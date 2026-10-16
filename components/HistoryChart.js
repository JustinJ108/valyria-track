"use client";
import { useState } from "react";

const SERIES = [
  { key: "team_pct", label: "Team profiles", short: "Team", color: "var(--series-1)" },
  { key: "project_pct", label: "Projects", short: "Projects", color: "var(--series-2)" },
];

const W = 560, H = 220, PAD = { t: 12, r: 104, b: 26, l: 36 };
const fmtDate = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

// Completeness % over time, one line per section. Hover for exact values.
export default function HistoryChart({ runs }) {
  const [hover, setHover] = useState(null);
  if (runs.length < 2)
    return <p className="empty">History appears after the second check (the daily cron adds one each day).</p>;

  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const x = (i) => PAD.l + (runs.length === 1 ? iw / 2 : (i / (runs.length - 1)) * iw);
  const y = (v) => PAD.t + ih - (v / 100) * ih;
  const last = runs[runs.length - 1];

  // End-of-line labels, pushed apart when the two values are close.
  const labelY = SERIES.map((s) => y(last[s.key]) + 4);
  if (Math.abs(labelY[0] - labelY[1]) < 14) {
    const mid = (labelY[0] + labelY[1]) / 2, up = labelY[0] <= labelY[1] ? -7 : 7;
    labelY[0] = mid + up;
    labelY[1] = mid - up;
  }

  function onMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - PAD.l) / iw) * (runs.length - 1));
    setHover(Math.max(0, Math.min(runs.length - 1, i)));
  }

  const h = hover != null ? runs[hover] : null;
  return (
    <div className="chart-wrap">
      <div className="legend" style={{ marginBottom: 8 }}>
        {SERIES.map((s) => (
          <span key={s.key}><svg width="14" height="4"><rect width="14" height="3" rx="1.5" fill={s.color} /></svg>{s.label}</span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Completeness over time"
        onMouseMove={onMove} onMouseLeave={() => setHover(null)} style={{ display: "block" }}>
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="var(--grid)" />
            <text x={PAD.l - 6} y={y(v) + 4} fontSize="11" textAnchor="end" fill="var(--ink-3)">{v}%</text>
          </g>
        ))}
        <text x={PAD.l} y={H - 6} fontSize="11" fill="var(--ink-3)">{fmtDate(runs[0].checked_at)}</text>
        <text x={W - PAD.r} y={H - 6} fontSize="11" textAnchor="end" fill="var(--ink-3)">{fmtDate(last.checked_at)}</text>
        {h && <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + ih} stroke="var(--ink-3)" strokeDasharray="3 3" />}
        {SERIES.map((s, si) => (
          <g key={s.key}>
            <polyline fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round"
              points={runs.map((r, i) => `${x(i)},${y(r[s.key])}`).join(" ")} />
            <text x={W - PAD.r + 8} y={labelY[si]} fontSize="12" fill="var(--ink-2)">
              {s.short} {last[s.key]}%
            </text>
            {h && <circle cx={x(hover)} cy={y(h[s.key])} r="4.5" fill={s.color} stroke="var(--surface)" strokeWidth="2" />}
          </g>
        ))}
      </svg>
      {h && (
        <div className="chart-tip" style={{ left: `${(x(hover) / W) * 100}%`, top: 24, transform: `translateX(${hover > runs.length / 2 ? "-105%" : "8px"})` }}>
          <strong>{new Date(h.checked_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</strong>
          {SERIES.map((s) => <div key={s.key}>{s.label}: {h[s.key]}%</div>)}
          <div>Broken links: {h.broken_links}</div>
        </div>
      )}
    </div>
  );
}
