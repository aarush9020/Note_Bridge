import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getCoverage } from '../lib/api';
import { ratioToPercent } from '../lib/format';
import type { Coverage } from '../lib/types';
import { ErrorBanner, Loading, ProgressBar } from '../components/ui';

/** Coverage screen: overall matched ratio plus the professor-only / book-only gaps. */
export function CoverageScreen() {
  const { courseId = '' } = useParams();
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCoverage(courseId)
      .then((c) => {
        if (!cancelled) setCoverage(c);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  return (
    <div className="space-y-6">
      <h2 className="font-semibold">Coverage</h2>

      {error && <ErrorBanner message={error} />}
      {!coverage && !error && <Loading />}

      {coverage && (
        <>
          <section className="rounded border border-slate-200 p-4">
            <p className="text-sm text-slate-600">Professor units matched to the textbook</p>
            <p className="text-3xl font-bold">{ratioToPercent(coverage.matchedRatio)}%</p>
            <div className="mt-2">
              <ProgressBar value={coverage.matchedRatio} />
            </div>
          </section>

          <div className="grid grid-cols-2 gap-4">
            <section className="rounded border border-slate-200 p-4">
              <h3 className="mb-2 font-semibold">Professor only</h3>
              {coverage.professorOnly.length === 0 ? (
                <p className="text-sm text-slate-500">Nothing unmatched.</p>
              ) : (
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {coverage.professorOnly.map((s) => (
                    <li key={s.id}>{s.title}</li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded border border-slate-200 p-4">
              <h3 className="mb-2 font-semibold">Book only</h3>
              {coverage.bookOnly.length === 0 ? (
                <p className="text-sm text-slate-500">Nothing unmatched.</p>
              ) : (
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {coverage.bookOnly.map((s) => (
                    <li key={s.id}>{s.title}</li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
