export interface TeacherRecord {
  seniorityRank?: number;
  originalSno: string;
  sheetRowNumber: number;
  teacherName: string;
  designation: string;
  ehrmsCode: string;
  schoolName: string;
  appointmentType: string;
  firstDistrict: string;
  dob: string;
  dobIso: string;
  dobTimestamp: number | null;
  orderDate: string;
  orderDateIso: string;
  joiningDateRampur: string;
  joiningDateIso: string;
  joiningDateTimestamp: number | null;
  trainingType: string;
  postingType: string;
  graduationSubjects: string;
  tetPs: string;
  tetUps: string;
  remarks: string;
  block: string;
  warnings: string[];
  exclusionReason?: string;
}

export interface SeniorityResponse {
  status: 'ok' | 'error';
  message?: string;
  generatedAt: string;
  spreadsheetName: string;
  sheetName: string;
  totalRows: number;
  eligibleCount: number;
  excludedCount: number;
  seniorityList: TeacherRecord[];
  excludedList: TeacherRecord[];
  blocks: string[];
  designations: string[];
  writtenTabName?: string;
  sourceMode?: 'apps-script' | 'csv-upload';
}
