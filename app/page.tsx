'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { UNIDADES, SERVICOS, getUnidadeStatus, gerarHorarios } from '@/lib/data';

// ─── Types ───────────────────────────────────────────────────────────────────

type UserRole = 'cliente' | 'barbeiro' | 'gerente' | 'dono';

interface BarbeiroDB {
  id: string;
  nome: string;
  especialidades: string[];
  unidades: string[];
  emoji: string;
  ativo: boolean;
  photo_url?: string | null;
  _messageId?: string;
}

interface Session {
  id: string;
  nome: string;
  email: string;
  role: UserRole;
}

interface Usuario {
  id: string;
  nome: string;
  email: string;
  barbeiro_favorito: string | null;
  servico_favorito: string | null;
  horario_favorito: string | null;
  unidade_favorita: string | null;
  pontos: number;
  tema: 'dark' | 'light';
  role: UserRole;
  barbeiro_id?: string | null;
  unidade_id?: string | null;
}

interface Agendamento {
  id: string;
  usuario_id: string;
  barbeiro_id: string;
  unidade_id: string;
  servico: string;
  data: string;
  horario: string;
  valor: number;
  status: string;
  avaliacao: number | null;
}

interface Stats { barbeiroId: string; mediaEstrelas: number; totalAvaliacoes: number; }

type AppTab = 'dashboard' | 'configuracoes' | 'admin';
type Step = 'unidade' | 'barbeiro' | 'servico' | 'data' | 'termos' | 'sucesso';

const ROLE_LABEL: Record<UserRole, string> = {
  cliente: 'Cliente',
  barbeiro: 'Barbeiro',
  gerente: 'Gerente',
  dono: 'Dono',
};

const ROLE_COLOR: Record<UserRole, string> = {
  cliente: 'var(--text-faint)',
  barbeiro: 'var(--green)',
  gerente: 'var(--yellow)',
  dono: 'var(--red)',
};

function canDo(role: UserRole, action: string): boolean {
  const lvl = { cliente: 0, barbeiro: 1, gerente: 2, dono: 3 }[role] ?? 0;
  switch (action) {
    case 'cancelar_alheio': return lvl >= 1;
    case 'ver_todos_ag':    return lvl >= 1;
    case 'gerenciar_usuarios': return lvl >= 2;
    case 'acesso_admin':   return lvl >= 1;
    case 'promover':       return lvl >= 2;
    default: return false;
  }
}

// ─── Stars ───────────────────────────────────────────────────────────────────

function Stars({ value, onChange, readonly }: { value: number; onChange?: (v: number) => void; readonly?: boolean }) {
  const [hover, setHover] = useState(0);
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={'star' + (i <= (hover || value) ? ' on' : '')}
          onMouseEnter={() => !readonly && setHover(i)}
          onMouseLeave={() => !readonly && setHover(0)}
          onClick={() => !readonly && onChange?.(i)}
          style={{ cursor: readonly ? 'default' : 'pointer' }}>★</span>
      ))}
    </span>
  );
}

// ─── Login ───────────────────────────────────────────────────────────────────

