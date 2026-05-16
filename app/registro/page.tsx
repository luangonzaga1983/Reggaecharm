'use client';
// app/registro/page.tsx
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegistroPage() {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (senha.length < 6) {
      setError('Senha deve ter ao menos 6 caracteres');
      return;
    }
    setLoading(true);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'registro', nome, email, senha }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao cadastrar');
      } else {
        router.push('/inicio');
      }
    } catch {
      setError('Erro de conexão');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{
      background: 'radial-gradient(ellipse at bottom right, #1a0d0d 0%, #0d0d0d 60%)'
    }}>
      <div className="fixed left-0 top-0 h-full rasta-stripe-vert opacity-60" />
      <div className="fixed right-0 top-0 h-full rasta-stripe-vert opacity-60" />

      <div className="w-full max-w-sm animate-slide-up">
        <div className="text-center mb-10">
          <div className="text-6xl mb-4 animate-float inline-block">✂️</div>
          <h1 className="text-4xl font-black text-rasta-cream tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            Criar conta
          </h1>
          <p className="text-white/40 mt-2 text-sm">Junte-se ao Reggae Charm</p>
        </div>

        <div className="rasta-stripe rounded-t-xl" />
        <div className="glass-card rounded-b-xl rounded-tr-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-white/50 mb-1.5 uppercase tracking-wider">Nome completo</label>
              <input
                type="text"
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Seu nome"
                required
                className="input-reggae"
              />
            </div>

            <div>
              <label className="block text-xs text-white/50 mb-1.5 uppercase tracking-wider">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="input-reggae"
              />
            </div>

            <div>
              <label className="block text-xs text-white/50 mb-1.5 uppercase tracking-wider">Senha</label>
              <input
                type="password"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
                className="input-reggae"
              />
            </div>

            {error && (
              <div className="bg-rasta-red/20 border border-rasta-red/40 rounded-lg px-4 py-3 text-sm text-rasta-red-light">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-2 disabled:opacity-50"
            >
              {loading ? 'Criando conta...' : 'Criar conta'}
            </button>
          </form>

          <p className="text-center text-sm text-white/40 mt-6">
            Já tem conta?{' '}
            <Link href="/login" className="text-rasta-green-light hover:text-rasta-green font-medium transition-colors">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
