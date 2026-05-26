'use client';
import { useState } from 'react';

interface Props {
  value: number;
  onChange?: (v: number) => void;
  readonly?: boolean;
}

export default function Stars({ value, onChange, readonly }: Props) {
  const [hover, setHover] = useState(0);
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {[1,2,3,4,5].map(i => (
        <span key={i}
          className={`star${i <= (hover || value) ? ' on' : ''}`}
          onMouseEnter={() => !readonly && setHover(i)}
          onMouseLeave={() => !readonly && setHover(0)}
          onClick={() => !readonly && onChange?.(i)}
          style={{ cursor: readonly ? 'default' : 'pointer' }}>★</span>
      ))}
    </span>
  );
}
