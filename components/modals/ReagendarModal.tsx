'use client';
import { useState, useEffect } from 'react';
import type { Agendamento } from '@/types';
import { formatDate } from '@/utils';

interface Props {
  agendamento: Agendamento;
  onClose: () => void;
  onDone: () => void;
}

/** Picker enxuto: mantém barbeiro/serviço, só troca data + horário. */
export default function ReagendarModal({ agendamento, onClose, onDone }: Props) {
  const [data, setData]         = useState(agendamento.data);
  const [horario, setHorario]   = useState('');
  const [ocupados, setOcupados] = useState<string[]>([]);
  const [reservados, setReservados] = useState<string[]>([]);
  const [folgaDia, setFolgaDia] = useState(false);
  const [slots, setSlots]       = useState<string[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const minDate = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!data) return;
    fetch(`/api/agendamentos?action=horarios&barbeiro_id=${encodeURIComponent(agendamento.barbeiro_id)}&data=${encodeURIComponent(data)}`)
      .then(r => r.json())
      .then(d => { setSlots(d.horarios || []); setOcupados(d.ocupados || []); setReservados(d.reservados || []); setFolgaDia(!!d.folga_dia_todo); })
      .catch(() => { setSlots([]); setOcupados([]); setReservados([]); setFolgaDia(false); });
    setHorario('');
  }, [data, agendamento.barbeiro_id]);

  async function confirmar() {
    if (!horario) return;
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/agendamentos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reagendar', agendamento_id: agendamento.id, data, horario }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'Erro ao reagendar'); return; }
      onDone(); onClose();
    } catch { setError('Erro de conexão'); }
    finally { setLoading(false); }
  }

  return (
    <div className="modal-back" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 460 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontSize: 17, fontWeight: 600 }}>Reagendar</h2>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: '4px 10px' }}>×</button>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--text-dim)', marginBottom: 14 }}>
          {agendamento.servico} · atual: {formatDate(agendamento.data, { day: '2-digit', month: 'short' })} às {agendamento.horario}
        </p>

        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-dim)', marginBottom: 6 }}>Nova data</label>
        <input type="date" className="input" min={minDate} value={data} onChange={e => setData(e.target.value)} style={{ marginBottom: 14 }} />

        {folgaDia && (
          <div className="card" style={{ padding: 10, marginBottom: 12, background: 'color-mix(in srgb, var(--warning) 8%, transparent)', borderColor: 'color-mix(in srgb, var(--warning) 30%, transparent)' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--warning)' }}>Barbeiro de folga neste dia</p>
          </div>
        )}

        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-dim)', marginBottom: 6 }}>Novo horário</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 16 }}>
          {slots.map(h => {
            const busy = ocupados.includes(h);
            const sel = horario === h;
            return (
              <button key={h} disabled={busy} onClick={() => setHorario(h)}
                style={{
                  padding: '9px 4px', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-mono)',
                  cursor: busy ? 'not-allowed' : 'pointer', border: '1px solid',
                  background: busy ? 'transparent' : sel ? 'var(--accent)' : 'var(--surface2)',
                  color: busy ? 'var(--text-faint)' : sel ? 'var(--accent-contrast)' : 'var(--text)',
                  borderColor: sel ? 'var(--accent)' : 'var(--border)',
                  textDecoration: busy ? 'line-through' : 'none',
                }}>{h}</button>
            );
          })}
        </div>

        {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>{error}</p>}
        <button className="btn btn-primary" style={{ width: '100%' }} disabled={!horario || loading} onClick={confirmar}>
          {loading ? <><span className="spinner" />Salvando…</> : 'Confirmar novo horário'}
        </button>
      </div>
    </div>
  );
}
