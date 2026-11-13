/**
 * Google Apps Script (code.js) — Rampur Teacher Seniority List Generator
 *
 * HOW TO DEPLOY:
 * 1. Open your Google Sheet containing the teacher records.
 * 2. Go to Extensions -> Apps Script.
 * 3. Delete any default code in Code.gs and paste the entire contents of this file (code.js).
 * 4. (Optional) If your data is on a specific tab, set SHEET_NAME below. Leave "" to use the first tab.
 * 5. Click Deploy -> New deployment -> Select type: Web app.
 * 6. Set "Execute as": Me, and "Who has access": Anyone.
 * 7. Click Deploy, authorize permissions, and copy the Web App URL (ending in /exec).
 * 8. Paste that URL into src/config.ts in your web app.
 */

// Optional: Leave "" to automatically read the first sheet tab,
// or enter the exact tab name (e.g., "Sheet1" or "Master Data").
var SHEET_NAME = "";

// Optional: Only needed if you create a standalone script outside the Google Sheet.
// Leave "" when created via Extensions -> Apps Script inside your Google Sheet.
var SPREADSHEET_ID = "";

/**
 * Adds a custom menu inside the Google Sheet for one-click tab generation.
 */
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu("Seniority Register")
      .addItem("Generate UPS TET Seniority Sheet", "generateSenioritySheetTab")
      .addToUi();
  } catch (err) {
    // Ignore when executed in Web App context without UI
  }
}

/**
 * HTTP GET endpoint for the Web Application.
 * Returns JSON containing the computed Seniority List, Excluded Candidates, and metadata.
 * Optional query param: ?action=writeSheet (also writes the Seniority List tab into the Google Sheet).
 */
