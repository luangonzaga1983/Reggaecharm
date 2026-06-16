'use client';
import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import Logo from '@/components/ui/Logo';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { AuthCard } from '@/components/modals/AuthModal';

/**
 * Tela de entrada — estática (uma tela só, sem scroll), porém viva:
 * fundo aurora em movimento contínuo + idle suave nos elementos.
 */
export default function Landing({ onSuccess }: { onSuccess: () => void }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    const ctx = gsap.context(() => {
      // Intro
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.from('.in-logo', { scale: 0.5, opacity: 0, duration: 0.7, ease: 'back.out(1.7)' })
        .from('.in-title', { y: 24, opacity: 0, duration: 0.6 }, '-=0.25')
        .from('.in-sub', { y: 16, opacity: 0, duration: 0.5 }, '-=0.3')
        .from('.in-card', { y: 26, opacity: 0, duration: 0.6 }, '-=0.25');

      // Idle infinito (mexe sozinho, sem interação) —
      gsap.to('.in-logo', { y: -10, duration: 2.4, ease: 'sine.inOut', repeat: -1, yoyo: true });
      gsap.to('.in-card', { y: -6, duration: 3.6, ease: 'sine.inOut', repeat: -1, yoyo: true, delay: 0.6 });
      gsap.to('.aurora-1', { xPercent: 18, yPercent: 14, scale: 1.25, duration: 11, ease: 'sine.inOut', repeat: -1, yoyo: true });
      gsap.to('.aurora-2', { xPercent: -16, yPercent: -12, scale: 1.2, duration: 14, ease: 'sine.inOut', repeat: -1, yoyo: true });
      gsap.to('.aurora-3', { xPercent: 12, yPercent: -16, scale: 1.3, duration: 17, ease: 'sine.inOut', repeat: -1, yoyo: true });
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={root}
      className="landing-static scene-deep"
      style={{ height: '100dvh', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative' }}
    >
      {/* Aurora viva */}
      <div className="aurora" aria-hidden>
        <span className="aurora-1" />
        <span className="aurora-2" />
        <span className="aurora-3" />
      </div>

      <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 30 }}><ThemeToggle /></div>

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 410, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div className="in-logo" style={{ marginBottom: 16 }}><Logo size={68} /></div>
        <p className="in-sub eyebrow-barbearia" style={{ marginBottom: 8 }}>Barbearia</p>
        <h1 className="in-title text-display" style={{ fontSize: 'clamp(2rem, 9vw, 3rem)', lineHeight: 1, textAlign: 'center', marginBottom: 12 }}>Reggae Charm</h1>
        <div className="in-sub barber-stripe" style={{ marginBottom: 12 }} aria-hidden />
        <p className="in-sub" style={{ fontSize: 13.5, color: 'var(--text-dim)', textAlign: 'center', marginBottom: 26, letterSpacing: '0.04em' }}>One Love, One Cut.</p>

        <div className="in-card" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          <AuthCard onSuccess={onSuccess} embedded />
        </div>
      </div>
    </div>
  );
}
