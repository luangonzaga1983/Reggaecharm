'use client';
import { useState, useEffect } from 'react';
import type { Session, Usuario, Agendamento, BarbeiroDB, StoreConfig, BarbeiroStats } from '@/types';
import { ROLE_LABEL, ROLE_COLOR, STATUS_BADGE, formatDate, getUnidadeStatus } from '@/utils';
import Avatar from '@/components/ui/Avatar';
import Stars from '@/components/ui/Stars';

const SLOT_ACCENTS = [
  { color: '#00c853', glow: 'rgba(0,200,83,0.25)',  border: 'rgba(0,200,83,0.35)'  },
  { color: '#ffd600', glow: 'rgba(255,214,0,0.2)',   border: 'rgba(255,214,0,0.35)' },
  { color: '#ff1744', glow: 'rgba(255,23,68,0.2)',   border: 'rgba(255,23,68,0.35)' },
];

interface Props {
  session: Session; usuario: Usuario | null; stats: BarbeiroStats[];
  agendamentos: Agendamento[]; barbeiros: BarbeiroDB[]; storeConfig: StoreConfig;
  onAgendar: () => void; onRefresh: () => void; onVerPerfil: (b: BarbeiroDB) => void;
}

export default function Dashboard({ session, usuario, stats, agendamentos, barbeiros, storeConfig, onAgendar, onRefresh, onVerPerfil }: Props) {
  const [avaliacoes, setAvaliacoes] = useState<Record<string, number>>({});
  const [savingAv, setSavingAv]     = useState<string | null>(null);
  const [mostrarTodos, setMostrarTodos] = useState(false);

  useEffect(() => {
    const av: Record<string, number> = {};
    agendamentos.forEach(a => { if (a.avaliacao) av[a.id] = a.avaliacao; });
    setAvaliacoes(av);
  }, [agendamentos]);

  async function salvarAvaliacao(id: string, estrelas: number) {
    setSavingAv(id); setAvaliacoes(p => ({ ...p, [id]: estrelas }));
    await fetch('/api/agendamentos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'avaliar', agendamento_id: id, estrelas }) });
    setSavingAv(null); onRefresh();
  }
  async function cancelar(id: string) {
    if (!confirm('Cancelar este agendamento?')) return;
    await fetch('/api/agendamentos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cancelar', agendamento_id: id }) });
    onRefresh();
  }

  const hoje     = new Date().toISOString().split('T')[0];
  const proximos = agendamentos.filter(a => a.data >= hoje && a.status !== 'cancelado');
  const passados = agendamentos.filter(a => a.data < hoje || a.status === 'cancelado');
  const hoje_ag  = agendamentos.find(a => a.data === hoje && a.status !== 'cancelado');
  const getB = (id: string) => barbeiros.find(b => b.id === id);
  const getU = (id: string) => storeConfig.unidades.find(u => u.id === id);
  const displayName = usuario?.username ? `@${usuario.username}` : session.nome.split(' ')[0];

  const rankBarbeiros = [...barbeiros].filter(b => b.ativo)
    .map(b => ({ ...b, stat: stats.find(s => s.barbeiroId === b.id) }))
    .sort((a, b) => (b.stat?.mediaEstrelas ?? 0) - (a.stat?.mediaEstrelas ?? 0));
  const top3 = rankBarbeiros.slice(0, 3);

  return (
    <div>
      {/* Header */}
      <div className="anim-up" style={{ marginBottom: 36 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar src={usuario?.foto_url} nome={session.nome} size={44} />
            <div>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-faint)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 2 }}>{storeConfig.slogan}</p>
              <p style={{ fontWeight: 800, fontSize: '1.05rem' }}>
                {displayName}
                {usuario && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--yellow)', marginLeft: 10, fontWeight: 400 }}>★ {usuario.pontos}pts</span>}
              </p>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: ROLE_COLOR[session.role] }}>{ROLE_LABEL[session.role]}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', lineHeight: 1, color: 'var(--text-faint)' }}>{storeConfig.nome_loja.split(' ')[0]}</p>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', lineHeight: 1, color: 'var(--green)', textShadow: '0 0 24px rgba(0,200,83,0.5)' }}>{storeConfig.nome_loja.split(' ').slice(1).join(' ') || 'CHARM'}</p>
          </div>
        </div>
        <div className="rasta-bar" style={{ borderRadius: 2 }} />
      </div>

      {/* Unidades */}
      <div className="anim-up d-1" style={{ marginBottom: 28 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-faint)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>Unidades</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
          {storeConfig.unidades.filter(u => u.ativo).map((u, i) => {
            const st = getUnidadeStatus(u);
            const accents = ['var(--green)', 'var(--yellow)', 'var(--red)', '#a78bfa'];
            const accent = accents[i];
            return (
              <div key={u.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderTop: `2px solid ${accent}`, borderRadius: '0 0 12px 12px', padding: '12px 12px 14px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 40, background: `linear-gradient(to bottom,${accent}18,transparent)`, pointerEvents: 'none' }} />
                <p style={{ fontSize: '0.6rem', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{u.bairro}</p>
                <p style={{ fontWeight: 800, fontSize: '0.82rem', marginBottom: 8, lineHeight: 1.2 }}>{u.nome.replace(storeConfig.nome_loja + ' ', '')}</p>
                {st.aberto
                  ? <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 6px var(--green)' }} /><span style={{ fontSize: '0.68rem', color: 'var(--green)', fontWeight: 600 }}>{st.texto}</span></div>
                  : <span style={{ fontSize: '0.68rem', color: 'var(--text-faint)' }}>{st.texto}</span>
                }
              </div>
            );
          })}
        </div>
      </div>

      {/* CTA */}
      <div className="anim-up d-2" style={{ marginBottom: 32 }}>
        {hoje_ag ? (
          <div style={{ background: 'var(--surface)', border: '1px solid rgba(0,200,83,0.4)', borderLeft: '3px solid var(--green)', borderRadius: 14, padding: '18px 22px' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--green)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>corte hoje</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', lineHeight: 1 }}>{getB(hoje_ag.barbeiro_id)?.nome}</p>
                <p style={{ color: 'var(--text-dim)', fontSize: '0.82rem', marginTop: 4 }}>{hoje_ag.servico} · {hoje_ag.horario} · {getU(hoje_ag.unidade_id)?.bairro}</p>
              </div>
              <span className={`badge ${STATUS_BADGE[hoje_ag.status] || 'badge-gray'}`}>{hoje_ag.status}</span>
            </div>
          </div>
        ) : (
          <button onClick={onAgendar} style={{ width: '100%', background: 'var(--green)', border: 'none', borderRadius: 14, padding: 0, cursor: 'pointer', position: 'relative', overflow: 'hidden', display: 'block' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 40px rgba(0,200,83,0.5)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'; }}>
            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(45deg,transparent,transparent 10px,rgba(0,0,0,0.06) 10px,rgba(0,0,0,0.06) 20px)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative', padding: '20px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.4rem,5vw,2rem)', letterSpacing: '0.06em', color: '#000' }}>AGENDAR HORÁRIO</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: '#000', opacity: 0.5 }}>→</span>
            </div>
          </button>
        )}
      </div>

      {/* Top 3 Barbeiros */}
      <div className="anim-up d-3" style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-faint)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Top Barbeiros</p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-faint)' }}>por avaliação</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          {top3.map((b, i) => {
            const acc = SLOT_ACCENTS[i];
            const media = b.stat?.mediaEstrelas ?? 0;
            const total = b.stat?.totalAvaliacoes ?? 0;
            return (
              <div key={b.id} style={{ background: 'var(--surface)', border: `1px solid ${acc.border}`, borderRadius: 16, padding: '20px 16px 14px', position: 'relative', overflow: 'hidden', transition: 'transform 0.2s,box-shadow 0.2s' }}
                onMouseEnter={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = 'translateY(-3px)'; d.style.boxShadow = `0 8px 32px ${acc.glow}`; }}
                onMouseLeave={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = 'none'; d.style.boxShadow = 'none'; }}>
                <div style={{ position: 'absolute', top: 10, right: 10, fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: acc.color, opacity: 0.25 }}>#{i + 1}</div>
                <div style={{ marginBottom: 12 }}><Avatar src={b.photo_url} nome={b.nome} size={48} accent={acc.color} /></div>
                <p style={{ fontWeight: 800, fontSize: '0.88rem', marginBottom: 2 }}>{b.nome.split(' ')[0]}</p>
                <p style={{ fontSize: '0.68rem', color: 'var(--text-faint)', marginBottom: 8 }}>{b.nome.split(' ').slice(1).join(' ')}</p>
                <div style={{ display: 'flex', gap: 2, marginBottom: 3 }}>
                  {[1,2,3,4,5].map(n => <span key={n} style={{ fontSize: '0.85rem', color: n <= Math.round(media) ? acc.color : 'var(--surface3)' }}>★</span>)}
                </div>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-faint)', marginBottom: 10 }}>{media ? media.toFixed(1) : '—'} · {total} av.</p>
                <button onClick={() => onVerPerfil(b)} style={{ width: '100%', padding: '7px 0', borderRadius: 8, background: 'none', border: `1px solid ${acc.border}`, color: acc.color, fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = acc.color + '22'}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'none'}>
                  Ver perfil
                </button>
              </div>
            );
          })}
        </div>
        {rankBarbeiros.length > 3 && (
          <>
            <button onClick={() => setMostrarTodos(p => !p)} style={{ width: '100%', marginTop: 12, padding: '12px 0', borderRadius: 10, background: 'none', border: '1px solid var(--border)', color: 'var(--text-faint)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s' }}
              onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = 'var(--green)'; b.style.color = 'var(--green)'; }}
              onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = 'var(--border)'; b.style.color = 'var(--text-faint)'; }}>
              {mostrarTodos ? '↑ Mostrar menos' : `↓ Ver todos os barbeiros (${rankBarbeiros.length})`}
            </button>
            {mostrarTodos && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {rankBarbeiros.map(b => {
                  const media = b.stat?.mediaEstrelas ?? 0;
                  return (
                    <div key={b.id} className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                      <Avatar src={b.photo_url} nome={b.nome} size={44} />
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>{b.nome}</p>
                        <div style={{ display: 'flex', gap: 2 }}>{[1,2,3,4,5].map(n => <span key={n} style={{ fontSize: '0.75rem', color: n <= Math.round(media) ? 'var(--yellow)' : 'var(--surface3)' }}>★</span>)}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>{b.especialidades.map(e => <span key={e} className="badge badge-gray" style={{ fontSize: '0.62rem' }}>{e}</span>)}</div>
                      </div>
                      <button onClick={() => onVerPerfil(b)} className="btn btn-outline" style={{ fontSize: '0.75rem', padding: '7px 14px' }}>Perfil</button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Agendamentos */}
      <div className="anim-up d-4">
        {proximos.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-faint)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>Próximos</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {proximos.slice(0, 5).map(a => {
                const b = getB(a.barbeiro_id); const u = getU(a.unidade_id);
                return (
                  <div key={a.id} className="card" style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <Avatar src={b?.photo_url} nome={b?.nome || '?'} size={28} />
                          <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>{b?.nome}</p>
                          <span className={`badge ${STATUS_BADGE[a.status] || 'badge-gray'}`}>{a.status}</span>
                        </div>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>{a.servico}</p>
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                          {formatDate(a.data, { day: '2-digit', month: 'short' })} · {a.horario} · {u?.bairro}
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
                const b = getB(a.barbeiro_id);
                const av = avaliacoes[a.id] || a.avaliacao || 0;
                const podeAvaliar = a.status === 'confirmado' && !a.avaliacao;
                return (
                  <div key={a.id} className="card" style={{ padding: '14px 18px', opacity: a.status === 'cancelado' ? 0.5 : 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <Avatar src={b?.photo_url} nome={b?.nome || '?'} size={28} />
                          <p style={{ fontWeight: 600, fontSize: '0.85rem' }}>{b?.nome}</p>
                          <span className={`badge ${STATUS_BADGE[a.status] || 'badge-gray'}`}>{a.status}</span>
                        </div>
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
                          {formatDate(a.data, { day: '2-digit', month: 'short', year: '2-digit' })} · {a.horario}
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
            <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: 'var(--text-faint)' }}>RC</div>
            <p style={{ fontSize: '0.9rem' }}>Nenhum agendamento ainda</p>
            <button className="btn btn-green" style={{ marginTop: 16 }} onClick={onAgendar}>Agendar agora</button>
          </div>
        )}
      </div>
    </div>
  );
}
