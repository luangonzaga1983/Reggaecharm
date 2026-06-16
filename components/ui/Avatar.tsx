'use client';
import { initials } from '@/utils';

interface Props {
  src?: string | null;
  nome: string;
  size?: number;
  accent?: string;
}

export default function Avatar({ src, nome, size = 40, accent = 'var(--accent)' }: Props) {
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: src ? 'transparent' : 'var(--surface2)',
      border: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      flexShrink: 0,
      fontSize: size * 0.36,
      fontWeight: 600,
      color: accent,
    }}>
      {src
        ? <img src={src} alt={nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : initials(nome)
      }
    </div>
  );
}
