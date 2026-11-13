import { AlertTriangle, CheckCircle2, X, XCircle } from 'lucide-react';
import { TeacherRecord } from '../types';

interface TeacherDetailModalProps {
  record: TeacherRecord | null;
  onClose: () => void;
}

export function TeacherDetailModal({ record, onClose }: TeacherDetailModalProps) {
  if (!record) return null;

  const isExcluded = Boolean(record.exclusionReason);

  const fields: { label: string; value: string; mono?: boolean }[] = [
    { label: 'Original Sheet S.No.', value: record.originalSno || '—', mono: true },
    { label: 'Sheet Row Number', value: String(record.sheetRowNumber), mono: true },
    { label: 'EHRMS Code', value: record.ehrmsCode || '—', mono: true },
    { label: 'Designation', value: record.designation || '—' },
    { label: 'School Name', value: record.schoolName || '—' },
    { label: 'Block', value: record.block || '—' },
    { label: 'First Joining Date in Rampur', value: record.joiningDateRampur || '—', mono: true },
    { label: 'Date of Birth', value: record.dob || '—', mono: true },
    { label: 'First Appointment Order Date', value: record.orderDate || '—', mono: true },
    { label: 'Appointment Type in Rampur', value: record.appointmentType || '—' },
    { label: 'First Appointment District', value: record.firstDistrict || '—' },
    { label: 'TET Passing Year - UPS', value: record.tetUps || 'Not Passed / Blank', mono: true },
    { label: 'TET Passing Year - PS', value: record.tetPs || '—', mono: true },
    { label: 'Training Type', value: record.trainingType || '—' },
    { label: 'Posting Type in Current Grade', value: record.postingType || '—' },
    { label: 'Graduation Subjects', value: record.graduationSubjects || '—' },
    { label: 'Disciplinary / Legal Remarks', value: record.remarks || 'None' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="teacher-detail-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-600 mb-1">
              {isExcluded ? (
                <span className="inline-flex items-center gap-1.5 text-red-700 font-medium">
                  <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                  Excluded from Seniority List
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                  Seniority Rank #{record.seniorityRank}
                </span>
              )}
              <span aria-hidden="true">·</span>
              <span className="font-mono">EHRMS {record.ehrmsCode || 'N/A'}</span>
            </div>
            <h2
              id="teacher-detail-title"
              className="text-lg font-bold text-slate-900 leading-snug"
            >
              {record.teacherName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 rounded-md transition-colors"
            aria-label="Close record details"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {record.exclusionReason && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-800 flex items-center gap-2">
              <XCircle className="w-4 h-4 shrink-0 text-red-600" aria-hidden="true" />
              <span>
                <strong>Exclusion Reason:</strong> {record.exclusionReason}
              </span>
            </div>
          )}

          {record.warnings.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-900 space-y-1">
              {record.warnings.map((w, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" aria-hidden="true" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            {fields.map((f) => (
              <div key={f.label} className="border-b border-slate-100 pb-2">
                <dt className="text-xs text-slate-500">{f.label}</dt>
                <dd
                  className={`mt-0.5 text-sm font-medium ${
                    f.label === 'Disciplinary / Legal Remarks' && record.remarks
                      ? 'text-red-700'
                      : 'text-slate-900'
                  } ${f.mono ? 'font-mono' : ''}`}
                >
                  {f.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
