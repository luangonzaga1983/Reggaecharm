'use client';
// components/Navbar.tsx
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

interface NavbarProps {
  userName?: string;
}

export default function Navbar({ userName }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = [
    { href: '/inicio', label: 'Início', icon: '🏠' },
    { href: '/agendar', label: 'Agendar', icon: '✂️' },
    { href: '/perfil', label: 'Perfil', icon: '👤' },
    { href: '/painel', label: 'Painel', icon: '📋' },
  ];

  async function handleLogout() {
    await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    });
    router.push('/login');
  }

  return (
    <nav className="sticky top-0 z-50 glass-card border-b border-white/10">
      <div className="rasta-stripe" />
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link href="/inicio" className="flex items-center gap-2 group">
          <span className="text-2xl">🌿</span>
          <span
            className="text-xl font-bold tracking-wide text-rasta-cream"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Reggae<span className="text-rasta-green-light">Charm</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {links.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                pathname === link.href
                  ? 'bg-rasta-green/30 text-rasta-green-light border border-rasta-green/40'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* User + logout */}
        <div className="hidden md:flex items-center gap-3">
          {userName && (
            <span className="text-sm text-white/50">
              Olá, <span className="text-rasta-cream font-medium">{userName.split(' ')[0]}</span>
            </span>
          )}
          <button
            onClick={handleLogout}
            className="text-sm text-white/40 hover:text-rasta-red-light transition-colors px-3 py-2 rounded-lg hover:bg-white/5"
          >
            Sair
          </button>
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden p-2 rounded-lg hover:bg-white/10 transition-colors"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <div className="w-5 space-y-1">
            <span className={`block h-0.5 bg-cream transition-all ${menuOpen ? 'rotate-45 translate-y-1.5' : ''}`} style={{backgroundColor: 'var(--cream)'}} />
            <span className={`block h-0.5 transition-all ${menuOpen ? 'opacity-0' : ''}`} style={{backgroundColor: 'var(--cream)'}} />
            <span className={`block h-0.5 bg-cream transition-all ${menuOpen ? '-rotate-45 -translate-y-1.5' : ''}`} style={{backgroundColor: 'var(--cream)'}} />
          </div>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-white/10 px-4 py-3 space-y-1">
          {links.map(link => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                pathname === link.href
                  ? 'bg-rasta-green/20 text-rasta-green-light'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>{link.icon}</span>
              {link.label}
            </Link>
          ))}
          <button
            onClick={handleLogout}
            className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-rasta-red-light hover:bg-white/5 transition-colors"
          >
            <span>🚪</span> Sair
          </button>
        </div>
      )}
    </nav>
  );
}
