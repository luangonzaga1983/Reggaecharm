'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UNIDADES, BARBEIROS, SERVICOS, getUnidadeStatus, gerarHorarios } from '@/lib/data';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Session { id: string; nome: string; email: string; }
interface Usuario { nome: string; email: string; barbeiro_favorito: string | null; servico_favorito: string | null; horario_favorito: string | null; unidade_favorita: string | null; pontos: number; tema: 'dark' | 'light'; }
interface Agendamento { id: string; barbeiro_id: string; unidade_id: string; servico: string; data: string; horario: string; valor: number; status: string; avaliacao: number | null; }
interface Stats { barbeiroId: string; mediaEstrelas: number; totalAvaliacoes: number; }

type Step = 'unidade' | 'barbeiro' | 'servico' | 'data' | 'termos' | 'sucesso';
type Tab = 'dashboard' | 'configuracoes';

// ─── Star Rating ─────────────────────────────────────────────────────────────

function Stars({ value, onChange, readonly }: { value: number; onChange?: (v: number) => void; readonly?: boolean }) {
  const [hover, setHover] = useState(0);
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {[1,2,3,4,5].map(i => (
        <span
          key={i}
          className={'star' + (i <= (hover || value) ? ' on' : '')}
          onMouseEnter={() => !readonly && setHover(i)}
          onMouseLeave={() => !readonly && setHover(0)}
          onClick={() => !readonly && onChange?.(i)}
          style={{ cursor: readonly ? 'default' : 'pointer' }}
        >★</span>
      ))}
    </span>
  );
}

// ─── Modal de Agendamento ────────────────────────────────────────────────────

