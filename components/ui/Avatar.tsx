'use client';
import { useState, useEffect } from 'react';
import { initials } from '@/utils';

interface Props {
  src?: string | null;
  nome: string;
  size?: number;
  accent?: string;
}

export default function Avatar({ src, nome, size = 40, accent = 'var(--accent)' }: Props) {
  // Se a imagem falhar (URL morta/expirada/404), cai pras iniciais em vez de
  // mostrar um quadrado quebrado. Reseta quando a src muda.
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);
  const showImg = !!src && !failed;
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: showImg ? 'transparent' : 'var(--surface2)',
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
      {showImg
        ? <img src={src!} alt={nome} onError={() => setFailed(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : initials(nome)
      }
    </div>
  );
}
