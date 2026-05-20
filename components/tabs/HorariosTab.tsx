'use client';
import { useState } from 'react';
import type { Session, Usuario, Agendamento, BarbeiroDB, StoreConfig } from '@/types';
import { STATUS_BADGE, formatDate } from '@/utils';
import Avatar from '@/components/ui/Avatar';
import Stars from '@/components/ui/Stars';

interface Props {
  session: Session; usuario: Usuario | null; barbeiros: BarbeiroDB[];
  agendamentos: Agendamento[]; storeConfig: StoreConfig; onRefresh: () => void;
}

export default function HorariosTab({ session, barbeiros, agendamentos, storeConfig, onRefresh }: Props) {
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroData, setFiltroData]     = useState('');

  const filtrados = agendamentos
    .filter(a => (filtroStatus === 'todos' || a.status === filtroStatus) && (!filtroData || a.data === filtroData))
    .sort((a, b) => a.data.localeCompare(b.data) || a.horario.localeCompare(b.horario));

  const hoje = new Date().toISOString().split('T')[0];
  const pendentesHoje = filtrados.filter(a => a.data === hoje && a.status === 'pendente').length;
  const getB = (id: string) => barbeiros.find(b => b.id === id);
  const getU = (id: string) => storeConfig.unidades.find(u => u.id === id);

  async function confirmarAg(id: string) {
    await fetch('/api/agendamentos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'confirmar', agendamento_id: id }) });
    onRefresh();
  }
  async function cancelarAg(id: string) {
    if (!confirm('Cancelar este agendamento?')) return;
    await fetch('/api/agendamentos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cancelar', agendamento_id: id }) });
    onRefresh();
  }

  return (
    <div>
      <div className="anim-up" style={{ marginBottom: 28 }}>
        <p style={{ fontSize: '0.72rem', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Painel</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem,6vw,3.5rem)' }}>HORÁRIOS</h1>
      </div>

      {pendentesHoje > 0 && (
        <div style={{ background: 'rgba(255,214,0,0.08)', border: '1px solid rgba(255,214,0,0.3)', borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.2rem' }}>⚠</span>
          <p style={{ fontSize: '0.85rem', color: 'var(--yellow)' }}>Você tem <strong>{pendentesHoje}</strong> agendamento{pendentesHoje > 1 ? 's' : ''} pendente{pendentesHoje > 1 ? 's' : ''} hoje</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <select className="input" style={{ flex: 1, minWidth: 130 }} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
          <option value="todos">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="confirmado">Confirmado</option>
          <option value="cancelado">Cancelado</option>
        </select>
        <input type="date" className="input" style={{ flex: 1, minWidth: 130, colorScheme: 'dark' }} value={filtroData} onChange={e => setFiltroData(e.target.value)} />
        {filtroData && <button className="btn btn-ghost" style={{ padding: '8px 12px' }} onClick={() => setFiltroData('')}>✕</button>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtrados.length === 0
          ? <p style={{ textAlign: 'center', color: 'var(--text-faint)', padding: 40, fontSize: '0.88rem' }}>Nenhum agendamento encontrado</p>
          : filtrados.map(a => {
              const b = getB(a.barbeiro_id); const u = getU(a.unidade_id); const isHoje = a.data === hoje;
              return (
                <div key={a.id} className="card" style={{ padding: '14px 18px', borderLeft: isHoje ? '3px solid var(--green)' : undefined }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                        {session.role !== 'barbeiro' && b && <Avatar src={b.photo_url} nome={b.nome} size={24} />}
                        {session.role !== 'barbeiro' && <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>{b?.nome}</span>}
                        <span className={`badge ${STATUS_BADGE[a.status] || 'badge-gray'}`}>{a.status}</span>
                        {isHoje && <span className="badge badge-green">hoje</span>}
                      </div>
                      <p style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: 2 }}>{a.servico}</p>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-faint)' }}>
                        {formatDate(a.data, { weekday: 'short', day: '2-digit', month: 'short', year: '2-digit' })} · {a.horario}
                      </p>
                      {u && <p style={{ fontSize: '0.7rem', color: 'var(--text-faint)', marginTop: 2 }}>{u.bairro} — {u.nome}</p>}
                      {a.avaliacao != null && <div style={{ marginTop: 4 }}><Stars value={a.avaliacao} readonly /></div>}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontWeight: 700, color: 'var(--green)', marginBottom: 6 }}>R${a.valor}</p>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', flexDirection: 'column' }}>
                        {a.status === 'pendente' && <button className="btn btn-green" style={{ padding: '4px 10px', fontSize: '0.72rem' }} onClick={() => confirmarAg(a.id)}>Confirmar</button>}
                        {a.status !== 'cancelado' && <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: '0.72rem' }} onClick={() => cancelarAg(a.id)}>Cancelar</button>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
      </div>
    </div>
  );
}
