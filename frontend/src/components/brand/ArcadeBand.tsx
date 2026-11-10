/**
 * A band of small arches, like the arcade around a caravansara's courtyard, at the foot of the home page
 * (specs/007-caravansara-theme, FR-003). Decoration only, so hidden from screen readers; desktop only.
 */
export function ArcadeBand() {
  return (
    <div aria-hidden className="mt-4 hidden h-12 gap-2.5 md:flex">
      {Array.from({ length: 12 }, (_, i) => (
        <span key={i} className="arch flex-1 bg-muted" />
      ))}
    </div>
  );
}
