'use client';
import { useState, useRef } from 'react';
import type { Session, Usuario, BarbeiroDB, StoreConfig } from '@/types';
import { ROLE_LABEL, ROLE_COLOR, gerarHorarios } from '@/utils';
import Avatar from '@/components/ui/Avatar';

interface Props {
  session: Session; usuario: Usuario | null; barbeiros: BarbeiroDB[];
  storeConfig: StoreConfig; onUpdate: () => void; onLogout: () => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card anim-up" style={{ padding: '20px 22px', marginBottom: 16 }}>
      <p style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-faint)', marginBottom: 16 }}>{title}</p>
      {children}
    </div>
  );
}

export default function Configuracoes({ session, usuario, barbeiros, storeConfig, onUpdate, onLogout }: Props) {
  const [tema, setTema]               = useState<'dark' | 'light'>(usuario?.tema || 'dark');
  const [barbeiroFav, setBarbeiroFav] = useState(usuario?.barbeiro_favorito || '');
  const [servicoFav, setServicoFav]   = useState(usuario?.servico_favorito || '');
  const [horarioFav, setHorarioFav]   = useState(usuario?.horario_favorito || '');
  const [unidadeFav, setUnidadeFav]   = useState(usuario?.unidade_favorita || '');
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [senhaAtual, setSenhaAtual]   = useState('');
  const [senhaNova, setSenhaNova]     = useState('');
  const [senhaConfirm, setSenhaConfirm] = useState('');
  const [senhaError, setSenhaError]   = useState('');
  const [senhaOk, setSenhaOk]         = useState(false);
  const [savingSenha, setSavingSenha] = useState(false);
  const [showSenhaSection, setShowSenhaSection] = useState(false);
  const [showSenhaAtual, setShowSenhaAtual]     = useState(false);
  const [showSenhaNova, setShowSenhaNova]       = useState(false);
  const [showSenhaConfirm, setShowSenhaConfirm] = useState(false);
  const [nomeEdit, setNomeEdit]         = useState(session.nome);
  const [usernameEdit, setUsernameEdit] = useState(usuario?.username || '');
  const [perfilError, setPerfilError]   = useState('');
  const [perfilOk, setPerfilOk]         = useState(false);
  const [savingPerfil, setSavingPerfil] = useState(false);
  const [fotoPreview, setFotoPreview]   = useState<string | null>(usuario?.foto_url || null);
  const [fotoFile, setFotoFile]         = useState<File | null>(null);
  const [savingFoto, setSavingFoto]     = useState(false);
  const fotoRef = useRef<HTMLInputElement>(null);

  const horarios = gerarHorarios(7, 18);

  async function salvarPrefs() {
    setSaving(true);
    await fetch('/api/usuarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'prefs', tema, barbeiro_favorito: barbeiroFav || null, servico_favorito: servicoFav || null, horario_favorito: horarioFav || null, unidade_favorita: unidadeFav || null }) });
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500); onUpdate();
  }

  async function salvarPerfil() {
    setPerfilError(''); setPerfilOk(false); setSavingPerfil(true);
    const res = await fetch('/api/usuarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'perfil', nome: nomeEdit, username: usernameEdit }) });
    const d = await res.json(); setSavingPerfil(false);
    if (!res.ok) { setPerfilError(d.error || 'Erro'); return; }
    setPerfilOk(true); setTimeout(() => setPerfilOk(false), 2500); onUpdate();
  }

  async function uploadFoto() {
    if (!fotoFile) return; setSavingFoto(true);
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
    setTimeout(() => { setSenhaOk(false); setShowSenhaSection(false); }, 2500);
  }

  async function excluirConta() {
    if (!confirm('Tem certeza? Irreversível.')) return;
    const c = prompt('Digite "EXCLUIR" para confirmar:');
    if (c !== 'EXCLUIR') return;
    await fetch('/api/usuarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'excluir' }) });
    onLogout();
  }

  return (
    <div>
      <div className="anim-up" style={{ marginBottom: 28 }}>
        <p style={{ fontSize: '0.72rem', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Painel</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem,6vw,3.5rem)' }}>CONTA</h1>
      </div>

      <Section title="Foto de perfil">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <Avatar src={fotoPreview} nome={session.nome} size={72} />
          <div>
            <p style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: 4 }}>{session.nome}</p>
            {usuario?.username && <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--green)' }}>@{usuario.username}</p>}
          </div>
        </div>
        <input ref={fotoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) { setFotoFile(f); setFotoPreview(URL.createObjectURL(f)); } }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => fotoRef.current?.click()}>{fotoPreview ? 'Trocar foto' : 'Adicionar foto'}</button>
          {fotoFile && <button className="btn btn-green" onClick={uploadFoto} disabled={savingFoto}>{savingFoto ? <><span className="spinner" />Enviando...</> : 'Salvar'}</button>}
        </div>
      </Section>

      <Section title="Dados pessoais">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-faint)', display: 'block', marginBottom: 4 }}>Nome</label>
            <input className="input" value={nomeEdit} onChange={e => setNomeEdit(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-faint)', display: 'block', marginBottom: 4 }}>Username (@)</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--green)', fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>@</span>
              <input className="input" value={usernameEdit} onChange={e => setUsernameEdit(e.target.value.replace(/^@/, ''))} placeholder="seuusername" style={{ paddingLeft: 30, fontFamily: 'var(--font-mono)' }} />
            </div>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-faint)', marginTop: 4 }}>3-30 caracteres: letras, números, . ou _</p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 4 }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>E-mail</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-faint)' }}>{session.email}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Nível</span>
            <span style={{ fontWeight: 700, color: ROLE_COLOR[session.role] }}>{ROLE_LABEL[session.role]}</span>
          </div>
          {perfilError && <p style={{ color: 'var(--red)', fontSize: '0.8rem' }}>{perfilError}</p>}
          {perfilOk && <p style={{ color: 'var(--green)', fontSize: '0.8rem' }}>Perfil atualizado</p>}
          <button className="btn btn-green" onClick={salvarPerfil} disabled={savingPerfil}>
            {savingPerfil ? <><span className="spinner" />Salvando...</> : 'Salvar perfil'}
          </button>
        </div>
      </Section>

      <Section title="Aparência">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.88rem', color: 'var(--text-dim)' }}>Tema</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['dark', 'light'] as const).map(t => (
              <button key={t} onClick={() => setTema(t)} className="btn" style={{ padding: '6px 14px', fontSize: '0.8rem', background: tema === t ? 'var(--green)' : 'var(--surface2)', color: tema === t ? '#000' : 'var(--text-dim)', border: '1px solid ' + (tema === t ? 'var(--green)' : 'var(--border)') }}>
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
            ['Horário favorito', horarioFav, setHorarioFav, horarios.map(h => ({ v: h, l: h }))],
            ['Unidade favorita', unidadeFav, setUnidadeFav, storeConfig.unidades.filter(u => u.ativo).map(u => ({ v: u.id, l: u.nome }))],
          ] as any[]).map(([label, val, setter, opts]) => (
            <div key={label}>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-faint)', display: 'block', marginBottom: 4 }}>{label}</label>
              <select className="input" value={val} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setter(e.target.value)}>
                <option value="">Nenhum</option>
                {opts.map((o: any) => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </div>
          ))}
          <button className="btn btn-green" onClick={salvarPrefs} disabled={saving} style={{ marginTop: 6 }}>
            {saving ? <><span className="spinner" />Salvando...</> : saved ? 'Salvo!' : 'Salvar preferências'}
          </button>
        </div>
      </Section>

      <div className="card anim-up" style={{ padding: '20px 22px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-faint)' }}>Segurança</p>
          <button className="btn btn-outline" style={{ fontSize: '0.72rem', padding: '5px 12px' }} onClick={() => setShowSenhaSection(p => !p)}>
            {showSenhaSection ? 'Cancelar' : 'Alterar senha'}
          </button>
        </div>
        {showSenhaSection && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {([
              [senhaAtual, setSenhaAtual, 'Senha atual', showSenhaAtual, () => setShowSenhaAtual(p => !p)],
              [senhaNova, setSenhaNova, 'Nova senha', showSenhaNova, () => setShowSenhaNova(p => !p)],
              [senhaConfirm, setSenhaConfirm, 'Confirmar nova senha', showSenhaConfirm, () => setShowSenhaConfirm(p => !p)],
            ] as any[]).map(([val, setter, ph, show, toggle]) => (
              <div key={ph} style={{ position: 'relative' }}>
                <input type={show ? 'text' : 'password'} className="input" placeholder={ph} value={val} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setter(e.target.value)} style={{ paddingRight: 72 }} />
                <button onClick={toggle} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', fontSize: '0.7rem', fontFamily: 'var(--font-mono)', padding: '4px 6px' }}>
                  {show ? 'ocultar' : 'mostrar'}
                </button>
              </div>
            ))}
            {senhaError && <p style={{ color: 'var(--red)', fontSize: '0.8rem' }}>{senhaError}</p>}
            {senhaOk && <p style={{ color: 'var(--green)', fontSize: '0.8rem' }}>Senha alterada com sucesso</p>}
            <button className="btn btn-green" onClick={alterarSenha} disabled={savingSenha}>
              {savingSenha ? <><span className="spinner" />Salvando...</> : 'Confirmar alteração'}
            </button>
          </div>
        )}
      </div>

      <Section title="Sessão">
        <button className="btn btn-outline" style={{ width: '100%', marginBottom: 10 }} onClick={onLogout}>Sair da sessão</button>
        <button className="btn btn-danger" style={{ width: '100%' }} onClick={excluirConta}>Excluir conta</button>
      </Section>
    </div>
  );
}
