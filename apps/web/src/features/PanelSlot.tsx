import { panelsFor, type PanelSlotName } from './registry';

export function PanelSlot({ slot }: { slot: PanelSlotName }) {
  const items = panelsFor(slot);
  if (items.length === 0) return null;
  return (
    <div className="space-y-4">
      {items.map(({ id, title, component: Panel }) => (
        <section key={id} className="rounded border border-slate-200 p-4">
          <h2 className="mb-2 font-semibold">{title}</h2>
          <Panel />
        </section>
      ))}
    </div>
  );
}
