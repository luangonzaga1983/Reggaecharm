'use client';
import { useState } from 'react';
import Logo from '@/components/ui/Logo';

/**
 * Cartão de autenticação (login/registro) — reutilizável.
 * Usado solto pelo <Auth> e embutido na <Landing>.
 */
export function AuthCard({ onSuccess, embedded = false }: { onSuccess: () => void; embedded?: boolean }) {
  const [mode, setMode]         = useState<'login' | 'registro'>('login');
  const [nome, setNome]         = useState('');
  const [email, setEmail]       = useState('');
  const [senha, setSenha]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [showPass, setShowPass] = useState(false);
  const [verTermos, setVerTermos] = useState(false);
  const [website, setWebsite]   = useState(''); // honeypot — humano nunca preenche

  async function submit() {
    if (loading) return;
    setError(''); setLoading(true);
    try {
      const body: Record<string, string> = { action: mode, email, senha };
      if (mode === 'registro') { body.nome = nome; body.website = website; }
      const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'Não foi dessa vez. Confira os dados e tente de novo.'); return; }
      onSuccess();
    } catch {
      setError('Sem conexão. Verifique sua internet e tente novamente.');
    } finally { setLoading(false); }
  }

  return (
    <div
      className="card"
      style={{ width: '100%', maxWidth: 410, padding: '30px 28px', position: 'relative', zIndex: 1, boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}
    >
      <span className="amb-glow" style={{ top: '-12%', left: '-6%' }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        {!embedded && (
          <div style={{ marginBottom: 24 }}>
            <div className="float-3d" style={{ display: 'inline-block', marginBottom: 14 }}><Logo size={48} /></div>
            <h1 className="text-display" style={{ fontSize: 'clamp(1.6rem, 6vw, 2rem)', lineHeight: 1.05 }}>Reggae Charm</h1>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 6 }}>Agende seu corte em poucos toques.</p>
          </div>
        )}

        {/* Tab switcher */}
        <div className="tab-bar" style={{ marginBottom: 20 }}>
          {(['login', 'registro'] as const).map(m => (
            <button
              key={m}
              className={`tab ${mode === m ? 'active' : ''}`}
              onClick={() => { setMode(m); setError(''); }}
            >
              {m === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
          {mode === 'registro' && (
            <div className="anim-in">
              <label style={{ display: 'block', fontSize: 10.5, color: 'var(--text-faint)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Nome</label>
              <input className="input" placeholder="Seu nome completo" value={nome} onChange={e => setNome(e.target.value)} />
              {/* Honeypot: invisível p/ humano, atrai bot. Fora da tela + sem tab/autofill. */}
              <input
                type="text" name="website" tabIndex={-1} autoComplete="off"
                value={website} onChange={e => setWebsite(e.target.value)}
                aria-hidden="true"
                style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
              />
            </div>
          )}
          <div>
            <label style={{ display: 'block', fontSize: 10.5, color: 'var(--text-faint)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>E-mail</label>
            <input className="input" type="email" autoComplete="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 10.5, color: 'var(--text-faint)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Senha</label>
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                type={showPass ? 'text' : 'password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder="••••••••"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()}
                style={{ paddingRight: 56 }}
              />
              <button
                onClick={() => setShowPass(v => !v)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', fontSize: 11, padding: 4, fontFamily: 'var(--font-mono)' }}
              >
                {showPass ? 'ocultar' : 'ver'}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div style={{ background: 'color-mix(in srgb, var(--danger) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 35%, transparent)', borderRadius: 9, padding: '10px 14px', fontSize: 13, color: 'var(--danger)', marginBottom: 14 }}>
            {error}
          </div>
        )}

        <button className="btn btn-primary" style={{ width: '100%', height: 52, fontSize: 14 }} onClick={submit} disabled={loading}>
          {loading ? <><span className="spinner" />Aguarde...</> : mode === 'login' ? 'Entrar' : 'Criar conta'}
        </button>

        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-faint)', marginTop: 20, lineHeight: 1.7, fontFamily: 'var(--font-mono)' }}>
          Uma conta por dispositivo. Dados protegidos pela LGPD.{' '}
          <button type="button" onClick={() => setVerTermos(true)} style={{ color: 'var(--accent)', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', padding: 0, font: 'inherit' }}>Termos</button>
        </p>
      </div>

      {verTermos && <TermosModal onClose={() => setVerTermos(false)} />}
    </div>
  );
}

/** Modal de Termos de Uso. */
function TermosModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-back" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 560, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Termos de Uso</h2>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: '4px 10px' }}>×</button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.65 }}>
          <h3 style={{ color: 'var(--text)', fontSize: 14, fontWeight: 700, marginTop: 12, marginBottom: 6 }}>1. Aceitação</h3>
          <p>Ao criar uma conta no Reggae Charm, você concorda integralmente com estes Termos.</p>

          <h3 style={{ color: 'var(--text)', fontSize: 14, fontWeight: 700, marginTop: 16, marginBottom: 6 }}>2. Conta e Dispositivo</h3>
          <p>Cada pessoa pode manter <strong>uma única conta por dispositivo</strong>. Tentativas de burla podem resultar em banimento.</p>

          <h3 style={{ color: 'var(--text)', fontSize: 14, fontWeight: 700, marginTop: 16, marginBottom: 6 }}>3. Agendamento e Pagamento</h3>
          <p>Para garantir o horário, o pagamento via PIX é exigido no ato do agendamento. O agendamento é confirmado após a confirmação do pagamento.</p>

          <h3 style={{ color: 'var(--danger)', fontSize: 14, fontWeight: 700, marginTop: 16, marginBottom: 6 }}>4. Política de Comparecimento (IMPORTANTE)</h3>
          <p>
            Ao confirmar um agendamento, você se compromete a comparecer no horário marcado.
            Caso <strong>não compareça sem aviso prévio</strong>, será aplicada multa de
            <strong style={{ color: 'var(--danger)' }}> R$ 10,00 (dez reais) </strong>
            por agendamento descumprido. A multa fica registrada no seu perfil e
            <strong> impede novos agendamentos até a quitação</strong> via PIX.
          </p>
          <p style={{ marginTop: 6 }}>Cancelamentos com antecedência <strong>não</strong> geram multa. O barbeiro ou gerente responsável valida a presença após o horário.</p>

          <h3 style={{ color: 'var(--text)', fontSize: 14, fontWeight: 700, marginTop: 16, marginBottom: 6 }}>5. Reembolsos</h3>
          <p>Pagamentos confirmados não são reembolsáveis em caso de falta. Em caso de cancelamento pela barbearia, o valor é integralmente devolvido.</p>

          <h3 style={{ color: 'var(--text)', fontSize: 14, fontWeight: 700, marginTop: 16, marginBottom: 6 }}>6. Avaliações</h3>
          <p>Avaliações só podem ser feitas após comparecimento confirmado pelo barbeiro.</p>

          <h3 style={{ color: 'var(--text)', fontSize: 14, fontWeight: 700, marginTop: 16, marginBottom: 6 }}>7. Banimento</h3>
          <p>A barbearia se reserva o direito de banir contas com histórico recorrente de faltas, fraudes em pagamento ou comportamento abusivo.</p>

          <h3 style={{ color: 'var(--text)', fontSize: 14, fontWeight: 700, marginTop: 16, marginBottom: 6 }}>8. Privacidade (LGPD)</h3>
          <p>Seus dados são utilizados exclusivamente para operação do serviço. Senhas são armazenadas em hash bcrypt. Você pode solicitar exclusão da conta a qualquer momento em Configurações.</p>

          <h3 style={{ color: 'var(--text)', fontSize: 14, fontWeight: 700, marginTop: 16, marginBottom: 6 }}>9. Alterações</h3>
          <p>Estes Termos podem ser atualizados. O uso contínuo do serviço implica aceitação das novas condições.</p>

          <p style={{ marginTop: 16, fontSize: 11, color: 'var(--text-faint)' }}>Última atualização: 22/05/2026</p>
        </div>
        <button className="btn btn-primary" style={{ width: '100%', marginTop: 18 }} onClick={onClose}>Entendi</button>
      </div>
    </div>
  );
}

/** Tela de auth standalone (fallback sem landing). */
export default function Auth({ onSuccess }: { onSuccess: () => void }) {
  return (
    <div className="scene-deep" style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative', overflow: 'hidden' }}>
      <div className="bg-3d" />
      <AuthCard onSuccess={onSuccess} />
    </div>
  );
}
