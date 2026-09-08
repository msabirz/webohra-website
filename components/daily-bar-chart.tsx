/**
 * No charting library in this project — a small vertical bar chart built
 * from plain divs, same "hand-rolled, no new dependency" style as the
 * admin dashboard's existing "Products by category" bar list. Bars are
 * simple height percentages of the window's max value; hover shows the
 * exact figure via the title attribute since there's no tooltip
 * component to reach for either.
 *
 * Extracted (item 30, 2026-09-07) from app/admin/(portal)/analytics/
 * page.tsx, which had this as a local function — the seller dashboard
 * needed the exact same chart for her own orders/GMV trend, and a second
 * copy-pasted definition would've been the kind of drift this codebase
 * has repeatedly caught and fixed elsewhere (see e.g. the GMV-eligibility
 * rule's own "never redefine, always reuse" comment in
 * app/api/admin/analytics/route.ts).
 */
export function DailyBarChart({
  title,
  values,
  format,
}: {
  title: string;
  values: { label: string; value: number }[];
  format?: (v: number) => string;
}) {
  const max = Math.max(...values.map((v) => v.value), 1);
  const fmt = format ?? ((v: number) => v.toLocaleString('en-IN'));
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink-soft/5">
      <h2 className="mb-4 font-heading text-sm font-semibold text-ink">{title}</h2>
      <div className="flex h-32 items-end gap-[2px]">
        {values.map((v) => (
          <div
            key={v.label}
            title={`${v.label}: ${fmt(v.value)}`}
            className="flex-1 rounded-t bg-navy/70 transition hover:bg-navy"
            style={{ height: `${Math.max((v.value / max) * 100, v.value > 0 ? 4 : 1)}%` }}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between font-body text-[10px] text-ink-soft">
        <span>{values[0]?.label}</span>
        <span>{values[values.length - 1]?.label}</span>
      </div>
    </div>
  );
}
