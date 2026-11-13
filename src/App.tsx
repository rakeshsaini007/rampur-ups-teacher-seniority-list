import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Download,
  FileDown,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Upload,
} from 'lucide-react';
import { AppsScriptGuide } from './components/AppsScriptGuide';
import { SeniorityTable } from './components/SeniorityTable';
import { TeacherDetailModal } from './components/TeacherDetailModal';
import { GOOGLE_APPS_SCRIPT_URL } from './config';
import { SeniorityResponse, TeacherRecord } from './types';
import { exportSeniorityPdf } from './utils/pdfExport';
import {
  exportSeniorityCsv,
  parseDelimitedSheetText,
  sortSeniorityRecords,
} from './utils/seniority';

type ActiveTab = 'seniority' | 'excluded' | 'setup';
type SeniorityMode = 'ups-tet' | 'all-teachers';
type RemarksFilter = 'all' | 'clean' | 'remarks' | 'date-warnings';

const PLACEHOLDER_URL = 'PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE';

function isValidConfiguredUrl(url: string): boolean {
  const trimmed = (url || '').trim();
  return (
    trimmed.length > 0 &&
    trimmed !== PLACEHOLDER_URL &&
    (trimmed.startsWith('https://') || trimmed.startsWith('http://'))
  );
}

export default function App() {
  const isConfiguredInFile = isValidConfiguredUrl(GOOGLE_APPS_SCRIPT_URL);

  const [activeTab, setActiveTab] = useState<ActiveTab>(
    isConfiguredInFile ? 'seniority' : 'setup'
  );
  const [seniorityMode, setSeniorityMode] = useState<SeniorityMode>('ups-tet');
  const [activeUrl, setActiveUrl] = useState<string>(
    isConfiguredInFile ? GOOGLE_APPS_SCRIPT_URL.trim() : ''
  );

  const [data, setData] = useState<SeniorityResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [blockFilter, setBlockFilter] = useState('all');
  const [designationFilter, setDesignationFilter] = useState('all');
  const [remarksFilter, setRemarksFilter] = useState<RemarksFilter>('all');

  // Detail modal
  const [selectedRecord, setSelectedRecord] = useState<TeacherRecord | null>(
    null
  );

  const fetchFromAppsScript = useCallback(
    async (targetUrl: string, writeSheetTab = false) => {
      const cleanUrl = targetUrl.trim();
      if (!isValidConfiguredUrl(cleanUrl)) {
        setError(
          'Please enter a valid Google Apps Script Web App URL (https://script.google.com/macros/s/.../exec) in src/config.ts.'
        );
        return;
      }

      setLoading(true);
      setError(null);
      setNotice(null);

      try {
        const requestUrl = writeSheetTab
          ? `${cleanUrl}${cleanUrl.includes('?') ? '&' : '?'}action=writeSheet`
          : cleanUrl;

        // Simple GET with no custom headers so Google Apps Script CORS redirect succeeds without preflight
        const res = await fetch(requestUrl, {
          method: 'GET',
          redirect: 'follow',
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status} ${res.statusText}`);
        }

        const json = (await res.json()) as SeniorityResponse;
        if (json.status === 'error') {
          throw new Error(json.message || 'Apps Script returned an error.');
        }

        const normalizedSeniority = sortSeniorityRecords(
          json.seniorityList || []
        );

        setData({
          ...json,
          seniorityList: normalizedSeniority,
          sourceMode: 'apps-script',
        });
        setActiveUrl(cleanUrl);

        if (writeSheetTab && json.writtenTabName) {
          setNotice(
            `Seniority list written to Google Sheet tab "${json.writtenTabName}".`
          );
        }

        if (activeTab === 'setup') {
          setActiveTab('seniority');
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Failed to fetch from Apps Script.';
        setError(
          `Could not load Google Sheet data: ${msg}. Verify your Web App deployment is set to "Execute as: Me" and "Who has access: Anyone".`
        );
      } finally {
        setLoading(false);
      }
    },
    [activeTab]
  );

  useEffect(() => {
    if (isConfiguredInFile) {
      fetchFromAppsScript(GOOGLE_APPS_SCRIPT_URL);
    }
    // Run once on initial mount when URL is hardcoded in src/config.ts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCsvLoaded = (content: string, fileName: string) => {
    setError(null);
    setNotice(null);
    try {
      const parsed = parseDelimitedSheetText(content, fileName);
      setData(parsed);
      setActiveTab('seniority');
      setNotice(
        `Loaded ${parsed.totalRows} rows from "${fileName}". Computed ${parsed.eligibleCount} UPS TET passed candidates.`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to parse CSV/TSV file.'
      );
    }
  };

  const handleQuickCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        handleCsvLoaded(reader.result, file.name);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const activeSenioritySource = useMemo(() => {
    if (!data) return [];
    if (seniorityMode === 'ups-tet') {
      return data.seniorityList;
    }
    const combined: TeacherRecord[] = [
      ...data.seniorityList,
      ...data.excludedList
        .filter((rec) => Boolean(rec.teacherName))
        .map((rec) => ({
          ...rec,
          exclusionReason: undefined,
        })),
    ];
    return sortSeniorityRecords(combined);
  }, [data, seniorityMode]);

  const filteredEligible = useMemo(() => {
    if (!data) return [];
    const q = searchQuery.trim().toLowerCase();
    return activeSenioritySource.filter((rec) => {
      if (blockFilter !== 'all' && rec.block !== blockFilter) return false;
      if (designationFilter !== 'all' && rec.designation !== designationFilter)
        return false;
      if (remarksFilter === 'clean' && rec.remarks) return false;
      if (remarksFilter === 'remarks' && !rec.remarks) return false;
      if (
        remarksFilter === 'date-warnings' &&
        (!rec.warnings || rec.warnings.length === 0)
      )
        return false;

      if (q) {
        const hay = `${rec.teacherName} ${rec.ehrmsCode} ${rec.schoolName} ${rec.block}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    data,
    activeSenioritySource,
    searchQuery,
    blockFilter,
    designationFilter,
    remarksFilter,
  ]);

  const filteredExcluded = useMemo(() => {
    if (!data) return [];
    const q = searchQuery.trim().toLowerCase();
    return data.excludedList.filter((rec) => {
      if (blockFilter !== 'all' && rec.block !== blockFilter) return false;
      if (designationFilter !== 'all' && rec.designation !== designationFilter)
        return false;

      if (q) {
        const hay = `${rec.teacherName} ${rec.ehrmsCode} ${rec.schoolName} ${rec.block} ${rec.exclusionReason || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data, searchQuery, blockFilter, designationFilter]);

  const activeDisplayedRecords =
    activeTab === 'excluded' ? filteredExcluded : filteredEligible;

  const actualRemarksCount = useMemo(() => {
    return activeDisplayedRecords.filter((r) => Boolean(r.remarks)).length;
  }, [activeDisplayedRecords]);

  const actualDateWarningsCount = useMemo(() => {
    return activeDisplayedRecords.filter(
      (r) => r.warnings && r.warnings.length > 0
    ).length;
  }, [activeDisplayedRecords]);

  const actualUniqueFlaggedCount = useMemo(() => {
    return activeDisplayedRecords.filter(
      (r) => Boolean(r.remarks) || (r.warnings && r.warnings.length > 0)
    ).length;
  }, [activeDisplayedRecords]);

  const handleExportCsv = () => {
    if (!activeDisplayedRecords.length) return;
    const dateStamp = new Date().toISOString().slice(0, 10);
    const prefix =
      activeTab === 'excluded'
        ? 'rampur_excluded_candidates'
        : seniorityMode === 'ups-tet'
        ? 'rampur_ups_tet_seniority'
        : 'rampur_all_teachers_seniority';
    exportSeniorityCsv(activeDisplayedRecords, `${prefix}_${dateStamp}.csv`);
  };

  const handleExportPdf = () => {
    if (!activeDisplayedRecords.length) return;
    const dateStamp = new Date().toISOString().slice(0, 10);
    const isExcluded = activeTab === 'excluded';
    const title = isExcluded
      ? 'District Rampur - Excluded Candidates Audit (Non-UPS TET)'
      : seniorityMode === 'ups-tet'
      ? 'District Rampur - UPS TET Passed Teachers Seniority List'
      : 'District Rampur - All Teachers Seniority List (Without UPS TET Criteria)';
    const subtitle = isExcluded
      ? `Excluded from UPS TET seniority list | Total Records: ${activeDisplayedRecords.length}`
      : seniorityMode === 'ups-tet'
      ? `Criteria: 1. UPS TET Passed Only | 2. First Joining Date in Rampur (Asc) | 3. Date of Birth (Asc) | Total: ${activeDisplayedRecords.length}`
      : `Criteria: 1. All Teachers (Without UPS TET Filter) | 2. First Joining Date in Rampur (Asc) | 3. Date of Birth (Asc) | Total: ${activeDisplayedRecords.length}`;
    const prefix = isExcluded
      ? 'rampur_excluded_candidates'
      : seniorityMode === 'ups-tet'
      ? 'rampur_ups_tet_seniority'
      : 'rampur_all_teachers_seniority';

    exportSeniorityPdf({
      records: activeDisplayedRecords,
      mode: isExcluded ? 'excluded' : 'eligible',
      title,
      subtitle,
      filename: `${prefix}_${dateStamp}.pdf`,
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 no-print">
        <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-element wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('seniority')}
            className="text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 text-left font-display"
          >
            Rampur Seniority Register
          </button>

          {/* Zone 2: Concise single-line nav links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <button
              type="button"
              onClick={() => {
                setActiveTab('seniority');
                setSeniorityMode('ups-tet');
              }}
              className={`py-1 whitespace-nowrap shrink-0 transition-colors border-b-2 ${
                activeTab === 'seniority' && seniorityMode === 'ups-tet'
                  ? 'border-[#1E3A8A] text-[#1E3A8A] font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Seniority (With UPS TET)
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('seniority');
                setSeniorityMode('all-teachers');
              }}
              className={`py-1 whitespace-nowrap shrink-0 transition-colors border-b-2 ${
                activeTab === 'seniority' && seniorityMode === 'all-teachers'
                  ? 'border-[#1E3A8A] text-[#1E3A8A] font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Seniority (Without UPS TET)
            </button>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center shrink-0">
            {activeUrl ? (
              <button
                type="button"
                disabled={loading}
                onClick={() => fetchFromAppsScript(activeUrl)}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#1E3A8A] hover:bg-[#1D4ED8] rounded-md transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                Sync Sheet
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveTab('setup')}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#1E3A8A] hover:bg-[#1D4ED8] rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                Connect Apps Script
              </button>
            )}
          </div>
        </div>

        {/* Mobile Nav Row */}
        <div className="md:hidden border-t border-slate-100 px-6 py-2 flex items-center gap-4 overflow-x-auto text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('seniority')}
            className={`whitespace-nowrap shrink-0 ${
              activeTab === 'seniority'
                ? 'text-[#1E3A8A] font-semibold'
                : 'text-slate-600'
            }`}
          >
            Seniority List
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('excluded')}
            className={`whitespace-nowrap shrink-0 ${
              activeTab === 'excluded'
                ? 'text-[#1E3A8A] font-semibold'
                : 'text-slate-600'
            }`}
          >
            Excluded Audit
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('setup')}
            className={`whitespace-nowrap shrink-0 ${
              activeTab === 'setup'
                ? 'text-[#1E3A8A] font-semibold'
                : 'text-slate-600'
            }`}
          >
            Apps Script Setup
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-6 space-y-6">
        {/* Print-only Header */}
        <div className="hidden print-only mb-4 border-b border-slate-300 pb-3">
          <h1 className="text-lg font-bold text-slate-900">
            {seniorityMode === 'ups-tet'
              ? 'District Rampur — UPS TET Passed Teachers Seniority List'
              : 'District Rampur — All Teachers Seniority List (Without UPS TET Criteria)'}
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Criteria:{' '}
            {seniorityMode === 'ups-tet'
              ? '1. UPS TET Passed Only · 2. First Joining Date in Rampur (Ascending) · 3. Date of Birth (Ascending)'
              : '1. All Teachers (Without UPS TET Filter) · 2. First Joining Date in Rampur (Ascending) · 3. Date of Birth (Ascending)'}
            {data ? ` · Total Ranked: ${filteredEligible.length}` : ''}
          </p>
        </div>

        {/* Page Context & Criteria Summary */}
        <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 no-print">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {seniorityMode === 'ups-tet'
                ? 'UPS TET Passed Teachers Seniority List'
                : 'All Teachers Seniority List (Without UPS TET Criteria)'}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              District Rampur ·{' '}
              {seniorityMode === 'ups-tet'
                ? 'Filtered strictly to UPS TET passed candidates'
                : 'Includes all candidates regardless of UPS TET status'}{' '}
              · Ranked by{' '}
              <span className="font-medium text-slate-800">
                First Joining Date in Rampur
              </span>{' '}
              then{' '}
              <span className="font-medium text-slate-800">Date of Birth</span>
            </p>
          </div>

          {data && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span>
                Source:{' '}
                <strong className="font-semibold text-slate-900">
                  {data.spreadsheetName || 'Google Sheet'}
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Tab:{' '}
                <strong className="font-semibold text-slate-900">
                  {data.sheetName}
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">
                {new Date(data.generatedAt).toLocaleString()}
              </span>
            </div>
          )}
        </section>

        {/* Error / Notice Banners */}
        {error && (
          <div
            role="alert"
            className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3 text-sm text-red-800 no-print"
          >
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-600" aria-hidden="true" />
            <div className="flex-1">{error}</div>
          </div>
        )}

        {notice && !error && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3.5 text-xs text-emerald-900 font-medium no-print">
            {notice}
          </div>
        )}

        {/* Tab Content */}
        {activeTab === 'setup' ? (
          <AppsScriptGuide
            activeUrl={activeUrl}
            isConfiguredInFile={isConfiguredInFile}
            onTestUrl={(url) => fetchFromAppsScript(url, false)}
            onWriteTabInSheet={(url) => fetchFromAppsScript(url, true)}
            onCsvFileLoaded={handleCsvLoaded}
            loading={loading}
          />
        ) : !data && loading ? (
          /* Skeleton Loading State */
          <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-3">
            <div className="h-5 w-64 bg-slate-200 rounded animate-pulse" />
            <div className="space-y-2 pt-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="h-10 w-full bg-slate-100 rounded animate-pulse"
                />
              ))}
            </div>
          </div>
        ) : !data ? (
          /* Empty / Unconfigured State */
          <div className="bg-white border border-slate-200 rounded-lg p-10 text-center max-w-2xl mx-auto">
            <FileSpreadsheet className="w-10 h-10 text-[#1E3A8A] mx-auto mb-3" aria-hidden="true" />
            <h2 className="text-lg font-bold text-slate-900">
              Connect Your Google Sheet via Google Apps Script
            </h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Deploy <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">code.js</code> inside your Google Sheet and paste your Web App URL into{' '}
              <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">src/config.ts</code>. You can also upload a CSV/TSV export right now to inspect the seniority ranking immediately.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('setup')}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#1E3A8A] hover:bg-[#1D4ED8] rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                Open Apps Script Setup
              </button>
              <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer transition-colors whitespace-nowrap shrink-0">
                <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                Upload Sheet CSV / TSV
                <input
                  type="file"
                  accept=".csv,.tsv,.txt"
                  onChange={handleQuickCsvUpload}
                  className="sr-only"
                />
              </label>
            </div>
          </div>
        ) : (
          /* Populated Data Workspace */
          <div className="space-y-5">
            {/* Flat Structured Stat Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 bg-white border border-slate-200 rounded-lg divide-y lg:divide-y-0 lg:divide-x divide-slate-200 no-print">
              <div className="p-4">
                <p className="text-xs text-slate-500">Total Sheet Records</p>
                <p className="mt-1 text-2xl font-bold font-mono text-slate-900">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('seniority');
                      setSeniorityMode('all-teachers');
                      setRemarksFilter('all');
                    }}
                    title="View all sheet records"
                    className={`inline-flex items-baseline gap-1.5 rounded px-1 -mx-1 py-0.5 transition-colors hover:bg-slate-100 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A]/40 cursor-pointer ${
                      activeTab === 'seniority' &&
                      seniorityMode === 'all-teachers' &&
                      remarksFilter === 'all'
                        ? 'underline decoration-2 underline-offset-4'
                        : ''
                    }`}
                  >
                    {data.totalRows}
                  </button>
                </p>
              </div>
              <div className="p-4">
                <p className="text-xs text-slate-500">UPS TET Passed (Eligible)</p>
                <p className="mt-1 text-2xl font-bold font-mono text-emerald-700">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('seniority');
                      setSeniorityMode('ups-tet');
                      setRemarksFilter('all');
                    }}
                    title="View UPS TET passed seniority list"
                    className={`inline-flex items-baseline gap-1.5 rounded px-1 -mx-1 py-0.5 transition-colors hover:bg-emerald-50 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 cursor-pointer ${
                      activeTab === 'seniority' &&
                      seniorityMode === 'ups-tet' &&
                      remarksFilter === 'all'
                        ? 'underline decoration-2 underline-offset-4'
                        : ''
                    }`}
                  >
                    {data.eligibleCount}
                  </button>
                </p>
              </div>
              <div className="p-4">
                <p className="text-xs text-slate-500">Excluded (No UPS TET)</p>
                <p className="mt-1 text-2xl font-bold font-mono text-slate-700">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('excluded');
                      setRemarksFilter('all');
                    }}
                    title="View excluded candidates list"
                    className={`inline-flex items-baseline gap-1.5 rounded px-1 -mx-1 py-0.5 transition-colors hover:bg-slate-100 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A]/40 cursor-pointer ${
                      activeTab === 'excluded'
                        ? 'underline decoration-2 underline-offset-4'
                        : ''
                    }`}
                  >
                    {data.excludedCount}
                  </button>
                </p>
              </div>
              <div className="p-4">
                <p className="text-xs text-slate-500">
                  Disciplinary / Date Flags
                </p>
                <p className="mt-1 text-2xl font-bold font-mono text-amber-700">
                  {actualUniqueFlaggedCount}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500 font-mono">
                  <button
                    type="button"
                    onClick={() => {
                      if (activeTab === 'seniority') {
                        setRemarksFilter((prev) =>
                          prev === 'remarks' ? 'all' : 'remarks'
                        );
                      }
                    }}
                    className={`hover:text-slate-900 ${
                      activeTab === 'seniority' ? 'underline cursor-pointer' : ''
                    }`}
                  >
                    {actualRemarksCount} disciplinary
                  </button>{' '}
                  ·{' '}
                  <button
                    type="button"
                    onClick={() => {
                      if (activeTab === 'seniority') {
                        setRemarksFilter((prev) =>
                          prev === 'date-warnings' ? 'all' : 'date-warnings'
                        );
                      }
                    }}
                    className={`hover:text-amber-800 ${
                      remarksFilter === 'date-warnings'
                        ? 'text-amber-800 font-semibold underline'
                        : activeTab === 'seniority'
                        ? 'underline cursor-pointer'
                        : ''
                    }`}
                  >
                    {actualDateWarningsCount} date
                  </button>
                </p>
              </div>
            </div>

            {/* Workspace Toolbar: Search, Filters & Actions */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3 no-print">
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                {/* Filter Inputs */}
                <div className="flex flex-wrap items-center gap-2.5 flex-1">
                  <div className="relative flex-1 min-w-[220px] max-w-sm">
                    <Search
                      className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search name, EHRMS code, school..."
                      className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20 focus:border-[#1E3A8A]"
                    />
                  </div>

                  <select
                    aria-label="Filter by Block"
                    value={blockFilter}
                    onChange={(e) => setBlockFilter(e.target.value)}
                    className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20 focus:border-[#1E3A8A]"
                  >
                    <option value="all">All Blocks</option>
                    {data.blocks.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Filter by Designation"
                    value={designationFilter}
                    onChange={(e) => setDesignationFilter(e.target.value)}
                    className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20 focus:border-[#1E3A8A]"
                  >
                    <option value="all">All Designations</option>
                    {data.designations.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Export Actions */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={!activeDisplayedRecords.length}
                    onClick={handleExportPdf}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
                  >
                    <FileDown className="w-3.5 h-3.5" aria-hidden="true" />
                    Export PDF
                  </button>
                  <button
                    type="button"
                    disabled={!activeDisplayedRecords.length}
                    onClick={handleExportCsv}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#1E3A8A] hover:bg-[#1D4ED8] rounded-md transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                    Export CSV
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <div>
                  Showing{' '}
                  <strong className="font-mono text-slate-900">
                    {activeTab === 'seniority'
                      ? filteredEligible.length
                      : filteredExcluded.length}
                  </strong>{' '}
                  of{' '}
                  <strong className="font-mono text-slate-900">
                    {activeTab === 'seniority'
                      ? activeSenioritySource.length
                      : data.excludedCount}
                  </strong>{' '}
                  {activeTab === 'seniority'
                    ? seniorityMode === 'ups-tet'
                      ? 'UPS TET passed candidates'
                      : 'all teachers (without UPS TET filter)'
                    : 'excluded candidates'}
                  <span aria-hidden="true"> · </span>
                  <span>Click any row to inspect all 17 spreadsheet fields</span>
                </div>
              </div>
            </div>

            {/* Data Table */}
            <SeniorityTable
              records={
                activeTab === 'seniority' ? filteredEligible : filteredExcluded
              }
              mode={activeTab === 'seniority' ? 'eligible' : 'excluded'}
              onSelectRecord={setSelectedRecord}
            />
          </div>
        )}
      </main>

      <TeacherDetailModal
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
      />
    </div>
  );
}
