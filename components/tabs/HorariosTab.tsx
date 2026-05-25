'use client';
import { useState } from 'react';
import type { Session, Usuario, Agendamento, BarbeiroDB, StoreConfig, ClienteResumo } from '@/types';
import { formatDate } from '@/utils';
import Avatar from '@/components/ui/Avatar';
import Reveal from '@/components/ui/Reveal';

interface Props {
  session: Session; usuario: Usuario | null; barbeiros: BarbeiroDB[];
  agendamentos: Agendamento[]; clientes: Record<string, ClienteResumo>;
  storeConfig: StoreConfig; onRefresh: () => void;
}

export default function HorariosTab({ session, barbeiros, agendamentos, clientes, storeConfig, onRefresh }: Props) {
  const [filtroData, setFiltroData] = useState('');
  const [busy, setBusy]             = useState<string | null>(null);
  const [verHistorico, setVerHistorico] = useState(false);

  async function editarApelido(usuarioId: string, atual: string | null) {
    const novo = prompt('Apelido do cliente (deixe vazio para remover):', atual ?? '');
    if (novo === null) return;
    await fetch('/api/usuarios', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'apelido', usuario_id: usuarioId, apelido: novo.trim() }),
    });
    onRefresh();
  }

  const isBarbeiro = session.role === 'barbeiro';
  const now        = Date.now();
  const inicioDe   = (a: Agendamento) => new Date(`${a.data}T${a.horario}:00`).getTime();

  // Agenda = só agendamentos ativos ainda não resolvidos. Ao marcar presença, somem.
  const fila = agendamentos
    .filter(a => a.status !== 'cancelado' && (a.presenca ?? 'pendente') === 'pendente' && (!filtroData || a.data === filtroData))
    .sort((a, b) => a.data.localeCompare(b.data) || a.horario.localeCompare(b.horario));

  // Histórico = cortes já resolvidos (compareceu/faltou) ou cancelados. Mais recentes primeiro.
  const historico = agendamentos
    .filter(a => a.status === 'cancelado' || (a.presenca && a.presenca !== 'pendente'))
    .filter(a => !filtroData || a.data === filtroData)
    .sort((a, b) => b.data.localeCompare(a.data) || b.horario.localeCompare(a.horario));

  const hoje  = new Date().toISOString().split('T')[0];
  const getB  = (id: string) => barbeiros.find(b => b.id === id);
  const getU  = (id: string) => storeConfig.unidades.find(u => u.id === id);

  async function marcarPresenca(id: string, presenca: 'compareceu' | 'faltou') {
    const msg = presenca === 'faltou'
      ? 'Marcar como NÃO COMPARECEU? Multa de R$ 10,00 será aplicada ao cliente.'
      : 'Confirmar COMPARECIMENTO?';
    if (!confirm(msg)) return;
    setBusy(id);
    const res = await fetch('/api/agendamentos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'marcar_presenca', agendamento_id: id, presenca }),
    });
    setBusy(null);
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || 'Não foi possível marcar agora.'); return; }
    onRefresh(); // agendamento sai da fila
  }

  return (
    <div>
      <header style={{ marginBottom: 18 }}>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Painel</p>
        <h1 className="text-display" style={{ fontSize: 24 }}>Agenda</h1>
        <p style={{ fontSize: 12.5, color: 'var(--text-faint)', marginTop: 4 }}>
          {isBarbeiro
            ? 'Ao chegar a hora, marque comparecimento. O agendamento sai da agenda.'
            : 'Agendamentos ativos da equipe.'}
        </p>
      </header>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="date" className="input" style={{ flex: 1, minWidth: 160 }} value={filtroData} onChange={e => setFiltroData(e.target.value)} />
        {filtroData && <button className="btn btn-ghost" onClick={() => setFiltroData('')}>Limpar</button>}
        <button className={`btn ${verHistorico ? 'btn-primary' : 'btn-outline'}`} style={{ fontSize: 12 }} onClick={() => setVerHistorico(v => !v)}>
          {verHistorico ? 'Ver fila' : 'Histórico'}
        </button>
        <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{verHistorico ? `${historico.length} no histórico` : `${fila.length} na fila`}</span>
      </div>

      {!verHistorico && (
      <div className="scene" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {fila.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-faint)', padding: '40px 20px', fontSize: 13 }}>
            Nenhum agendamento na fila.
          </div>
        ) : (
          fila.map((a, i) => {
            const b = getB(a.barbeiro_id);
            const u = getU(a.unidade_id);
            const isHoje = a.data === hoje;
            const liberado = now >= inicioDe(a);   // só marca a partir da hora do corte
            return (
              <Reveal key={a.id} delay={Math.min(i, 8) * 40}>
                <div className="card" style={{ padding: 13, borderLeft: isHoje ? '3px solid var(--accent)' : undefined }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                        {!isBarbeiro && b && <Avatar src={b.photo_url} nome={b.nome} size={22} />}
                        {!isBarbeiro && <span style={{ fontWeight: 600, fontSize: 13 }}>{b?.nome}</span>}
                        {a.pago ? <span className="badge badge-green">pago</span>
                          : a.pagamento_metodo === 'dinheiro' ? <span className="badge badge-yellow">💵 dinheiro na barbearia</span>
                          : <span className="badge badge-yellow">aguardando pagto</span>}
                        {isHoje && <span className="badge badge-gray">hoje</span>}
                      </div>
                      {(() => {
                        const c = clientes[a.usuario_id];
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{c?.apelido || c?.nome || 'Cliente'}</span>
                            {c?.apelido && <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>({c.nome})</span>}
                            {c?.fiel && <span className="badge badge-green" title={`${c.total_cortes} cortes`}>FIEL</span>}
                            <button onClick={() => editarApelido(a.usuario_id, c?.apelido ?? null)} title="Editar apelido"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', fontSize: 12, lineHeight: 1, padding: '0 2px' }}>✎</button>
                          </div>
                        );
                      })()}
                      <p style={{ fontSize: 13, fontWeight: 600 }}>{a.servico}</p>
                      <p className="text-mono" style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>
                        {formatDate(a.data, { weekday: 'short', day: '2-digit', month: 'short' })} · {a.horario}
                      </p>
                      {u && <p style={{ fontSize: 11, color: 'var(--text-faint)' }}>{u.bairro} — {u.nome}</p>}
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>R$ {a.valor}</p>
                      <div style={{ display: 'flex', gap: 5, flexDirection: 'column', alignItems: 'stretch', minWidth: 138 }}>
                        <button className="btn btn-primary" style={{ padding: '7px 10px', fontSize: 11 }} disabled={!liberado || busy === a.id} title={liberado ? '' : `Disponível às ${a.horario}`} onClick={() => marcarPresenca(a.id, 'compareceu')}>
                          ✓ Compareceu
                        </button>
                        <button className="btn btn-danger" style={{ padding: '7px 10px', fontSize: 11 }} disabled={!liberado || busy === a.id} title={liberado ? '' : `Disponível às ${a.horario}`} onClick={() => marcarPresenca(a.id, 'faltou')}>
                          ✕ Não compareceu
                        </button>
                        {!liberado && <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>libera às {a.horario}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })
        )}
      </div>
      )}

      {verHistorico && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {historico.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-faint)', padding: '40px 20px', fontSize: 13 }}>
              Nenhum corte no histórico.
            </div>
          ) : (
            historico.map(a => {
              const b = getB(a.barbeiro_id);
              const u = getU(a.unidade_id);
              const c = clientes[a.usuario_id];
              const cancelado = a.status === 'cancelado';
              const faltou = a.presenca === 'faltou';
              return (
                <div key={a.id} className="card" style={{ padding: 12, opacity: cancelado ? 0.6 : 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{c?.apelido || c?.nome || 'Cliente'}</span>
                        {c?.fiel && <span className="badge badge-green">FIEL</span>}
                        {cancelado ? <span className="badge badge-red">cancelado</span>
                          : faltou ? <span className="badge badge-red">faltou</span>
                          : <span className="badge badge-green">compareceu</span>}
                      </div>
                      <p style={{ fontSize: 13 }}>{a.servico}{!isBarbeiro && b ? ` · ${b.nome}` : ''}</p>
                      <p className="text-mono" style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>
                        {formatDate(a.data, { day: '2-digit', month: 'short', year: '2-digit' })} · {a.horario}{u ? ` · ${u.bairro}` : ''}
                      </p>
                    </div>
                    <p style={{ fontWeight: 700, fontSize: 14 }}>R$ {a.valor}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
