'use client';
import { useState, useEffect } from 'react';
import type { Session, BarbeiroDB, StoreConfig, BarbeiroStats } from '@/types';
import { gerarHorarios, getUnidadeStatus, formatDate } from '@/utils';
import Avatar from '@/components/ui/Avatar';
import Stars from '@/components/ui/Stars';
import PerfilBarbeiroModal from './PerfilBarbeiroModal';

type Step = 'unidade' | 'barbeiro' | 'servico' | 'data' | 'termos' | 'sucesso';

interface Props {
  session: Session; stats: BarbeiroStats[]; barbeiros: BarbeiroDB[];
  storeConfig: StoreConfig; onClose: () => void; onSuccess: () => void;
}

export default function AgendarModal({ session, stats, barbeiros, storeConfig, onClose, onSuccess }: Props) {
  const [step, setStep]           = useState<Step>('unidade');
  const [unidadeId, setUnidadeId] = useState('');
  const [barbeiroId, setBarbeiroId] = useState('');
  const [servicoId, setServicoId] = useState('');
  const [data, setData]           = useState('');
  const [horario, setHorario]     = useState('');
  const [ocupados, setOcupados]   = useState<string[]>([]);
  const [termos, setTermos]       = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [verPerfilB, setVerPerfilB] = useState<BarbeiroDB | null>(null);

  const unidades = storeConfig.unidades.filter(u => u.ativo);
  const servicos = storeConfig.servicos.filter(s => s.ativo);
  const unidade  = unidades.find(u => u.id === unidadeId);
  const barbeiro = barbeiros.find(b => b.id === barbeiroId);
  const servico  = servicos.find(s => s.id === servicoId);
  const horarios = unidade ? gerarHorarios(unidade.horario.abertura, unidade.horario.fechamento) : [];
  const minDate  = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (barbeiroId && unidadeId && data) {
      fetch(`/api/agendamentos?action=horarios&barbeiro_id=${barbeiroId}&data=${data}`)
        .then(r => r.json()).then(d => setOcupados(d.ocupados || []));
    }
  }, [barbeiroId, unidadeId, data]);

  const stepN = ({ unidade: 1, barbeiro: 2, servico: 3, data: 4, termos: 5, sucesso: 6 } as Record<string, number>)[step] ?? 1;

  async function confirmar() {
    if (!termos) return;
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/agendamentos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'criar', barbeiro_id: barbeiroId, unidade_id: unidadeId, servico: servico?.nome, data, horario }) });
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'Erro'); return; }
      setStep('sucesso');
    } finally { setLoading(false); }
  }

  if (verPerfilB) return <PerfilBarbeiroModal barbeiro={verPerfilB} agendamentos={[]} onClose={() => setVerPerfilB(null)} />;

  return (
    <div className="modal-back" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        {step !== 'sucesso' && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', letterSpacing: '0.04em', color: 'var(--green)' }}>AGENDAR</span>
              <button className="btn btn-ghost" style={{ padding: '6px 12px' }} onClick={onClose}>x</button>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[1,2,3,4,5].map(n => (
                <div key={n} className="progress-track" style={{ flex: 1 }}>
                  <div className="progress-fill" style={{ width: n <= stepN ? '100%' : '0%' }} />
                </div>
              ))}
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-faint)', marginTop: 6, fontFamily: 'var(--font-mono)' }}>PASSO {Math.min(stepN, 5)} / 5</p>
          </div>
        )}

        {step === 'unidade' && (
          <div className="anim-in">
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', marginBottom: 20 }}>UNIDADE</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {unidades.map(u => {
                const st = getUnidadeStatus(u);
                return (
                  <button key={u.id} className="card card-green" style={{ padding: 16, textAlign: 'left', border: '1px solid var(--border)', cursor: 'pointer', width: '100%', background: 'var(--surface)' }} onClick={() => { setUnidadeId(u.id); setStep('barbeiro'); }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div><p style={{ fontWeight: 700, fontSize: '0.95rem' }}>{u.nome}</p><p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: 2 }}>{u.endereco} · {u.bairro}</p></div>
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
                  <div key={bid} className="card" style={{ padding: '16px 20px', border: '1px solid var(--border)', background: 'var(--surface)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <Avatar src={b.photo_url} nome={b.nome} size={48} />
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 700 }}>{b.nome}</p>
                        <Stars value={Math.round(stat?.mediaEstrelas || 0)} readonly />
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>{b.especialidades.map(e => <span key={e} className="badge badge-gray">{e}</span>)}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button className="btn btn-outline" style={{ flex: 1, fontSize: '0.78rem' }} onClick={() => setVerPerfilB(b)}>Ver perfil</button>
                      <button className="btn btn-green" style={{ flex: 2 }} onClick={() => { setBarbeiroId(bid); setStep('servico'); }}>Selecionar →</button>
                    </div>
                  </div>
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
              {servicos.map(s => (
                <button key={s.id} className="card card-yellow" style={{ padding: '14px 18px', textAlign: 'left', cursor: 'pointer', width: '100%', background: 'var(--surface)', border: '1px solid var(--border)' }} onClick={() => { setServicoId(s.id); setStep('data'); }}>
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                  {horarios.map(h => {
                    const busy = ocupados.includes(h);
                    return (
                      <button key={h} disabled={busy} onClick={() => { setHorario(h); setStep('termos'); }}
                        style={{ padding: '10px 6px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 700, fontFamily: 'var(--font-mono)', cursor: busy ? 'not-allowed' : 'pointer', border: '1px solid', background: busy ? 'transparent' : horario === h ? 'var(--green)' : 'var(--surface2)', color: busy ? 'var(--text-faint)' : horario === h ? '#000' : 'var(--text)', borderColor: busy ? 'var(--border)' : horario === h ? 'var(--green)' : 'var(--border)', textDecoration: busy ? 'line-through' : 'none', transition: 'all 0.15s' }}>{h}</button>
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
              {[['Unidade', unidade?.nome], ['Barbeiro', barbeiro?.nome], ['Serviço', servico?.nome], ['Data', data ? formatDate(data, { weekday: 'short', day: '2-digit', month: 'short' }) : ''], ['Horário', horario], ['Valor', servico ? 'R$ ' + servico.valor.toFixed(2) : '']].map(([k, v]) => (
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
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(0,200,83,0.15)', border: '2px solid var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '1.8rem', color: 'var(--green)' }}>✓</div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', color: 'var(--green)', marginBottom: 8 }}>AGENDADO!</p>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', marginBottom: 6 }}>{barbeiro?.nome} · {servico?.nome}</p>
            <p style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', marginBottom: 24 }}>
              {data ? formatDate(data, { weekday: 'long', day: '2-digit', month: 'long' }) : ''} às {horario}
            </p>
            <button className="btn btn-green" style={{ width: '100%' }} onClick={() => { onSuccess(); onClose(); }}>Fechar</button>
          </div>
        )}
      </div>
    </div>
  );
}
