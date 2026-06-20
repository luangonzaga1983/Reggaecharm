'use client';
import type { Agendamento } from '@/types';
import { formatDate } from '@/utils';

interface Item { ag: Agendamento; souCliente: boolean }
interface Props { itens: Item[]; onDismiss: (agId: string) => void }

export default function CancelBanner({ itens, onDismiss }: Props) {
  if (!itens.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
      {itens.map(({ ag, souCliente }) => (
        <div key={ag.id} className="card anim-up" style={{
          padding: 14, display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start',
          background: 'color-mix(in srgb, var(--danger) 8%, transparent)',
          borderColor: 'color-mix(in srgb, var(--danger) 40%, transparent)',
        }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger)', marginBottom: 4 }}>Agendamento cancelado</p>
            <p style={{ fontSize: 13, color: 'var(--text)' }}>
              O corte de <strong>{formatDate(ag.data, { day: '2-digit', month: 'short' })} às {ag.horario}</strong> foi cancelado {souCliente ? 'pelo barbeiro/loja' : 'pelo cliente'}.
            </p>
            <p style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 4, wordBreak: 'break-word' }}>Motivo: <em>{ag.cancelado_motivo}</em></p>
          </div>
          <button className="btn btn-ghost" style={{ padding: '4px 12px', flexShrink: 0 }} onClick={() => onDismiss(ag.id)}>OK</button>
        </div>
      ))}
    </div>
  );
}