function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) ? String(e.parameter.action) : "get";
    var result = computeSeniorityData();

    if (action === "writeSheet") {
      var writtenTab = writeSeniorityTabInternal(result);
      result.writtenTabName = writtenTab;
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    var errPayload = {
      status: "error",
      message: error && error.message ? error.message : String(error)
    };
    return ContentService
      .createTextOutput(JSON.stringify(errPayload))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Generates or updates a "Seniority_List_UPS_TET" tab directly inside the Google Sheet.
 */
function generateSenioritySheetTab() {
  var result = computeSeniorityData();
  var tabName = writeSeniorityTabInternal(result);
  try {
    SpreadsheetApp.getUi().alert(
      "Seniority List generated in tab '" + tabName + "' with " +
      result.eligibleCount + " UPS TET passed teachers."
    );
  } catch (err) {
    // No UI context
  }
  return tabName;
}

/**
 * Core processor: reads Google Sheet rows, filters UPS TET passed candidates,
 * and sorts by (1) First Joining Date in Rampur ASC, (2) Date of Birth ASC.
 */
function computeSeniorityData() {
  var ss = SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();

  if (!ss) {
    throw new Error("Could not access Spreadsheet. Attach this script to your Google Sheet or set SPREADSHEET_ID.");
  }

  var sheet = SHEET_NAME ? ss.getSheetByName(SHEET_NAME) : ss.getSheets()[0];
  if (!sheet) {
    throw new Error("Sheet tab not found: " + (SHEET_NAME || "First Sheet"));
  }

  var timeZone = ss.getSpreadsheetTimeZone() || Session.getScriptTimeZone() || "Asia/Kolkata";
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow < 2 || lastCol < 1) {
    return {
      status: "ok",
      generatedAt: new Date().toISOString(),
      spreadsheetName: ss.getName(),
      sheetName: sheet.getName(),
      totalRows: 0,
      eligibleCount: 0,
      excludedCount: 0,
      seniorityList: [],
      excludedList: [],
      blocks: [],
      designations: []
    };
  }

  var rawValues = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = rawValues[0].map(function (h) {
    return String(h || "").trim();
  });

  var colMap = resolveColumnMap(headers);
  var eligible = [];
  var excluded = [];
  var blockSet = {};
  var designationSet = {};
  var totalDataRows = 0;

  for (var r = 1; r < rawValues.length; r++) {
    var row = rawValues[r];
    if (isRowCompletelyEmpty(row)) {
      continue;
    }

    totalDataRows++;

    var teacherName = getCellString(row, colMap.teacherName);
    var designation = getCellString(row, colMap.designation);
    var ehrmsCode = getCellString(row, colMap.ehrmsCode);
    var schoolName = getCellString(row, colMap.schoolName);
    var appointmentType = getCellString(row, colMap.appointmentType);
    var firstDistrict = getCellString(row, colMap.firstDistrict);
    var dobParsed = parseSheetDate(row[colMap.dob], timeZone);
    var orderDateParsed = parseSheetDate(row[colMap.orderDate], timeZone);
    var joiningDateParsed = parseSheetDate(row[colMap.joiningDateRampur], timeZone);
    var trainingType = getCellString(row, colMap.trainingType);
    var postingType = getCellString(row, colMap.postingType);
    var graduationSubjects = getCellString(row, colMap.graduationSubjects);
    var tetPs = getCellString(row, colMap.tetPs);
    var tetUps = getCellString(row, colMap.tetUps);
    var remarks = getCellString(row, colMap.remarks);
    var block = getCellString(row, colMap.block);
    var originalSno = getCellString(row, colMap.sno) || String(r);

    if (block) {
      blockSet[block] = true;
    }
    if (designation) {
      designationSet[designation] = true;
    }

    var warnings = [];
    if (!joiningDateParsed.valid) {
      warnings.push("Missing or invalid First Joining Date in Rampur");
    }
    if (!dobParsed.valid) {
      warnings.push("Missing or invalid Date of Birth");
    } else if (dobParsed.year > 2010 || dobParsed.year < 1940) {
      warnings.push("Verify DOB year (" + dobParsed.year + ")");
    }
    if (joiningDateParsed.valid && dobParsed.valid && joiningDateParsed.timestamp <= dobParsed.timestamp) {
      warnings.push("Joining date is before or equal to DOB");
    }

    var record = {
      originalSno: originalSno,
      sheetRowNumber: r + 1,
      teacherName: teacherName,
      designation: designation,
      ehrmsCode: ehrmsCode,
      schoolName: schoolName,
      appointmentType: appointmentType,
      firstDistrict: firstDistrict,
      dob: dobParsed.display,
      dobIso: dobParsed.iso,
      dobTimestamp: dobParsed.timestamp,
      orderDate: orderDateParsed.display,
      orderDateIso: orderDateParsed.iso,
      joiningDateRampur: joiningDateParsed.display,
      joiningDateIso: joiningDateParsed.iso,
      joiningDateTimestamp: joiningDateParsed.timestamp,
      trainingType: trainingType,
      postingType: postingType,
      graduationSubjects: graduationSubjects,
      tetPs: tetPs,
      tetUps: tetUps,
      remarks: remarks,
      block: block,
      warnings: warnings
    };

    if (!teacherName) {
      record.exclusionReason = "Missing Teacher Name";
      excluded.push(record);
      continue;
    }

    // Criterion 1: Only UPS TET passed candidates are taken
    if (!isUpsTetPassed(tetUps)) {
      record.exclusionReason = tetUps
        ? "UPS TET marked '" + tetUps + "' (Not Passed)"
        : "UPS TET Passing Year is blank";
      excluded.push(record);
      continue;
    }

    eligible.push(record);
  }

  // Criteria 2 & 3:
  // Sort by First Joining Date in Rampur (ascending) -> earliest date is Rank 1.
  // Tie-breaker: Date of Birth (ascending) -> earlier birth date (older candidate) ranks higher.
  eligible.sort(function (a, b) {
    var aHasJoin = a.joiningDateTimestamp !== null;
    var bHasJoin = b.joiningDateTimestamp !== null;
    if (aHasJoin && !bHasJoin) return -1;
    if (!aHasJoin && bHasJoin) return 1;

    if (aHasJoin && bHasJoin && a.joiningDateTimestamp !== b.joiningDateTimestamp) {
      return a.joiningDateTimestamp - b.joiningDateTimestamp;
    }

    var aHasDob = a.dobTimestamp !== null;
    var bHasDob = b.dobTimestamp !== null;
    if (aHasDob && !bHasDob) return -1;
    if (!aHasDob && bHasDob) return 1;

    if (aHasDob && bHasDob && a.dobTimestamp !== b.dobTimestamp) {
      return a.dobTimestamp - b.dobTimestamp;
    }

    var nameCmp = (a.teacherName || "").localeCompare(b.teacherName || "");
    if (nameCmp !== 0) return nameCmp;

    return (a.ehrmsCode || "").localeCompare(b.ehrmsCode || "");
  });

  // Assign Seniority Rank (1..N)
  for (var i = 0; i < eligible.length; i++) {
    eligible[i].seniorityRank = i + 1;
  }

  return {
    status: "ok",
    generatedAt: new Date().toISOString(),
    spreadsheetName: ss.getName(),
    sheetName: sheet.getName(),
    totalRows: totalDataRows,
    eligibleCount: eligible.length,
    excludedCount: excluded.length,
    seniorityList: eligible,
    excludedList: excluded,
    blocks: Object.keys(blockSet).sort(),
    designations: Object.keys(designationSet).sort()
  };
}

