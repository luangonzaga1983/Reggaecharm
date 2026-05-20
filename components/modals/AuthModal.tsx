'use client';
import { useState } from 'react';

export default function Auth({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode]       = useState<'login'|'registro'>('login');
  const [nome, setNome]       = useState('');
  const [email, setEmail]     = useState('');
  const [senha, setSenha]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [showPass, setShowPass] = useState(false);

  async function submit() {
    setError(''); setLoading(true);
    try {
      const body: Record<string,string> = { action: mode, email, senha };
      if (mode === 'registro') body.nome = nome;
      const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'Erro'); return; }
      onSuccess();
    } finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 20px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'fixed', inset: 0, background: 'var(--black)', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: '-10%', left: '50%', transform: 'translateX(-50%)', width: '70vw', height: '40vh', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(0,200,83,0.15) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ width: '100%', maxWidth: 400, position: 'relative', zIndex: 1 }}>
        <div style={{ marginBottom: 40 }}>
          <div className="rasta-bar" style={{ width: 48, borderRadius: 2, marginBottom: 24 }} />
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 6 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(3rem,10vw,4.5rem)', lineHeight: 0.9, letterSpacing: '0.03em', color: 'var(--text)' }}>REGGAE</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(3rem,10vw,4.5rem)', lineHeight: 0.9, letterSpacing: '0.03em', color: 'var(--green)', textShadow: '0 0 40px rgba(0,200,83,0.4)' }}>CHARM</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-faint)', letterSpacing: '0.15em', textTransform: 'uppercase', lineHeight: 1.4, paddingBottom: 4 }}>ONE LOVE<br/>ONE CUT</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 0, marginBottom: 28, borderBottom: '1px solid var(--border)' }}>
          {(['login','registro'] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setError(''); }}
              style={{ flex: 1, padding: '10px 0', fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.08em', textTransform: 'uppercase', background: 'transparent', border: 'none', borderBottom: `2px solid ${mode === m ? 'var(--green)' : 'transparent'}`, color: mode === m ? 'var(--text)' : 'var(--text-faint)', cursor: 'pointer', transition: 'all 0.18s', marginBottom: -1 }}>
              {m === 'login' ? 'Entrar' : 'Cadastrar'}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          {mode === 'registro' && (
            <div>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-faint)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Nome</label>
              <input className="input" placeholder="Seu nome completo" value={nome} onChange={e => setNome(e.target.value)} />
            </div>
          )}
          <div>
            <label style={{ fontSize: '0.7rem', color: 'var(--text-faint)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>E-mail</label>
            <input className="input" type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: '0.7rem', color: 'var(--text-faint)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Senha</label>
            <div style={{ position: 'relative' }}>
              <input className="input" type={showPass ? 'text' : 'password'} placeholder="••••••••" value={senha} onChange={e => setSenha(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} style={{ paddingRight: 48 }} />
              <button onClick={() => setShowPass(v => !v)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', fontSize: '0.9rem', padding: 4 }}>
                {showPass ? 'ocultar' : 'ver'}
              </button>
            </div>
          </div>
        </div>
        {error && <div style={{ background: 'rgba(255,23,68,0.08)', border: '1px solid rgba(255,23,68,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: '0.82rem', color: 'var(--red)', marginBottom: 16 }}>{error}</div>}
        <button className="btn btn-green" style={{ width: '100%', height: 50, fontSize: '0.95rem' }} onClick={submit} disabled={loading}>
          {loading ? <><span className="spinner"/>{mode === 'login' ? 'Entrando...' : 'Criando conta...'}</> : mode === 'login' ? 'Entrar' : 'Criar conta'}
        </button>
        <p style={{ textAlign: 'center', fontSize: '0.68rem', color: 'var(--text-faint)', marginTop: 24, lineHeight: 1.7 }}>
          Uma conta por dispositivo. Dados protegidos pela LGPD.
        </p>
      </div>
    </div>
  );
}
