'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import type { Session, Usuario, Agendamento, BarbeiroDB, StoreConfig, UserRole } from '@/types';
import { ROLE_LABEL, ROLE_COLOR, ROLE_LEVEL, TEMA_COR_MAP, DIAS_NOMES, canDo, applyStoreTheme } from '@/utils';
import Avatar from '@/components/ui/Avatar';

interface Props {
  session: Session; barbeiros: BarbeiroDB[]; storeConfig: StoreConfig; onRefresh: () => void;
}

type GTab = 'usuarios' | 'barbeiros' | 'loja' | 'manutencao';

export default function GerenciaPanel({ session, barbeiros: barbeirosInit, storeConfig: storeConfigInit, onRefresh }: Props) {
  const [usuarios, setUsuarios]         = useState<UsuarioSafe[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [barbeiros, setBarbeiros]       = useState<BarbeiroDB[]>(barbeirosInit);
  const [loading, setLoading]           = useState(true);
  const [activeTab, setActiveTab]       = useState<GTab>('usuarios');
  const [banTarget, setBanTarget]       = useState<string | null>(null);
  const [banMotivo, setBanMotivo]       = useState('');
  const [maintenance, setMaintenance]   = useState<{ ativo: boolean; mensagem: string; _messageId?: string } | null>(null);
  const [maintSaving, setMaintSaving]   = useState(false);
  const [maintSaved, setMaintSaved]     = useState(false);
  const [userSearch, setUserSearch]     = useState('');
  const [promoTarget, setPromoTarget]   = useState<string | null>(null);
  const [novoRole, setNovoRole]         = useState<UserRole>('barbeiro');
  const [novoBarbeiroId, setNovoBarbeiroId] = useState('');
  const [novaUnidadeId, setNovaUnidadeId]   = useState('');
  const [saving, setSaving]             = useState(false);
  const [bFormOpen, setBFormOpen]       = useState(false);
  const [bEditId, setBEditId]           = useState<string | null>(null);
  const [bNome, setBNome]               = useState('');
  const [bEsp, setBEsp]                 = useState('');
  const [bUnidades, setBUnidades]       = useState<string[]>([]);
  const [bFotoFile, setBFotoFile]       = useState<File | null>(null);
  const [bFotoPreview, setBFotoPreview] = useState<string | null>(null);
  const [bSaving, setBSaving]           = useState(false);
  const [bError, setBError]             = useState('');
  const fotoInputRef = useRef<HTMLInputElement>(null);
  const [storeConfig, setStoreConfig]   = useState<StoreConfig>(storeConfigInit);
  const [storeSaving, setStoreSaving]   = useState(false);
  const [storeSaved, setStoreSaved]     = useState(false);
  const [storeError, setStoreError]     = useState('');
  const isDono = session.role === 'dono';

  type UsuarioSafe = Omit<Usuario, 'senha'>;

  const loadAdmin = useCallback(async () => {
    setLoading(true);
    const reqs: Promise<Response>[] = [
      fetch('/api/usuarios?action=todos'),
      fetch('/api/agendamentos?action=admin'),
      fetch('/api/barbeiros?todos=1'),
    ];
    if (isDono) reqs.push(fetch('/api/manutencao'));
    const results = await Promise.all(reqs);
    if (results[0].ok) { const d = await results[0].json(); setUsuarios(d.usuarios || []); }
    if (results[1].ok) { const d = await results[1].json(); setAgendamentos(d.agendamentos || []); }
    if (results[2].ok) { const d = await results[2].json(); setBarbeiros(d.barbeiros || []); }
    if (isDono && results[3]?.ok) { const d = await results[3].json(); setMaintenance(d.maintenance || null); }
    setLoading(false);
  }, [isDono]);

  useEffect(() => { loadAdmin(); }, [loadAdmin]);

  async function promover(uid: string) {
    setSaving(true);
    await fetch('/api/usuarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'promover', usuario_id: uid, novo_role: novoRole, barbeiro_id: novoBarbeiroId || null, unidade_id: novaUnidadeId || null }) });
    setSaving(false); setPromoTarget(null); setNovoRole('barbeiro'); setNovoBarbeiroId(''); setNovaUnidadeId(''); loadAdmin();
  }

  async function banir(uid: string) {
    if (!banMotivo.trim()) { alert('Informe o motivo'); return; }
    setSaving(true);
    await fetch('/api/usuarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'banir', usuario_id: uid, motivo: banMotivo }) });
    setSaving(false); setBanTarget(null); setBanMotivo(''); loadAdmin();
  }

  async function desbanir(uid: string) {
    if (!confirm('Desbanir?')) return;
    await fetch('/api/usuarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'desbanir', usuario_id: uid }) });
    loadAdmin();
  }

  async function salvarManutencao(ativo: boolean, mensagem: string) {
    setMaintSaving(true);
    const res = await fetch('/api/manutencao', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ativo, mensagem }) });
    const d = await res.json(); setMaintSaving(false);
    if (res.ok) { setMaintenance(d.maintenance); setMaintSaved(true); setTimeout(() => setMaintSaved(false), 2500); }
  }

  async function salvarBarbeiro() {
    setBError(''); setBSaving(true);
    try {
      const esp = bEsp.split(',').map(s => s.trim()).filter(Boolean);
      if (bEditId) {
        await fetch('/api/barbeiros', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'editar', barbeiro_id: bEditId, nome: bNome, especialidades: esp, unidades: bUnidades }) });
        if (bFotoFile) { const form = new FormData(); form.append('barbeiro_id', bEditId); form.append('foto', bFotoFile); await fetch('/api/barbeiros', { method: 'POST', body: form }); }
      } else {
        const res = await fetch('/api/barbeiros', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'criar', nome: bNome, especialidades: esp, unidades: bUnidades }) });
        const d = await res.json();
        if (bFotoFile && d.barbeiro?.id) { const form = new FormData(); form.append('barbeiro_id', d.barbeiro.id); form.append('foto', bFotoFile); await fetch('/api/barbeiros', { method: 'POST', body: form }); }
      }
      setBFormOpen(false); setBEditId(null); setBNome(''); setBEsp(''); setBUnidades([]); setBFotoFile(null); setBFotoPreview(null);
      loadAdmin(); onRefresh();
    } catch { setBError('Erro ao salvar'); } finally { setBSaving(false); }
  }

  async function salvarLoja() {
    setStoreError(''); setStoreSaving(true);
    try {
      const res = await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(storeConfig) });
      const d = await res.json();
      if (!res.ok) { setStoreError(d.error || 'Erro'); return; }
      setStoreSaved(true); setTimeout(() => setStoreSaved(false), 2500);
      if (d.config) setStoreConfig(d.config);
      onRefresh();
    } catch { setStoreError('Falha de conexão.'); } finally { setStoreSaving(false); }
  }

  const updateU = (idx: number, f: string, v: unknown) => setStoreConfig(p => { const u = [...p.unidades]; u[idx] = { ...u[idx], [f]: v }; return { ...p, unidades: u }; });
  const updateS = (idx: number, f: string, v: unknown) => setStoreConfig(p => { const s = [...p.servicos]; s[idx] = { ...s[idx], [f]: v }; return { ...p, servicos: s }; });
  const rolesDisponiveis: UserRole[] = isDono ? ['cliente', 'barbeiro', 'gerente', 'dono'] : ['cliente', 'barbeiro', 'gerente'];

  return (
    <div>
      <div className="anim-up" style={{ marginBottom: 28 }}>
        <div className="rasta-bar" style={{ width: 40, borderRadius: 2, marginBottom: 16 }} />
        <p style={{ fontSize: '0.72rem', color: ROLE_COLOR[session.role], textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{ROLE_LABEL[session.role]}</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem,6vw,3rem)' }}>GERÊNCIA</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 24 }}>
        {[{ label: 'Usuários', valor: usuarios.length, color: 'var(--green)' }, { label: 'Agendamentos', valor: agendamentos.length, color: 'var(--yellow)' }, { label: 'Pendentes', valor: agendamentos.filter(a => a.status === 'pendente').length, color: 'var(--red)' }].map(s => (
          <div key={s.label} className="card" style={{ padding: '16px 14px', textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: s.color, lineHeight: 1 }}>{s.valor}</p>
            <p style={{ fontSize: '0.65rem', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>{s.label}</p>
          </div>
        ))}
      </div>

      <div className="tab-bar" style={{ marginBottom: 20, flexWrap: 'wrap' }}>
        <button className={`tab${activeTab === 'usuarios' ? ' active' : ''}`} onClick={() => setActiveTab('usuarios')}>Usuários</button>
        <button className={`tab${activeTab === 'barbeiros' ? ' active' : ''}`} onClick={() => setActiveTab('barbeiros')}>Barbeiros</button>
        {isDono && <button className={`tab${activeTab === 'loja' ? ' active' : ''}`} onClick={() => setActiveTab('loja')}>Loja</button>}
        {isDono && <button className={`tab${activeTab === 'manutencao' ? ' active' : ''}`} onClick={() => setActiveTab('manutencao')} style={{ color: maintenance?.ativo ? 'var(--red)' : undefined }}>Manutenção</button>}
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 40 }}><span className="spinner spinner-lg" /></div>

      : activeTab === 'usuarios' ? (
        <div>
          <input className="input" placeholder="Buscar por nome, @ ou e-mail..." value={userSearch} onChange={e => setUserSearch(e.target.value)} style={{ marginBottom: 12 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {usuarios.filter(u => {
              if (!userSearch) return true;
              const q = userSearch.toLowerCase();
              return u.nome.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q);
            }).map(u => {
              const isMe = u.id === session.id;
              const podeMexer = canDo(session.role, 'promover') && !isMe;
              const lvlAlvo = ROLE_LEVEL[u.role as UserRole] ?? 0;
              const lvlMeu  = ROLE_LEVEL[session.role] ?? 0;
              const bloqueado = !isMe && lvlAlvo >= lvlMeu && session.role !== 'dono';
              return (
                <div key={u.id} className="card" style={{ padding: '16px 18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ display: 'flex', gap: 12, flex: 1 }}>
                      <Avatar src={u.foto_url} nome={u.nome} size={40} accent={ROLE_COLOR[u.role as UserRole]} />
                      <div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 2 }}>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{u.nome}</span>
                          {u.username && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--green)' }}>@{u.username}</span>}
                          <span className="badge" style={{ color: ROLE_COLOR[u.role as UserRole], borderColor: ROLE_COLOR[u.role as UserRole] + '44', background: ROLE_COLOR[u.role as UserRole] + '11' }}>{ROLE_LABEL[u.role as UserRole]}</span>
                          {isMe && <span className="badge badge-gray">Você</span>}
                          {u.banido && <span className="badge badge-red">Banido</span>}
                          {u.barbeiro_id && <span className="badge badge-green">{barbeiros.find(b => b.id === u.barbeiro_id)?.nome || u.barbeiro_id}</span>}
                        </div>
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-faint)' }}>{u.email}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {podeMexer && !bloqueado && <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => { setPromoTarget(u.id === promoTarget ? null : u.id); setBanTarget(null); }}>{promoTarget === u.id ? 'Cancelar' : 'Cargo'}</button>}
                      {!isMe && u.role !== 'dono' && canDo(session.role, 'promover') && (u.banido
                        ? <button className="btn btn-green" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => desbanir(u.id)}>Desbanir</button>
                        : <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => { setBanTarget(u.id === banTarget ? null : u.id); setPromoTarget(null); setBanMotivo(''); }}>Banir</button>
                      )}
                    </div>
                  </div>
                  {banTarget === u.id && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <p style={{ fontSize: '0.72rem', color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Banir usuário</p>
                      <input className="input" placeholder="Motivo..." value={banMotivo} onChange={e => setBanMotivo(e.target.value)} />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => banir(u.id)} disabled={saving}>{saving ? <><span className="spinner" />Banindo...</> : 'Confirmar'}</button>
                        <button className="btn btn-outline" onClick={() => { setBanTarget(null); setBanMotivo(''); }}>Cancelar</button>
                      </div>
                    </div>
                  )}
                  {promoTarget === u.id && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div>
                        <label style={{ fontSize: '0.72rem', color: 'var(--text-faint)', display: 'block', marginBottom: 4 }}>Novo cargo</label>
                        <select className="input" value={novoRole} onChange={e => setNovoRole(e.target.value as UserRole)}>
                          {rolesDisponiveis.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                        </select>
                      </div>
                      {novoRole === 'barbeiro' && <div><label style={{ fontSize: '0.72rem', color: 'var(--text-faint)', display: 'block', marginBottom: 4 }}>Barbeiro vinculado</label><select className="input" value={novoBarbeiroId} onChange={e => setNovoBarbeiroId(e.target.value)}><option value="">Nenhum</option>{barbeiros.map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}</select></div>}
                      {(novoRole === 'barbeiro' || novoRole === 'gerente') && <div><label style={{ fontSize: '0.72rem', color: 'var(--text-faint)', display: 'block', marginBottom: 4 }}>Unidade</label><select className="input" value={novaUnidadeId} onChange={e => setNovaUnidadeId(e.target.value)}><option value="">Nenhuma</option>{storeConfig.unidades.map(un => <option key={un.id} value={un.id}>{un.nome}</option>)}</select></div>}
                      <button className="btn btn-green" onClick={() => promover(u.id)} disabled={saving}>{saving ? <><span className="spinner" />Salvando...</> : 'Confirmar alteração'}</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      ) : activeTab === 'barbeiros' ? (
        <div>
          <button className="btn btn-green" style={{ width: '100%', marginBottom: 16 }} onClick={() => { setBFormOpen(true); setBEditId(null); setBNome(''); setBEsp(''); setBUnidades([]); setBFotoFile(null); setBFotoPreview(null); }}>+ Novo Barbeiro</button>
          {bFormOpen && (
            <div className="card" style={{ padding: 20, marginBottom: 16 }}>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>{bEditId ? 'Editar' : 'Novo barbeiro'}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input className="input" placeholder="Nome" value={bNome} onChange={e => setBNome(e.target.value)} />
                <input className="input" placeholder="Especialidades (sep. por vírgula)" value={bEsp} onChange={e => setBEsp(e.target.value)} />
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-faint)', display: 'block', marginBottom: 6 }}>Unidades</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {storeConfig.unidades.map(u => (
                      <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.82rem' }}>
                        <input type="checkbox" checked={bUnidades.includes(u.id)} onChange={e => setBUnidades(p => e.target.checked ? [...p, u.id] : p.filter(x => x !== u.id))} style={{ accentColor: 'var(--green)' }} />
                        {u.nome.replace(storeConfig.nome_loja + ' ', '')}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-faint)', display: 'block', marginBottom: 6 }}>Foto</label>
                  {bFotoPreview && <img src={bFotoPreview} alt="preview" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', marginBottom: 8 }} />}
                  <input ref={fotoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) { setBFotoFile(f); setBFotoPreview(URL.createObjectURL(f)); } }} />
                  <button className="btn btn-outline" style={{ width: '100%' }} onClick={() => fotoInputRef.current?.click()}>{bFotoPreview ? 'Trocar foto' : 'Adicionar foto'}</button>
                </div>
                {bError && <p style={{ color: 'var(--red)', fontSize: '0.8rem' }}>{bError}</p>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-green" style={{ flex: 1 }} onClick={salvarBarbeiro} disabled={bSaving}>{bSaving ? <><span className="spinner" />Salvando...</> : 'Salvar'}</button>
                  <button className="btn btn-outline" onClick={() => { setBFormOpen(false); setBEditId(null); }}>Cancelar</button>
                </div>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {barbeiros.map(b => (
              <div key={b.id} className="card" style={{ padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <Avatar src={b.photo_url} nome={b.nome} size={48} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontWeight: 700 }}>{b.nome}</span>
                      {!b.ativo && <span className="badge badge-red">Inativo</span>}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{b.especialidades.map(e => <span key={e} className="badge badge-gray">{e}</span>)}</div>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-faint)', marginTop: 4 }}>{b.unidades.map(uid => storeConfig.unidades.find(u => u.id === uid)?.bairro || uid).join(', ')}</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button className="btn btn-outline" style={{ padding: '4px 10px', fontSize: '0.72rem' }} onClick={() => { setBFormOpen(true); setBEditId(b.id); setBNome(b.nome); setBEsp(b.especialidades.join(', ')); setBUnidades([...b.unidades]); setBFotoPreview(b.photo_url || null); }}>Editar</button>
                    <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: '0.72rem' }} onClick={async () => { if (!confirm(b.ativo ? 'Desativar?' : 'Reativar?')) return; await fetch('/api/barbeiros', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'editar', barbeiro_id: b.id, ativo: !b.ativo }) }); loadAdmin(); onRefresh(); }}>{b.ativo ? 'Desativar' : 'Reativar'}</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      ) : activeTab === 'manutencao' && isDono ? (
        <div>
          <div className="card" style={{ padding: 20, marginBottom: 16, border: maintenance?.ativo ? '1px solid rgba(255,23,68,0.4)' : '1px solid var(--border)' }}>
            <p style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-faint)', marginBottom: 16 }}>Modo Manutenção</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: '0.95rem' }}>{maintenance?.ativo ? 'Ativo — Site bloqueado' : 'Desativado — Site normal'}</p>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-faint)', marginTop: 3 }}>Apenas o dono acessa durante manutenção</p>
              </div>
              <button onClick={() => salvarManutencao(!maintenance?.ativo, maintenance?.mensagem || 'Site em manutenção. Voltamos em breve.')} disabled={maintSaving} style={{ padding: '10px 20px', borderRadius: 10, fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', border: 'none', background: maintenance?.ativo ? 'var(--green)' : 'var(--red)', color: '#fff', minWidth: 100 }}>
                {maintSaving ? '...' : maintenance?.ativo ? 'Desativar' : 'Ativar'}
              </button>
            </div>
            <textarea className="input" rows={3} value={maintenance?.mensagem || ''} onChange={e => setMaintenance(prev => prev ? { ...prev, mensagem: e.target.value } : { ativo: false, mensagem: e.target.value })} style={{ resize: 'vertical', fontFamily: 'var(--font-ui)', marginBottom: 12 }} />
            {maintSaved && <p style={{ color: 'var(--green)', fontSize: '0.8rem', marginBottom: 10 }}>Salvo</p>}
            <button className="btn btn-outline" style={{ width: '100%' }} onClick={() => salvarManutencao(maintenance?.ativo ?? false, maintenance?.mensagem || '')}>
              {maintSaving ? <><span className="spinner" />Salvando...</> : 'Salvar mensagem'}
            </button>
          </div>
        </div>

      ) : activeTab === 'loja' && isDono ? (
        <div>
          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <p style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-faint)', marginBottom: 16 }}>Identidade da loja</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label style={{ fontSize: '0.78rem', color: 'var(--text-faint)', display: 'block', marginBottom: 4 }}>Nome</label><input className="input" value={storeConfig.nome_loja} onChange={e => setStoreConfig(p => ({ ...p, nome_loja: e.target.value }))} /></div>
              <div><label style={{ fontSize: '0.78rem', color: 'var(--text-faint)', display: 'block', marginBottom: 4 }}>Slogan</label><input className="input" value={storeConfig.slogan} onChange={e => setStoreConfig(p => ({ ...p, slogan: e.target.value }))} /></div>
              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-faint)', display: 'block', marginBottom: 10 }}>Cor principal</label>

                {/* Swatches rápidos */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
                  {(['green', 'yellow', 'red', 'purple', 'blue'] as const).map(cor => (
                    <button
                      key={cor}
                      className={`swatch${storeConfig.tema_cor === cor && !storeConfig.modo_reggae ? ' active' : ''}`}
                      onClick={() => { setStoreConfig(p => ({ ...p, tema_cor: cor, modo_reggae: false })); applyStoreTheme({ tema_cor: cor, modo_reggae: false }); }}
                      style={{ background: TEMA_COR_MAP[cor] }}
                      title={cor}
                    />
                  ))}
                  {/* Swatch cor livre */}
                  <button
                    className={`swatch${storeConfig.tema_cor === 'custom' && !storeConfig.modo_reggae ? ' active' : ''}`}
                    onClick={() => setStoreConfig(p => ({ ...p, tema_cor: 'custom', modo_reggae: false }))}
                    style={{ background: storeConfig.tema_cor_custom || 'conic-gradient(red,yellow,lime,cyan,blue,magenta,red)', position: 'relative', overflow: 'hidden' }}
                    title="Cor personalizada"
                  />
                </div>

                {/* Color picker nativo */}
                {storeConfig.tema_cor === 'custom' && !storeConfig.modo_reggae && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--surface2)', borderRadius: 6, border: '1px solid var(--border)', marginBottom: 12 }}>
                    <input
                      type="color"
                      value={storeConfig.tema_cor_custom || '#D4AF37'}
                      onChange={e => {
                        const hex = e.target.value;
                        setStoreConfig(p => ({ ...p, tema_cor: 'custom', tema_cor_custom: hex }));
                        applyStoreTheme({ tema_cor: 'custom', tema_cor_custom: hex, modo_reggae: false });
                      }}
                      style={{ width: 52, height: 52, border: 'none', borderRadius: 6, cursor: 'pointer', background: 'none', padding: 0, flexShrink: 0 }}
                    />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: 'var(--text)', marginBottom: 2 }}>
                        {storeConfig.tema_cor_custom || '#D4AF37'}
                      </p>
                      <p style={{ fontSize: '0.68rem', color: 'var(--text-faint)' }}>Clique no quadrado para abrir o painel de cores</p>
                    </div>
                    <div style={{
                      width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                      background: storeConfig.tema_cor_custom || '#D4AF37',
                      border: '2px solid rgba(255,255,255,0.15)',
                      boxShadow: `0 0 18px ${storeConfig.tema_cor_custom || '#D4AF37'}66`,
                    }} />
                  </div>
                )}

                {/* Modo Reggae */}
                <div
                  onClick={() => {
                    const next = !storeConfig.modo_reggae;
                    setStoreConfig(p => ({ ...p, modo_reggae: next }));
                    applyStoreTheme({ tema_cor: storeConfig.tema_cor, tema_cor_custom: storeConfig.tema_cor_custom, modo_reggae: next });
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 14px', borderRadius: 6, cursor: 'pointer',
                    background: storeConfig.modo_reggae
                      ? 'linear-gradient(90deg,rgba(0,200,83,0.1),rgba(255,214,0,0.1),rgba(255,23,68,0.1))'
                      : 'var(--surface2)',
                    border: `1px solid ${storeConfig.modo_reggae ? 'rgba(0,200,83,0.3)' : 'var(--border)'}`,
                    transition: 'all 0.3s',
                    userSelect: 'none',
                  }}
                >
                  <div>
                    <p style={{ fontSize: '0.84rem', fontWeight: 700, color: storeConfig.modo_reggae ? '#00C853' : 'var(--text)', marginBottom: 2 }}>
                      {storeConfig.modo_reggae ? '🟢🟡🔴 Modo Reggae ATIVO' : '🎵 Modo Reggae'}
                    </p>
                    <p style={{ fontSize: '0.68rem', color: 'var(--text-faint)' }}>Verde · Amarelo · Vermelho — one love ✌️</p>
                  </div>
                  <div
                    className={`toggle${storeConfig.modo_reggae ? ' on' : ''}`}
                    style={storeConfig.modo_reggae ? { background: '#00C853' } : {}}
                    onClick={e => e.stopPropagation()}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <p style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-faint)' }}>Unidades</p>
              <button className="btn btn-outline" style={{ padding: '6px 14px', fontSize: '0.78rem' }} onClick={() => { const id = 'u' + Date.now(); setStoreConfig(p => ({ ...p, unidades: [...p.unidades, { id, nome: p.nome_loja + ' Nova Unidade', endereco: '', bairro: '', cidade: '', horario: { abertura: 8, fechamento: 20 }, dias_semana: [1,2,3,4,5,6], barbeiros: [], ativo: true }] })); }}>+ Adicionar</button>
            </div>
            {storeConfig.unidades.map((u, idx) => (
              <div key={u.id} style={{ borderBottom: idx < storeConfig.unidades.length - 1 ? '1px solid var(--border)' : 'none', paddingBottom: 16, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <input className="input" value={u.nome} onChange={e => updateU(idx, 'nome', e.target.value)} style={{ fontWeight: 700 }} />
                  <button onClick={() => updateU(idx, 'ativo', !u.ativo)} className={`btn ${u.ativo ? 'btn-outline' : 'btn-green'}`} style={{ padding: '6px 12px', fontSize: '0.72rem', flexShrink: 0 }}>{u.ativo ? 'Ativo' : 'Inativo'}</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <input className="input" placeholder="Endereço" value={u.endereco} onChange={e => updateU(idx, 'endereco', e.target.value)} style={{ fontSize: '0.82rem' }} />
                  <input className="input" placeholder="Bairro" value={u.bairro} onChange={e => updateU(idx, 'bairro', e.target.value)} style={{ fontSize: '0.82rem' }} />
                  <input className="input" placeholder="Cidade" value={u.cidade} onChange={e => updateU(idx, 'cidade', e.target.value)} style={{ fontSize: '0.82rem' }} />
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-faint)' }}>Abre:</span>
                  <input type="number" className="input" value={u.horario.abertura} min={0} max={23} onChange={e => updateU(idx, 'horario', { ...u.horario, abertura: +e.target.value })} style={{ width: 70 }} />
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-faint)' }}>Fecha:</span>
                  <input type="number" className="input" value={u.horario.fechamento} min={0} max={24} onChange={e => updateU(idx, 'horario', { ...u.horario, fechamento: +e.target.value })} style={{ width: 70 }} />
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {DIAS_NOMES.map((dia, dIdx) => (
                    <label key={dIdx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
                      <input type="checkbox" checked={u.dias_semana.includes(dIdx)} onChange={e => { const dias = e.target.checked ? [...u.dias_semana, dIdx].sort() : u.dias_semana.filter(d => d !== dIdx); updateU(idx, 'dias_semana', dias); }} style={{ accentColor: 'var(--green)' }} />
                      <span style={{ fontSize: '0.65rem', color: u.dias_semana.includes(dIdx) ? 'var(--green)' : 'var(--text-faint)' }}>{dia}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <p style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-faint)' }}>Serviços</p>
              <button className="btn btn-outline" style={{ padding: '6px 14px', fontSize: '0.78rem' }} onClick={() => { const id = 's' + Date.now(); setStoreConfig(p => ({ ...p, servicos: [...p.servicos, { id, nome: 'Novo Serviço', valor: 30, duracao: 30, descricao: '', ativo: true }] })); }}>+ Adicionar</button>
            </div>
            {storeConfig.servicos.map((s, idx) => (
              <div key={s.id} style={{ borderBottom: idx < storeConfig.servicos.length - 1 ? '1px solid var(--border)' : 'none', paddingBottom: 14, marginBottom: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <input className="input" value={s.nome} onChange={e => updateS(idx, 'nome', e.target.value)} style={{ fontWeight: 700 }} />
                  <button onClick={() => updateS(idx, 'ativo', !s.ativo)} className={`btn ${s.ativo ? 'btn-outline' : 'btn-green'}`} style={{ padding: '6px 12px', fontSize: '0.72rem' }}>{s.ativo ? 'Ativo' : 'Inativo'}</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <div><label style={{ fontSize: '0.72rem', color: 'var(--text-faint)', display: 'block', marginBottom: 3 }}>Valor (R$)</label><input type="number" className="input" value={s.valor} min={0} onChange={e => updateS(idx, 'valor', +e.target.value)} /></div>
                  <div><label style={{ fontSize: '0.72rem', color: 'var(--text-faint)', display: 'block', marginBottom: 3 }}>Duração (min)</label><input type="number" className="input" value={s.duracao} min={10} step={5} onChange={e => updateS(idx, 'duracao', +e.target.value)} /></div>
                </div>
                <input className="input" placeholder="Descrição" value={s.descricao} onChange={e => updateS(idx, 'descricao', e.target.value)} style={{ fontSize: '0.82rem' }} />
              </div>
            ))}
          </div>

          {storeError && <p style={{ color: 'var(--red)', fontSize: '0.8rem', marginBottom: 10 }}>{storeError}</p>}
          {storeSaved && <p style={{ color: 'var(--green)', fontSize: '0.8rem', marginBottom: 10 }}>Configurações salvas</p>}
          <button className="btn btn-green" style={{ width: '100%' }} onClick={salvarLoja} disabled={storeSaving}>
            {storeSaving ? <><span className="spinner" />Salvando...</> : 'Salvar todas as configurações'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
