'use client';

interface Props {
  /** Badge size in px. */
  size?: number;
  /** @deprecated mantido p/ compat com chamadas antigas (ignorado). */
  bars?: number;
  /** Desliga a animação idle (header denso). */
  still?: boolean;
}

/**
 * Marca da Reggae Charm — SÓ o corte BLACK POWER (afro).
 * Massa de cabelo afro, sem rosto/ombros. Silhueta fofa e arredondada,
 * na cor de contraste sobre o badge (accent). Segue o tema.
 */
export default function Logo({ size = 48, still = false }: Props) {
  const hair = 'var(--accent-contrast)';
  return (
    <div
      className={`logo-mark ${still ? '' : 'logo-sway'}`}
      style={{
        width: size, height: size,
        borderRadius: size * 0.3,
        background: 'var(--accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: 'var(--shadow-md)',
        overflow: 'hidden',
      }}
      aria-label="Reggae Charm"
    >
      <svg width={size * 0.84} height={size * 0.84} viewBox="0 0 64 64" fill="none" aria-hidden>
        {/* Afro: nuvem de círculos sobrepostos formando o cabelo (sem rosto). */}
        <g fill={hair}>
          <circle cx="32" cy="35" r="17" />
          <circle cx="32" cy="14" r="11.5" />
          <circle cx="22" cy="17" r="10.5" />
          <circle cx="42" cy="17" r="10.5" />
          <circle cx="16" cy="28" r="10" />
          <circle cx="48" cy="28" r="10" />
          <circle cx="14" cy="38" r="8.5" />
          <circle cx="50" cy="38" r="8.5" />
          <circle cx="22" cy="47" r="9" />
          <circle cx="42" cy="47" r="9" />
          <circle cx="32" cy="49" r="9.5" />
        </g>
      </svg>
    </div>
  );
}
