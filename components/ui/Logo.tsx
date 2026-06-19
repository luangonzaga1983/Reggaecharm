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
        {/* BLACK POWER: só o cabelo afro. Topo e laterais fofos; base côncava
            (linha do cabelo + costeletas), sem rosto/corpo. */}
        <g fill={hair}>
          {/* Massa do afro: volume arredondado, borda em cachos (couve-flor),
              vão do rosto aberto embaixo. Topo e laterais, sem rosto/corpo. */}
          <path d="M17.29 50.81A27 26 0 1 1 46.71 50.81C42.7 46 37 42 32 42C27 42 21.3 46 17.29 50.81Z" />
          {/* borda externa de cachos */}
          <circle cx="17.29" cy="50.81" r="5.7" />
          <circle cx="12.25" cy="46.73" r="4.6" />
          <circle cx="8.39" cy="41.61" r="5.6" />
          <circle cx="5.92" cy="35.73" r="4.9" />
          <circle cx="5" cy="29.45" r="5.5" />
          <circle cx="5.69" cy="23.15" r="5.3" />
          <circle cx="7.94" cy="17.2" r="4.5" />
          <circle cx="11.62" cy="11.94" r="5.4" />
          <circle cx="16.51" cy="7.7" r="5.8" />
          <circle cx="22.32" cy="4.73" r="4.5" />
          <circle cx="28.71" cy="3.19" r="5.3" />
          <circle cx="35.29" cy="3.19" r="5" />
          <circle cx="41.68" cy="4.73" r="5.7" />
          <circle cx="47.49" cy="7.7" r="5.7" />
          <circle cx="52.38" cy="11.94" r="5" />
          <circle cx="56.06" cy="17.2" r="4.8" />
          <circle cx="58.31" cy="23.15" r="4.6" />
          <circle cx="59" cy="29.45" r="5.5" />
          <circle cx="58.08" cy="35.73" r="5.7" />
          <circle cx="55.61" cy="41.61" r="5.9" />
          <circle cx="51.75" cy="46.73" r="4.8" />
          <circle cx="46.71" cy="50.81" r="5.3" />
          {/* fileira interna p/ volume */}
          <circle cx="20.53" cy="44.56" r="4.6" />
          <circle cx="15.23" cy="39.35" r="3.9" />
          <circle cx="12.37" cy="32.63" r="4.2" />
          <circle cx="12.37" cy="25.37" r="4.3" />
          <circle cx="15.23" cy="18.65" r="4.1" />
          <circle cx="20.53" cy="13.44" r="3.6" />
          <circle cx="27.5" cy="10.49" r="4.9" />
          <circle cx="35.13" cy="10.23" r="4.6" />
          <circle cx="42.3" cy="12.71" r="3.5" />
          <circle cx="47.97" cy="17.57" r="4.1" />
          <circle cx="51.32" cy="24.08" r="4.5" />
          <circle cx="51.85" cy="31.32" r="4.7" />
          <circle cx="49.49" cy="38.21" r="4.2" />
          <circle cx="44.59" cy="43.77" r="4.1" />
        </g>
      </svg>
    </div>
  );
}
