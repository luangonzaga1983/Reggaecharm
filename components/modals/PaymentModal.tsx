'use client';
import { useEffect, useState, useCallback } from 'react';

interface PixData {
  transactionId: string;
  qrCodeBase64: string;
  qrCodeText: string;
  amount: number;
  status: string;
  expiresAt: string;
}

interface Props {
  purpose: 'agendamento' | 'multa';
  agendamentoId?: string;
  titulo?: string;
  onClose: () => void;
  onPaid: () => void;
}

/**
 * Modal genérico de pagamento PIX.
 * - 'agendamento': passa agendamentoId
 * - 'multa': sem agendamentoId (usa multa_pendente do usuário)
 */
export default function PaymentModal({ purpose, agendamentoId, titulo, onClose, onPaid }: Props) {
  const [pix, setPix]         = useState<PixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [pago, setPago]       = useState(false);
  const [copied, setCopied]   = useState(false);

  const gerar = useCallback(async () => {
    setError(''); setLoading(true);
    try {
      const r = await fetch('/api/pix/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose, agendamento_id: agendamentoId }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'Erro ao gerar PIX'); return; }
      setPix({
        transactionId: d.transactionId,
        qrCodeBase64: d.qrCodeBase64,
        qrCodeText:   d.qrCodeText,
        amount: d.amount,
        status: d.status,
        expiresAt: d.expiresAt,
      });
    } catch {
      setError('Erro de conexão');
    } finally { setLoading(false); }
  }, [purpose, agendamentoId]);

  useEffect(() => { gerar(); }, [gerar]);

  // Poll status
  useEffect(() => {
    if (!pix || pago) return;
    const iv = setInterval(async () => {
      try {
        const r = await fetch(`/api/pix/status?tx=${encodeURIComponent(pix.transactionId)}`);
        if (!r.ok) return;
        const d = await r.json();
        if (d.status === 'PAID') {
          setPago(true);
          clearInterval(iv);
          setTimeout(() => onPaid(), 1500);
        }
      } catch { /* ignore */ }
    }, 4000);
    return () => clearInterval(iv);
  }, [pix, pago, onPaid]);

  async function copiar() {
    if (!pix?.qrCodeText) return;
    try {
      await navigator.clipboard.writeText(pix.qrCodeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* ignore */ }
  }

  return (
    <div className="modal-back" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 440, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>{titulo || (purpose === 'multa' ? 'Quitar multa' : 'Pagamento')}</h2>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: '4px 10px' }}>×</button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <span className="spinner spinner-lg" />
            <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 10 }}>Gerando PIX...</p>
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <p style={{ color: 'var(--danger)', fontSize: 14, marginBottom: 12 }}>{error}</p>
            <button className="btn btn-primary" onClick={gerar}>Tentar novamente</button>
          </div>
        ) : pago ? (
          <div style={{ textAlign: 'center', padding: '36px 0' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(46, 160, 67, 0.15)', border: '1px solid var(--success)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 12px', color: 'var(--success)', fontSize: 26,
            }}>✓</div>
            <p style={{ fontWeight: 600 }}>Pagamento confirmado!</p>
            {pix && <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>R$ {pix.amount.toFixed(2)}</p>}
          </div>
        ) : pix ? (
          <>
            <div className="card" style={{ padding: 16, textAlign: 'center', marginBottom: 12 }}>
              <div style={{ background: '#fff', padding: 10, borderRadius: 8, display: 'inline-block', marginBottom: 12 }}>
                {pix.qrCodeBase64 ? (
                  <img
                    src={`data:image/png;base64,${pix.qrCodeBase64}`}
                    alt="QR Code PIX"
                    style={{ width: 200, height: 200, display: 'block', imageRendering: 'pixelated' }}
                  />
                ) : (
                  <div style={{ width: 200, height: 200, color: '#888', fontSize: 12 }}>QR indisponível</div>
                )}
              </div>
              <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>R$ {pix.amount.toFixed(2)}</p>
              <p style={{ fontSize: 11, color: 'var(--text-faint)' }}>Aguardando pagamento...</p>
            </div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>PIX copia e cola</label>
            <div
              onClick={copiar}
              style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '10px 12px', fontSize: 11,
                color: 'var(--text-dim)', wordBreak: 'break-all', cursor: 'pointer',
                fontFamily: 'var(--font-mono)', marginBottom: 10, lineHeight: 1.5,
              }}
            >
              {pix.qrCodeText.length > 80 ? pix.qrCodeText.slice(0, 80) + '...' : pix.qrCodeText}
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={copiar}>
              {copied ? '✓ Copiado!' : 'Copiar código PIX'}
            </button>
            <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-faint)', marginTop: 12 }}>
Pagamento seguro · SSL 256-bit
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
