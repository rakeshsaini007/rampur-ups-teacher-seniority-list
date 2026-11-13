import { SeniorityResponse, TeacherRecord } from '../types';

export interface ParsedDateResult {
  valid: boolean;
  display: string;
  iso: string;
  timestamp: number | null;
  year: number | null;
}

const DISQUALIFIED_TET_VALUES = new Set([
  'NA',
  'N.A.',
  'N.A',
  'N/A',
  'NIL',
  'NONE',
  'NO',
  '-',
  '--',
  '---',
  '0',
  'FALSE',
  'FAIL',
  'FAILED',
  'NOTPASSED',
  'UNQUALIFIED',
  'APPEARING',
  'NULL',
]);

export function isUpsTetPassed(rawValue: string | number | null | undefined): boolean {
  if (rawValue === null || rawValue === undefined) return false;
  const cleaned = String(rawValue).trim();
  if (!cleaned) return false;
  const normalized = cleaned.toUpperCase().replace(/\s+/g, '');
  return !DISQUALIFIED_TET_VALUES.has(normalized);
}

export function parseDateString(rawVal: string | number | null | undefined): ParsedDateResult {
  if (rawVal === null || rawVal === undefined) {
    return { valid: false, display: '', iso: '', timestamp: null, year: null };
  }
  const str = String(rawVal).trim();
  if (!str) {
    return { valid: false, display: '', iso: '', timestamp: null, year: null };
  }

  // DD.MM.YYYY or DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) {
      year += year >= 40 ? 1900 : 2000;
    }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const check = new Date(Date.UTC(year, month - 1, day));
      if (
        check.getUTCFullYear() === year &&
        check.getUTCMonth() === month - 1 &&
        check.getUTCDate() === day
      ) {
        const paddedM = String(month).padStart(2, '0');
        const paddedD = String(day).padStart(2, '0');
        return {
          valid: true,
          display: `${paddedD}.${paddedM}.${year}`,
          iso: `${year}-${paddedM}-${paddedD}`,
          timestamp: Date.UTC(year, month - 1, day),
          year,
        };
      }
    }
  }

  // YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10);
    const day = parseInt(ymdMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const paddedM = String(month).padStart(2, '0');
      const paddedD = String(day).padStart(2, '0');
      return {
        valid: true,
        display: `${paddedD}.${paddedM}.${year}`,
        iso: `${year}-${paddedM}-${paddedD}`,
        timestamp: Date.UTC(year, month - 1, day),
        year,
      };
    }
  }

  return { valid: false, display: str, iso: '', timestamp: null, year: null };
}

export function sortSeniorityRecords(records: TeacherRecord[]): TeacherRecord[] {
  const copy = [...records];
  copy.sort((a, b) => {
    const aHasJoin = a.joiningDateTimestamp !== null && a.joiningDateTimestamp !== undefined;
    const bHasJoin = b.joiningDateTimestamp !== null && b.joiningDateTimestamp !== undefined;
    if (aHasJoin && !bHasJoin) return -1;
    if (!aHasJoin && bHasJoin) return 1;

    if (
      aHasJoin &&
      bHasJoin &&
      a.joiningDateTimestamp !== b.joiningDateTimestamp
    ) {
      return (a.joiningDateTimestamp as number) - (b.joiningDateTimestamp as number);
    }

    const aHasDob = a.dobTimestamp !== null && a.dobTimestamp !== undefined;
    const bHasDob = b.dobTimestamp !== null && b.dobTimestamp !== undefined;
    if (aHasDob && !bHasDob) return -1;
    if (!aHasDob && bHasDob) return 1;

    if (aHasDob && bHasDob && a.dobTimestamp !== b.dobTimestamp) {
      return (a.dobTimestamp as number) - (b.dobTimestamp as number);
    }

    const nameCmp = (a.teacherName || '').localeCompare(b.teacherName || '');
    if (nameCmp !== 0) return nameCmp;

    return (a.ehrmsCode || '').localeCompare(b.ehrmsCode || '');
  });

  return copy.map((rec, idx) => ({
    ...rec,
    seniorityRank: idx + 1,
  }));
}

