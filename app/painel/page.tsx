'use client';
// app/painel/page.tsx
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import StarRating from '@/components/StarRating';
import { BARBEIROS } from '@/lib/data';

interface Agendamento {
  id: string;
  usuario_id: string;
  barbeiro_id: string;
  servico: string;
  data: string;
  horario: string;
  valor: number;
  status: string;
  avaliacao: number | null;
}

export default function PainelPage() {
  const router = useRouter();
  const [session, setSession] = useState<{ nome: string } | null>(null);
  const [selectedBarbeiro, setSelectedBarbeiro] = useState<string>('b1');
  const [selectedData, setSelectedData] = useState<string>(new Date().toISOString().split('T')[0]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(false);
  const [mediaEstrelas, setMediaEstrelas] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch('/api/auth').then(r => r.json()).then(d => {
      if (!d.session) { router.push('/login'); return; }
      setSession(d.session);
    });

    // Load stats for all barbers
    fetch('/api/agendamentos?action=stats')
      .then(r => r.json())
      .then(d => {
        const map: Record<string, number> = {};
        (d.stats || []).forEach((s: { barbeiroId: string; mediaEstrelas: number }) => {
          map[s.barbeiroId] = s.mediaEstrelas;
        });
        setMediaEstrelas(map);
      });
  }, [router]);

  useEffect(() => {
    if (!selectedBarbeiro) return;
    setLoading(true);
    fetch(`/api/agendamentos?action=barbeiro&barbeiro_id=${selectedBarbeiro}&data=${selectedData}`)
      .then(r => r.json())
      .then(d => setAgendamentos(d.agendamentos || []))
      .finally(() => setLoading(false));
  }, [selectedBarbeiro, selectedData]);

  const barbeiroInfo = BARBEIROS.find(b => b.id === selectedBarbeiro);

  const confirmados = agendamentos.filter(a => a.status === 'confirmado');
  const pendentes = agendamentos.filter(a => a.status === 'pendente');
  const cancelados = agendamentos.filter(a => a.status === 'cancelado');
  const receitaDia = confirmados.reduce((acc, a) => acc + a.valor, 0);

  const statusColors: Record<string, string> = {
    confirmado: 'text-rasta-green-light bg-rasta-green/20 border-rasta-green/30',
    cancelado: 'text-rasta-red-light bg-rasta-red/20 border-rasta-red/30',
    pendente: 'text-rasta-yellow bg-rasta-yellow/10 border-rasta-yellow/30',
  };

  const agOrdenados = [...agendamentos].sort((a, b) => a.horario.localeCompare(b.horario));

  return (
    <div className="min-h-screen" style={{ background: 'radial-gradient(ellipse at top, #0d0d1a 0%, #0d0d0d 60%)' }}>
      <Navbar userName={session?.nome} />

      <main className="max-w-5xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <p className="text-rasta-yellow text-sm font-medium uppercase tracking-widest mb-2">Gestão</p>
          <h1 className="text-4xl font-black text-rasta-cream" style={{ fontFamily: 'var(--font-display)' }}>
            Painel do Barbeiro
          </h1>
        </div>

        {/* Barber selector */}
        <div className="flex gap-3 mb-8 flex-wrap">
          {BARBEIROS.map(b => (
            <button
              key={b.id}
              onClick={() => setSelectedBarbeiro(b.id)}
              className={`px-5 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                selectedBarbeiro === b.id
                  ? 'bg-rasta-green/30 border-rasta-green/50 text-rasta-green-light'
                  : 'glass-card border-white/10 text-white/60 hover:text-white hover:border-white/20'
              }`}
            >
              {b.nome}
            </button>
          ))}
        </div>

        {/* Barber stats header */}
        {barbeiroInfo && (
          <div className="glass-card border border-white/10 rounded-2xl p-6 mb-8">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-rasta-green/20 border border-rasta-green/30 flex items-center justify-center text-2xl">
                  ✂️
                </div>
                <div>
                  <h2 className="text-xl font-bold text-rasta-cream" style={{ fontFamily: 'var(--font-display)' }}>
                    {barbeiroInfo.nome}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <StarRating value={Math.round(mediaEstrelas[barbeiroInfo.id] || 0)} readonly size="sm" />
                    <span className="text-sm text-white/50">
                      {mediaEstrelas[barbeiroInfo.id]?.toFixed(1) || '—'} média
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="text-center">
                  <p className="text-2xl font-bold text-rasta-green-light">{confirmados.length}</p>
                  <p className="text-xs text-white/40">confirmados</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-rasta-yellow">{pendentes.length}</p>
                  <p className="text-xs text-white/40">pendentes</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-rasta-cream">R$ {receitaDia.toFixed(2)}</p>
                  <p className="text-xs text-white/40">receita do dia</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Date selector */}
        <div className="flex items-center gap-4 mb-6">
          <h2 className="text-sm text-white/50 uppercase tracking-wider">Agenda do dia</h2>
          <input
            type="date"
            value={selectedData}
            onChange={e => setSelectedData(e.target.value)}
            className="input-reggae w-auto text-sm"
          />
        </div>

        {/* Schedule */}
        {loading ? (
          <div className="text-center py-10 text-white/40 animate-pulse">Carregando agenda...</div>
        ) : agOrdenados.length === 0 ? (
          <div className="glass-card border border-white/10 rounded-xl p-10 text-center">
            <p className="text-4xl mb-3">📅</p>
            <p className="text-white/40">Nenhum agendamento para esta data.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {agOrdenados.map((ag, i) => {
              const statusClass = statusColors[ag.status] || statusColors.pendente;
              return (
                <div
                  key={ag.id}
                  className="glass-card border border-white/10 rounded-xl p-4 flex items-center gap-4 animate-slide-up"
                  style={{ animationDelay: `${i * 40}ms`, animationFillMode: 'both' }}
                >
                  {/* Time */}
                  <div className="text-center w-14 flex-shrink-0">
                    <p className="text-lg font-bold text-rasta-cream font-mono">{ag.horario}</p>
                  </div>

                  {/* Divider */}
                  <div className="w-px h-10 bg-white/10" />

                  {/* Info */}
                  <div className="flex-1">
                    <p className="font-medium text-rasta-cream">{ag.servico}</p>
                    <p className="text-xs text-white/40 mt-0.5">Cliente #{ag.usuario_id.slice(0, 8)}</p>
                  </div>

                  {/* Value */}
                  <div className="text-right">
                    <p className="font-bold text-rasta-green-light">R$ {ag.valor.toFixed(2)}</p>
                    <span className={`text-xs border rounded-full px-2 py-0.5 ${statusClass} block mt-1`}>
                      {ag.status}
                    </span>
                  </div>

                  {/* Rating indicator */}
                  {ag.avaliacao && (
                    <div className="flex items-center gap-1 text-rasta-yellow text-sm">
                      ★ {ag.avaliacao}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Cancelados collapsible */}
        {cancelados.length > 0 && (
          <details className="mt-6">
            <summary className="cursor-pointer text-xs text-white/30 hover:text-white/50 transition-colors uppercase tracking-wider">
              {cancelados.length} cancelado(s)
            </summary>
            <div className="mt-3 space-y-2">
              {cancelados.map(ag => (
                <div key={ag.id} className="glass-card border border-white/5 rounded-xl p-3 flex items-center gap-4 opacity-40">
                  <span className="text-sm font-mono text-white/60 w-14">{ag.horario}</span>
                  <span className="text-sm text-white/60">{ag.servico}</span>
                  <span className="ml-auto text-xs text-rasta-red-light">cancelado</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </main>
    </div>
  );
}
