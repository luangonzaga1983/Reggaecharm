'use client';

interface Props {
  /** Badge size in px. */
  size?: number;
  /** Bar count. */
  bars?: number;
}

/**
 * Marca da Reggae Charm — equalizador de áudio animado (ritmo/música = reggae).
 * Sempre em movimento: barras dançam continuamente. Monocromático.
 */
export default function Logo({ size = 48, bars = 5 }: Props) {
  const arr = Array.from({ length: bars });
  const gap = size * 0.07;
  const barW = size * 0.085;
  return (
    <div
      className="logo-eq"
      style={{
        width: size, height: size,
        borderRadius: size * 0.3,
        background: 'var(--accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap, boxShadow: 'var(--shadow-md)',
        overflow: 'hidden',
      }}
      aria-label="Reggae Charm"
    >
      {arr.map((_, i) => (
        <span
          key={i}
          style={{
            width: barW,
            height: size * 0.5,
            background: 'var(--accent-contrast)',
            borderRadius: 99,
            transformOrigin: 'center',
            animation: `eq 1s ease-in-out ${i * 0.13}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
