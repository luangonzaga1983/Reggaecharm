'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import Logo from '@/components/ui/Logo';

interface PixData {
  transactionId: string;
  qrCodeBase64: string;
  qrCodeText: string;
  amount: number;
  status: string;
  expiresAt: string;
  valorServico?: number;
  creditoUsado?: number;
}

interface Props {
  purpose: 'agendamento' | 'multa';
  agendamentoId?: string;
  titulo?: string;
  /** Nome da loja (branding do recibo). */
  storeName?: string;
  /** Slogan da loja. */
  slogan?: string;
  onClose: () => void;
  onPaid: () => void;
}

/** mm:ss a partir de ms restantes. */
function fmtClock(ms: number): string {
  if (ms <= 0) return '00:00';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Modal de pagamento PIX — recibo com a marca Reggae Charm.
 * - 'agendamento': passa agendamentoId
 * - 'multa': sem agendamentoId (usa multa_pendente do usuário)
 */
export default function PaymentModal({ purpose, agendamentoId, titulo, storeName = 'Reggae Charm', slogan = 'One Love, One Cut', onClose, onPaid }: Props) {
  const [pix, setPix]         = useState<PixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [pago, setPago]       = useState(false);
  const [copied, setCopied]   = useState(false);
  const [restMs, setRestMs]   = useState<number | null>(null);
  // Agendamento exige ciência da política de comparecimento antes de gerar o PIX.
  // Multa: já é consequência da falta, não precisa do aviso.
  const [ciente, setCiente]   = useState(purpose !== 'agendamento');
  const startedAt             = useRef<number>(Date.now());

  const gerar = useCallback(async () => {
    setError(''); setLoading(true);
    try {
      const r = await fetch('/api/pix/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose, agendamento_id: agendamentoId }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'Não foi possível gerar o PIX. Tente de novo.'); return; }
      startedAt.current = Date.now();
      setPix({
        transactionId: d.transactionId,
        qrCodeBase64: d.qrCodeBase64,
        qrCodeText:   d.qrCodeText,
        amount: d.amount,
        status: d.status,
        expiresAt: d.expiresAt,
        valorServico: d.valorServico,
        creditoUsado: d.creditoUsado,
      });
    } catch {
      setError('Sem conexão. Tente de novo.');
    } finally { setLoading(false); }
  }, [purpose, agendamentoId]);

  useEffect(() => { if (ciente) gerar(); }, [gerar, ciente]);

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
          setTimeout(() => onPaid(), 1800);
        }
      } catch { /* ignore */ }
    }, 4000);
    return () => clearInterval(iv);
  }, [pix, pago, onPaid]);

  // Countdown de expiração — janela REAL em que o horário fica segurado (15 min).
  // (O expiresAt do gateway é a data-limite do PIX, ~24h; não serve pra esse relógio.)
  const HOLD_MS = 15 * 60 * 1000;
  useEffect(() => {
    if (!pix || pago) return;
    const exp = startedAt.current + HOLD_MS;
    const tick = () => setRestMs(exp - Date.now());
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [pix, pago]);

  const expirado = restMs !== null && restMs <= 0;

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
      <div className="modal-box pix-ticket" style={{ maxWidth: 420, maxHeight: '92vh', overflowY: 'auto', padding: 0, overflowX: 'hidden' }}>

        {/* ── Cabeçalho da marca ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 11,
          padding: '18px 20px 16px',
          background: 'var(--accent)', color: 'var(--accent-contrast)',
          position: 'relative',
        }}>
          <Logo size={38} />
          <div style={{ lineHeight: 1.2, flex: 1 }}>
            <p style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em' }}>{storeName}</p>
            <p style={{ fontSize: 11, opacity: 0.7 }}>{slogan}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{
              background: 'color-mix(in srgb, var(--accent-contrast) 14%, transparent)',
              color: 'var(--accent-contrast)', border: 'none', borderRadius: 8,
              width: 28, height: 28, cursor: 'pointer', fontSize: 17, lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >×</button>
        </div>

        {/* ── Picote (notch) divisor ── */}
        <div className="pix-notch" />

        <div style={{ padding: '8px 20px 22px' }}>
          <p style={{ fontSize: 11, color: 'var(--text-faint)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 14, textAlign: 'center' }}>
            {titulo || (purpose === 'multa' ? 'Quitar multa' : 'Pagamento via PIX')}
          </p>

          {!ciente ? (
            <div className="anim-in" style={{ padding: '4px 0 6px' }}>
              <div style={{
                background: 'color-mix(in srgb, var(--danger) 7%, transparent)',
                border: '1px solid color-mix(in srgb, var(--danger) 35%, transparent)',
                borderRadius: 12, padding: '14px 16px', marginBottom: 16,
              }}>
                <p style={{ color: 'var(--danger)', fontWeight: 700, fontSize: 13, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  Política de comparecimento
                </p>
                <p style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                  Ao confirmar o pagamento, você se compromete a comparecer no horário marcado.
                  Faltar <strong>sem aviso prévio</strong> gera multa de
                  <strong style={{ color: 'var(--danger)' }}> R$ 10,00</strong>, que fica
                  registrada no seu perfil e <strong>bloqueia novos agendamentos até a quitação</strong>.
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.6, marginTop: 8 }}>
                  Cancelamentos com antecedência <strong>não</strong> geram multa. Pagamentos
                  confirmados não são reembolsáveis em caso de falta.
                </p>
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setCiente(true)}>
                Estou ciente — gerar PIX
              </button>
              <button className="btn btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={onClose}>
                Cancelar
              </button>
            </div>
          ) : loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <span className="spinner spinner-lg" />
              <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 10 }}>Gerando seu PIX...</p>
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <p style={{ color: 'var(--danger)', fontSize: 14, marginBottom: 12 }}>{error}</p>
              <button className="btn btn-primary" onClick={gerar}>Tentar novamente</button>
            </div>
          ) : pago ? (
            <div style={{ textAlign: 'center', padding: '30px 0 18px' }}>
              <div className="pix-check" style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'color-mix(in srgb, var(--success) 16%, transparent)',
                border: '2px solid var(--success)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 14px', color: 'var(--success)', fontSize: 30, fontWeight: 700,
              }}>✓</div>
              <p style={{ fontWeight: 700, fontSize: 16 }}>Pagamento confirmado!</p>
              {pix && <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)', margin: '6px 0 2px' }}>R$ {pix.amount.toFixed(2)}</p>}
              <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>Valeu! Te esperamos na cadeira.</p>
            </div>
          ) : pix ? (
            <>
              {/* Valor em destaque */}
              <div style={{ textAlign: 'center', marginBottom: 14 }}>
                {pix.creditoUsado && pix.creditoUsado > 0 && pix.valorServico ? (
                  <div style={{ marginBottom: 8, fontSize: 12.5, color: 'var(--text-dim)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', maxWidth: 220, margin: '0 auto' }}>
                      <span>Serviço</span><span>R$ {pix.valorServico.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', maxWidth: 220, margin: '0 auto', color: 'var(--success)' }}>
                      <span>Crédito</span><span>− R$ {pix.creditoUsado.toFixed(2)}</span>
                    </div>
                    <div style={{ height: 1, background: 'var(--border)', maxWidth: 220, margin: '6px auto' }} />
                  </div>
                ) : null}
                <p style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 2 }}>Valor a pagar</p>
                <p style={{ fontSize: 32, fontWeight: 800, color: 'var(--accent)', letterSpacing: '-0.02em', lineHeight: 1 }}>
                  R$ {pix.amount.toFixed(2)}
                </p>
              </div>

              {/* QR */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                <div style={{ background: '#fff', padding: 12, borderRadius: 14, boxShadow: 'var(--shadow-md)', lineHeight: 0 }}>
                  {pix.qrCodeBase64 ? (
                    <img
                      src={`data:image/png;base64,${pix.qrCodeBase64}`}
                      alt="QR Code PIX"
                      style={{ width: 196, height: 196, display: 'block', imageRendering: 'pixelated', opacity: expirado ? 0.25 : 1 }}
                    />
                  ) : (
                    <div style={{ width: 196, height: 196, color: '#888', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>QR indisponível</div>
                  )}
                </div>
              </div>

              {/* Status / countdown */}
              {expirado ? (
                <div style={{ textAlign: 'center', marginBottom: 14 }}>
                  <p style={{ fontSize: 13, color: 'var(--danger)', fontWeight: 600, marginBottom: 8 }}>PIX expirado</p>
                  <button className="btn btn-primary" onClick={gerar}>Gerar novo PIX</button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginBottom: 14 }}>
                  <span className="dot-live" />
                  <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                    Aguardando pagamento
                    {restMs !== null && <> · expira em <strong style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{fmtClock(restMs)}</strong></>}
                  </span>
                </div>
              )}

              {/* Copia e cola */}
              {!expirado && (
                <>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)', marginBottom: 5 }}>PIX copia e cola</label>
                  <div
                    onClick={copiar}
                    title="Clique para copiar"
                    style={{
                      background: 'var(--surface)', border: '1px solid var(--border)',
                      borderRadius: 8, padding: '10px 12px', fontSize: 11,
                      color: 'var(--text-dim)', wordBreak: 'break-all', cursor: 'pointer',
                      fontFamily: 'var(--font-mono)', marginBottom: 10, lineHeight: 1.5,
                    }}
                  >
                    {pix.qrCodeText.length > 76 ? pix.qrCodeText.slice(0, 76) + '…' : pix.qrCodeText}
                  </div>
                  <button className="btn btn-primary" style={{ width: '100%' }} onClick={copiar}>
                    {copied ? '✓ Código copiado!' : 'Copiar código PIX'}
                  </button>
                </>
              )}

              <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-faint)', marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                Pagamento seguro · {storeName}
              </p>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
