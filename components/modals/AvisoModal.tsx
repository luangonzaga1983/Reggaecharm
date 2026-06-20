'use client';
import { useState, useEffect, useCallback } from 'react';
import type { AvisoAg } from '@/types';

const PRESETS_PADRAO = ['Vou atrasar ~10 min', 'Estou a caminho', 'Cheguei', 'Preciso remarcar'];

interface Props {
  agendamentoId: string;
  sessionId: string;
  outroNome: string;
  /** Frases rápidas conforme quem está mandando (cliente ou barbeiro). */
  presets?: string[];
  onClose: () => void;
  onSent?: () => void;
}

export default function AvisoModal({ agendamentoId, sessionId, outroNome, presets = PRESETS_PADRAO, onClose, onSent }: Props) {
  const [avisos, setAvisos]   = useState<AvisoAg[]>([]);
  const [loading, setLoading] = useState(true);
  const [texto, setTexto]     = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro]       = useState('');

  const carregar = useCallback(async () => {
    try {
      const r = await fetch(`/api/agendamentos?action=avisos&agendamento_id=${encodeURIComponent(agendamentoId)}`);
      if (r.ok) { const d = await r.json(); setAvisos(d.avisos || []); }
    } finally { setLoading(false); }
  }, [agendamentoId]);
  useEffect(() => { carregar(); }, [carregar]);

  async function enviar(t: string) {
    const msg = t.trim();
    if (!msg || enviando) return;
    setEnviando(true); setErro('');
    try {
      const r = await fetch('/api/agendamentos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'avisar', agendamento_id: agendamentoId, texto: msg }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErro(d.error || 'Não foi possível enviar.'); return; }
      setTexto(''); await carregar(); onSent?.();
    } catch { setErro('Sem conexão.'); }
    finally { setEnviando(false); }
  }

  return (
    <div className="modal-back" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 440, display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>Recados</h3>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: '4px 10px' }}>×</button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 12 }}>Conversa com {outroNome} · sem confirmação de leitura</p>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10, minHeight: 90 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 20 }}><span className="spinner" /></div>
          ) : avisos.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-faint)', textAlign: 'center', padding: '24px 0' }}>Nenhum recado ainda. Manda o primeiro.</p>
          ) : avisos.map(a => {
            const meu = a.from_id === sessionId;
            return (
              <div key={a.id} style={{ alignSelf: meu ? 'flex-end' : 'flex-start', maxWidth: '82%', display: 'flex', flexDirection: 'column', alignItems: meu ? 'flex-end' : 'flex-start' }}>
                <span style={{ fontSize: 10, color: 'var(--text-faint)', margin: '0 4px 2px' }}>{meu ? 'Você' : outroNome}</span>
                <div style={{ background: meu ? 'var(--accent)' : 'var(--surface2)', color: meu ? 'var(--accent-contrast)' : 'var(--text)', padding: '8px 11px', borderRadius: 10, fontSize: 13, lineHeight: 1.4 }}>
                  <p style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{a.texto}</p>
                  <p style={{ fontSize: 10, opacity: 0.7, marginTop: 3, textAlign: 'right' }}>{new Date(a.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {presets.map(p => (
            <button key={p} className="btn btn-outline" style={{ padding: '5px 9px', fontSize: 11 }} disabled={enviando} onClick={() => enviar(p)}>{p}</button>
          ))}
        </div>
        {erro && <p style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 6 }}>{erro}</p>}
        <div style={{ display: 'flex', gap: 6 }}>
          <input className="input" placeholder="Escreva um recado..." value={texto} maxLength={300}
            onChange={e => setTexto(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') enviar(texto); }} />
          <button className="btn btn-primary" disabled={enviando || !texto.trim()} onClick={() => enviar(texto)}>
            {enviando ? <span className="spinner" /> : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  );
}