function AgendarModal({ session, usuario, stats, onClose, onSuccess }: {
  session: Session;
  usuario: Usuario | null;
  stats: Stats[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<Step>('unidade');
  const [unidadeId, setUnidadeId] = useState('');
  const [barbeiroId, setBarbeiroId] = useState('');
  const [servicoId, setServicoId] = useState('');
  const [data, setData] = useState('');
  const [horario, setHorario] = useState('');
  const [ocupados, setOcupados] = useState<string[]>([]);
  const [termos, setTermos] = useState(false);
  const [loading, setLoading] = useState(false);
  const [agendamentoId, setAgendamentoId] = useState('');
  const [error, setError] = useState('');

  const unidade = UNIDADES.find(u => u.id === unidadeId);
  const barbeiro = BARBEIROS.find(b => b.id === barbeiroId);
  const servico = SERVICOS.find(s => s.id === servicoId);
  const horarios = unidade ? gerarHorarios(unidade.horario.abertura, unidade.horario.fechamento) : [];
  const minDate = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (barbeiroId && unidadeId && data) {
      fetch(`/api/agendamentos?action=horarios&barbeiro_id=${barbeiroId}&data=${data}`)
        .then(r => r.json()).then(d => setOcupados(d.ocupados || []));
    }
  }, [barbeiroId, unidadeId, data]);

  const stepN = { unidade: 1, barbeiro: 2, servico: 3, data: 4, termos: 5, sucesso: 6 }[step];

  async function confirmar() {
    if (!termos) return;
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/agendamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'criar', barbeiro_id: barbeiroId, unidade_id: unidadeId, servico: servico?.nome, data, horario }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'Erro'); return; }
      setAgendamentoId(d.agendamento.id);
      setStep('sucesso');
    } finally { setLoading(false); }
  }

  return (
    <div className="modal-back" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxHeight: '90vh', overflowY: 'auto' }}>

        {step !== 'sucesso' && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', letterSpacing: '0.04em', color: 'var(--green)' }}>
                AGENDAR
              </span>
              <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '1.2rem' }} onClick={onClose}>✕</button>
            </div>
            {/* Progress */}
            <div style={{ display: 'flex', gap: 4 }}>
              {[1,2,3,4,5].map(n => (
                <div key={n} className="progress-track" style={{ flex: 1 }}>
                  <div className="progress-fill" style={{ width: n <= stepN ? '100%' : '0%' }} />
                </div>
              ))}
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-faint)', marginTop: 6, fontFamily: 'var(--font-mono)' }}>
              PASSO {Math.min(stepN, 5)} / 5
            </p>
          </div>
        )}

        {/* UNIDADE */}
        {step === 'unidade' && (
          <div className="anim-in">
            <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Escolha a</p>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', marginBottom: 20 }}>UNIDADE</h2>

            {/* Botão localização — não funcional ainda */}
            <button className="btn btn-outline" style={{ width: '100%', marginBottom: 16, opacity: 0.5, cursor: 'not-allowed' }}>
              <span>📍</span> Usar a mais próxima
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {UNIDADES.map(u => {
                const st = getUnidadeStatus(u);
                return (
                  <button
                    key={u.id}
                    className="card card-green"
                    style={{ padding: '16px', textAlign: 'left', border: '1px solid var(--border)', cursor: 'pointer', width: '100%', background: 'var(--surface)' }}
                    onClick={() => { setUnidadeId(u.id); setStep('barbeiro'); }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: '0.95rem' }}>{u.nome}</p>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: 2 }}>{u.endereco} · {u.bairro}</p>
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-faint)', marginTop: 1 }}>{u.cidade}</p>
                      </div>
                      {st.aberto
                        ? <span className="open-indicator"><span className="dot-live" />Aberto</span>
                        : <span className="closed-indicator">Fechado</span>}
                    </div>
                    <p style={{ fontSize: '0.75rem', color: st.aberto ? 'var(--green)' : 'var(--text-faint)', marginTop: 8 }}>{st.texto}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* BARBEIRO */}
        {step === 'barbeiro' && (
          <div className="anim-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <button className="btn btn-ghost" style={{ padding: '6px 10px' }} onClick={() => setStep('unidade')}>←</button>
              <div>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Escolha o</p>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem' }}>BARBEIRO</h2>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {unidade?.barbeiros.map(bid => {
                const b = BARBEIROS.find(x => x.id === bid)!;
                const stat = stats.find(s => s.barbeiroId === bid);
                const isFav = usuario?.barbeiro_favorito === bid;
                return (
                  <button
                    key={bid}
                    className="card card-green"
                    style={{ padding: '16px 20px', textAlign: 'left', cursor: 'pointer', width: '100%', background: 'var(--surface)', border: '1px solid var(--border)' }}
                    onClick={() => { setBarbeiroId(bid); setStep('servico'); }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--surface3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>
                        {b.emoji}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <p style={{ fontWeight: 700 }}>{b.nome}</p>
                          {isFav && <span className="badge badge-yellow">⭐ Fav</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                          <Stars value={Math.round(stat?.mediaEstrelas || 0)} readonly />
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
                            {stat?.mediaEstrelas ? stat.mediaEstrelas.toFixed(1) : '—'} ({stat?.totalAvaliacoes || 0})
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                          {b.especialidades.map(e => <span key={e} className="badge badge-gray">{e}</span>)}
                        </div>
                      </div>
                      <span style={{ color: 'var(--text-faint)' }}>→</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* SERVICO */}
        {step === 'servico' && (
          <div className="anim-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <button className="btn btn-ghost" style={{ padding: '6px 10px' }} onClick={() => setStep('barbeiro')}>←</button>
              <div>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Escolha o</p>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem' }}>CORTE</h2>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {SERVICOS.map(s => {
                const isFav = usuario?.servico_favorito === s.id;
                return (
                  <button
                    key={s.id}
                    className="card card-yellow"
                    style={{ padding: '14px 18px', textAlign: 'left', cursor: 'pointer', width: '100%', background: 'var(--surface)', border: '1px solid var(--border)' }}
                    onClick={() => { setServicoId(s.id); setStep('data'); }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <p style={{ fontWeight: 700, fontSize: '0.95rem' }}>{s.nome}</p>
                          {isFav && <span className="badge badge-yellow">Fav</span>}
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 2 }}>{s.descricao}</p>
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-faint)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>{s.duracao} min</p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 16 }}>
                        <p style={{ fontWeight: 800, color: 'var(--green)', fontSize: '1.1rem' }}>R${s.valor}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* DATA & HORÁRIO */}
        {step === 'data' && (
          <div className="anim-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <button className="btn btn-ghost" style={{ padding: '6px 10px' }} onClick={() => setStep('servico')}>←</button>
              <div>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Escolha data &</p>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem' }}>HORÁRIO</h2>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', display: 'block', marginBottom: 6 }}>Data</label>
              <input type="date" className="input" min={minDate} value={data} onChange={e => setData(e.target.value)} style={{ colorScheme: 'dark' }} />
            </div>

            {data && (
              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-dim)', display: 'block', marginBottom: 8 }}>Horário disponível</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                  {horarios.map(h => {
                    const busy = ocupados.includes(h);
                    const isFav = usuario?.horario_favorito === h;
                    return (
                      <button
                        key={h}
                        disabled={busy}
                        onClick={() => { setHorario(h); setStep('termos'); }}
                        style={{
                          padding: '10px 6px',
                          borderRadius: 8,
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          fontFamily: 'var(--font-mono)',
                          cursor: busy ? 'not-allowed' : 'pointer',
                          border: '1px solid',
                          background: busy ? 'transparent' : horario === h ? 'var(--green)' : 'var(--surface2)',
                          color: busy ? 'var(--text-faint)' : horario === h ? '#000' : isFav ? 'var(--yellow)' : 'var(--text)',
                          borderColor: busy ? 'var(--border)' : horario === h ? 'var(--green)' : isFav ? 'rgba(255,214,0,0.4)' : 'var(--border)',
                          textDecoration: busy ? 'line-through' : 'none',
                          transition: 'all 0.15s',
                        }}
                      >{h}</button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TERMOS */}
        {step === 'termos' && (
          <div className="anim-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <button className="btn btn-ghost" style={{ padding: '6px 10px' }} onClick={() => setStep('data')}>←</button>
              <div>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Confirme os</p>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem' }}>TERMOS</h2>
              </div>
            </div>

            {/* Resumo */}
            <div className="card" style={{ padding: 16, marginBottom: 20 }}>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Resumo</p>
              {[
                ['Unidade', unidade?.nome],
                ['Barbeiro', barbeiro?.nome],
                ['Serviço', servico?.nome],
                ['Data', data ? new Date(data + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }) : ''],
                ['Horário', horario],
                ['Valor', servico ? 'R$ ' + servico.valor.toFixed(2) : ''],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6, marginBottom: 6, borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-faint)' }}>{k}</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>

            {/* Termos de uso */}
            <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: 14, marginBottom: 16, maxHeight: 180, overflowY: 'auto', fontSize: '0.75rem', lineHeight: 1.7, color: 'var(--text-dim)' }}>
              <p style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Termos de Uso — Reggae Charm Barbearia</p>
              <p><strong>1. Compromisso de comparecimento.</strong> Ao confirmar o agendamento, o cliente se compromete a comparecer no horário marcado. Atrasos superiores a 15 minutos podem resultar em cancelamento automático, sem direito a reembolso.</p>
              <br />
              <p><strong>2. Cancelamento.</strong> Cancelamentos devem ser feitos com no mínimo 2 horas de antecedência pelo próprio sistema. Não comparecimento sem aviso prévio implica penalidade de bloqueio temporário por 7 dias.</p>
              <br />
              <p><strong>3. Reagendamento.</strong> É permitido um reagendamento gratuito por agendamento, com pelo menos 1 hora de antecedência.</p>
              <br />
              <p><strong>4. Saúde e higiene.</strong> A barbearia reserva o direito de recusar o atendimento em caso de condições que possam comprometer a higiene ou segurança do profissional ou de outros clientes.</p>
              <br />
              <p><strong>5. Avaliação.</strong> Após o atendimento, o cliente poderá avaliar o barbeiro com 1 a 5 estrelas. Avaliações fraudulentas ou de má-fé poderão resultar em suspensão da conta.</p>
              <br />
              <p><strong>6. Privacidade.</strong> Seus dados (nome, e-mail, histórico) são utilizados exclusivamente para gerenciar agendamentos e melhorar o serviço, conforme a LGPD (Lei 13.709/2018).</p>
              <br />
              <p><strong>7. Conduta.</strong> Comportamento inadequado com os profissionais resultará em banimento permanente da plataforma.</p>
              <br />
              <p><strong>8. Pagamento.</strong> O pagamento é realizado presencialmente na unidade. Valores podem variar de acordo com o serviço real executado.</p>
            </div>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', marginBottom: 20 }}>
              <input
                type="checkbox"
                checked={termos}
                onChange={e => setTermos(e.target.checked)}
                style={{ width: 18, height: 18, marginTop: 2, accentColor: 'var(--green)', flexShrink: 0 }}
              />
              <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
                Li e aceito os termos de uso, e me comprometo a comparecer no horário agendado.
              </span>
            </label>

            {error && <p style={{ color: 'var(--red)', fontSize: '0.82rem', marginBottom: 12 }}>{error}</p>}

            <button
              className="btn btn-green"
              style={{ width: '100%', opacity: termos ? 1 : 0.4 }}
              disabled={!termos || loading}
              onClick={confirmar}
            >
              {loading ? <><span className="spinner" /> Confirmando...</> : 'Confirmar agendamento'}
            </button>
          </div>
        )}

        {/* SUCESSO */}
        {step === 'sucesso' && (
          <div className="anim-in" style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '4rem', marginBottom: 16, animation: 'fadeUp 0.5s ease' }}>✅</div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', color: 'var(--green)', marginBottom: 8 }}>AGENDADO!</p>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', marginBottom: 6 }}>
              {barbeiro?.nome} · {servico?.nome}
            </p>
            <p style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', marginBottom: 24 }}>
              {data ? new Date(data + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }) : ''} às {horario}
            </p>
            <button className="btn btn-green" style={{ width: '100%' }} onClick={() => { onSuccess(); onClose(); }}>
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

