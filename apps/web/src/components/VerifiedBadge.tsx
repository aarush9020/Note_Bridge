import type { VerifyResult } from '../lib/verifyTypes';
import { toBadgeModel, type BadgeTone } from '../lib/verify';

const TONE_STYLE: Record<BadgeTone, string> = {
  verified: 'border-green-200 bg-green-50 text-green-900',
  mismatch: 'border-red-200 bg-red-50 text-red-900',
  error: 'border-amber-200 bg-amber-50 text-amber-900',
};

const DIFF_STYLE = {
  same: 'text-slate-600',
  removed: 'bg-red-100 text-red-800',
  added: 'bg-green-100 text-green-800',
} as const;

const ICON: Record<BadgeTone, string> = { verified: '✓', mismatch: '✗', error: '!' };

/**
 * "Verified by running code" badge, or the mismatch diff. Takes the verifier's result as-is, so a
 * panel can drop it in: <VerifiedBadge result={result} />.
 */
export function VerifiedBadge({ result }: { result: VerifyResult }) {
  const m = toBadgeModel(result);
  return (
    <div
      className={`rounded border p-3 text-sm ${TONE_STYLE[m.tone]}`}
      role={m.tone === 'verified' ? 'status' : 'alert'}
      data-testid="verified-badge"
      data-tone={m.tone}
    >
      <p className="flex items-center gap-2 font-medium">
        <span aria-hidden="true">{ICON[m.tone]}</span>
        <span>{m.label}</span>
      </p>
      <p className="mt-1 text-xs opacity-80">{m.detail}</p>
      {m.isolated === false && (
        <p className="mt-1 text-xs opacity-70">Ran locally without network isolation.</p>
      )}

      {m.tone === 'mismatch' && (
        <pre
          className="mt-2 overflow-x-auto rounded bg-white/70 p-2 font-mono text-xs"
          aria-label="Difference between the expected answer and the code output"
        >
          {m.diff.map((line, i) => (
            <span key={i} className={`block ${DIFF_STYLE[line.kind]}`}>
              {line.marker} {line.text}
            </span>
          ))}
        </pre>
      )}

      {m.code && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs underline">Show the code that ran</summary>
          <pre className="mt-1 overflow-x-auto rounded bg-white/70 p-2 font-mono text-xs">
            {m.code}
          </pre>
        </details>
      )}
    </div>
  );
}
