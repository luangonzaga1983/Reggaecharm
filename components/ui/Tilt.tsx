'use client';
import { useRef, type ReactNode, type CSSProperties } from 'react';

interface Props {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Max tilt in degrees. Default 10. */
  max?: number;
  /** Show the moving specular glare. Default true. */
  glare?: boolean;
  onClick?: () => void;
}

/**
 * Pointer-tracking 3D tilt. Sets CSS vars (--rx/--ry/--mx/--my) consumed by
 * `.tilt` in globals.css. Pure transform/opacity → cheap. No tilt on touch.
 */
export default function Tilt({ children, className = '', style, max = 10, glare = true, onClick }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  function move(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'touch') return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;   // 0..1
    const py = (e.clientY - r.top) / r.height;   // 0..1
    el.style.setProperty('--ry', `${(px - 0.5) * 2 * max}deg`);
    el.style.setProperty('--rx', `${(0.5 - py) * 2 * max}deg`);
    el.style.setProperty('--mx', `${px * 100}%`);
    el.style.setProperty('--my', `${py * 100}%`);
  }
  function enter(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'touch') return;
    ref.current?.classList.add('is-active');
  }
  function leave() {
    const el = ref.current;
    if (!el) return;
    el.classList.remove('is-active');
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  }

  return (
    <div
      ref={ref}
      className={`tilt ${className}`}
      style={style}
      onPointerMove={move}
      onPointerEnter={enter}
      onPointerLeave={leave}
      onClick={onClick}
    >
      {children}
      {glare && <span className="tilt-glare" />}
    </div>
  );
}
