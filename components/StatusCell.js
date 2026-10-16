export const STATUS_META = {
  ok: { icon: "✓", label: "OK" },
  warn: { icon: "⚠", label: "Check" },
  unverified: { icon: "?", label: "Verify" },
  broken: { icon: "✗", label: "Broken" },
  missing: { icon: "✗", label: "Missing" },
};

// One table cell: icon + short label (so it never relies on color alone),
// a tooltip with the detail, and a link to the URL when there is one.
export default function StatusCell({ field, showLabel }) {
  const meta = STATUS_META[field.status];
  const tip = [meta.label, field.detail, field.url].filter(Boolean).join(" — ");
  const content = (
    <>
      <span className="ico" aria-hidden="true">{meta.icon}</span>
      {(showLabel || field.status !== "ok") && <span className="txt">{meta.label}</span>}
    </>
  );
  const props = { className: `cell s-${field.status}`, "data-tip": tip, "aria-label": tip };
  return field.url ? (
    <a {...props} href={field.url} target="_blank" rel="noopener noreferrer">{content}</a>
  ) : (
    <span {...props} tabIndex={0}>{content}</span>
  );
}

export function Legend() {
  const items = [
    ["ok", "Present & working"],
    ["missing", "Not on the site"],
    ["broken", "Link is dead"],
    ["warn", "Works, but looks wrong"],
    ["unverified", "Site blocks bots — check by hand"],
  ];
  return (
    <div className="legend">
      {items.map(([s, text]) => (
        <span key={s}>
          <span className={`pill s-${s}`}>{STATUS_META[s].icon} {STATUS_META[s].label}</span> {text}
        </span>
      ))}
    </div>
  );
}
