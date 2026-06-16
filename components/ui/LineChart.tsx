'use client';
import { useId } from 'react';

export interface ChartPoint { label: string; valor: number; }

interface Props {
  data: ChartPoint[];
  /** Formata o valor do badge (último ponto). */
  formatValue?: (v: number) => string;
  height?: number;
}

/** Número compacto p/ eixo Y: 1500 → "1,5k". */
function compact(v: number): string {
  if (Math.abs(v) >= 1000) return (v / 1000).toFixed(1).replace(/\.0$/, '').replace('.', ',') + 'k';
  return String(Math.round(v));
}

/** Catmull-Rom → curva Bézier suave passando por todos os pontos. */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return pts.length ? `M ${pts[0].x} ${pts[0].y}` : '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

/**
 * Gráfico de linha SVG (sem libs): grade, eixos, curva suave, área com gradiente,
 * animação de "desenho" e badge no último ponto. Monocromático (segue --accent).
 */
export default function LineChart({ data, formatValue, height = 240 }: Props) {
  const uid = useId().replace(/:/g, '');
  const W = 620, H = 260;
  const padL = 44, padR = 64, padT = 18, padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  if (data.length < 2) {
    return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontSize: 13 }}>Sem dados suficientes para o gráfico.</div>;
  }

  const vals = data.map(d => d.valor);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (min === max) { max = max + 1; min = Math.max(0, min - 1); }
  // "folga" de 8% em cima/baixo
  const span = max - min;
  max += span * 0.08; min -= span * 0.08;
  if (min < 0) min = 0;

  const x = (i: number) => padL + (i / (data.length - 1)) * plotW;
  const y = (v: number) => padT + (1 - (v - min) / (max - min)) * plotH;
  const pts = data.map((d, i) => ({ x: x(i), y: y(d.valor) }));

  const linePath = smoothPath(pts);
  const areaPath = `${linePath} L ${pts[pts.length - 1].x} ${padT + plotH} L ${pts[0].x} ${padT + plotH} Z`;

  // Linhas de grade horizontais (5 níveis) + rótulos Y.
  const grid = Array.from({ length: 5 }, (_, i) => {
    const v = min + (i / 4) * (max - min);
    return { v, gy: y(v) };
  });

  // Rótulos X: ~6 distribuídos.
  const step = Math.max(1, Math.floor(data.length / 6));
  const last = pts[pts.length - 1];
  const lastV = data[data.length - 1].valor;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={height} style={{ display: 'block', overflow: 'visible' }} role="img" aria-label="Gráfico de faturamento">
      <defs>
        <linearGradient id={`area-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Grade + eixo Y */}
      {grid.map((g, i) => (
        <g key={i}>
          <line x1={padL} y1={g.gy} x2={padL + plotW} y2={g.gy} stroke="var(--border)" strokeWidth="1" />
          <text x={padL - 8} y={g.gy + 3.5} textAnchor="end" fontSize="11" fill="var(--text-faint)">{compact(g.v)}</text>
        </g>
      ))}

      {/* Eixo X */}
      {data.map((d, i) => (i % step === 0 || i === data.length - 1) ? (
        <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--text-faint)">{d.label}</text>
      ) : null)}

      {/* Área */}
      <path d={areaPath} fill={`url(#area-${uid})`} className={`lc-area lc-area-${uid}`} />

      {/* Linha */}
      <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className={`lc-line lc-line-${uid}`} />

      {/* Último ponto + badge */}
      <circle cx={last.x} cy={last.y} r="4.5" fill="var(--accent)" stroke="var(--bg-elev)" strokeWidth="2" className={`lc-dot lc-dot-${uid}`} />
      <g className={`lc-badge lc-badge-${uid}`} transform={`translate(${last.x + 10}, ${last.y})`}>
        <rect x="0" y="-13" rx="6" ry="6" width="62" height="26" fill="var(--accent)" />
        <text x="31" y="4" textAnchor="middle" fontSize="11.5" fontWeight="700" fill="var(--accent-contrast)">{(formatValue ? formatValue(lastV) : compact(lastV))}</text>
      </g>

      <style>{`
        .lc-line-${uid} { stroke-dasharray: 1; stroke-dashoffset: 1; animation: lcDraw-${uid} 1.1s cubic-bezier(.4,0,.2,1) forwards; }
        @keyframes lcDraw-${uid} { to { stroke-dashoffset: 0; } }
        .lc-area-${uid} { opacity: 0; animation: lcFade-${uid} 0.6s ease 0.7s forwards; }
        .lc-dot-${uid}, .lc-badge-${uid} { opacity: 0; animation: lcFade-${uid} 0.4s ease 1s forwards; }
        @keyframes lcFade-${uid} { to { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) {
          .lc-line-${uid}, .lc-area-${uid}, .lc-dot-${uid}, .lc-badge-${uid} { animation: none; opacity: 1; stroke-dashoffset: 0; }
        }
      `}</style>
    </svg>
  );
}
