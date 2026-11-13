import { AlertTriangle, Eye } from 'lucide-react';
import { TeacherRecord } from '../types';

interface SeniorityTableProps {
  records: TeacherRecord[];
  mode: 'eligible' | 'excluded';
  onSelectRecord: (record: TeacherRecord) => void;
}

export function SeniorityTable({
  records,
  mode,
  onSelectRecord,
}: SeniorityTableProps) {
  if (records.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-10 text-center">
        <p className="text-sm font-medium text-slate-900">
          {mode === 'eligible'
            ? 'No UPS TET passed candidates match the active filters.'
            : 'No excluded candidates match the active filters.'}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Try clearing your Block, Designation, or Search filters above.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#1E3A8A] text-white text-xs font-semibold">
              {mode === 'eligible' ? (
                <th className="py-3 px-3 text-right whitespace-nowrap w-16">
                  Rank
                </th>
              ) : (
                <th className="py-3 px-3 text-right whitespace-nowrap w-16">
                  Row
                </th>
              )}
              <th className="py-3 px-3 text-right whitespace-nowrap w-16">
                S.No.
              </th>
              <th className="py-3 px-3 whitespace-nowrap min-w-[180px]">
                Teacher Name
              </th>
              <th className="py-3 px-3 whitespace-nowrap">Designation</th>
              <th className="py-3 px-3 whitespace-nowrap">EHRMS Code</th>
              <th className="py-3 px-3 whitespace-nowrap min-w-[220px]">
                School Name
              </th>
              <th className="py-3 px-3 whitespace-nowrap">Block</th>
              <th className="py-3 px-3 whitespace-nowrap">
                First Joining (Rampur)
              </th>
              <th className="py-3 px-3 whitespace-nowrap">Date of Birth</th>
              <th className="py-3 px-3 whitespace-nowrap">UPS TET</th>
              <th className="py-3 px-3 whitespace-nowrap">
                {mode === 'eligible' ? 'Remarks / Status' : 'Exclusion Reason'}
              </th>
              <th className="py-3 px-3 text-center whitespace-nowrap no-print">
                Details
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-[13px] text-slate-800">
            {records.map((rec, idx) => {
              const hasRemarks = Boolean(rec.remarks);
              const hasWarnings = rec.warnings && rec.warnings.length > 0;
              return (
                <tr
                  key={`${rec.sheetRowNumber}-${rec.ehrmsCode}-${idx}`}
                  onClick={() => onSelectRecord(rec)}
                  className="hover:bg-slate-50/90 transition-colors cursor-pointer"
                >
                  {mode === 'eligible' ? (
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">
                      {rec.seniorityRank}
                    </td>
                  ) : (
                    <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                      {rec.sheetRowNumber}
                    </td>
                  )}
                  <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                    {rec.originalSno || '—'}
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-slate-900">
                    <div className="flex items-center gap-1.5">
                      <span>{rec.teacherName || '—'}</span>
                      {hasWarnings && (
                        <span
                          title={rec.warnings.join('; ')}
                          className="text-amber-600 inline-flex items-center shrink-0"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap text-slate-700">
                    {rec.designation || '—'}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-700 whitespace-nowrap">
                    {rec.ehrmsCode || '—'}
                  </td>
                  <td className="py-2.5 px-3 text-slate-700 max-w-[260px] truncate" title={rec.schoolName}>
                    {rec.schoolName || '—'}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap text-slate-700">
                    {rec.block || '—'}
                  </td>
                  <td
                    className={`py-2.5 px-3 font-mono whitespace-nowrap ${
                      mode === 'eligible'
                        ? 'font-semibold text-[#1E3A8A]'
                        : 'text-slate-600'
                    }`}
                  >
                    {rec.joiningDateRampur || (
                      <span className="text-amber-700 font-sans text-xs">
                        Missing
                      </span>
                    )}
                  </td>
                  <td
                    className={`py-2.5 px-3 font-mono whitespace-nowrap ${
                      hasWarnings &&
                      rec.warnings.some((w) => w.includes('DOB'))
                        ? 'text-amber-700 font-semibold'
                        : 'text-slate-800'
                    }`}
                  >
                    {rec.dob || (
                      <span className="text-amber-700 font-sans text-xs">
                        Missing
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                    {rec.tetUps ? (
                      <span
                        className={
                          mode === 'eligible'
                            ? 'text-emerald-700 font-semibold'
                            : 'text-slate-600'
                        }
                      >
                        {rec.tetUps}
                      </span>
                    ) : (
                      <span className="text-slate-400 font-sans text-xs">
                        Blank
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap text-xs">
                    {mode === 'eligible' ? (
                      hasRemarks ? (
                        <span className="text-red-700 font-semibold">
                          {rec.remarks}
                        </span>
                      ) : hasWarnings ? (
                        <span className="text-amber-700 font-medium">
                          {rec.warnings[0]}
                        </span>
                      ) : (
                        <span className="text-slate-500">Clear</span>
                      )
                    ) : (
                      <span className="text-red-700 font-medium">
                        {rec.exclusionReason}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center no-print">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectRecord(rec);
                      }}
                      className="inline-flex items-center justify-center p-1.5 text-slate-500 hover:text-[#1E3A8A] hover:bg-slate-100 rounded transition-colors"
                      aria-label={`View full details for ${rec.teacherName}`}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
