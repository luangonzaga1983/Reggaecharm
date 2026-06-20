'use client';
import { useState, useEffect } from 'react';
import type { Session, Usuario, Agendamento, BarbeiroDB, StoreConfig, BarbeiroStats, UnidadeConfig } from '@/types';
import { ROLE_LABEL, ROLE_COLOR, STATUS_BADGE, formatDate, getUnidadeStatus, LEMBRETE_CORTE_DIAS } from '@/utils';
import { hojeSP } from '@/lib/datetime';
import Avatar from '@/components/ui/Avatar';
import Stars from '@/components/ui/Stars';
import Tilt from '@/components/ui/Tilt';
import PaymentModal from '@/components/modals/PaymentModal';
import ReagendarModal from '@/components/modals/ReagendarModal';
import UnidadeModal from '@/components/modals/UnidadeModal';
import AvisoModal from '@/components/modals/AvisoModal';

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
  const [payAgId, setPayAgId]           = useState<string | null>(null);
  const [payFine, setPayFine]           = useState(false);
  const [reagendarAg, setReagendarAg]   = useState<Agendamento | null>(null);
  const [unidadeAberta, setUnidadeAberta] = useState<UnidadeConfig | null>(null);
  const [avisoAg, setAvisoAg]             = useState<Agendamento | null>(null);
  const [avisoCounts, setAvisoCounts]     = useState<Record<string, number>>({});
  const [preloadMaps, setPreloadMaps]     = useState(false);

  const carregarAvisoCounts = () => fetch('/api/agendamentos?action=avisos_count').then(r => r.ok ? r.json() : { counts: {} }).then(d => setAvisoCounts(d.counts || {})).catch(() => {});
  useEffect(() => { carregarAvisoCounts(); }, [agendamentos]);
  const multa = Number(usuario?.multa_pendente ?? 0);
  const creditoSaldo = Number(usuario?.credito_saldo ?? 0);

  useEffect(() => {
    const av: Record<string, number> = {};
    agendamentos.forEach(a => { if (a.avaliacao) av[a.id] = a.avaliacao; });
    setAvaliacoes(av);
  }, [agendamentos]);

  // Pré-carrega os mapas das unidades em segundo plano (após render), pra abrir
  // instantâneo: ao clicar na unidade, o mapa já está no cache do navegador.
  useEffect(() => {
    const t = setTimeout(() => setPreloadMaps(true), 1200);
    return () => clearTimeout(t);
  }, []);

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

  const hoje      = hojeSP();
  const proximos  = agendamentos.filter(a => a.data >= hoje && a.status !== 'cancelado');
  // "Tá na hora de cortar": dias desde o último corte concluído, sem agendamento futuro.
  const ultimoCorte    = agendamentos.filter(a => a.presenca === 'compareceu').map(a => a.data).sort().pop();
  const temProximo     = agendamentos.some(a => a.data >= hoje && a.status !== 'cancelado');
  const diasSemCortar  = ultimoCorte ? Math.floor((Date.now() - new Date(ultimoCorte + 'T12:00').getTime()) / 86400000) : null;
  const naHora         = session.role === 'cliente' && !temProximo && diasSemCortar !== null && diasSemCortar >= LEMBRETE_CORTE_DIAS;
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
          storeName={storeConfig.nome_loja}
          slogan={storeConfig.slogan}
          onClose={() => setPayFine(false)}
          onPaid={() => { setPayFine(false); onRefresh(); }}
        />
      )}
      {payAgId && (
        <PaymentModal
          purpose="agendamento"
          agendamentoId={payAgId}
          titulo="Pagar agendamento"
          storeName={storeConfig.nome_loja}
          slogan={storeConfig.slogan}
          onClose={() => setPayAgId(null)}
          onPaid={() => { setPayAgId(null); onRefresh(); }}
        />
      )}
      {reagendarAg && (
        <ReagendarModal agendamento={reagendarAg} onClose={() => setReagendarAg(null)} onDone={onRefresh} />
      )}
      {unidadeAberta && (
        <UnidadeModal unidade={unidadeAberta} onClose={() => setUnidadeAberta(null)} />
      )}
      {avisoAg && (
        <AvisoModal agendamentoId={avisoAg.id} sessionId={session.id}
          outroNome={getB(avisoAg.barbeiro_id)?.nome || 'Barbeiro'}
          onClose={() => setAvisoAg(null)} onSent={carregarAvisoCounts} />
      )}
      {preloadMaps && (
        <div aria-hidden style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }}>
          {storeConfig.unidades.filter(u => u.ativo).map(u => {
            const q = encodeURIComponent([u.endereco, u.bairro, u.cidade].filter(Boolean).join(', ') || u.nome);
            return <iframe key={u.id} title="" tabIndex={-1} width={300} height={200} loading="eager" src={`https://www.google.com/maps?q=${q}&z=15&output=embed`} />;
          })}
        </div>
      )}

      {naHora && (
        <div className="card anim-up" style={{
          marginBottom: 18, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
          background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
          borderColor: 'color-mix(in srgb, var(--accent) 35%, transparent)',
        }}>
          <div>
            <p style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700, marginBottom: 4 }}>Tá na hora de cortar</p>
            <p style={{ fontSize: 13, color: 'var(--text)' }}>Faz <strong>{diasSemCortar} dias</strong> do seu último corte. Bora agendar?</p>
          </div>
          <button className="btn btn-primary" onClick={() => multa > 0 ? setPayFine(true) : onAgendar()}>Agendar</button>
        </div>
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

      {creditoSaldo > 0 && (
        <div className="card anim-up" style={{
          marginBottom: 18, padding: 16,
          background: 'color-mix(in srgb, var(--success) 8%, transparent)',
          borderColor: 'color-mix(in srgb, var(--success) 38%, transparent)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
        }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={{ fontSize: 12, color: 'var(--success)', fontWeight: 700, marginBottom: 4 }}>Crédito na conta</p>
            <p style={{ fontSize: 13, color: 'var(--text)' }}>
              Você tem <strong style={{ color: 'var(--success)' }}>R$ {creditoSaldo.toFixed(2)}</strong> de crédito. É abatido automaticamente do próximo corte — cobre tudo ou parte, e o que sobrar fica pro próximo.
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => multa > 0 ? setPayFine(true) : onAgendar()}>Usar crédito</button>
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
        <div className="scene stagger-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
          {storeConfig.unidades.filter(u => u.ativo).map(u => {
            const st = getUnidadeStatus(u);
            return (
              <Tilt key={u.id} className="card" style={{ padding: 14, cursor: 'pointer' }} onClick={() => setUnidadeAberta(u)}>
                <div className="tilt-pop-sm">
                  <p style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 4 }}>{u.bairro}</p>
                  <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, lineHeight: 1.3 }}>{u.nome.replace(storeConfig.nome_loja + ' ', '')}</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    {st.aberto
                      ? <span className="open-indicator">{st.texto}</span>
                      : <span className="closed-indicator">{st.texto}</span>}
                    <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, whiteSpace: 'nowrap' }}>ver mapa ›</span>
                  </div>
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
            className="btn btn-primary pulse-glow"
            onClick={() => multa > 0 ? setPayFine(true) : onAgendar()}
            disabled={multa > 0 && !usuario}
            style={{ width: '100%', padding: '15px 20px', fontSize: 15, borderRadius: 12 }}
          >
            {multa > 0 ? 'Quitar multa' : 'Agendar horário'}
          </button>
        )}
      </section>

      {/* Barbeiros — pódio top 3 + ranking completo (todos) */}
      {rankBarbeiros.length > 0 && (
        <section className="anim-up d-3" style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
            <p style={eyebrow}>Barbeiros</p>
            <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>ranking por avaliação</span>
          </div>

          {/* Pódio: exibe 2º · 1º · 3º (1º maior e destacado) */}
          <div className="scene" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, alignItems: 'end' }}>
            {[1, 0, 2].map(pos => {
              const b = top3[pos];
              if (!b) return <div key={pos} />;
              const media = b.stat?.mediaEstrelas ?? 0;
              const total = b.stat?.totalAvaliacoes ?? 0;
              const first = pos === 0;
              const rank = pos + 1;
              return (
                <Tilt key={b.id} max={14} className="card" onClick={() => onVerPerfil(b)}
                  style={{ padding: first ? '20px 12px 14px' : '14px 10px 12px', textAlign: 'center', cursor: 'pointer', transform: first ? 'translateY(-8px)' : 'none', borderColor: first ? 'color-mix(in srgb, var(--warning) 55%, transparent)' : 'var(--border)' }}>
                  <div className="tilt-pop" style={{ display: 'flex', justifyContent: 'center', marginBottom: 8, position: 'relative' }}>
                    <span style={{
                      position: 'absolute', top: first ? -14 : -11, left: '50%', transform: 'translateX(-50%)',
                      width: first ? 24 : 20, height: first ? 24 : 20, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: first ? 12 : 11, fontWeight: 800, zIndex: 2,
                      background: first ? 'var(--warning)' : 'var(--surface3)',
                      color: first ? '#fff' : 'var(--text)', border: '2px solid var(--bg-elev)',
                    }}>{rank}</span>
                    <Avatar src={b.photo_url} nome={b.nome} size={first ? 58 : 46} />
                  </div>
                  <div className="tilt-pop-sm">
                    <p style={{ fontWeight: 700, fontSize: first ? 14 : 12.5, lineHeight: 1.2 }}>{b.nome.split(' ')[0]}</p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 1, margin: '4px 0 2px' }}>
                      {[1, 2, 3, 4, 5].map(n => <span key={n} style={{ fontSize: 12, color: n <= Math.round(media) ? 'var(--warning)' : 'var(--surface3)' }}>★</span>)}
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--text-faint)' }}>{media ? media.toFixed(1) : '—'} · {total} av.</p>
                  </div>
                </Tilt>
              );
            })}
          </div>

          {/* Do 4º em diante — todos os barbeiros */}
          {rankBarbeiros.length > 3 && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {rankBarbeiros.slice(3).map((b, i) => {
                const media = b.stat?.mediaEstrelas ?? 0;
                const total = b.stat?.totalAvaliacoes ?? 0;
                return (
                  <button key={b.id} onClick={() => onVerPerfil(b)} className="card"
                    style={{ padding: 10, display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit' }}>
                    <span style={{ width: 24, textAlign: 'center', fontWeight: 700, fontSize: 13, color: 'var(--text-faint)', flexShrink: 0 }}>{i + 4}º</span>
                    <Avatar src={b.photo_url} nome={b.nome} size={36} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: 13 }}>{b.nome}</p>
                      <div style={{ display: 'flex', gap: 1 }}>{[1, 2, 3, 4, 5].map(n => <span key={n} style={{ fontSize: 11, color: n <= Math.round(media) ? 'var(--warning)' : 'var(--surface3)' }}>★</span>)}</div>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-faint)', flexShrink: 0 }}>{media ? media.toFixed(1) : '—'} · {total}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Agendamentos */}
      <section className="anim-up d-4">
        {proximos.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <p style={eyebrow}>Próximos</p>
            <div className="stagger-list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                          {a.pagamento_metodo === 'credito' ? <span className="badge badge-green">grátis (crédito)</span>
                            : a.pago ? <span className="badge badge-green">pago</span>
                            : a.pagamento_metodo === 'dinheiro' ? <span className="badge badge-gray">pagar na barbearia</span>
                            : <span className="badge badge-yellow">aguardando pagto</span>}
                        </div>
                        <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>{a.servico}</p>
                        <p className="text-mono" style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>
                          {formatDate(a.data, { day: '2-digit', month: 'short' })} · {a.horario} · {u?.bairro}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontWeight: 700, fontSize: 15 }}>R$ {a.valor}</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
                          {!a.pago && a.status !== 'cancelado' && a.pagamento_metodo !== 'dinheiro' && (
                            <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => setPayAgId(a.id)}>Pagar agora</button>
                          )}
                          {a.status !== 'cancelado' && (a.presenca ?? 'pendente') === 'pendente' && a.data >= hoje && (
                            <button className="btn btn-outline" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => setReagendarAg(a)}>Reagendar</button>
                          )}
                          {a.status === 'pendente' && a.data >= hoje && (
                            <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => cancelar(a.id)}>Cancelar</button>
                          )}
                          {a.status !== 'cancelado' && a.data >= hoje && (
                            <button className="btn btn-outline" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => setAvisoAg(a)}>
                              Avisar{avisoCounts[a.id] ? ` · ${avisoCounts[a.id]}` : ''}
                            </button>
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
            <div className="stagger-list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                          {a.cancelado_motivo === 'barbeiro_removido' && <span className="badge badge-gray">barbeiro removido</span>}
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