/**
 * Parses a CSV or TSV exported from Google Sheets and computes the Seniority List
 * using the exact same rules as code.js.
 */
export function parseDelimitedSheetText(
  content: string,
  fileName: string
): SeniorityResponse {
  const firstLine = content.split(/\r?\n/)[0] || '';
  const delimiter = firstLine.includes('\t') ? '\t' : ',';
  const rows = parseDelimitedRows(content, delimiter);

  if (rows.length < 2) {
    throw new Error('The uploaded file does not contain header and data rows.');
  }

  const headers = rows[0].map((h) => h.trim());
  const findCol = (patterns: string[], fallback: number): number => {
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i].toLowerCase().replace(/\s+/g, ' ');
      for (const pat of patterns) {
        if (h.includes(pat.toLowerCase())) return i;
      }
    }
    return fallback < headers.length ? fallback : -1;
  };

  const colMap = {
    sno: findCol(['s.no', 'क्र०सं०', 'serial'], 0),
    teacherName: findCol(['teacher name', 'अध्यापक का नाम'], 1),
    designation: findCol(['designation', 'पदनाम'], 2),
    ehrmsCode: findCol(['ehrms'], 3),
    schoolName: findCol(['school name', 'विद्यालय का नाम'], 4),
    appointmentType: findCol(['appointment type', 'नियुक्ति का प्रकार'], 5),
    firstDistrict: findCol(['first appointment district', 'प्रथम नियुक्ति वाले जनपद'], 6),
    dob: findCol(['date of birth', 'जन्म तिथि'], 7),
    orderDate: findCol(['first appointment order date', 'आदेश तिथि'], 8),
    joiningDateRampur: findCol(['first joining date in rampur', 'प्रथम बार कार्यभार ग्रहण'], 9),
    trainingType: findCol(['training type', 'प्रशिक्षण का प्रकार'], 10),
    postingType: findCol(['posting type', 'तैनाती का प्रकार'], 11),
    graduationSubjects: findCol(['graduation subjects', 'स्नातक के विषय'], 12),
    tetPs: findCol(['tet passing year - ps', 'उत्तीर्ण वर्ष - ps'], 13),
    tetUps: findCol(['tet passing year - ups', 'उत्तीर्ण वर्ष - ups'], 14),
    remarks: findCol(['pending disciplinary', 'legal action', 'अभियुक्ति'], 15),
    block: findCol(['block'], 16),
  };

  const getCell = (row: string[], idx: number) =>
    idx >= 0 && idx < row.length ? (row[idx] || '').trim() : '';

  const eligible: TeacherRecord[] = [];
  const excluded: TeacherRecord[] = [];
  const blockSet = new Set<string>();
  const designationSet = new Set<string>();
  let totalRows = 0;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.every((c) => !c.trim())) continue;
    totalRows++;

    const teacherName = getCell(row, colMap.teacherName);
    const designation = getCell(row, colMap.designation);
    const ehrmsCode = getCell(row, colMap.ehrmsCode);
    const schoolName = getCell(row, colMap.schoolName);
    const appointmentType = getCell(row, colMap.appointmentType);
    const firstDistrict = getCell(row, colMap.firstDistrict);
    const dobParsed = parseDateString(getCell(row, colMap.dob));
    const orderDateParsed = parseDateString(getCell(row, colMap.orderDate));
    const joiningDateParsed = parseDateString(getCell(row, colMap.joiningDateRampur));
    const trainingType = getCell(row, colMap.trainingType);
    const postingType = getCell(row, colMap.postingType);
    const graduationSubjects = getCell(row, colMap.graduationSubjects);
    const tetPs = getCell(row, colMap.tetPs);
    const tetUps = getCell(row, colMap.tetUps);
    const remarks = getCell(row, colMap.remarks);
    const block = getCell(row, colMap.block);
    const originalSno = getCell(row, colMap.sno) || String(r);

    if (block) blockSet.add(block);
    if (designation) designationSet.add(designation);

    const warnings: string[] = [];
    if (!joiningDateParsed.valid) {
      warnings.push('Missing or invalid First Joining Date in Rampur');
    }
    if (!dobParsed.valid) {
      warnings.push('Missing or invalid Date of Birth');
    } else if (dobParsed.year && (dobParsed.year > 2010 || dobParsed.year < 1940)) {
      warnings.push(`Verify DOB year (${dobParsed.year})`);
    }
    if (
      joiningDateParsed.valid &&
      dobParsed.valid &&
      joiningDateParsed.timestamp !== null &&
      dobParsed.timestamp !== null &&
      joiningDateParsed.timestamp <= dobParsed.timestamp
    ) {
      warnings.push('Joining date is before or equal to DOB');
    }

    const record: TeacherRecord = {
      originalSno,
      sheetRowNumber: r + 1,
      teacherName,
      designation,
      ehrmsCode,
      schoolName,
      appointmentType,
      firstDistrict,
      dob: dobParsed.display,
      dobIso: dobParsed.iso,
      dobTimestamp: dobParsed.timestamp,
      orderDate: orderDateParsed.display,
      orderDateIso: orderDateParsed.iso,
      joiningDateRampur: joiningDateParsed.display,
      joiningDateIso: joiningDateParsed.iso,
      joiningDateTimestamp: joiningDateParsed.timestamp,
      trainingType,
      postingType,
      graduationSubjects,
      tetPs,
      tetUps,
      remarks,
      block,
      warnings,
    };

    if (!teacherName) {
      record.exclusionReason = 'Missing Teacher Name';
      excluded.push(record);
      continue;
    }

    if (!isUpsTetPassed(tetUps)) {
      record.exclusionReason = tetUps
        ? `UPS TET marked '${tetUps}' (Not Passed)`
        : 'UPS TET Passing Year is blank';
      excluded.push(record);
      continue;
    }

    eligible.push(record);
  }

  const sorted = sortSeniorityRecords(eligible);

  return {
    status: 'ok',
    generatedAt: new Date().toISOString(),
    spreadsheetName: fileName,
    sheetName: 'Imported CSV/TSV',
    totalRows,
    eligibleCount: sorted.length,
    excludedCount: excluded.length,
    seniorityList: sorted,
    excludedList: excluded,
    blocks: Array.from(blockSet).sort(),
    designations: Array.from(designationSet).sort(),
    sourceMode: 'csv-upload',
  };
}

function parseDelimitedRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows;
}

export function exportSeniorityCsv(records: TeacherRecord[], filename: string): void {
  const headers = [
    'Seniority Rank',
    'Original S.No.',
    'Teacher Name',
    'Designation',
    'EHRMS Code',
    'School Name',
    'Block',
    'First Joining Date in Rampur',
    'Date of Birth',
    'TET Passing Year - UPS',
    'TET Passing Year - PS',
    'Appointment Type in Rampur',
    'First Appointment District',
    'First Appointment Order Date',
    'Training Type',
    'Posting Type in Current Grade',
    'Graduation Subjects',
    'Pending Disciplinary/Legal Action/Remarks',
    'Verification Warnings',
  ];

  const escapeCsv = (val: string | number | undefined) => {
    const s = val === undefined || val === null ? '' : String(val);
    if (s.includes('"') || s.includes(',') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines = [headers.map(escapeCsv).join(',')];
  for (const r of records) {
    lines.push(
      [
        r.seniorityRank ?? '',
        r.originalSno,
        r.teacherName,
        r.designation,
        r.ehrmsCode,
        r.schoolName,
        r.block,
        r.joiningDateRampur,
        r.dob,
        r.tetUps,
        r.tetPs,
        r.appointmentType,
        r.firstDistrict,
        r.orderDate,
        r.trainingType,
        r.postingType,
        r.graduationSubjects,
        r.remarks,
        r.warnings.join('; '),
      ]
        .map(escapeCsv)
        .join(',')
    );
  }

  const blob = new Blob(['\uFEFF' + lines.join('\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