function Auth({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode] = useState<'login' | 'registro'>('login');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);

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
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 20px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Fundo texturizado */}
      <div style={{
        position: 'fixed', inset: 0,
        background: 'var(--black)',
        zIndex: 0,
      }} />
      {/* Glow verde embaixo */}
      <div style={{
        position: 'fixed',
        bottom: '-10%', left: '50%',
        transform: 'translateX(-50%)',
        width: '70vw', height: '40vh',
        borderRadius: '50%',
        background: 'radial-gradient(ellipse, rgba(0,200,83,0.15) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <div style={{ width: '100%', maxWidth: 400, position: 'relative', zIndex: 1 }}>

        {/* Marca */}
        <div style={{ marginBottom: 40 }}>
          <div className="rasta-bar" style={{ width: 48, borderRadius: 2, marginBottom: 24 }} />
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 6 }}>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(3rem, 10vw, 4.5rem)',
              lineHeight: 0.9,
              letterSpacing: '0.03em',
              color: 'var(--text)',
            }}>REGGAE</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(3rem, 10vw, 4.5rem)',
              lineHeight: 0.9,
              letterSpacing: '0.03em',
              color: 'var(--green)',
              textShadow: '0 0 40px rgba(0,200,83,0.4)',
            }}>CHARM</span>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.62rem',
              color: 'var(--text-faint)',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              lineHeight: 1.4,
              paddingBottom: 4,
            }}>ONE LOVE<br />ONE CUT</span>
          </div>
        </div>

        {/* Tabs entrar/cadastrar */}
        <div style={{
          display: 'flex',
          gap: 0,
          marginBottom: 28,
          borderBottom: '1px solid var(--border)',
        }}>
          {(['login', 'registro'] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setError(''); }}
              style={{
                flex: 1,
                padding: '10px 0',
                fontFamily: 'var(--font-ui)',
                fontWeight: 700,
                fontSize: '0.8rem',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                background: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${mode === m ? 'var(--green)' : 'transparent'}`,
                color: mode === m ? 'var(--text)' : 'var(--text-faint)',
                cursor: 'pointer',
                transition: 'all 0.18s',
                marginBottom: -1,
              }}>
              {m === 'login' ? 'Entrar' : 'Cadastrar'}
            </button>
          ))}
        </div>

        {/* Campos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          {mode === 'registro' && (
            <div>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-faint)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Nome</label>
              <input className="input" placeholder="Seu nome completo" value={nome} onChange={e => setNome(e.target.value)} />
            </div>
          )}
          <div>
            <label style={{ fontSize: '0.7rem', color: 'var(--text-faint)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>E-mail</label>
            <input className="input" type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: '0.7rem', color: 'var(--text-faint)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Senha</label>
            <div style={{ position: 'relative' }}>
              <input className="input" type={showPass ? 'text' : 'password'} placeholder="••••••••"
                value={senha} onChange={e => setSenha(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()}
                style={{ paddingRight: 48 }} />
              <button onClick={() => setShowPass(v => !v)}
                style={{
                  position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-faint)', fontSize: '0.9rem', padding: 4,
                }}>
                {showPass ? '🙈' : '👁'}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div style={{
            background: 'rgba(255,23,68,0.08)',
            border: '1px solid rgba(255,23,68,0.3)',
            borderRadius: 8,
            padding: '10px 14px',
            fontSize: '0.82rem',
            color: 'var(--red)',
            marginBottom: 16,
          }}>{error}</div>
        )}

        <button className="btn btn-green" style={{ width: '100%', height: 50, fontSize: '0.95rem' }}
          onClick={submit} disabled={loading}>
          {loading ? <><span className="spinner" />{mode === 'login' ? 'Entrando...' : 'Criando conta...'}</> : mode === 'login' ? 'Entrar' : 'Criar conta'}
        </button>

        <p style={{ textAlign: 'center', fontSize: '0.68rem', color: 'var(--text-faint)', marginTop: 24, lineHeight: 1.7 }}>
          Uma conta por dispositivo.<br />Seus dados são protegidos pela LGPD.
        </p>
      </div>
    </div>
  );
}

// ─── Modal Agendamento ────────────────────────────────────────────────────────

function AgendarModal({ session, usuario, stats, barbeiros, onClose, onSuccess }: {
  session: Session; usuario: Usuario | null; stats: Stats[]; barbeiros: BarbeiroDB[];
  onClose: () => void; onSuccess: () => void;
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
  const [error, setError] = useState('');

  const unidade = UNIDADES.find(u => u.id === unidadeId);
  const barbeiro = barbeiros.find(b => b.id === barbeiroId);
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
      setStep('sucesso');
    } finally { setLoading(false); }
  }

  return (
    <div className="modal-back" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        {step !== 'sucesso' && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', letterSpacing: '0.04em', color: 'var(--green)' }}>AGENDAR</span>
              <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '1.2rem' }} onClick={onClose}>✕</button>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[1, 2, 3, 4, 5].map(n => (
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

        {step === 'unidade' && (
          <div className="anim-in">
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', marginBottom: 20 }}>UNIDADE</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {UNIDADES.map(u => {
                const st = getUnidadeStatus(u);
                return (
                  <button key={u.id} className="card card-green"
                    style={{ padding: '16px', textAlign: 'left', border: '1px solid var(--border)', cursor: 'pointer', width: '100%', background: 'var(--surface)' }}
                    onClick={() => { setUnidadeId(u.id); setStep('barbeiro'); }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: '0.95rem' }}>{u.nome}</p>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: 2 }}>{u.endereco} · {u.bairro}</p>
                      </div>
                      {st.aberto ? <span className="open-indicator"><span className="dot-live" />Aberto</span> : <span className="closed-indicator">Fechado</span>}
                    </div>
                    <p style={{ fontSize: '0.75rem', color: st.aberto ? 'var(--green)' : 'var(--text-faint)', marginTop: 8 }}>{st.texto}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 'barbeiro' && (
          <div className="anim-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <button className="btn btn-ghost" style={{ padding: '6px 10px' }} onClick={() => setStep('unidade')}>←</button>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem' }}>BARBEIRO</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {unidade?.barbeiros.map(bid => {
                const b = barbeiros.find(x => x.id === bid);
                if (!b) return null;
                const stat = stats.find(s => s.barbeiroId === bid);
                return (
                  <button key={bid} className="card card-green"
                    style={{ padding: '16px 20px', textAlign: 'left', cursor: 'pointer', width: '100%', background: 'var(--surface)', border: '1px solid var(--border)' }}
                    onClick={() => { setBarbeiroId(bid); setStep('servico'); }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--surface3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', overflow: 'hidden', flexShrink: 0 }}>
                        {b.photo_url
                          ? <img src={b.photo_url} alt={b.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : b.emoji}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 700 }}>{b.nome}</p>
                        <Stars value={Math.round(stat?.mediaEstrelas || 0)} readonly />
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

        {step === 'servico' && (
          <div className="anim-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <button className="btn btn-ghost" style={{ padding: '6px 10px' }} onClick={() => setStep('barbeiro')}>←</button>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem' }}>CORTE</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {SERVICOS.map(s => (
                <button key={s.id} className="card card-yellow"
                  style={{ padding: '14px 18px', textAlign: 'left', cursor: 'pointer', width: '100%', background: 'var(--surface)', border: '1px solid var(--border)' }}
                  onClick={() => { setServicoId(s.id); setStep('data'); }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: '0.95rem' }}>{s.nome}</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 2 }}>{s.descricao}</p>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-faint)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>{s.duracao} min</p>
                    </div>
                    <p style={{ fontWeight: 800, color: 'var(--green)', fontSize: '1.1rem' }}>R${s.valor}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'data' && (
          <div className="anim-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <button className="btn btn-ghost" style={{ padding: '6px 10px' }} onClick={() => setStep('servico')}>←</button>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem' }}>HORÁRIO</h2>
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
                    return (
                      <button key={h} disabled={busy} onClick={() => { setHorario(h); setStep('termos'); }}
                        style={{
                          padding: '10px 6px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 700,
                          fontFamily: 'var(--font-mono)', cursor: busy ? 'not-allowed' : 'pointer',
                          border: '1px solid', background: busy ? 'transparent' : horario === h ? 'var(--green)' : 'var(--surface2)',
                          color: busy ? 'var(--text-faint)' : horario === h ? '#000' : 'var(--text)',
                          borderColor: busy ? 'var(--border)' : horario === h ? 'var(--green)' : 'var(--border)',
                          textDecoration: busy ? 'line-through' : 'none', transition: 'all 0.15s',
                        }}>{h}</button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'termos' && (
          <div className="anim-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <button className="btn btn-ghost" style={{ padding: '6px 10px' }} onClick={() => setStep('data')}>←</button>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem' }}>CONFIRMAR</h2>
            </div>
            <div className="card" style={{ padding: 16, marginBottom: 20 }}>
              {[['Unidade', unidade?.nome], ['Barbeiro', barbeiro?.nome], ['Serviço', servico?.nome], ['Data', data ? new Date(data + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }) : ''], ['Horário', horario], ['Valor', servico ? 'R$ ' + servico.valor.toFixed(2) : '']].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6, marginBottom: 6, borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-faint)' }}>{k}</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', marginBottom: 20 }}>
              <input type="checkbox" checked={termos} onChange={e => setTermos(e.target.checked)} style={{ width: 18, height: 18, marginTop: 2, accentColor: 'var(--green)' }} />
              <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>Li e aceito os termos de uso e me comprometo a comparecer no horário agendado.</span>
            </label>
            {error && <p style={{ color: 'var(--red)', fontSize: '0.82rem', marginBottom: 12 }}>{error}</p>}
            <button className="btn btn-green" style={{ width: '100%', opacity: termos ? 1 : 0.4 }} disabled={!termos || loading} onClick={confirmar}>
              {loading ? <><span className="spinner" />Confirmando...</> : 'Confirmar agendamento'}
            </button>
          </div>
        )}

        {step === 'sucesso' && (
          <div className="anim-in" style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '4rem', marginBottom: 16 }}>✅</div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', color: 'var(--green)', marginBottom: 8 }}>AGENDADO!</p>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', marginBottom: 6 }}>{barbeiro?.nome} · {servico?.nome}</p>
            <p style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', marginBottom: 24 }}>
              {data ? new Date(data + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }) : ''} às {horario}
            </p>
            <button className="btn btn-green" style={{ width: '100%' }} onClick={() => { onSuccess(); onClose(); }}>Fechar</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

const SLOT_ACCENTS = [
  { color: '#00c853', glow: 'rgba(0,200,83,0.25)', border: 'rgba(0,200,83,0.35)' },
  { color: '#ffd600', glow: 'rgba(255,214,0,0.2)', border: 'rgba(255,214,0,0.35)' },
  { color: '#ff1744', glow: 'rgba(255,23,68,0.2)', border: 'rgba(255,23,68,0.35)' },
];

function Dashboard({ session, usuario, stats, agendamentos, barbeiros, onAgendar, onRefresh }: {
  session: Session; usuario: Usuario | null; stats: Stats[];
  agendamentos: Agendamento[]; barbeiros: BarbeiroDB[]; onAgendar: () => void; onRefresh: () => void;
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
    await fetch('/api/agendamentos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'avaliar', agendamento_id: id, estrelas }) });
    setSavingAv(null); onRefresh();
  }

  async function cancelar(id: string) {
    if (!confirm('Cancelar este agendamento?')) return;
    await fetch('/api/agendamentos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cancelar', agendamento_id: id }) });
    onRefresh();
  }

  const hoje = new Date().toISOString().split('T')[0];
  const proximos = agendamentos.filter(a => a.data >= hoje && a.status !== 'cancelado');
  const passados = agendamentos.filter(a => a.data < hoje || a.status === 'cancelado');
  const hoje_ag = agendamentos.find(a => a.data === hoje && a.status !== 'cancelado');

  const getBarbeiro = (id: string) => barbeiros.find(b => b.id === id);
  const getUnidade = (id: string) => UNIDADES.find(u => u.id === id);

  const statusBadge: Record<string, string> = { confirmado: 'badge-green', pendente: 'badge-yellow', cancelado: 'badge-red' };

  const top3 = [...barbeiros].map(b => ({ ...b, stat: stats.find(s => s.barbeiroId === b.id) }))
    .sort((a, b) => (b.stat?.mediaEstrelas || 0) - (a.stat?.mediaEstrelas || 0)).slice(0, 3);

  return (
    <div>
      <div className="anim-up" style={{ marginBottom: 36 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-faint)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 2 }}>one love, one cut</p>
            <p style={{ fontWeight: 800, fontSize: '1.15rem' }}>
              {session.nome.split(' ')[0]}
              {usuario && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--yellow)', marginLeft: 10, fontWeight: 400 }}>★ {usuario.pontos}pts</span>}
            </p>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: ROLE_COLOR[session.role] }}>
              {ROLE_LABEL[session.role]}
            </span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.9rem', lineHeight: 1, color: 'var(--text-faint)' }}>REGGAE</p>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.9rem', lineHeight: 1, color: 'var(--green)', textShadow: '0 0 24px rgba(0,200,83,0.5)' }}>CHARM</p>
          </div>
        </div>
        <div className="rasta-bar" style={{ borderRadius: 2 }} />
      </div>

      {/* Unidades */}
      <div className="anim-up d-1" style={{ marginBottom: 28 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-faint)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>Unidades</p>
        <div className="unidades-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {UNIDADES.map((u, i) => {
            const st = getUnidadeStatus(u);
            const accentColors = ['var(--green)', 'var(--yellow)', 'var(--red)', '#a78bfa'];
            const accent = accentColors[i];
            return (
              <div key={u.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderTop: `2px solid ${accent}`, borderRadius: '0 0 12px 12px', padding: '12px 12px 14px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 40, background: `linear-gradient(to bottom, ${accent}18, transparent)`, pointerEvents: 'none' }} />
                <p style={{ fontSize: '0.6rem', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{u.bairro}</p>
                <p style={{ fontWeight: 800, fontSize: '0.82rem', marginBottom: 8, lineHeight: 1.2 }}>{u.nome.replace('Reggae Charm ', '')}</p>
                {st.aberto ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 6px var(--green)' }} />
                    <span style={{ fontSize: '0.68rem', color: 'var(--green)', fontWeight: 600 }}>{st.texto}</span>
                  </div>
                ) : (
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-faint)' }}>{st.texto}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* CTA */}
      <div className="anim-up d-2" style={{ marginBottom: 32 }}>
        {hoje_ag ? (
          <div style={{ background: 'var(--surface)', border: '1px solid rgba(0,200,83,0.4)', borderLeft: '3px solid var(--green)', borderRadius: 14, padding: '18px 22px' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--green)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>▸ corte hoje</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', lineHeight: 1 }}>{getBarbeiro(hoje_ag.barbeiro_id)?.nome}</p>
                <p style={{ color: 'var(--text-dim)', fontSize: '0.82rem', marginTop: 4 }}>{hoje_ag.servico} · {hoje_ag.horario} · {getUnidade(hoje_ag.unidade_id)?.bairro}</p>
              </div>
              <span className={'badge ' + (statusBadge[hoje_ag.status] || 'badge-gray')}>{hoje_ag.status}</span>
            </div>
          </div>
        ) : (
          <button onClick={onAgendar} style={{ width: '100%', background: 'var(--green)', border: 'none', borderRadius: 14, padding: 0, cursor: 'pointer', position: 'relative', overflow: 'hidden', display: 'block' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 40px rgba(0,200,83,0.5)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'; }}>
            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.06) 10px, rgba(0,0,0,0.06) 20px)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative', padding: '20px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.4rem, 5vw, 2rem)', letterSpacing: '0.06em', color: '#000' }}>AGENDAR HORÁRIO</span>
              <span style={{ fontSize: '1.8rem' }}>✂️</span>
            </div>
          </button>
        )}
      </div>

      {/* Top 3 */}
      <div className="anim-up d-3" style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-faint)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Top Barbeiros</p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-faint)' }}>por avaliação</p>
        </div>
        <div className="top3-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {top3.map((b, i) => {
            const acc = SLOT_ACCENTS[i];
            const media = b.stat?.mediaEstrelas || 0;
            const total = b.stat?.totalAvaliacoes || 0;
            return (
              <div key={b.id} style={{ background: 'var(--surface)', border: `1px solid ${acc.border}`, borderRadius: 16, padding: '20px 16px 18px', position: 'relative', overflow: 'hidden' }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 32px ${acc.glow}`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'none'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}>
                <div style={{ position: 'absolute', top: 10, right: 10, fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: acc.color, opacity: 0.25 }}>#{i + 1}</div>
                <div style={{ width: 48, height: 48, borderRadius: '50%', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', background: `${acc.color}22`, border: `1px solid ${acc.border}`, overflow: 'hidden' }}>
                  {b.photo_url
                    ? <img src={b.photo_url} alt={b.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : b.emoji}
                </div>
                <p style={{ fontWeight: 800, fontSize: '0.88rem', marginBottom: 2 }}>{b.nome.split(' ')[0]}</p>
                <p style={{ fontSize: '0.68rem', color: 'var(--text-faint)', marginBottom: 10 }}>{b.nome.split(' ').slice(1).join(' ')}</p>
                <div style={{ display: 'flex', gap: 2, marginBottom: 3 }}>
                  {[1, 2, 3, 4, 5].map(n => <span key={n} style={{ fontSize: '0.85rem', color: n <= Math.round(media) ? acc.color : 'var(--surface3)' }}>★</span>)}
                </div>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-faint)' }}>{media ? media.toFixed(1) : '—'} · {total} av.</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Agendamentos */}
      <div className="anim-up d-4">
        {proximos.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-faint)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>Próximos</p>
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
                        <p style={{ color: 'var(--green)', fontWeight: 700 }}>R${a.valor}</p>
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
                          <Stars value={av} readonly={!podeAvaliar || savingAv === a.id} onChange={v => salvarAvaliacao(a.id, v)} />
                          {podeAvaliar && <span style={{ fontSize: '0.68rem', color: 'var(--text-faint)', marginLeft: 6 }}>clique para avaliar</span>}
                        </div>
                      </div>
                      <p style={{ color: 'var(--text-faint)', fontSize: '0.82rem' }}>R${a.valor}</p>
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

// ─── Configurações ────────────────────────────────────────────────────────────

function Configuracoes({ session, usuario, barbeiros, onUpdate, onLogout }: {
  session: Session; usuario: Usuario | null; barbeiros: BarbeiroDB[]; onUpdate: () => void; onLogout: () => void;
}) {
  const [tema, setTema] = useState<'dark' | 'light'>(usuario?.tema || 'dark');
  const [barbeiroFav, setBarbeiroFav] = useState(usuario?.barbeiro_favorito || '');
  const [servicoFav, setServicoFav] = useState(usuario?.servico_favorito || '');
  const [horarioFav, setHorarioFav] = useState(usuario?.horario_favorito || '');
  const [unidadeFav, setUnidadeFav] = useState(usuario?.unidade_favorita || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [senhaConfirm, setSenhaConfirm] = useState('');
  const [senhaError, setSenhaError] = useState('');
  const [senhaOk, setSenhaOk] = useState(false);
  const [savingSenha, setSavingSenha] = useState(false);

  const horarios = ['07:00','07:30','08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00'];

  async function salvarPrefs() {
    setSaving(true);
    await fetch('/api/usuarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'prefs', tema, barbeiro_favorito: barbeiroFav || null, servico_favorito: servicoFav || null, horario_favorito: horarioFav || null, unidade_favorita: unidadeFav || null }) });
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500); onUpdate();
  }

  async function alterarSenha() {
    setSenhaError(''); setSenhaOk(false);
    if (senhaNova !== senhaConfirm) { setSenhaError('Senhas não coincidem'); return; }
    if (senhaNova.length < 6) { setSenhaError('Mínimo 6 caracteres'); return; }
    setSavingSenha(true);
    const res = await fetch('/api/usuarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'senha', senha_atual: senhaAtual, senha_nova: senhaNova }) });
    const d = await res.json();
    setSavingSenha(false);
    if (!res.ok) { setSenhaError(d.error || 'Erro'); return; }
    setSenhaOk(true); setSenhaAtual(''); setSenhaNova(''); setSenhaConfirm('');
  }

  async function excluirConta() {
    if (!confirm('Tem certeza? Irreversível.')) return;
    const c = prompt('Digite "EXCLUIR" para confirmar:');
    if (c !== 'EXCLUIR') return;
    await fetch('/api/usuarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'excluir' }) });
    onLogout();
  }

  const S = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="card anim-up" style={{ padding: '20px 22px', marginBottom: 16 }}>
      <p style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-faint)', marginBottom: 16 }}>{title}</p>
      {children}
    </div>
  );

  return (
    <div>
      <div className="anim-up" style={{ marginBottom: 28 }}>
        <p style={{ fontSize: '0.72rem', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Painel</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 6vw, 3.5rem)' }}>CONFIGURAÇÕES</h1>
      </div>

      <S title="Conta">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: '0.88rem', color: 'var(--text-dim)' }}>Nome</span>
          <span style={{ fontWeight: 700 }}>{session.nome}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: '0.88rem', color: 'var(--text-dim)' }}>E-mail</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-dim)' }}>{session.email}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.88rem', color: 'var(--text-dim)' }}>Nível</span>
          <span style={{ fontWeight: 700, color: ROLE_COLOR[session.role] }}>{ROLE_LABEL[session.role]}</span>
        </div>
      </S>

      <S title="Aparência">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.88rem', color: 'var(--text-dim)' }}>Tema</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['dark', 'light'] as const).map(t => (
              <button key={t} onClick={() => setTema(t)} className="btn" style={{ padding: '6px 14px', fontSize: '0.8rem', background: tema === t ? 'var(--green)' : 'var(--surface2)', color: tema === t ? '#000' : 'var(--text-dim)', border: '1px solid ' + (tema === t ? 'var(--green)' : 'var(--border)') }}>
                {t === 'dark' ? '🌑 Escuro' : '☀️ Claro'}
              </button>
            ))}
          </div>
        </div>
      </S>

      <S title="Preferências">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[['Barbeiro favorito', barbeiroFav, setBarbeiroFav, barbeiros.map(b => ({ v: b.id, l: `${b.emoji} ${b.nome}` }))],
            ['Serviço favorito', servicoFav, setServicoFav, SERVICOS.map(s => ({ v: s.id, l: s.nome }))],
            ['Horário favorito', horarioFav, setHorarioFav, horarios.map(h => ({ v: h, l: h }))],
            ['Unidade favorita', unidadeFav, setUnidadeFav, UNIDADES.map(u => ({ v: u.id, l: u.nome }))],
          ].map(([label, val, setter, opts]: any) => (
            <div key={label}>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-faint)', display: 'block', marginBottom: 4 }}>{label}</label>
              <select className="input" value={val} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setter(e.target.value)}>
                <option value="">Nenhum</option>
                {opts.map((o: any) => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </div>
          ))}
          <button className="btn btn-green" onClick={salvarPrefs} disabled={saving} style={{ marginTop: 6 }}>
            {saving ? <><span className="spinner" />Salvando...</> : saved ? '✓ Salvo!' : 'Salvar preferências'}
          </button>
        </div>
      </S>

      <S title="Alterar senha">
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
      </S>

      <S title="Sessão">
        <button className="btn btn-outline" style={{ width: '100%', marginBottom: 10 }} onClick={onLogout}>Sair da sessão</button>
        <button className="btn btn-danger" style={{ width: '100%' }} onClick={excluirConta}>Excluir conta</button>
      </S>
    </div>
  );
}