/**
 * Resolves column indices by matching English & Hindi header text,
 * falling back to the standard 17-column layout.
 */
function resolveColumnMap(headers) {
  function findCol(patterns, fallbackIdx) {
    for (var i = 0; i < headers.length; i++) {
      var h = headers[i].toLowerCase().replace(/\s+/g, " ");
      for (var p = 0; p < patterns.length; p++) {
        if (h.indexOf(patterns[p].toLowerCase()) !== -1) {
          return i;
        }
      }
    }
    return fallbackIdx < headers.length ? fallbackIdx : -1;
  }

  return {
    sno: findCol(["s.no", "क्र०सं०", "serial"], 0),
    teacherName: findCol(["teacher name", "अध्यापक का नाम"], 1),
    designation: findCol(["designation", "पदनाम"], 2),
    ehrmsCode: findCol(["ehrms"], 3),
    schoolName: findCol(["school name", "विद्यालय का नाम"], 4),
    appointmentType: findCol(["appointment type", "नियुक्ति का प्रकार"], 5),
    firstDistrict: findCol(["first appointment district", "प्रथम नियुक्ति वाले जनपद"], 6),
    dob: findCol(["date of birth", "जन्म तिथि"], 7),
    orderDate: findCol(["first appointment order date", "आदेश तिथि"], 8),
    joiningDateRampur: findCol(["first joining date in rampur", "प्रथम बार कार्यभार ग्रहण"], 9),
    trainingType: findCol(["training type", "प्रशिक्षण का प्रकार"], 10),
    postingType: findCol(["posting type", "तैनाती का प्रकार"], 11),
    graduationSubjects: findCol(["graduation subjects", "स्नातक के विषय"], 12),
    tetPs: findCol(["tet passing year - ps", "उत्तीर्ण वर्ष - ps"], 13),
    tetUps: findCol(["tet passing year - ups", "उत्तीर्ण वर्ष - ups"], 14),
    remarks: findCol(["pending disciplinary", "legal action", "अभियुक्ति"], 15),
    block: findCol(["block"], 16)
  };
}

function getCellString(row, idx) {
  if (idx < 0 || idx >= row.length) return "";
  var val = row[idx];
  if (val === null || val === undefined) return "";
  return String(val).trim();
}

function isRowCompletelyEmpty(row) {
  for (var i = 0; i < row.length; i++) {
    if (row[i] !== null && row[i] !== undefined && String(row[i]).trim() !== "") {
      return false;
    }
  }
  return true;
}

/**
 * Checks whether the TET Passing Year - UPS cell represents a passed candidate.
 * Rejects blank, NA, N.A., N/A, NIL, NONE, NO, -, 0, FAIL, NOT PASSED, APPEARING.
 */
