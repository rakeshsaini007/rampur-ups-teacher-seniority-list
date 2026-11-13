import { useState } from 'react';
import { Check, Copy, ExternalLink, FileSpreadsheet, RefreshCw } from 'lucide-react';
import codeJsSource from '../../code.js?raw';
import { GOOGLE_APPS_SCRIPT_URL } from '../config';

interface AppsScriptGuideProps {
  activeUrl: string;
  isConfiguredInFile: boolean;
  onTestUrl: (url: string) => void;
  onWriteTabInSheet: (url: string) => void;
  onCsvFileLoaded: (content: string, fileName: string) => void;
  loading: boolean;
}

export function AppsScriptGuide({
  activeUrl,
  isConfiguredInFile,
  onTestUrl,
  onWriteTabInSheet,
  onCsvFileLoaded,
  loading,
}: AppsScriptGuideProps) {
  const [copied, setCopied] = useState(false);
  const [urlInput, setUrlInput] = useState(
    isConfiguredInFile ? GOOGLE_APPS_SCRIPT_URL : ''
  );

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(codeJsSource);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback copy
      const ta = document.createElement('textarea');
      ta.value = codeJsSource;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onCsvFileLoaded(reader.result, file.name);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Hardcoded Config Status */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Hardcoded Apps Script URL Configuration
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Enter your deployed Google Apps Script Web App URL in{' '}
              <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-900">
                src/config.ts
              </code>{' '}
              so the app connects automatically on every load.
            </p>
          </div>
          <div className="text-xs font-medium whitespace-nowrap shrink-0">
            {isConfiguredInFile ? (
              <span className="text-emerald-700">
                Configured in src/config.ts
              </span>
            ) : (
              <span className="text-amber-700">
                Placeholder URL in src/config.ts
              </span>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Instructions & File Location */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">
              01. Deploy code.js in Your Google Sheet
            </h3>
            <ol className="space-y-2.5 text-sm text-slate-700 list-decimal list-inside">
              <li>
                Open your Rampur Teachers Google Sheet and click{' '}
                <strong className="font-semibold text-slate-900">
                  Extensions → Apps Script
                </strong>
                .
              </li>
              <li>
                Delete any existing code in <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">Code.gs</code> and paste the contents of{' '}
                <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">code.js</code>.
              </li>
              <li>
                Click <strong className="font-semibold text-slate-900">Deploy → New deployment</strong>, choose{' '}
                <strong className="font-semibold text-slate-900">Web app</strong>.
              </li>
              <li>
                Set <strong className="font-semibold text-slate-900">Execute as: Me</strong> and{' '}
                <strong className="font-semibold text-slate-900">Who has access: Anyone</strong>, then authorize &amp; deploy.
              </li>
              <li>
                Copy the generated Web App URL (ending in <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">/exec</code>) and paste it into{' '}
                <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">src/config.ts</code>.
              </li>
            </ol>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleCopyCode}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#1E3A8A] hover:bg-[#1D4ED8] rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                    Copied code.js
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                    Copy code.js
                  </>
                )}
              </button>

              {activeUrl && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => onWriteTabInSheet(activeUrl)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />
                  Create Seniority Tab in Google Sheet
                </button>
              )}
            </div>
          </div>

          {/* Right: Target File Snippet + Quick Test */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">
              02. File to Edit: src/config.ts
            </h3>
            <pre className="p-3.5 bg-slate-900 text-slate-100 rounded-md text-xs font-mono overflow-x-auto leading-relaxed">
{`export const GOOGLE_APPS_SCRIPT_URL =
  "${isConfiguredInFile ? GOOGLE_APPS_SCRIPT_URL : 'https://script.google.com/macros/s/YOUR_DEPLOY_ID/exec'}";`}
            </pre>

            <div className="pt-1 space-y-2">
              <label
                htmlFor="test-gas-url"
                className="block text-xs font-semibold text-slate-700"
              >
                Test a Web App URL in Browser (Before Hardcoding in src/config.ts)
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  id="test-gas-url"
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="flex-1 px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20 focus:border-[#1E3A8A]"
                />
                <button
                  type="button"
                  disabled={loading || !urlInput.trim()}
                  onClick={() => onTestUrl(urlInput.trim())}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
                  Fetch Live Data
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-xs text-slate-600">
                Or upload a CSV/TSV export from your Google Sheet to verify locally:
              </span>
              <label className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer transition-colors whitespace-nowrap shrink-0">
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                Upload Sheet CSV / TSV
                <input
                  type="file"
                  accept=".csv,.tsv,.txt"
                  onChange={handleFileChange}
                  className="sr-only"
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Full code.js Viewer */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="font-mono font-semibold text-slate-900">code.js</span>
            <span aria-hidden="true">·</span>
            <span>Google Apps Script Web App &amp; Sheet Tab Generator</span>
          </div>
          <button
            type="button"
            onClick={handleCopyCode}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                Copy Script
              </>
            )}
          </button>
        </div>
        <pre className="p-5 bg-slate-950 text-slate-200 text-xs font-mono overflow-x-auto max-h-[460px] leading-relaxed">
          {codeJsSource}
        </pre>
      </div>
    </div>
  );
}
