import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { listDocuments, listEdges, listSections } from '../lib/api';
import { buildMatchPairs, printedPage } from '../lib/format';
import type { Document, MatchPair } from '../lib/types';
import { PanelSlot } from '../features/PanelSlot';
import { ConfidenceTag, EmptyState, ErrorBanner, Loading, RelationBadge } from '../components/ui';

/** Side-by-side Viewer: each professor unit beside its matched book section, with a
 *  "Why this match?" popover showing the edge rationale, confidence and relation. */
export function Viewer() {
  const { courseId = '' } = useParams();
  const [pairs, setPairs] = useState<MatchPair[] | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openWhy, setOpenWhy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const [edges, sections, docs] = await Promise.all([
          listEdges(courseId),
          listSections(courseId),
          listDocuments(courseId),
        ]);
        if (cancelled) return;
        setDocuments(docs);
        setPairs(buildMatchPairs(edges, sections));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  function pageLabel(documentId: string, pdfPage: number): string {
    const doc = documents.find((d) => d.id === documentId);
    return doc ? `p. ${printedPage(doc, pdfPage)}` : `pdf p. ${pdfPage}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Side-by-side</h2>
        <span className="text-xs text-slate-500">{pairs?.length ?? 0} matched units</span>
      </div>

      {error && <ErrorBanner message={error} />}
      {!pairs && !error && <Loading />}
      {pairs?.length === 0 && <EmptyState>No matches yet. Run alignment first.</EmptyState>}

      {pairs?.map(({ edge, profSection, bookSection }) => (
        <div key={edge.id} className="rounded border border-slate-200 p-4">
          <div className="mb-3 flex items-center justify-between">
            <RelationBadge relation={edge.relation} />
            <button
              type="button"
              className="rounded border border-slate-300 px-2 py-1 text-xs text-blue-700"
              aria-expanded={openWhy === edge.id}
              onClick={() => setOpenWhy(openWhy === edge.id ? null : edge.id)}
            >
              Why this match?
            </button>
          </div>

          {openWhy === edge.id && (
            <div className="mb-3 rounded bg-slate-50 p-3 text-sm">
              <p className="mb-1">{edge.rationale}</p>
              <ConfidenceTag confidence={edge.confidence} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium uppercase text-slate-400">Professor</p>
              <h3 className="font-medium">{profSection.title}</h3>
              <p className="text-xs text-slate-500">
                {pageLabel(profSection.documentId, profSection.pageStart)}
              </p>
              <p className="mt-1 text-sm text-slate-700">{profSection.summary}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-slate-400">Textbook</p>
              {bookSection ? (
                <>
                  <h3 className="font-medium">{bookSection.title}</h3>
                  <p className="text-xs text-slate-500">
                    {pageLabel(bookSection.documentId, bookSection.pageStart)}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">{bookSection.summary}</p>
                </>
              ) : (
                <p className="text-sm text-slate-400">No textbook counterpart.</p>
              )}
            </div>
          </div>
        </div>
      ))}

      <PanelSlot slot="viewer" />
    </div>
  );
}
