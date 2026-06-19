'use client';
import { useState, useRef, useEffect } from 'react';
import type { Session, Usuario, BarbeiroDB, StoreConfig } from '@/types';
import { ROLE_LABEL, ROLE_COLOR, applyTheme, getStoredTheme } from '@/utils';
import Avatar from '@/components/ui/Avatar';

interface Props {
  session: Session; usuario: Usuario | null; barbeiros: BarbeiroDB[];
  storeConfig: StoreConfig; onUpdate: () => void; onLogout: () => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 16, marginBottom: 12 }}>
      <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-dim)', marginBottom: 12 }}>{title}</p>
      {children}
    </div>
  );
}

export default function Configuracoes({ session, usuario, barbeiros, storeConfig, onUpdate, onLogout }: Props) {
  const [tema, setTema]                 = useState<'dark' | 'light'>('light');
  useEffect(() => { setTema(getStoredTheme()); }, []);
  const [barbeiroFav, setBarbeiroFav]   = useState(usuario?.barbeiro_favorito || '');
  const [servicoFav, setServicoFav]     = useState(usuario?.servico_favorito || '');
  const [unidadeFav, setUnidadeFav]     = useState(usuario?.unidade_favorita || '');
  const [saving, setSaving]             = useState(false);
  const [saved, setSaved]               = useState(false);

  const [senhaAtual, setSenhaAtual]         = useState('');
  const [senhaNova, setSenhaNova]           = useState('');
  const [senhaConfirm, setSenhaConfirm]     = useState('');
  const [senhaError, setSenhaError]         = useState('');
  const [senhaOk, setSenhaOk]               = useState(false);
  const [savingSenha, setSavingSenha]       = useState(false);
  const [showSenhaSection, setShowSenhaSection] = useState(false);

  const [nomeEdit, setNomeEdit]             = useState(session.nome);
  const [usernameEdit, setUsernameEdit]     = useState(usuario?.username || '');
  const [perfilError, setPerfilError]       = useState('');
  const [perfilOk, setPerfilOk]             = useState(false);
  const [savingPerfil, setSavingPerfil]     = useState(false);
  const [fotoPreview, setFotoPreview]       = useState<string | null>(usuario?.foto_url || null);
  const [fotoFile, setFotoFile]             = useState<File | null>(null);
  const [savingFoto, setSavingFoto]         = useState(false);
  const fotoRef = useRef<HTMLInputElement>(null);

  async function salvarPrefs() {
    setSaving(true);
    await fetch('/api/usuarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'prefs', tema, barbeiro_favorito: barbeiroFav || null, servico_favorito: servicoFav || null, unidade_favorita: unidadeFav || null }) });
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000); onUpdate();
  }

  async function salvarPerfil() {
    setPerfilError(''); setPerfilOk(false); setSavingPerfil(true);
    const res = await fetch('/api/usuarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'perfil', nome: nomeEdit, username: usernameEdit }) });
    const d = await res.json(); setSavingPerfil(false);
    if (!res.ok) { setPerfilError(d.error || 'Erro'); return; }
    setPerfilOk(true); setTimeout(() => setPerfilOk(false), 2000); onUpdate();
  }

  async function uploadFoto() {
    if (!fotoFile) return;
    setSavingFoto(true);
    const form = new FormData(); form.append('foto', fotoFile);
    const res = await fetch('/api/usuarios', { method: 'POST', body: form });
    const d = await res.json(); setSavingFoto(false);
    if (res.ok && d.foto_url) { setFotoPreview(d.foto_url); setFotoFile(null); onUpdate(); }
  }

  async function alterarSenha() {
    setSenhaError(''); setSenhaOk(false);
    if (senhaNova !== senhaConfirm) { setSenhaError('Senhas não coincidem'); return; }
    if (senhaNova.length < 6) { setSenhaError('Mínimo 6 caracteres'); return; }
    setSavingSenha(true);
    const res = await fetch('/api/usuarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'senha', senha_atual: senhaAtual, senha_nova: senhaNova }) });
    const d = await res.json(); setSavingSenha(false);
    if (!res.ok) { setSenhaError(d.error || 'Erro'); return; }
    setSenhaOk(true); setSenhaAtual(''); setSenhaNova(''); setSenhaConfirm('');
    setTimeout(() => { setSenhaOk(false); setShowSenhaSection(false); }, 2000);
  }

  async function excluirConta() {
    if (!confirm('Tem certeza? Esta ação é irreversível.')) return;
    const c = prompt('Digite "EXCLUIR" para confirmar:');
    if (c !== 'EXCLUIR') return;
    const res = await fetch('/api/usuarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'excluir' }) });
    if (!res.ok) {
      const d = await res.json();
      alert(d.error || 'Erro ao excluir conta');
      return;
    }
    onLogout();
  }

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Painel</p>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>Conta</h1>
      </header>

      <Section title="Foto de perfil">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
          <Avatar src={fotoPreview} nome={session.nome} size={64} />
          <div>
            <p style={{ fontSize: 14, fontWeight: 500 }}>{session.nome}</p>
            {usuario?.username && <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)' }}>@{usuario.username}</p>}
          </div>
        </div>
        <input ref={fotoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) { setFotoFile(f); setFotoPreview(URL.createObjectURL(f)); } }} />
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => fotoRef.current?.click()}>{fotoPreview ? 'Trocar foto' : 'Adicionar foto'}</button>
          {fotoFile && <button className="btn btn-primary" onClick={uploadFoto} disabled={savingFoto}>{savingFoto ? <><span className="spinner" />Enviando</> : 'Salvar'}</button>}
        </div>
      </Section>

      <Section title="Dados pessoais">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>Nome</label>
            <input className="input" value={nomeEdit} onChange={e => setNomeEdit(e.target.value)} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>Username</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', fontSize: 14 }}>@</span>
              <input className="input" value={usernameEdit} onChange={e => setUsernameEdit(e.target.value.replace(/^@/, ''))} placeholder="seuusername" style={{ paddingLeft: 26, fontFamily: 'var(--font-mono)' }} />
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>3-30 caracteres: letras, números, . ou _</p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, paddingTop: 4 }}>
            <span style={{ color: 'var(--text-dim)' }}>E-mail</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>{session.email}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: 'var(--text-dim)' }}>Nível</span>
            <span style={{ fontWeight: 500, color: ROLE_COLOR[session.role] }}>{ROLE_LABEL[session.role]}</span>
          </div>
          {perfilError && <p style={{ color: 'var(--danger)', fontSize: 12 }}>{perfilError}</p>}
          {perfilOk && <p style={{ color: 'var(--success)', fontSize: 12 }}>Perfil atualizado</p>}
          <button className="btn btn-primary" onClick={salvarPerfil} disabled={savingPerfil}>
            {savingPerfil ? <><span className="spinner" />Salvando</> : 'Salvar perfil'}
          </button>
        </div>
      </Section>

      <Section title="Aparência">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>Tema</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['dark', 'light'] as const).map(t => (
              <button
                key={t}
                onClick={() => { setTema(t); applyTheme(t); }}
                className={`btn ${tema === t ? 'btn-primary' : 'btn-outline'}`}
                style={{ padding: '6px 14px', fontSize: 12 }}
              >
                {t === 'dark' ? 'Escuro' : 'Claro'}
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Preferências">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {([
            ['Barbeiro favorito', barbeiroFav, setBarbeiroFav, barbeiros.map(b => ({ v: b.id, l: b.nome }))],
            ['Serviço favorito', servicoFav, setServicoFav, storeConfig.servicos.filter(s => s.ativo).map(s => ({ v: s.id, l: s.nome }))],
            ['Unidade favorita', unidadeFav, setUnidadeFav, storeConfig.unidades.filter(u => u.ativo).map(u => ({ v: u.id, l: u.nome }))],
          ] as Array<[string, string, (s: string) => void, Array<{ v: string; l: string }>]>).map(([label, val, setter, opts]) => (
            <div key={label}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>{label}</label>
              <select className="input" value={val} onChange={e => setter(e.target.value)}>
                <option value="">Nenhum</option>
                {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </div>
          ))}
          <button className="btn btn-primary" onClick={salvarPrefs} disabled={saving} style={{ marginTop: 4 }}>
            {saving ? <><span className="spinner" />Salvando</> : saved ? 'Salvo' : 'Salvar preferências'}
          </button>
        </div>
      </Section>

      <Section title="Segurança">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>Senha</span>
          <button className="btn btn-outline" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => setShowSenhaSection(p => !p)}>
            {showSenhaSection ? 'Cancelar' : 'Alterar'}
          </button>
        </div>
        {showSenhaSection && (
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input type="password" className="input" placeholder="Senha atual" value={senhaAtual} onChange={e => setSenhaAtual(e.target.value)} autoComplete="current-password" />
            <input type="password" className="input" placeholder="Nova senha" value={senhaNova} onChange={e => setSenhaNova(e.target.value)} autoComplete="new-password" />
            <input type="password" className="input" placeholder="Confirmar nova senha" value={senhaConfirm} onChange={e => setSenhaConfirm(e.target.value)} autoComplete="new-password" />
            {senhaError && <p style={{ color: 'var(--danger)', fontSize: 12 }}>{senhaError}</p>}
            {senhaOk && <p style={{ color: 'var(--success)', fontSize: 12 }}>Senha alterada com sucesso</p>}
            <button className="btn btn-primary" onClick={alterarSenha} disabled={savingSenha}>
              {savingSenha ? <><span className="spinner" />Salvando</> : 'Confirmar alteração'}
            </button>
          </div>
        )}
      </Section>

      <Section title="Sessão">
        <button className="btn btn-outline" style={{ width: '100%', marginBottom: 8 }} onClick={onLogout}>Sair</button>
        <button className="btn btn-danger" style={{ width: '100%' }} onClick={excluirConta}>Excluir conta</button>
      </Section>
    </div>
  );
}
