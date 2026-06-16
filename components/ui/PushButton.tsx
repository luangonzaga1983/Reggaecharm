'use client';
import { useState, useEffect } from 'react';
import { pushSupported, pushAtivo, ativarPush, desativarPush } from '@/lib/pushClient';

export default function PushButton() {
  const [supported, setSupported] = useState(true);
  const [ativo, setAtivo]   = useState(false);
  const [busy, setBusy]     = useState(false);
  const [msg, setMsg]       = useState('');

  useEffect(() => {
    setSupported(pushSupported());
    pushAtivo().then(setAtivo);
  }, []);

  async function toggle() {
    setBusy(true); setMsg('');
    try {
      if (ativo) { await desativarPush(); setAtivo(false); setMsg('Notificações desativadas.'); }
      else {
        const r = await ativarPush();
        setMsg(r.msg);
        if (r.ok) setAtivo(true);
      }
    } catch { setMsg('Erro ao alterar notificações.'); }
    finally { setBusy(false); }
  }

  if (!supported) {
    return (
      <div className="card" style={{ padding: 14 }}>
        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Notificações</p>
        <p style={{ fontSize: 12, color: 'var(--text-faint)' }}>
          Seu navegador não suporta. No iPhone, adicione o site à tela inicial primeiro.
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Notificações {ativo ? '· ativas' : ''}</p>
        <p style={{ fontSize: 12, color: 'var(--text-faint)' }}>
          {msg || 'Avisos de pagamento, lembrete de corte e mais — direto no navegador.'}
        </p>
      </div>
      <button className={`btn ${ativo ? 'btn-outline' : 'btn-primary'}`} style={{ padding: '8px 14px', fontSize: 12.5 }} disabled={busy} onClick={toggle}>
        {busy ? <><span className="spinner" />…</> : ativo ? 'Desativar' : 'Ativar'}
      </button>
    </div>
  );
}
