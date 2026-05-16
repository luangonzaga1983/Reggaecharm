'use client';
// app/inicio/page.tsx
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import StarRating from '@/components/StarRating';
import { BARBEIROS, SERVICOS } from '@/lib/data';

interface Stats {
  barbeiroId: string;
  mediaEstrelas: number;
}

interface Session {
  id: string;
  nome: string;
  email: string;
}

interface Usuario {
  barbeiro_favorito: string | null;
  pontos: number;
}

export default function InicioPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [stats, setStats] = useState<Stats[]>([]);
  const [favoriting, setFavoriting] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [sessRes, userRes, statsRes] = await Promise.all([
        fetch('/api/auth'),
        fetch('/api/usuarios'),
        fetch('/api/agendamentos?action=stats'),
      ]);

      const sessData = await sessRes.json();
      if (!sessData.session) { router.push('/login'); return; }
      setSession(sessData.session);

      if (userRes.ok) {
        const ud = await userRes.json();
        setUsuario(ud.usuario);
      }

      if (statsRes.ok) {
        const sd = await statsRes.json();
        setStats(sd.stats || []);
      }

      setLoading(false);
    }
    load();
  }, [router]);

  async function toggleFavorito(barbeiroId: string) {
    if (!usuario) return;
    setFavoriting(barbeiroId);
    const isFav = usuario.barbeiro_favorito === barbeiroId;

    const res = await fetch('/api/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'favoritar', barbeiro_id: isFav ? null : barbeiroId }),
    });

    if (res.ok) {
      const data = await res.json();
      setUsuario(prev => prev ? { ...prev, barbeiro_favorito: data.barbeiro_favorito } : null);
    }
    setFavoriting(null);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-rasta-green-light animate-pulse text-2xl">🌿</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'radial-gradient(ellipse at top, #0d1f0d 0%, #0d0d0d 50%)' }}>
      <Navbar userName={session?.nome} />

      <main className="max-w-5xl mx-auto px-4 py-10">
        {/* Hero */}
        <div className="mb-12">
          <p className="text-rasta-green-light text-sm font-medium uppercase tracking-widest mb-2">Bem-vindo de volta</p>
          <h1 className="text-4xl md:text-5xl font-black text-rasta-cream leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
            {session?.nome?.split(' ')[0]},<br />
            <span className="text-white/40 text-3xl md:text-4xl">pronto pro corte?</span>
          </h1>

          {/* Points */}
          {usuario && (
            <div className="mt-6 inline-flex items-center gap-3 glass-card border border-rasta-yellow/20 rounded-full px-5 py-2.5">
              <span className="text-rasta-yellow text-lg">⭐</span>
              <span className="text-rasta-cream font-semibold">{usuario.pontos} pontos</span>
              <span className="text-white/30 text-sm">| {Math.floor(usuario.pontos / 10)} cortes</span>
            </div>
          )}
        </div>

        {/* Services bar */}
        <div className="mb-10">
          <h2 className="text-xs text-white/40 uppercase tracking-widest mb-4">Serviços</h2>
          <div className="flex flex-wrap gap-3">
            {SERVICOS.map(s => (
              <div key={s.id} className="glass-card border border-white/10 rounded-xl px-5 py-3 flex items-center gap-3">
                <span className="text-rasta-cream font-medium">{s.nome}</span>
                <span className="text-rasta-green-light font-bold">R$ {s.valor.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Barbers */}
        <h2 className="text-xs text-white/40 uppercase tracking-widest mb-4">Nossos Barbeiros</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {BARBEIROS.map((b, i) => {
            const stat = stats.find(s => s.barbeiroId === b.id);
            const isFav = usuario?.barbeiro_favorito === b.id;

            return (
              <div
                key={b.id}
                className="glass-card rounded-2xl overflow-hidden border border-white/10 hover:border-rasta-green/30 transition-all duration-300 group animate-slide-up"
                style={{ animationDelay: `${i * 100}ms`, animationFillMode: 'both' }}
              >
                {/* Card header with gradient */}
                <div
                  className="h-28 relative"
                  style={{
                    background: i === 0
                      ? 'linear-gradient(135deg, #0d2a0d 0%, #1a4a1a 100%)'
                      : 'linear-gradient(135deg, #2a0d0d 0%, #1a1a4a 100%)',
                  }}
                >
                  {/* Avatar placeholder */}
                  <div className="absolute bottom-0 left-6 translate-y-1/2">
                    <div className="w-16 h-16 rounded-full border-4 border-rasta-charcoal flex items-center justify-center text-3xl"
                      style={{ background: i === 0 ? '#1a7a2e' : '#7a1a1a' }}>
                      {i === 0 ? '✂️' : '💈'}
                    </div>
                  </div>

                  {/* Fav button */}
                  <button
                    onClick={() => toggleFavorito(b.id)}
                    disabled={favoriting === b.id}
                    className="absolute top-4 right-4 p-2 rounded-full bg-black/30 hover:bg-black/50 transition-all active:scale-90"
                    title={isFav ? 'Remover favorito' : 'Favoritar'}
                  >
                    <span className={`text-xl ${isFav ? 'opacity-100' : 'opacity-40 hover:opacity-70'} transition-opacity`}>
                      {isFav ? '❤️' : '🤍'}
                    </span>
                  </button>
                </div>

                <div className="pt-12 px-6 pb-6">
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="text-xl font-bold text-rasta-cream" style={{ fontFamily: 'var(--font-display)' }}>
                      {b.nome}
                    </h3>
                    {isFav && (
                      <span className="text-xs bg-rasta-red/20 text-rasta-red-light border border-rasta-red/30 rounded-full px-2 py-0.5">
                        favorito
                      </span>
                    )}
                  </div>

                  {/* Stars */}
                  <div className="flex items-center gap-2 mb-3">
                    <StarRating value={Math.round(stat?.mediaEstrelas || 0)} readonly size="sm" />
                    <span className="text-sm text-white/50">
                      {stat?.mediaEstrelas ? stat.mediaEstrelas.toFixed(1) : '—'}
                    </span>
                  </div>

                  {/* Bio */}
                  <p className="text-sm text-white/50 mb-4">{b.bio}</p>

                  {/* Specialties */}
                  <div className="flex flex-wrap gap-2 mb-5">
                    {b.especialidades.map(esp => (
                      <span key={esp} className="text-xs bg-rasta-smoke border border-white/10 rounded-full px-3 py-1 text-white/60 capitalize">
                        {esp}
                      </span>
                    ))}
                  </div>

                  {/* CTA */}
                  <button
                    onClick={() => router.push(`/agendar?barbeiro=${b.id}`)}
                    className="btn-primary w-full text-sm"
                  >
                    Agendar com {b.nome.split(' ')[0]}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
