'use client';
import { initials } from '@/utils';

interface Props {
  src?: string | null;
  nome: string;
  size?: number;
  accent?: string;
}

export default function Avatar({ src, nome, size = 40, accent = 'var(--green)' }: Props) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: src ? 'transparent' : `${accent}22`,
      border: `1px solid ${accent}55`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', flexShrink: 0,
      fontSize: size * 0.35, fontWeight: 700, color: accent, letterSpacing: '0.04em',
    }}>
      {src
        ? <img src={src} alt={nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : initials(nome)
      }
    </div>
  );
}