function isUpsTetPassed(rawValue) {
  if (rawValue === null || rawValue === undefined) return false;
  var cleaned = String(rawValue).trim();
  if (!cleaned) return false;

  var normalized = cleaned.toUpperCase().replace(/\s+/g, "");
  var disqualified = [
    "NA", "N.A.", "N.A", "N/A", "NIL", "NONE", "NO", "-", "--", "---",
    "0", "FALSE", "FAIL", "FAILED", "NOTPASSED", "UNQUALIFIED", "APPEARING", "NULL"
  ];
  for (var i = 0; i < disqualified.length; i++) {
    if (normalized === disqualified[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Parses Google Sheet native Date objects or DD.MM.YYYY / DD/MM/YYYY / DD-MM-YYYY strings.
 */
function parseSheetDate(rawVal, timeZone) {
  if (rawVal === null || rawVal === undefined || rawVal === "") {
    return { valid: false, display: "", iso: "", timestamp: null, year: null };
  }

  if (Object.prototype.toString.call(rawVal) === "[object Date]" && !isNaN(rawVal.getTime())) {
    var isoStr = Utilities.formatDate(rawVal, timeZone, "yyyy-MM-dd");
    var dispStr = Utilities.formatDate(rawVal, timeZone, "dd.MM.yyyy");
    var parts = isoStr.split("-");
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    var d = parseInt(parts[2], 10);
    return {
      valid: true,
      display: dispStr,
      iso: isoStr,
      timestamp: Date.UTC(y, m - 1, d),
      year: y
    };
  }

  var str = String(rawVal).trim();
  // Match DD.MM.YYYY or DD/MM/YYYY or DD-MM-YYYY
  var dmyMatch = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (dmyMatch) {
    var day = parseInt(dmyMatch[1], 10);
    var month = parseInt(dmyMatch[2], 10);
    var year = parseInt(dmyMatch[3], 10);
    if (year < 100) {
      year += year >= 40 ? 1900 : 2000;
    }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      var check = new Date(Date.UTC(year, month - 1, day));
      if (
        check.getUTCFullYear() === year &&
        check.getUTCMonth() === month - 1 &&
        check.getUTCDate() === day
      ) {
        var paddedM = month < 10 ? "0" + month : String(month);
        var paddedD = day < 10 ? "0" + day : String(day);
        return {
          valid: true,
          display: paddedD + "." + paddedM + "." + year,
          iso: year + "-" + paddedM + "-" + paddedD,
          timestamp: Date.UTC(year, month - 1, day),
          year: year
        };
      }
    }
  }

  // Match YYYY-MM-DD
  var ymdMatch = str.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (ymdMatch) {
    var yr = parseInt(ymdMatch[1], 10);
    var mo = parseInt(ymdMatch[2], 10);
    var dy = parseInt(ymdMatch[3], 10);
    if (mo >= 1 && mo <= 12 && dy >= 1 && dy <= 31) {
      var pM = mo < 10 ? "0" + mo : String(mo);
      var pD = dy < 10 ? "0" + dy : String(dy);
      return {
        valid: true,
        display: pD + "." + pM + "." + yr,
        iso: yr + "-" + pM + "-" + pD,
        timestamp: Date.UTC(yr, mo - 1, dy),
        year: yr
      };
    }
  }

  return { valid: false, display: str, iso: "", timestamp: null, year: null };
}

/**
 * Writes the sorted UPS TET Seniority List to a dedicated tab in the Google Sheet.
 */
function writeSeniorityTabInternal(result) {
  var ss = SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();

  var targetName = "Seniority_List_UPS_TET";
  var targetSheet = ss.getSheetByName(targetName);
  if (!targetSheet) {
    targetSheet = ss.insertSheet(targetName);
  } else {
    targetSheet.clear();
  }

  var headerRow = [
    "Seniority Rank",
    "Original S.No.",
    "Teacher Name",
    "Designation",
    "EHRMS Code",
    "School Name",
    "Block",
    "First Joining Date in Rampur",
    "Date of Birth",
    "TET Passing Year - UPS",
    "TET Passing Year - PS",
    "Appointment Type in Rampur",
    "First Appointment District",
    "First Appointment Order Date",
    "Training Type",
    "Posting Type in Current Grade",
    "Graduation Subjects",
    "Pending Disciplinary/Legal Action/Remarks"
  ];

  var rows = [headerRow];
  for (var i = 0; i < result.seniorityList.length; i++) {
    var item = result.seniorityList[i];
    rows.push([
      item.seniorityRank,
      item.originalSno,
      item.teacherName,
      item.designation,
      item.ehrmsCode,
      item.schoolName,
      item.block,
      item.joiningDateRampur,
      item.dob,
      item.tetUps,
      item.tetPs,
      item.appointmentType,
      item.firstDistrict,
      item.orderDate,
      item.trainingType,
      item.postingType,
      item.graduationSubjects,
      item.remarks
    ]);
  }

  targetSheet.getRange(1, 1, rows.length, headerRow.length).setValues(rows);
  targetSheet.getRange(1, 1, 1, headerRow.length)
    .setBackground("#1E3A8A")
    .setFontColor("#FFFFFF")
    .setFontWeight("bold");
  targetSheet.setFrozenRows(1);

  return targetName;
}