// ─── Admin Panel ──────────────────────────────────────────────────────────────

function AdminPanel({ session, barbeiros: barbeirosInit, onRefresh }: { session: Session; barbeiros: BarbeiroDB[]; onRefresh: () => void }) {
  const [usuarios, setUsuarios] = useState<(Usuario & { _messageId?: string })[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [barbeiros, setBarbeiros] = useState<BarbeiroDB[]>(barbeirosInit);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'usuarios' | 'agendamentos' | 'barbeiros'>('usuarios');
  const [promoTarget, setPromoTarget] = useState<string | null>(null);
  const [novoRole, setNovoRole] = useState<UserRole>('barbeiro');
  const [novoBarbeiroId, setNovoBarbeiroId] = useState('');
  const [novaUnidadeId, setNovaUnidadeId] = useState('');
  const [saving, setSaving] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroBarbeiro, setFiltroBarbeiro] = useState('');

  // Barbeiro form state
  const [bFormOpen, setBFormOpen] = useState(false);
  const [bEditId, setBEditId] = useState<string | null>(null);
  const [bNome, setBNome] = useState('');
  const [bEmoji, setBEmoji] = useState('✂️');
  const [bEspecialidades, setBEspecialidades] = useState('');
  const [bUnidades, setBUnidades] = useState<string[]>([]);
  const [bFotoFile, setBFotoFile] = useState<File | null>(null);
  const [bFotoPreview, setBFotoPreview] = useState<string | null>(null);
  const [bSaving, setBSaving] = useState(false);
  const [bError, setBError] = useState('');
  const fotoInputRef = useRef<HTMLInputElement>(null);

  const loadAdmin = useCallback(async () => {
    setLoading(true);
    const [uRes, aRes, bRes] = await Promise.all([
      fetch('/api/usuarios?action=todos'),
      fetch('/api/agendamentos?action=admin'),
      fetch('/api/barbeiros'),
    ]);
    if (uRes.ok) { const d = await uRes.json(); setUsuarios(d.usuarios || []); }
    if (aRes.ok) { const d = await aRes.json(); setAgendamentos(d.agendamentos || []); }
    if (bRes.ok) { const d = await bRes.json(); setBarbeiros(d.barbeiros || []); }
    setLoading(false);
  }, []);

  useEffect(() => { loadAdmin(); }, [loadAdmin]);

  async function promover(uid: string) {
    setSaving(true);
    await fetch('/api/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'promover', usuario_id: uid, novo_role: novoRole, barbeiro_id: novoBarbeiroId || null, unidade_id: novaUnidadeId || null }),
    });
    setSaving(false);
    setPromoTarget(null);
    setNovoRole('barbeiro');
    setNovoBarbeiroId('');
    setNovaUnidadeId('');
    loadAdmin();
  }

  async function cancelarAg(id: string) {
    if (!confirm('Cancelar este agendamento?')) return;
    await fetch('/api/agendamentos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cancelar', agendamento_id: id }) });
    loadAdmin();
  }

  async function confirmarAg(id: string) {
    await fetch('/api/agendamentos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'confirmar', agendamento_id: id }) });
    loadAdmin();
  }

  const rolesDisponiveis: UserRole[] = session.role === 'dono'
    ? ['cliente', 'barbeiro', 'gerente', 'dono']
    : ['cliente', 'barbeiro', 'gerente'];

  const agsFiltrados = agendamentos.filter(a => {
    if (filtroStatus !== 'todos' && a.status !== filtroStatus) return false;
    if (filtroBarbeiro && a.barbeiro_id !== filtroBarbeiro) return false;
    return true;
  });

  const statusBadge: Record<string, string> = { confirmado: 'badge-green', pendente: 'badge-yellow', cancelado: 'badge-red' };

  return (
    <div>
      <div className="anim-up" style={{ marginBottom: 28 }}>
        <div className="rasta-bar" style={{ width: 40, borderRadius: 2, marginBottom: 16 }} />
        <p style={{ fontSize: '0.72rem', color: ROLE_COLOR[session.role], textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
          {ROLE_LABEL[session.role]}
        </p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 6vw, 3rem)' }}>PAINEL ADMIN</h1>
      </div>

      {/* Stats rápidas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }}>
        {[
          { label: 'Usuários', valor: usuarios.length, color: 'var(--green)' },
          { label: 'Agendamentos', valor: agendamentos.length, color: 'var(--yellow)' },
          { label: 'Pendentes', valor: agendamentos.filter(a => a.status === 'pendente').length, color: 'var(--red)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '16px 14px', textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: s.color, lineHeight: 1 }}>{s.valor}</p>
            <p style={{ fontSize: '0.65rem', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tab-bar" style={{ marginBottom: 20 }}>
        <button className={'tab' + (activeTab === 'usuarios' ? ' active' : '')} onClick={() => setActiveTab('usuarios')}>Usuários</button>
        <button className={'tab' + (activeTab === 'agendamentos' ? ' active' : '')} onClick={() => setActiveTab('agendamentos')}>Agendamentos</button>
        {canDo(session.role, 'acesso_admin') && (
          <button className={'tab' + (activeTab === 'barbeiros' ? ' active' : '')} onClick={() => setActiveTab('barbeiros')}>✂️ Barbeiros</button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><span className="spinner spinner-lg" /></div>
      ) : activeTab === 'usuarios' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {usuarios.map(u => {
            const isMe = u.id === session.id;
            const podeMexer = canDo(session.role, 'promover') && !isMe;
            const lvlAlvo = { cliente: 0, barbeiro: 1, gerente: 2, dono: 3 }[u.role as UserRole] ?? 0;
            const lvlMeu = { cliente: 0, barbeiro: 1, gerente: 2, dono: 3 }[session.role] ?? 0;
            const bloqueado = !isMe && lvlAlvo >= lvlMeu && session.role !== 'dono';

            return (
              <div key={u.id} className="card" style={{ padding: '16px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>{u.nome}</p>
                      {isMe && <span className="badge badge-gray">você</span>}
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>{u.email}</p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: ROLE_COLOR[u.role as UserRole], textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {ROLE_LABEL[u.role as UserRole]}
                      </span>
                      {u.barbeiro_id && <span className="badge badge-green">✂️ {barbeiros.find(b => b.id === u.barbeiro_id)?.nome || u.barbeiro_id}</span>}
                      {u.unidade_id && <span className="badge badge-gray">📍 {UNIDADES.find(un => un.id === u.unidade_id)?.bairro || u.unidade_id}</span>}
                      <span className="badge badge-yellow">★ {u.pontos || 0}pts</span>
                    </div>
                  </div>
                  {podeMexer && !bloqueado && (
                    <button className="btn btn-outline" style={{ padding: '6px 14px', fontSize: '0.76rem', flexShrink: 0 }}
                      onClick={() => { setPromoTarget(u.id); setNovoRole(u.role as UserRole); setNovoBarbeiroId(u.barbeiro_id || ''); setNovaUnidadeId(u.unidade_id || ''); }}>
                      Editar
                    </button>
                  )}
                </div>

                {/* Modal inline de promoção */}
                {promoTarget === u.id && (
                  <div style={{ marginTop: 16, padding: 16, background: 'var(--surface2)', borderRadius: 12, border: '1px solid var(--border-bright)' }}>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Alterar nível de {u.nome}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div>
                        <label style={{ fontSize: '0.72rem', color: 'var(--text-faint)', display: 'block', marginBottom: 4 }}>Função</label>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {rolesDisponiveis.map(r => (
                            <button key={r} onClick={() => setNovoRole(r)} style={{
                              padding: '6px 14px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 700,
                              cursor: 'pointer', border: '1px solid', fontFamily: 'var(--font-ui)',
                              background: novoRole === r ? ROLE_COLOR[r] : 'transparent',
                              color: novoRole === r ? (r === 'cliente' ? '#000' : '#000') : ROLE_COLOR[r],
                              borderColor: ROLE_COLOR[r],
                            }}>
                              {ROLE_LABEL[r]}
                            </button>
                          ))}
                        </div>
                      </div>
                      {(novoRole === 'barbeiro') && (
                        <div>
                          <label style={{ fontSize: '0.72rem', color: 'var(--text-faint)', display: 'block', marginBottom: 4 }}>Vincular ao barbeiro</label>
                          <select className="input" value={novoBarbeiroId} onChange={e => setNovoBarbeiroId(e.target.value)}>
                            <option value="">Nenhum</option>
                            {barbeiros.map(b => <option key={b.id} value={b.id}>{b.emoji} {b.nome}</option>)}
                          </select>
                        </div>
                      )}
                      {(novoRole === 'gerente' || novoRole === 'barbeiro') && (
                        <div>
                          <label style={{ fontSize: '0.72rem', color: 'var(--text-faint)', display: 'block', marginBottom: 4 }}>Unidade responsável</label>
                          <select className="input" value={novaUnidadeId} onChange={e => setNovaUnidadeId(e.target.value)}>
                            <option value="">Todas</option>
                            {UNIDADES.map(un => <option key={un.id} value={un.id}>{un.nome}</option>)}
                          </select>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        <button className="btn btn-green" style={{ flex: 1 }} disabled={saving} onClick={() => promover(u.id)}>
                          {saving ? <><span className="spinner" />Salvando...</> : 'Confirmar'}
                        </button>
                        <button className="btn btn-ghost" onClick={() => setPromoTarget(null)}>Cancelar</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : activeTab === 'agendamentos' ? (
        <div>
          {/* Filtros */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <select className="input" style={{ flex: 1, minWidth: 120 }} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
              <option value="todos">Todos status</option>
              <option value="pendente">Pendente</option>
              <option value="confirmado">Confirmado</option>
              <option value="cancelado">Cancelado</option>
            </select>
            <select className="input" style={{ flex: 1, minWidth: 120 }} value={filtroBarbeiro} onChange={e => setFiltroBarbeiro(e.target.value)}>
              <option value="">Todos barbeiros</option>
              {barbeiros.map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {agsFiltrados.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-faint)' }}>Nenhum agendamento encontrado</div>
            )}
            {agsFiltrados.map(a => {
              const b = barbeiros.find(x => x.id === a.barbeiro_id);
              const u = UNIDADES.find(x => x.id === a.unidade_id);
              const cliente = usuarios.find(x => x.id === a.usuario_id);
              return (
                <div key={a.id} className="card" style={{ padding: '14px 18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span>{b?.emoji}</span>
                        <p style={{ fontWeight: 700, fontSize: '0.88rem' }}>{b?.nome}</p>
                        <span className={'badge ' + (statusBadge[a.status] || 'badge-gray')}>{a.status}</span>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 2 }}>{a.servico}</p>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
                        {new Date(a.data + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} · {a.horario} · {u?.bairro}
                      </p>
                      {cliente && (
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-faint)', marginTop: 4 }}>
                          👤 {cliente.nome}
                        </p>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, alignItems: 'flex-end' }}>
                      <p style={{ color: 'var(--green)', fontWeight: 700, fontSize: '0.88rem' }}>R${a.valor}</p>
                      {a.status === 'pendente' && (
                        <button className="btn btn-green" style={{ padding: '4px 10px', fontSize: '0.72rem' }} onClick={() => confirmarAg(a.id)}>Confirmar</button>
                      )}
                      {a.status !== 'cancelado' && (
                        <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: '0.72rem' }} onClick={() => cancelarAg(a.id)}>Cancelar</button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : activeTab === 'barbeiros' ? (
        <div>
          {/* Header + botão novo */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-faint)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
              {barbeiros.length} barbeiro{barbeiros.length !== 1 ? 's' : ''} cadastrado{barbeiros.length !== 1 ? 's' : ''}
            </p>
            <button className="btn btn-green" style={{ padding: '6px 14px', fontSize: '0.8rem' }}
              onClick={() => {
                setBEditId(null); setBNome(''); setBEmoji('✂️'); setBEspecialidades('');
                setBUnidades([]); setBFotoFile(null); setBFotoPreview(null); setBError('');
                setBFormOpen(true);
              }}>
              + Novo barbeiro
            </button>
          </div>

          {/* Formulário criar/editar */}
          {bFormOpen && (
            <div className="card anim-in" style={{ padding: '20px 18px', marginBottom: 16, border: '1px solid var(--green)', background: 'rgba(0,200,83,0.04)' }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', marginBottom: 16 }}>
                {bEditId ? 'EDITAR BARBEIRO' : 'NOVO BARBEIRO'}
              </p>

              {/* Foto de perfil */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                <div
                  onClick={() => fotoInputRef.current?.click()}
                  style={{
                    width: 72, height: 72, borderRadius: '50%', background: 'var(--surface3)',
                    border: '2px dashed var(--border)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', cursor: 'pointer', overflow: 'hidden',
                    flexShrink: 0, transition: 'border-color 0.2s',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--green)'}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'}
                >
                  {bFotoPreview
                    ? <img src={bFotoPreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: '1.8rem' }}>{bEmoji || '📷'}</span>}
                </div>
                <div>
                  <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: '0.78rem', marginBottom: 4 }}
                    onClick={() => fotoInputRef.current?.click()}>
                    {bFotoPreview ? '🔄 Trocar foto' : '📷 Adicionar foto'}
                  </button>
                  {bFotoPreview && (
                    <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: '0.78rem', marginLeft: 6, color: 'var(--red)' }}
                      onClick={() => { setBFotoFile(null); setBFotoPreview(null); }}>
                      ✕ Remover
                    </button>
                  )}
                  <p style={{ fontSize: '0.68rem', color: 'var(--text-faint)', marginTop: 4 }}>
                    JPG, PNG ou WEBP · máx 8MB<br />
                    A URL é renovada automaticamente a cada acesso
                  </p>
                </div>
                <input
                  ref={fotoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: 'none' }}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setBFotoFile(file);
                    const reader = new FileReader();
                    reader.onload = ev => setBFotoPreview(ev.target?.result as string);
                    reader.readAsDataURL(file);
                  }}
                />
              </div>

              {/* Campos */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-faint)', display: 'block', marginBottom: 4 }}>Nome *</label>
                    <input className="input" placeholder="Ex: João Silva" value={bNome} onChange={e => setBNome(e.target.value)} style={{ width: '100%' }} />
                  </div>
                  <div style={{ width: 80 }}>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-faint)', display: 'block', marginBottom: 4 }}>Emoji</label>
                    <input className="input" placeholder="✂️" value={bEmoji} onChange={e => setBEmoji(e.target.value)} style={{ width: '100%', textAlign: 'center', fontSize: '1.2rem' }} />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-faint)', display: 'block', marginBottom: 4 }}>
                    Especialidades <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>(separadas por vírgula)</span>
                  </label>
                  <input className="input" placeholder="Degradê, Barba, Pézinho" value={bEspecialidades} onChange={e => setBEspecialidades(e.target.value)} style={{ width: '100%' }} />
                </div>

                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-faint)', display: 'block', marginBottom: 6 }}>Unidades</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {UNIDADES.map(u => (
                      <button key={u.id}
                        className={'btn' + (bUnidades.includes(u.id) ? ' btn-green' : ' btn-ghost')}
                        style={{ padding: '5px 12px', fontSize: '0.75rem' }}
                        onClick={() => setBUnidades(prev =>
                          prev.includes(u.id) ? prev.filter(x => x !== u.id) : [...prev, u.id]
                        )}>
                        {u.bairro}
                      </button>
                    ))}
                  </div>
                </div>

                {bError && <p style={{ color: 'var(--red)', fontSize: '0.78rem' }}>{bError}</p>}

                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { setBFormOpen(false); setBEditId(null); }}>
                    Cancelar
                  </button>
                  <button className="btn btn-green" style={{ flex: 2 }} disabled={bSaving}
                    onClick={async () => {
                      if (!bNome.trim()) { setBError('Nome é obrigatório'); return; }
                      setBSaving(true); setBError('');
                      try {
                        let barbeiroId = bEditId;

                        if (bEditId) {
                          // Editar existente
                          await fetch('/api/barbeiros', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              action: 'editar',
                              barbeiro_id: bEditId,
                              nome: bNome,
                              emoji: bEmoji,
                              especialidades: bEspecialidades.split(',').map(s => s.trim()).filter(Boolean),
                              unidades: bUnidades,
                            }),
                          });
                        } else {
                          // Criar novo
                          const res = await fetch('/api/barbeiros', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              action: 'criar',
                              nome: bNome,
                              emoji: bEmoji,
                              especialidades: bEspecialidades.split(',').map(s => s.trim()).filter(Boolean),
                              unidades: bUnidades,
                            }),
                          });
                          const d = await res.json();
                          barbeiroId = d.barbeiro?.id;
                        }

                        // Upload de foto (se selecionada)
                        if (bFotoFile && barbeiroId) {
                          const fd = new FormData();
                          fd.append('barbeiro_id', barbeiroId);
                          fd.append('foto', bFotoFile);
                          await fetch('/api/barbeiros', { method: 'POST', body: fd });
                        }

                        await loadAdmin();
                        onRefresh();
                        setBFormOpen(false); setBEditId(null);
                      } catch (e: any) {
                        setBError(e.message || 'Erro ao salvar');
                      } finally {
                        setBSaving(false);
                      }
                    }}>
                    {bSaving ? <span className="spinner" /> : bEditId ? 'Salvar alterações' : 'Criar barbeiro'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Lista de barbeiros */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {barbeiros.length === 0 && !bFormOpen && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-faint)' }}>
                <p style={{ fontSize: '2rem', marginBottom: 8 }}>✂️</p>
                <p style={{ fontSize: '0.9rem' }}>Nenhum barbeiro cadastrado ainda</p>
                <p style={{ fontSize: '0.75rem', marginTop: 4 }}>Clique em "Novo barbeiro" para começar</p>
              </div>
            )}
            {barbeiros.map(b => (
              <div key={b.id} className="card" style={{ padding: '14px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  {/* Avatar */}
                  <div style={{
                    width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
                    background: 'var(--surface3)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '1.4rem', overflow: 'hidden',
                    border: '1px solid var(--border)',
                  }}>
                    {b.photo_url
                      ? <img src={b.photo_url} alt={b.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : b.emoji}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                      <p style={{ fontWeight: 700, fontSize: '0.95rem' }}>{b.nome}</p>
                      <span className="badge badge-gray" style={{ fontSize: '0.65rem' }}>{b.id}</span>
                    </div>
                    {b.especialidades.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
                        {b.especialidades.map(e => <span key={e} className="badge badge-gray" style={{ fontSize: '0.65rem' }}>{e}</span>)}
                      </div>
                    )}
                    {b.unidades.length > 0 && (
                      <p style={{ fontSize: '0.68rem', color: 'var(--text-faint)' }}>
                        📍 {b.unidades.map(uid => UNIDADES.find(u => u.id === uid)?.bairro || uid).join(' · ')}
                      </p>
                    )}
                  </div>

                  {/* Ações */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                    <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: '0.75rem' }}
                      onClick={() => {
                        setBEditId(b.id);
                        setBNome(b.nome);
                        setBEmoji(b.emoji);
                        setBEspecialidades(b.especialidades.join(', '));
                        setBUnidades(b.unidades);
                        setBFotoFile(null);
                        setBFotoPreview(b.photo_url || null);
                        setBError('');
                        setBFormOpen(true);
                        // Scroll up
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}>
                      ✏️ Editar
                    </button>
                    <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: '0.75rem', color: 'var(--red)' }}
                      onClick={async () => {
                        if (!confirm(`Desativar ${b.nome}? Histórico de agendamentos é preservado.`)) return;
                        await fetch('/api/barbeiros', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action: 'deletar', barbeiro_id: b.id }),
                        });
                        await loadAdmin();
                        onRefresh();
                      }}>
                      🗑 Desativar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── App Principal ────────────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab] = useState<AppTab>('dashboard');
  const [session, setSession] = useState<Session | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [stats, setStats] = useState<Stats[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [barbeiros, setBarbeiros] = useState<BarbeiroDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [agendarOpen, setAgendarOpen] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const [sessRes, userRes, agRes, statsRes, barbRes] = await Promise.all([
      fetch('/api/auth'),
      fetch('/api/usuarios'),
      fetch('/api/agendamentos?action=meus'),
      fetch('/api/agendamentos?action=stats'),
      fetch('/api/barbeiros'),
    ]);

    const sessData = await sessRes.json();
    if (sessData.session) { setSession(sessData.session); setAuthed(true); }
    if (userRes.ok) { const d = await userRes.json(); setUsuario(d.usuario || null); }
    if (agRes.ok) { const d = await agRes.json(); setAgendamentos(d.agendamentos || []); }
    if (statsRes.ok) { const d = await statsRes.json(); setStats(d.stats || []); }
    if (barbRes.ok) { const d = await barbRes.json(); setBarbeiros(d.barbeiros || []); }
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

  if (!authed || !session) return <Auth onSuccess={loadAll} />;

  const temAdmin = canDo(session.role, 'acesso_admin');

  return (
    <div style={{ minHeight: '100vh' }}>
      <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse 120% 60% at 50% -10%, rgba(0,200,83,0.06), transparent)', pointerEvents: 'none', zIndex: 0 }} />
      <div className="rasta-bar" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50 }} />

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '40px 16px 120px', position: 'relative', zIndex: 1 }}>
        {tab === 'dashboard' && (
          <Dashboard session={session} usuario={usuario} stats={stats} agendamentos={agendamentos} barbeiros={barbeiros} onAgendar={() => setAgendarOpen(true)} onRefresh={loadAll} />
        )}
        {tab === 'configuracoes' && (
          <Configuracoes session={session} usuario={usuario} barbeiros={barbeiros} onUpdate={loadAll} onLogout={logout} />
        )}
        {tab === 'admin' && temAdmin && (
          <AdminPanel session={session} barbeiros={barbeiros} onRefresh={loadAll} />
        )}
      </div>

      {/* Bottom nav */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 16px', background: 'rgba(5,5,5,0.95)', backdropFilter: 'blur(20px)', borderTop: '1px solid var(--border)', zIndex: 50 }}>
        <div className="rasta-bar" style={{ position: 'absolute', top: 0, left: 0, right: 0, opacity: 0.5 }} />
        <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', gap: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 4 }}>
          {([
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'configuracoes', label: 'Config' },
            ...(temAdmin ? [{ id: 'admin', label: `Admin ${session.role === 'dono' ? '👑' : session.role === 'gerente' ? '⚡' : '✂️'}` }] : []),
          ] as { id: AppTab; label: string }[]).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={'tab' + (tab === t.id ? ' active' : '')}
              style={{ flex: 1 }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {agendarOpen && (
        <AgendarModal session={session} usuario={usuario} stats={stats} barbeiros={barbeiros} onClose={() => setAgendarOpen(false)} onSuccess={loadAll} />
      )}
    </div>
  );
}