function Dashboard({ session, usuario, stats, agendamentos, onAgendar, onRefresh }: {
  session: Session;
  usuario: Usuario | null;
  stats: Stats[];
  agendamentos: Agendamento[];
  onAgendar: () => void;
  onRefresh: () => void;
}) {
  const [avaliacoes, setAvaliacoes] = useState<Record<string, number>>({});
  const [savingAv, setSavingAv] = useState<string | null>(null);

  useEffect(() => {
    const av: Record<string, number> = {};
    agendamentos.forEach(a => { if (a.avaliacao) av[a.id] = a.avaliacao; });
    setAvaliacoes(av);
  }, [agendamentos]);

  async function salvarAvaliacao(id: string, estrelas: number) {
    setSavingAv(id);
    setAvaliacoes(p => ({ ...p, [id]: estrelas }));
    await fetch('/api/agendamentos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'avaliar', agendamento_id: id, estrelas }),
    });
    setSavingAv(null);
    onRefresh();
  }

  async function cancelar(id: string) {
    if (!confirm('Cancelar este agendamento?')) return;
    await fetch('/api/agendamentos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancelar', agendamento_id: id }),
    });
    onRefresh();
  }

  const hoje = new Date().toISOString().split('T')[0];
  const proximos = agendamentos.filter(a => a.data >= hoje && a.status !== 'cancelado');
  const passados = agendamentos.filter(a => a.data < hoje || a.status === 'cancelado');

  // Info do dia — próximo agendamento de hoje
  const hoje_ag = agendamentos.find(a => a.data === hoje && a.status !== 'cancelado');

  function getBarbeiro(id: string) { return BARBEIROS.find(b => b.id === id); }
  function getUnidade(id: string) { return UNIDADES.find(u => u.id === id); }

  const statusBadge: Record<string, string> = {
    confirmado: 'badge-green',
    pendente: 'badge-yellow',
    cancelado: 'badge-red',
  };

  return (
    <div>
      {/* Hero header */}
      <div className="anim-up" style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p style={{ fontSize: '0.72rem', color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.14em', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
              ONE LOVE, ONE CUT
            </p>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.5rem, 8vw, 4.5rem)', lineHeight: 1, letterSpacing: '0.02em' }}>
              <span style={{ display: 'block' }}>REGGAE</span>
              <span style={{ display: 'block', color: 'var(--green)', textShadow: '0 0 30px rgba(0,200,83,0.4)' }}>CHARM</span>
            </h1>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-faint)', marginBottom: 4 }}>Bem-vindo</p>
            <p style={{ fontWeight: 700, fontSize: '1.1rem' }}>{session.nome.split(' ')[0]}</p>
            {usuario && (
              <p style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--yellow)', marginTop: 4 }}>⭐ {usuario.pontos} pts</p>
            )}
          </div>
        </div>

        {/* Rasta bar */}
        <div className="rasta-bar" style={{ marginTop: 16, borderRadius: 2, opacity: 0.7 }} />
      </div>

      {/* Info do dia */}
      <div className="anim-up d-1" style={{ marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {/* Unidades abertas */}
          {UNIDADES.map(u => {
            const st = getUnidadeStatus(u);
            return (
              <div key={u.id} className="card" style={{ padding: '14px 16px' }}>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-faint)', marginBottom: 4 }}>{u.bairro}</p>
                <p style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: 6 }}>{u.nome.replace('Reggae Charm ', '')}</p>
                {st.aberto
                  ? <span className="open-indicator"><span className="dot-live" />{st.texto}</span>
                  : <span className="closed-indicator">⏸ {st.texto}</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* CTA Agendar */}
      <div className="anim-up d-2" style={{ marginBottom: 32 }}>
        {hoje_ag ? (
          <div className="card" style={{ padding: '20px 24px', border: '1px solid rgba(0,200,83,0.3)', boxShadow: 'var(--glow-green)' }}>
            <p style={{ fontSize: '0.72rem', color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Seu corte hoje</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem' }}>
                  {getBarbeiro(hoje_ag.barbeiro_id)?.nome} · {hoje_ag.horario}
                </p>
                <p style={{ color: 'var(--text-dim)', fontSize: '0.82rem', marginTop: 2 }}>
                  {hoje_ag.servico} · {getUnidade(hoje_ag.unidade_id)?.bairro}
                </p>
              </div>
              <span className={'badge ' + (statusBadge[hoje_ag.status] || 'badge-gray')}>{hoje_ag.status}</span>
            </div>
          </div>
        ) : (
          <button
            className="btn btn-green"
            style={{ width: '100%', padding: '18px 32px', fontSize: '1rem', borderRadius: 14, position: 'relative', overflow: 'hidden' }}
            onClick={onAgendar}
          >
            <span style={{ position: 'relative', zIndex: 1, fontFamily: 'var(--font-display)', fontSize: '1.4rem', letterSpacing: '0.06em' }}>
              AGENDAR HORÁRIO ✂️
            </span>
          </button>
        )}
      </div>

      {/* Avaliação dos barbeiros */}
      <div className="anim-up d-3" style={{ marginBottom: 32 }}>
        <p style={{ fontSize: '0.72rem', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>Barbeiros</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
          {BARBEIROS.map(b => {
            const stat = stats.find(s => s.barbeiroId === b.id);
            const unNomes = b.unidades.map(uid => UNIDADES.find(u => u.id === uid)?.bairro).filter(Boolean);
            return (
              <div key={b.id} className="card card-hover" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--surface3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', flexShrink: 0 }}>
                  {b.emoji}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.nome}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <Stars value={Math.round(stat?.mediaEstrelas || 0)} readonly />
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
                      {stat?.mediaEstrelas ? stat.mediaEstrelas.toFixed(1) : '—'}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.68rem', color: 'var(--text-faint)', marginTop: 2 }}>{unNomes.join(', ')}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Agendamentos */}
      <div className="anim-up d-4">
        {proximos.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Próximos</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {proximos.slice(0, 5).map(a => {
                const b = getBarbeiro(a.barbeiro_id);
                const u = getUnidade(a.unidade_id);
                return (
                  <div key={a.id} className="card" style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: '1.1rem' }}>{b?.emoji}</span>
                          <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>{b?.nome}</p>
                          <span className={'badge ' + (statusBadge[a.status] || 'badge-gray')}>{a.status}</span>
                        </div>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>{a.servico}</p>
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                          {new Date(a.data + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} · {a.horario} · {u?.bairro}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ color: 'var(--green)', fontWeight: 700, fontSize: '0.9rem' }}>R${a.valor}</p>
                        {a.status === 'pendente' && a.data >= hoje && (
                          <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: '0.72rem', marginTop: 6 }} onClick={() => cancelar(a.id)}>Cancelar</button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Histórico */}
        {passados.length > 0 && (
          <div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Histórico</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {passados.slice(0, 8).map(a => {
                const b = getBarbeiro(a.barbeiro_id);
                const av = avaliacoes[a.id] || a.avaliacao || 0;
                const podeAvaliar = a.status === 'confirmado' && !a.avaliacao;
                return (
                  <div key={a.id} className="card" style={{ padding: '14px 18px', opacity: a.status === 'cancelado' ? 0.5 : 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: '1rem' }}>{b?.emoji}</span>
                          <p style={{ fontWeight: 600, fontSize: '0.85rem' }}>{b?.nome}</p>
                          <span className={'badge ' + (statusBadge[a.status] || 'badge-gray')}>{a.status}</span>
                        </div>
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
                          {new Date(a.data + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })} · {a.horario}
                        </p>
                        <div style={{ marginTop: 6 }}>
                          <Stars
                            value={av}
                            readonly={!podeAvaliar || savingAv === a.id}
                            onChange={v => salvarAvaliacao(a.id, v)}
                          />
                          {podeAvaliar && <span style={{ fontSize: '0.68rem', color: 'var(--text-faint)', marginLeft: 6 }}>clique para avaliar</span>}
                        </div>
                      </div>
                      <p style={{ color: 'var(--text-faint)', fontSize: '0.82rem', flexShrink: 0 }}>R${a.valor}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {agendamentos.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-faint)' }}>
            <p style={{ fontSize: '2rem', marginBottom: 8 }}>✂️</p>
            <p style={{ fontSize: '0.9rem' }}>Nenhum agendamento ainda</p>
            <button className="btn btn-green" style={{ marginTop: 16 }} onClick={onAgendar}>Agendar agora</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Configurações ───────────────────────────────────────────────────────────

function Configuracoes({ session, usuario, onUpdate, onLogout }: {
  session: Session;
  usuario: Usuario | null;
  onUpdate: () => void;
  onLogout: () => void;
}) {
  const [tema, setTema] = useState<'dark' | 'light'>(usuario?.tema || 'dark');
  const [barbeiroFav, setBarbeiroFav] = useState(usuario?.barbeiro_favorito || '');
  const [servicoFav, setServicoFav] = useState(usuario?.servico_favorito || '');
  const [horarioFav, setHorarioFav] = useState(usuario?.horario_favorito || '');
  const [unidadeFav, setUnidadeFav] = useState(usuario?.unidade_favorita || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Senha
  const [senhaAtual, setSenhaAtual] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [senhaConfirm, setSenhaConfirm] = useState('');
  const [senhaError, setSenhaError] = useState('');
  const [senhaOk, setSenhaOk] = useState(false);
  const [savingSenha, setSavingSenha] = useState(false);

  const horarios = ['07:00','07:30','08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00'];

  async function salvarPrefs() {
    setSaving(true);
    await fetch('/api/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'prefs', tema, barbeiro_favorito: barbeiroFav || null, servico_favorito: servicoFav || null, horario_favorito: horarioFav || null, unidade_favorita: unidadeFav || null }),
    });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    onUpdate();
  }

  async function alterarSenha() {
    setSenhaError(''); setSenhaOk(false);
    if (senhaNova !== senhaConfirm) { setSenhaError('Senhas não coincidem'); return; }
    if (senhaNova.length < 6) { setSenhaError('Mínimo 6 caracteres'); return; }
    setSavingSenha(true);
    const res = await fetch('/api/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'senha', senha_atual: senhaAtual, senha_nova: senhaNova }),
    });
    const d = await res.json();
    setSavingSenha(false);
    if (!res.ok) { setSenhaError(d.error || 'Erro'); return; }
    setSenhaOk(true); setSenhaAtual(''); setSenhaNova(''); setSenhaConfirm('');
  }

  async function excluirConta() {
    const confirm1 = confirm('Tem certeza? Esta ação é irreversível e liberará seu dispositivo para criar uma nova conta.');
    if (!confirm1) return;
    const confirm2 = prompt('Digite "EXCLUIR" para confirmar:');
    if (confirm2 !== 'EXCLUIR') return;
    await fetch('/api/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'excluir' }),
    });
    onLogout();
  }

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="card anim-up" style={{ padding: '20px 22px', marginBottom: 16 }}>
      <p style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-faint)', marginBottom: 16 }}>{title}</p>
      {children}
    </div>
  );

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 }}>
      <span style={{ fontSize: '0.88rem', color: 'var(--text-dim)' }}>{label}</span>
      {children}
    </div>
  );

  return (
    <div>
      <div className="anim-up" style={{ marginBottom: 28 }}>
        <p style={{ fontSize: '0.72rem', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Painel</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 6vw, 3.5rem)' }}>CONFIGURAÇÕES</h1>
      </div>

      <Section title="Conta">
        <Row label="Nome"><span style={{ fontWeight: 700 }}>{session.nome}</span></Row>
        <Row label="E-mail"><span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-dim)' }}>{session.email}</span></Row>
      </Section>

      <Section title="Aparência">
        <Row label="Tema">
          <div style={{ display: 'flex', gap: 8 }}>
            {(['dark', 'light'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTema(t)}
                className="btn"
                style={{
                  padding: '6px 14px',
                  fontSize: '0.8rem',
                  background: tema === t ? 'var(--green)' : 'var(--surface2)',
                  color: tema === t ? '#000' : 'var(--text-dim)',
                  border: '1px solid ' + (tema === t ? 'var(--green)' : 'var(--border)'),
                }}
              >
                {t === 'dark' ? '🌑 Escuro' : '☀️ Claro'}
              </button>
            ))}
          </div>
        </Row>
      </Section>

      <Section title="Preferências">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-faint)', display: 'block', marginBottom: 4 }}>Barbeiro favorito</label>
            <select className="input" value={barbeiroFav} onChange={e => setBarbeiroFav(e.target.value)}>
              <option value="">Nenhum</option>
              {BARBEIROS.map(b => <option key={b.id} value={b.id}>{b.emoji} {b.nome}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-faint)', display: 'block', marginBottom: 4 }}>Serviço favorito</label>
            <select className="input" value={servicoFav} onChange={e => setServicoFav(e.target.value)}>
              <option value="">Nenhum</option>
              {SERVICOS.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-faint)', display: 'block', marginBottom: 4 }}>Horário favorito</label>
            <select className="input" value={horarioFav} onChange={e => setHorarioFav(e.target.value)}>
              <option value="">Nenhum</option>
              {horarios.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-faint)', display: 'block', marginBottom: 4 }}>Unidade favorita</label>
            <select className="input" value={unidadeFav} onChange={e => setUnidadeFav(e.target.value)}>
              <option value="">Nenhuma</option>
              {UNIDADES.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </div>
          <button className="btn btn-green" onClick={salvarPrefs} disabled={saving} style={{ marginTop: 6 }}>
            {saving ? <><span className="spinner" />Salvando...</> : saved ? '✓ Salvo!' : 'Salvar preferências'}
          </button>
        </div>
      </Section>

      <Section title="Alterar senha">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input type="password" className="input" placeholder="Senha atual" value={senhaAtual} onChange={e => setSenhaAtual(e.target.value)} />
          <input type="password" className="input" placeholder="Nova senha" value={senhaNova} onChange={e => setSenhaNova(e.target.value)} />
          <input type="password" className="input" placeholder="Confirmar nova senha" value={senhaConfirm} onChange={e => setSenhaConfirm(e.target.value)} />
          {senhaError && <p style={{ color: 'var(--red)', fontSize: '0.8rem' }}>{senhaError}</p>}
          {senhaOk && <p style={{ color: 'var(--green)', fontSize: '0.8rem' }}>✓ Senha alterada!</p>}
          <button className="btn btn-outline" onClick={alterarSenha} disabled={savingSenha}>
            {savingSenha ? <><span className="spinner" />Salvando...</> : 'Alterar senha'}
          </button>
        </div>
      </Section>

      <Section title="Sessão">
        <button className="btn btn-outline" style={{ width: '100%', marginBottom: 10 }} onClick={onLogout}>
          Sair da sessão
        </button>
        <button className="btn btn-danger" style={{ width: '100%' }} onClick={excluirConta}>
          Excluir conta
        </button>
        <p style={{ fontSize: '0.7rem', color: 'var(--text-faint)', marginTop: 10, lineHeight: 1.5 }}>
          Excluir a conta remove permanentemente seus dados e libera seu dispositivo para criar uma nova conta.
        </p>
      </Section>
    </div>
  );
}

// ─── Login/Registro ──────────────────────────────────────────────────────────

function Auth({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode] = useState<'login' | 'registro'>('login');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setError(''); setLoading(true);
    try {
      const body: Record<string, string> = { action: mode, email, senha };
      if (mode === 'registro') body.nome = nome;
      const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'Erro'); return; }
      onSuccess();
    } finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      {/* BG gradient */}
      <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse 80% 80% at 50% -20%, rgba(0,200,83,0.12), transparent)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 380 }}>
        {/* Logo */}
        <div className="anim-up" style={{ textAlign: 'center', marginBottom: 40 }}>
          <div className="rasta-bar" style={{ width: 60, margin: '0 auto 20px', borderRadius: 2 }} />
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '3.5rem', lineHeight: 1, letterSpacing: '0.04em' }}>
            REGGAE<br /><span style={{ color: 'var(--green)', textShadow: '0 0 30px rgba(0,200,83,0.5)' }}>CHARM</span>
          </p>
          <p style={{ color: 'var(--text-faint)', fontSize: '0.78rem', marginTop: 8, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
            One Love, One Cut
          </p>
        </div>

        <div className="card anim-up d-1" style={{ padding: '28px 24px' }}>
          <div className="tab-bar" style={{ marginBottom: 24 }}>
            <button className={'tab' + (mode === 'login' ? ' active' : '')} onClick={() => { setMode('login'); setError(''); }}>Entrar</button>
            <button className={'tab' + (mode === 'registro' ? ' active' : '')} onClick={() => { setMode('registro'); setError(''); }}>Cadastrar</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {mode === 'registro' && (
              <input className="input" placeholder="Nome completo" value={nome} onChange={e => setNome(e.target.value)} />
            )}
            <input className="input" type="email" placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} />
            <input className="input" type="password" placeholder="Senha" value={senha} onChange={e => setSenha(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()} />

            {error && <p style={{ color: 'var(--red)', fontSize: '0.82rem', textAlign: 'center' }}>{error}</p>}

            <button className="btn btn-green" style={{ marginTop: 4, width: '100%', fontSize: '0.9rem' }} onClick={submit} disabled={loading}>
              {loading ? <><span className="spinner" />{mode === 'login' ? 'Entrando...' : 'Cadastrando...'}</> : mode === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-faint)', marginTop: 20, lineHeight: 1.6 }}>
          Uma conta por dispositivo.<br />Seus dados são protegidos pela LGPD.
        </p>
      </div>
    </div>
  );
}

// ─── App Principal ───────────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [session, setSession] = useState<Session | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [stats, setStats] = useState<Stats[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [agendarOpen, setAgendarOpen] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const [sessRes, userRes, agRes, statsRes] = await Promise.all([
      fetch('/api/auth'),
      fetch('/api/usuarios'),
      fetch('/api/agendamentos?action=meus'),
      fetch('/api/agendamentos?action=stats'),
    ]);

    const sessData = await sessRes.json();
    if (sessData.session) {
      setSession(sessData.session);
      setAuthed(true);
    }

    if (userRes.ok) { const d = await userRes.json(); setUsuario(d.usuario || null); }
    if (agRes.ok) { const d = await agRes.json(); setAgendamentos(d.agendamentos || []); }
    if (statsRes.ok) { const d = await statsRes.json(); setStats(d.stats || []); }
    setLoading(false);
  }

  async function logout() {
    await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) });
    setSession(null); setAuthed(false); setUsuario(null); setAgendamentos([]);
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div className="rasta-bar" style={{ width: 80, borderRadius: 2 }} />
        <span className="spinner spinner-lg" />
      </div>
    );
  }

  if (!authed || !session) {
    return <Auth onSuccess={loadAll} />;
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Top gradient BG */}
      <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse 120% 60% at 50% -10%, rgba(0,200,83,0.06), transparent)', pointerEvents: 'none', zIndex: 0 }} />

      {/* Rasta top bar */}
      <div className="rasta-bar" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50 }} />

      {/* Main content */}
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '40px 16px 120px', position: 'relative', zIndex: 1 }}>
        {tab === 'dashboard' && (
          <Dashboard
            session={session}
            usuario={usuario}
            stats={stats}
            agendamentos={agendamentos}
            onAgendar={() => setAgendarOpen(true)}
            onRefresh={loadAll}
          />
        )}
        {tab === 'configuracoes' && (
          <Configuracoes
            session={session}
            usuario={usuario}
            onUpdate={loadAll}
            onLogout={logout}
          />
        )}
      </div>

      {/* Bottom nav */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 16px', background: 'rgba(5,5,5,0.95)', backdropFilter: 'blur(20px)', borderTop: '1px solid var(--border)', zIndex: 50 }}>
        <div className="rasta-bar" style={{ position: 'absolute', top: 0, left: 0, right: 0, opacity: 0.5 }} />
        <div className="tab-bar" style={{ maxWidth: 400, margin: '0 auto' }}>
          <button className={'tab' + (tab === 'dashboard' ? ' active' : '')} onClick={() => setTab('dashboard')}>
            Dashboard
          </button>
          <button className={'tab' + (tab === 'configuracoes' ? ' active' : '')} onClick={() => setTab('configuracoes')}>
            Configurações
          </button>
        </div>
      </div>

      {/* Modal de agendamento */}
      {agendarOpen && (
        <AgendarModal
          session={session}
          usuario={usuario}
          stats={stats}
          onClose={() => setAgendarOpen(false)}
          onSuccess={loadAll}
        />
      )}
    </div>
  );
}
