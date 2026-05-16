'use client';
// app/perfil/page.tsx
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import StarRating from '@/components/StarRating';
import { BARBEIROS, SERVICOS } from '@/lib/data';

interface AgendamentoEnriquecido {
  id: string;
  barbeiro_id: string;
  servico: string;
  data: string;
  horario: string;
  valor: number;
  status: string;
  avaliacao: number | null;
  barbeiro?: { id: string; nome: string };
}

interface Usuario {
  nome: string;
  email: string;
  barbeiro_favorito: string | null;
  pontos: number;
}

export default function PerfilPage() {
  const router = useRouter();
  const [session, setSession] = useState<{ nome: string } | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [agendamentos, setAgendamentos] = useState<AgendamentoEnriquecido[]>([]);
  const [loading, setLoading] = useState(true);
  const [avaliacoes, setAvaliacoes] = useState<Record<string, number>>({});
  const [savingAv, setSavingAv] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const [sessRes, userRes, agRes] = await Promise.all([
        fetch('/api/auth'),
        fetch('/api/usuarios'),
        fetch('/api/agendamentos?action=meus'),
      ]);

      const sessData = await sessRes.json();
      if (!sessData.session) { router.push('/login'); return; }
      setSession(sessData.session);

      if (userRes.ok) {
        const ud = await userRes.json();
        setUsuario(ud.usuario);
      }

      if (agRes.ok) {
        const ad = await agRes.json();
        const sorted = (ad.agendamentos || []).sort((a: AgendamentoEnriquecido, b: AgendamentoEnriquecido) =>
          b.data.localeCompare(a.data) || b.horario.localeCompare(a.horario)
        );
        setAgendamentos(sorted);
        // Pre-fill existing ratings
        const av: Record<string, number> = {};
        sorted.forEach((a: AgendamentoEnriquecido) => { if (a.avaliacao) av[a.id] = a.avaliacao; });
        setAvaliacoes(av);
      }

      setLoading(false);
    }
    load();
  }, [router]);

  async function salvarAvaliacao(agendamentoId: string, estrelas: number) {
    setSavingAv(agendamentoId);
    setAvaliacoes(prev => ({ ...prev, [agendamentoId]: estrelas }));

    await fetch('/api/agendamentos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'avaliar', agendamento_id: agendamentoId, estrelas }),
    });
    setSavingAv(null);

    // Update local state
    setAgendamentos(prev => prev.map(a => a.id === agendamentoId ? { ...a, avaliacao: estrelas } : a));
  }

  async function cancelar(agendamentoId: string) {
    if (!confirm('Cancelar este agendamento?')) return;
    const res = await fetch('/api/agendamentos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancelar', agendamento_id: agendamentoId }),
    });
    if (res.ok) {
      setAgendamentos(prev => prev.map(a => a.id === agendamentoId ? { ...a, status: 'cancelado' } : a));
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-rasta-green-light animate-pulse text-2xl">🌿</div>
      </div>
    );
  }

  const barbeiroFav = usuario?.barbeiro_favorito ? BARBEIROS.find(b => b.id === usuario.barbeiro_favorito) : null;

  const statusColors: Record<string, string> = {
    confirmado: 'text-rasta-green-light bg-rasta-green/20 border-rasta-green/30',
    cancelado: 'text-rasta-red-light bg-rasta-red/20 border-rasta-red/30',
    pendente: 'text-rasta-yellow bg-rasta-yellow/10 border-rasta-yellow/30',
  };

  return (
    <div className="min-h-screen" style={{ background: 'radial-gradient(ellipse at bottom left, #001a1a 0%, #0d0d0d 60%)' }}>
      <Navbar userName={session?.nome} />

      <main className="max-w-3xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-10">
          <p className="text-rasta-green-light text-sm font-medium uppercase tracking-widest mb-2">Minha Conta</p>
          <h1 className="text-4xl font-black text-rasta-cream" style={{ fontFamily: 'var(--font-display)' }}>
            Perfil
          </h1>
        </div>

        {/* User card */}
        <div className="glass-card border border-white/10 rounded-2xl p-6 mb-8">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-rasta-green/20 border border-rasta-green/30 flex items-center justify-center text-2xl">
                👤
              </div>
              <div>
                <h2 className="text-xl font-bold text-rasta-cream" style={{ fontFamily: 'var(--font-display)' }}>
                  {usuario?.nome}
                </h2>
                <p className="text-sm text-white/40">{usuario?.email}</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-rasta-yellow">{usuario?.pontos || 0}</p>
                <p className="text-xs text-white/40">pontos</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-rasta-green-light">
                  {agendamentos.filter(a => a.status === 'confirmado').length}
                </p>
                <p className="text-xs text-white/40">cortes</p>
              </div>
            </div>
          </div>

          {barbeiroFav && (
            <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-3">
              <span className="text-rasta-red-light">❤️</span>
              <span className="text-sm text-white/50">Barbeiro favorito:</span>
              <span className="text-sm font-medium text-rasta-cream">{barbeiroFav.nome}</span>
              <button
                onClick={() => router.push(`/agendar?barbeiro=${barbeiroFav.id}`)}
                className="ml-auto text-xs btn-primary py-1 px-3"
              >
                Agendar
              </button>
            </div>
          )}
        </div>

        {/* History */}
        <h2 className="text-xs text-white/40 uppercase tracking-widest mb-4">Histórico de Agendamentos</h2>

        {agendamentos.length === 0 ? (
          <div className="glass-card border border-white/10 rounded-xl p-10 text-center">
            <p className="text-4xl mb-3">✂️</p>
            <p className="text-white/40">Nenhum agendamento ainda.</p>
            <button onClick={() => router.push('/agendar')} className="btn-primary mt-4 text-sm">
              Fazer primeiro agendamento
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {agendamentos.map((ag, i) => {
              const bInfo = BARBEIROS.find(b => b.id === ag.barbeiro_id);
              const statusClass = statusColors[ag.status] || statusColors.pendente;
              const canAvaliar = ag.status === 'confirmado';
              const podeAvaliar = canAvaliar;

              return (
                <div
                  key={ag.id}
                  className="glass-card border border-white/10 rounded-xl p-5 animate-slide-up"
                  style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'both' }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-rasta-cream">{ag.servico}</span>
                        <span className={`text-xs border rounded-full px-2 py-0.5 ${statusClass}`}>
                          {ag.status}
                        </span>
                      </div>
                      <div className="text-sm text-white/50 mt-1">
                        {bInfo?.nome} · {ag.data} às {ag.horario}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-rasta-green-light font-bold">R$ {ag.valor.toFixed(2)}</div>
                      {ag.status === 'pendente' && (
                        <button
                          onClick={() => cancelar(ag.id)}
                          className="text-xs text-rasta-red-light hover:underline mt-1 block"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Rating */}
                  {podeAvaliar && (
                    <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-3">
                      <span className="text-xs text-white/40">Avaliação:</span>
                      <StarRating
                        value={avaliacoes[ag.id] || ag.avaliacao || 0}
                        onChange={(v) => salvarAvaliacao(ag.id, v)}
                        readonly={!!ag.avaliacao}
                        size="sm"
                      />
                      {savingAv === ag.id && <span className="text-xs text-white/30">Salvando...</span>}
                      {ag.avaliacao && <span className="text-xs text-white/30">Avaliado</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
