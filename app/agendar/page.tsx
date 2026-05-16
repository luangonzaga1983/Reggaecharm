'use client';
// app/agendar/page.tsx
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { BARBEIROS, SERVICOS } from '@/lib/data';

type Step = 'barbeiro' | 'servico' | 'data' | 'horario' | 'pagamento' | 'sucesso';

export default function AgendarPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselect = searchParams.get('barbeiro');

  const [session, setSession] = useState<{ nome: string } | null>(null);
  const [step, setStep] = useState<Step>('barbeiro');

  const [barbeiro, setBarbeiro] = useState<string>(preselect || '');
  const [servico, setServico] = useState<string>('');
  const [data, setData] = useState<string>('');
  const [horario, setHorario] = useState<string>('');

  const [horarios, setHorarios] = useState<string[]>([]);
  const [ocupados, setOcupados] = useState<string[]>([]);
  const [loadingHorarios, setLoadingHorarios] = useState(false);

  const [agendamentoId, setAgendamentoId] = useState<string>('');
  const [valor, setValor] = useState<number>(0);
  const [loadingAg, setLoadingAg] = useState(false);
  const [error, setError] = useState('');

  const PIX_KEY = process.env.NEXT_PUBLIC_PIX_KEY || 'reggaecharm@pix.com';

  useEffect(() => {
    fetch('/api/auth').then(r => r.json()).then(d => {
      if (!d.session) { router.push('/login'); return; }
      setSession(d.session);
    });
  }, [router]);

  useEffect(() => {
    if (preselect) {
      setBarbeiro(preselect);
      setStep('servico');
    }
  }, [preselect]);

  useEffect(() => {
    if (barbeiro && data) {
      setLoadingHorarios(true);
      fetch(`/api/agendamentos?action=horarios&barbeiro_id=${barbeiro}&data=${data}`)
        .then(r => r.json())
        .then(d => {
          setHorarios(d.horarios || []);
          setOcupados(d.ocupados || []);
        })
        .finally(() => setLoadingHorarios(false));
    }
  }, [barbeiro, data]);

  async function criarAgendamento() {
    setLoadingAg(true);
    setError('');
    const servicoInfo = SERVICOS.find(s => s.id === servico);

    try {
      const res = await fetch('/api/agendamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'criar',
          barbeiro_id: barbeiro,
          servico: servicoInfo?.nome,
          data,
          horario,
        }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error); return; }

      setAgendamentoId(d.agendamento.id);
      setValor(d.agendamento.valor);
      setStep('pagamento');
    } catch {
      setError('Erro ao criar agendamento');
    } finally {
      setLoadingAg(false);
    }
  }

  async function confirmarPagamento() {
    setLoadingAg(true);
    const res = await fetch('/api/agendamentos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'confirmar_pagamento', agendamento_id: agendamentoId }),
    });
    if (res.ok) setStep('sucesso');
    setLoadingAg(false);
  }

  const barbeiroInfo = BARBEIROS.find(b => b.id === barbeiro);
  const servicoInfo = SERVICOS.find(s => s.id === servico);

  const minDate = new Date().toISOString().split('T')[0];

  const stepNumber = { barbeiro: 1, servico: 2, data: 3, horario: 4, pagamento: 5, sucesso: 6 }[step];

  return (
    <div className="min-h-screen" style={{ background: 'radial-gradient(ellipse at top right, #1a0d00 0%, #0d0d0d 50%)' }}>
      <Navbar userName={session?.nome} />

      <main className="max-w-2xl mx-auto px-4 py-10">
        {/* Header */}
        {step !== 'sucesso' && (
          <div className="mb-8">
            <p className="text-rasta-yellow text-sm font-medium uppercase tracking-widest mb-2">Agendamento</p>
            <h1 className="text-3xl font-black text-rasta-cream" style={{ fontFamily: 'var(--font-display)' }}>
              Marque seu corte
            </h1>

            {/* Progress */}
            <div className="flex items-center gap-1 mt-6">
              {[1, 2, 3, 4, 5].map(n => (
                <div
                  key={n}
                  className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                    n <= stepNumber ? 'bg-rasta-green-light' : 'bg-white/10'
                  }`}
                />
              ))}
            </div>
            <p className="text-xs text-white/30 mt-2">Passo {Math.min(stepNumber, 5)} de 5</p>
          </div>
        )}

        {/* STEP: Barbeiro */}
        {step === 'barbeiro' && (
          <div className="space-y-4 animate-fade-in">
            <h2 className="text-lg font-semibold text-rasta-cream mb-4">Escolha o barbeiro</h2>
            {BARBEIROS.map(b => (
              <button
                key={b.id}
                onClick={() => { setBarbeiro(b.id); setStep('servico'); }}
                className="w-full glass-card border border-white/10 hover:border-rasta-green/40 rounded-xl p-5 flex items-center gap-4 text-left transition-all group"
              >
                <div className="w-12 h-12 rounded-full bg-rasta-green/20 flex items-center justify-center text-2xl flex-shrink-0">
                  ✂️
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-rasta-cream group-hover:text-rasta-green-light transition-colors">
                    {b.nome}
                  </div>
                  <div className="text-xs text-white/40 mt-1 capitalize">{b.especialidades.join(' · ')}</div>
                </div>
                <span className="text-white/20 group-hover:text-rasta-green-light transition-colors">→</span>
              </button>
            ))}
          </div>
        )}

        {/* STEP: Serviço */}
        {step === 'servico' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => setStep('barbeiro')} className="text-white/40 hover:text-white transition-colors">← Voltar</button>
              <h2 className="text-lg font-semibold text-rasta-cream">Escolha o serviço</h2>
            </div>
            {barbeiroInfo && (
              <div className="flex items-center gap-2 mb-2 text-sm text-white/50">
                <span>✂️</span> <span>{barbeiroInfo.nome}</span>
              </div>
            )}
            {SERVICOS.map(s => (
              <button
                key={s.id}
                onClick={() => { setServico(s.id); setStep('data'); }}
                className="w-full glass-card border border-white/10 hover:border-rasta-yellow/40 rounded-xl p-5 flex items-center justify-between text-left transition-all group"
              >
                <div>
                  <div className="font-semibold text-rasta-cream group-hover:text-rasta-yellow transition-colors">{s.nome}</div>
                  <div className="text-xs text-white/40 mt-1">{s.descricao}</div>
                </div>
                <div className="text-right">
                  <div className="text-rasta-green-light font-bold">R$ {s.valor.toFixed(2)}</div>
                  <div className="text-xs text-white/30">{s.duracao} min</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* STEP: Data */}
        {step === 'data' && (
          <div className="animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => setStep('servico')} className="text-white/40 hover:text-white transition-colors">← Voltar</button>
              <h2 className="text-lg font-semibold text-rasta-cream">Escolha a data</h2>
            </div>
            <div className="flex gap-3 text-sm text-white/40 mb-6">
              <span>✂️ {barbeiroInfo?.nome}</span>
              <span>·</span>
              <span>💈 {servicoInfo?.nome}</span>
            </div>

            <div className="glass-card border border-white/10 rounded-xl p-6">
              <label className="block text-xs text-white/50 mb-2 uppercase tracking-wider">Data do agendamento</label>
              <input
                type="date"
                value={data}
                min={minDate}
                onChange={e => setData(e.target.value)}
                className="input-reggae"
              />
              {data && (
                <button
                  onClick={() => setStep('horario')}
                  className="btn-primary w-full mt-4"
                >
                  Ver horários disponíveis →
                </button>
              )}
            </div>
          </div>
        )}

        {/* STEP: Horário */}
        {step === 'horario' && (
          <div className="animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => setStep('data')} className="text-white/40 hover:text-white transition-colors">← Voltar</button>
              <h2 className="text-lg font-semibold text-rasta-cream">Escolha o horário</h2>
            </div>
            <div className="flex gap-3 text-sm text-white/40 mb-6 flex-wrap">
              <span>✂️ {barbeiroInfo?.nome}</span>
              <span>·</span>
              <span>💈 {servicoInfo?.nome}</span>
              <span>·</span>
              <span>📅 {data}</span>
            </div>

            {loadingHorarios ? (
              <div className="text-center py-10 text-white/40 animate-pulse">Carregando horários...</div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {horarios.map(h => {
                  const isOcupado = ocupados.includes(h);
                  const isSelected = horario === h;
                  return (
                    <button
                      key={h}
                      disabled={isOcupado}
                      onClick={() => setHorario(h)}
                      className={`py-3 rounded-lg text-sm font-medium transition-all ${
                        isOcupado
                          ? 'bg-white/5 text-white/20 cursor-not-allowed line-through'
                          : isSelected
                          ? 'bg-rasta-green text-white border border-rasta-green-light shadow-lg shadow-rasta-green/20'
                          : 'glass-card border border-white/10 text-rasta-cream hover:border-rasta-green/40 hover:text-rasta-green-light'
                      }`}
                    >
                      {h}
                    </button>
                  );
                })}
              </div>
            )}

            {error && (
              <div className="mt-4 bg-rasta-red/20 border border-rasta-red/40 rounded-lg px-4 py-3 text-sm text-rasta-red-light">
                {error}
              </div>
            )}

            {horario && (
              <button
                onClick={criarAgendamento}
                disabled={loadingAg}
                className="btn-primary w-full mt-6 disabled:opacity-50"
              >
                {loadingAg ? 'Reservando...' : `Confirmar às ${horario} →`}
              </button>
            )}
          </div>
        )}

        {/* STEP: Pagamento PIX */}
        {step === 'pagamento' && (
          <div className="animate-fade-in">
            <div className="rasta-stripe rounded-t-xl" />
            <div className="glass-card border border-rasta-yellow/20 rounded-b-xl rounded-tr-xl p-8">
              <div className="text-center mb-6">
                <div className="text-5xl mb-3">💳</div>
                <h2 className="text-2xl font-bold text-rasta-cream" style={{ fontFamily: 'var(--font-display)' }}>
                  Pague via PIX
                </h2>
                <p className="text-white/50 text-sm mt-1">Pague no seu banco e confirme aqui</p>
              </div>

              {/* Value */}
              <div className="bg-rasta-green/10 border border-rasta-green/30 rounded-xl p-4 text-center mb-6">
                <p className="text-xs text-white/40 mb-1">Valor a pagar</p>
                <p className="text-3xl font-bold text-rasta-green-light">R$ {valor.toFixed(2)}</p>
              </div>

              {/* Summary */}
              <div className="space-y-2 mb-6 text-sm">
                <div className="flex justify-between text-white/60">
                  <span>Barbeiro</span>
                  <span className="text-rasta-cream">{barbeiroInfo?.nome}</span>
                </div>
                <div className="flex justify-between text-white/60">
                  <span>Serviço</span>
                  <span className="text-rasta-cream">{servicoInfo?.nome}</span>
                </div>
                <div className="flex justify-between text-white/60">
                  <span>Data</span>
                  <span className="text-rasta-cream">{data} às {horario}</span>
                </div>
              </div>

              {/* PIX Key */}
              <div className="bg-rasta-smoke border border-rasta-yellow/30 rounded-xl p-4 mb-6">
                <p className="text-xs text-white/40 mb-2 uppercase tracking-wider">Chave PIX</p>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-rasta-yellow font-medium break-all">{PIX_KEY}</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(PIX_KEY)}
                    className="text-xs text-white/40 hover:text-white border border-white/10 rounded-lg px-3 py-1.5 flex-shrink-0 hover:border-white/30 transition-all"
                  >
                    Copiar
                  </button>
                </div>
                <p className="text-xs text-white/30 mt-2">
                  ⚠️ Use a referência: <span className="text-white/50 font-mono">{agendamentoId.slice(0, 8).toUpperCase()}</span>
                </p>
              </div>

              <button
                onClick={confirmarPagamento}
                disabled={loadingAg}
                className="btn-primary w-full disabled:opacity-50"
              >
                {loadingAg ? 'Confirmando...' : '✅ Já paguei — Confirmar agendamento'}
              </button>

              <p className="text-center text-xs text-white/20 mt-4">
                Não pagou ainda? O agendamento ficará pendente.
              </p>
            </div>
          </div>
        )}

        {/* STEP: Sucesso */}
        {step === 'sucesso' && (
          <div className="animate-fade-in text-center py-10">
            <div className="text-7xl mb-6 animate-float inline-block">🎉</div>
            <h1 className="text-4xl font-black text-rasta-cream mb-3" style={{ fontFamily: 'var(--font-display)' }}>
              Agendado!
            </h1>
            <p className="text-white/50 mb-2">Seu corte está confirmado.</p>
            <p className="text-rasta-green-light font-medium mb-2">+10 pontos adicionados!</p>

            <div className="glass-card border border-white/10 rounded-xl p-6 mt-8 mb-8 text-left space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-white/50">Barbeiro</span>
                <span className="text-rasta-cream font-medium">{barbeiroInfo?.nome}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Serviço</span>
                <span className="text-rasta-cream font-medium">{servicoInfo?.nome}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Data</span>
                <span className="text-rasta-cream font-medium">{data} às {horario}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Valor pago</span>
                <span className="text-rasta-green-light font-bold">R$ {valor.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex gap-3 justify-center">
              <button onClick={() => router.push('/perfil')} className="btn-ghost">
                Ver histórico
              </button>
              <button onClick={() => router.push('/inicio')} className="btn-primary">
                Início
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
