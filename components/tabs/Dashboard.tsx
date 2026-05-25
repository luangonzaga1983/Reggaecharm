'use client';
import { useState, useEffect } from 'react';
import type { Session, Usuario, Agendamento, BarbeiroDB, StoreConfig, BarbeiroStats } from '@/types';
import { ROLE_LABEL, ROLE_COLOR, STATUS_BADGE, formatDate, getUnidadeStatus } from '@/utils';
import Avatar from '@/components/ui/Avatar';
import Stars from '@/components/ui/Stars';
import Tilt from '@/components/ui/Tilt';
import PaymentModal from '@/components/modals/PaymentModal';

interface Props {
  session: Session; usuario: Usuario | null; stats: BarbeiroStats[];
  agendamentos: Agendamento[]; barbeiros: BarbeiroDB[]; storeConfig: StoreConfig;
  onAgendar: () => void; onRefresh: () => void; onVerPerfil: (b: BarbeiroDB) => void;
}

const eyebrow: React.CSSProperties = {
  fontSize: 11, color: 'var(--text-faint)', letterSpacing: '0.06em',
  textTransform: 'uppercase', marginBottom: 12, fontWeight: 600,
};

export default function Dashboard({ session, usuario, stats, agendamentos, barbeiros, storeConfig, onAgendar, onRefresh, onVerPerfil }: Props) {
  const [avaliacoes, setAvaliacoes]     = useState<Record<string, number>>({});
  const [savingAv, setSavingAv]         = useState<string | null>(null);
  const [mostrarTodos, setMostrarTodos] = useState(false);
  const [payAgId, setPayAgId]           = useState<string | null>(null);
  const [payFine, setPayFine]           = useState(false);
  const multa = Number(usuario?.multa_pendente ?? 0);

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

  const hoje      = new Date().toISOString().split('T')[0];
  const proximos  = agendamentos.filter(a => a.data >= hoje && a.status !== 'cancelado');
  const passados  = agendamentos.filter(a => a.data < hoje || a.status === 'cancelado');
  const hoje_ag   = agendamentos.find(a => a.data === hoje && a.status !== 'cancelado');
  const getB      = (id: string) => barbeiros.find(b => b.id === id);
  const getU      = (id: string) => storeConfig.unidades.find(u => u.id === id);
  const displayName = usuario?.username ? `@${usuario.username}` : session.nome.split(' ')[0];

  const rankBarbeiros = [...barbeiros].filter(b => b.ativo)
    .map(b => ({ ...b, stat: stats.find(s => s.barbeiroId === b.id) }))
    .sort((a, b) => (b.stat?.mediaEstrelas ?? 0) - (a.stat?.mediaEstrelas ?? 0));
  const top3 = rankBarbeiros.slice(0, 3);

  return (
    <div>
      {payFine && (
        <PaymentModal
          purpose="multa"
          titulo="Quitar multa pendente"
          onClose={() => setPayFine(false)}
          onPaid={() => { setPayFine(false); onRefresh(); }}
        />
      )}
      {payAgId && (
        <PaymentModal
          purpose="agendamento"
          agendamentoId={payAgId}
          titulo="Pagar agendamento"
          onClose={() => setPayAgId(null)}
          onPaid={() => { setPayAgId(null); onRefresh(); }}
        />
      )}

      {multa > 0 && (
        <div className="card anim-up" style={{
          marginBottom: 18, padding: 16,
          background: 'color-mix(in srgb, var(--danger) 7%, transparent)',
          borderColor: 'color-mix(in srgb, var(--danger) 35%, transparent)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
        }}>
          <div>
            <p style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 700, marginBottom: 4 }}>Multa pendente</p>
            <p style={{ fontSize: 13, color: 'var(--text)' }}>
              Você possui <strong style={{ color: 'var(--danger)' }}>R$ {multa.toFixed(2)}</strong> em multa por falta. Quite para liberar novos agendamentos.
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => setPayFine(true)}>Pagar multa</button>
        </div>
      )}

      {/* Header pessoal */}
      <div className="anim-up" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <Avatar src={usuario?.foto_url} nome={session.nome} size={48} />
        <div>
          <p style={{ fontWeight: 700, fontSize: 17, lineHeight: 1.2 }}>{displayName}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 3 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: ROLE_COLOR[session.role] }}>{ROLE_LABEL[session.role]}</span>
            {usuario && <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{usuario.pontos} pontos</span>}
          </div>
        </div>
      </div>

      {/* Unidades */}
      <section className="anim-up d-1" style={{ marginBottom: 28 }}>
        <p style={eyebrow}>Unidades</p>
        <div className="scene" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
          {storeConfig.unidades.filter(u => u.ativo).map(u => {
            const st = getUnidadeStatus(u);
            return (
              <Tilt key={u.id} className="card" style={{ padding: 14 }}>
                <div className="tilt-pop-sm">
                  <p style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 4 }}>{u.bairro}</p>
                  <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, lineHeight: 1.3 }}>{u.nome.replace(storeConfig.nome_loja + ' ', '')}</p>
                  {st.aberto
                    ? <span className="open-indicator">{st.texto}</span>
                    : <span className="closed-indicator">{st.texto}</span>}
                </div>
              </Tilt>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="anim-up d-2" style={{ marginBottom: 28 }}>
        {hoje_ag ? (
          <div className="card" style={{ padding: 18, borderLeft: '3px solid var(--accent)' }}>
            <p style={eyebrow}>Corte hoje</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <p style={{ fontSize: 18, fontWeight: 700 }}>{getB(hoje_ag.barbeiro_id)?.nome}</p>
                <p style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 4 }}>{hoje_ag.servico} · {hoje_ag.horario} · {getU(hoje_ag.unidade_id)?.bairro}</p>
              </div>
              <span className={`badge ${STATUS_BADGE[hoje_ag.status] || 'badge-gray'}`}>{hoje_ag.status}</span>
            </div>
          </div>
        ) : (
          <button
            className="btn btn-primary"
            onClick={() => multa > 0 ? setPayFine(true) : onAgendar()}
            disabled={multa > 0 && !usuario}
            style={{ width: '100%', padding: '15px 20px', fontSize: 15, borderRadius: 12 }}
          >
            {multa > 0 ? 'Quitar multa' : 'Agendar horário'}
          </button>
        )}
      </section>

      {/* Top Barbeiros */}
      {top3.length > 0 && (
        <section className="anim-up d-3" style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <p style={eyebrow}>Barbeiros</p>
            <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>por avaliação</span>
          </div>
          <div className="scene" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {top3.map(b => {
              const media = b.stat?.mediaEstrelas ?? 0;
              const total = b.stat?.totalAvaliacoes ?? 0;
              return (
                <Tilt key={b.id} max={14} className="card" style={{ padding: 14, textAlign: 'center' }}>
                  <div className="tilt-pop" style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}><Avatar src={b.photo_url} nome={b.nome} size={48} /></div>
                  <div className="tilt-pop-sm">
                    <p style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.3 }}>{b.nome.split(' ')[0]}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 8 }}>{b.nome.split(' ').slice(1).join(' ')}</p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 2, marginBottom: 4 }}>
                      {[1, 2, 3, 4, 5].map(n => <span key={n} style={{ fontSize: 13, color: n <= Math.round(media) ? 'var(--warning)' : 'var(--surface3)' }}>★</span>)}
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 10 }}>{media ? media.toFixed(1) : '—'} · {total} av.</p>
                    <button className="btn btn-outline" style={{ width: '100%', padding: '6px 0', fontSize: 12 }} onClick={() => onVerPerfil(b)}>Ver perfil</button>
                  </div>
                </Tilt>
              );
            })}
          </div>
          {rankBarbeiros.length > 3 && (
            <>
              <button onClick={() => setMostrarTodos(p => !p)} className="btn btn-ghost" style={{ width: '100%', marginTop: 10, fontSize: 12.5 }}>
                {mostrarTodos ? 'Mostrar menos' : `Ver todos (${rankBarbeiros.length})`}
              </button>
              {mostrarTodos && (
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {rankBarbeiros.map(b => {
                    const media = b.stat?.mediaEstrelas ?? 0;
                    return (
                      <div key={b.id} className="card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Avatar src={b.photo_url} nome={b.nome} size={40} />
                        <div style={{ flex: 1 }}>
                          <p style={{ fontWeight: 600, fontSize: 13 }}>{b.nome}</p>
                          <div style={{ display: 'flex', gap: 1 }}>{[1, 2, 3, 4, 5].map(n => <span key={n} style={{ fontSize: 11, color: n <= Math.round(media) ? 'var(--warning)' : 'var(--surface3)' }}>★</span>)}</div>
                        </div>
                        <button onClick={() => onVerPerfil(b)} className="btn btn-outline" style={{ padding: '5px 10px', fontSize: 11 }}>Perfil</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* Agendamentos */}
      <section className="anim-up d-4">
        {proximos.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <p style={eyebrow}>Próximos</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {proximos.slice(0, 5).map(a => {
                const b = getB(a.barbeiro_id);
                const u = getU(a.unidade_id);
                return (
                  <div key={a.id} className="card" style={{ padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                          <Avatar src={b?.photo_url} nome={b?.nome || '?'} size={28} />
                          <p style={{ fontWeight: 600, fontSize: 13 }}>{b?.nome}</p>
                          <span className={`badge ${STATUS_BADGE[a.status] || 'badge-gray'}`}>{a.status}</span>
                          {a.pago && <span className="badge badge-green">pago</span>}
                          {!a.pago && <span className="badge badge-yellow">aguardando pagto</span>}
                        </div>
                        <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>{a.servico}</p>
                        <p className="text-mono" style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>
                          {formatDate(a.data, { day: '2-digit', month: 'short' })} · {a.horario} · {u?.bairro}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontWeight: 700, fontSize: 15 }}>R$ {a.valor}</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
                          {!a.pago && a.status !== 'cancelado' && (
                            <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => setPayAgId(a.id)}>Pagar agora</button>
                          )}
                          {a.status === 'pendente' && a.data >= hoje && (
                            <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => cancelar(a.id)}>Cancelar</button>
                          )}
                        </div>
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
            <p style={eyebrow}>Histórico</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {passados.slice(0, 8).map(a => {
                const b = getB(a.barbeiro_id);
                const av = avaliacoes[a.id] || a.avaliacao || 0;
                const podeAvaliar = a.status === 'confirmado' && !a.avaliacao;
                return (
                  <div key={a.id} className="card" style={{ padding: 14, opacity: a.status === 'cancelado' ? 0.6 : 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <Avatar src={b?.photo_url} nome={b?.nome || '?'} size={28} />
                          <p style={{ fontWeight: 600, fontSize: 13 }}>{b?.nome}</p>
                          <span className={`badge ${STATUS_BADGE[a.status] || 'badge-gray'}`}>{a.status}</span>
                        </div>
                        <p className="text-mono" style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                          {formatDate(a.data, { day: '2-digit', month: 'short', year: '2-digit' })} · {a.horario}
                        </p>
                        <div style={{ marginTop: 6 }}>
                          <Stars value={av} readonly={!podeAvaliar || savingAv === a.id} onChange={v => salvarAvaliacao(a.id, v)} />
                          {podeAvaliar && <span style={{ fontSize: 11, color: 'var(--text-faint)', marginLeft: 6 }}>clique para avaliar</span>}
                        </div>
                      </div>
                      <p style={{ color: 'var(--text-faint)', fontSize: 13 }}>R$ {a.valor}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {agendamentos.length === 0 && (
          <div style={{ textAlign: 'center', padding: '44px 20px', color: 'var(--text-faint)' }}>
            <p style={{ fontSize: 14, marginBottom: 14 }}>Nenhum agendamento ainda</p>
            <button className="btn btn-primary" onClick={onAgendar}>Agendar agora</button>
          </div>
        )}
      </section>
    </div>
  );
}
