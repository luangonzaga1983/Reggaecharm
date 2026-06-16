'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import type { Session, Usuario, Agendamento, BarbeiroDB, StoreConfig, UserRole, FolgaBlock } from '@/types';
import { ROLE_LABEL, ROLE_COLOR, ROLE_LEVEL, TEMA_COR_MAP, DIAS_NOMES, canDo, applyStoreTheme, gerarHorarios } from '@/utils';
import { hojeSP } from '@/lib/datetime';
import Avatar from '@/components/ui/Avatar';

const TIME_OPTS = gerarHorarios(0, 24); // '00:00' … '23:30'

type UsuarioSafe = Omit<Usuario, 'senha'>;
type GTab = 'usuarios' | 'barbeiros' | 'loja' | 'manutencao';

interface Props {
  session: Session; barbeiros: BarbeiroDB[]; storeConfig: StoreConfig; onRefresh: () => void;
}

export default function GerenciaPanel({ session, barbeiros: barbeirosInit, storeConfig: storeConfigInit, onRefresh }: Props) {
  const [usuarios, setUsuarios]         = useState<UsuarioSafe[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [barbeiros, setBarbeiros]       = useState<BarbeiroDB[]>(barbeirosInit);
  const [loading, setLoading]           = useState(true);
  const [activeTab, setActiveTab]       = useState<GTab>('usuarios');

  const [banTarget, setBanTarget]   = useState<string | null>(null);
  const [banMotivo, setBanMotivo]   = useState('');
  const [delTarget, setDelTarget]   = useState<string | null>(null);
  const [openUser, setOpenUser]     = useState<string | null>(null);
  const [openBarber, setOpenBarber] = useState<string | null>(null);
  const [gerTarget, setGerTarget]   = useState<string | null>(null);
  const [gerForm, setGerForm]       = useState({ nome: '', email: '', username: '', senha: '', saldo: '', multa: '' });
  const [gerSaving, setGerSaving]   = useState(false);
  const [gerMsg, setGerMsg]         = useState('');
  const [maintenance, setMaintenance] = useState<{ ativo: boolean; mensagem: string; _messageId?: string } | null>(null);
  const [maintSaving, setMaintSaving] = useState(false);
  const [maintSaved, setMaintSaved]   = useState(false);

  const [userSearch, setUserSearch]         = useState('');
  const [promoTarget, setPromoTarget]       = useState<string | null>(null);
  const [novoRole, setNovoRole]             = useState<UserRole>('barbeiro');
  const [novaUnidadeId, setNovaUnidadeId]   = useState('');
  const [saving, setSaving]                 = useState(false);

  const [bFormOpen, setBFormOpen]       = useState(false);
  const [bEditId, setBEditId]           = useState<string | null>(null);
  const [bNome, setBNome]               = useState('');
  const [bEsp, setBEsp]                 = useState('');
  const [bUnidades, setBUnidades]       = useState<string[]>([]);
  const [bFotoFile, setBFotoFile]       = useState<File | null>(null);
  const [bFotoPreview, setBFotoPreview] = useState<string | null>(null);
  const [bSaving, setBSaving]           = useState(false);
  const [bError, setBError]             = useState('');
  const [bAlmocoIni, setBAlmocoIni]     = useState('');
  const [bAlmocoFim, setBAlmocoFim]     = useState('');
  const [bFolgas, setBFolgas]           = useState<FolgaBlock[]>([]);
  const fotoInputRef = useRef<HTMLInputElement>(null);

  function abrirFormBarbeiro(b: BarbeiroDB | null) {
    setBFormOpen(true);
    setBError('');
    setBEditId(b?.id ?? null);
    setBNome(b?.nome ?? '');
    setBEsp(b?.especialidades.join(', ') ?? '');
    setBUnidades(b ? [...b.unidades] : []);
    setBFotoFile(null);
    setBFotoPreview(b?.photo_url ?? null);
    setBAlmocoIni(b?.almoco?.inicio ?? '');
    setBAlmocoFim(b?.almoco?.fim ?? '');
    setBFolgas(b?.folgas ? b.folgas.map(f => ({ ...f })) : []);
  }

  const [storeConfig, setStoreConfig] = useState<StoreConfig>(storeConfigInit);
  const [storeSaving, setStoreSaving] = useState(false);
  const [storeSaved, setStoreSaved]   = useState(false);
  const [storeError, setStoreError]   = useState('');
  const isDono = session.role === 'dono';
  const canGerenciarContas = isDono || session.role === 'gerente';

  /** Painel reutilizável de "Gerenciar conta" (Usuários e Barbeiros). */
  function gerenciarBloco(u: UsuarioSafe) {
    const aberto = gerTarget === u.id;
    return (
      <>
        <button className="btn btn-outline" style={{ width: '100%', marginTop: 10, fontSize: 12 }}
          onClick={() => aberto ? setGerTarget(null) : abrirGerenciar(u)}>
          {aberto ? 'Fechar gerenciamento' : 'Gerenciar conta'}
        </button>
        {aberto && (
          <div className="card" style={{ padding: 14, marginTop: 8, background: 'var(--bg-elev)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {isDono && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Avatar src={u.foto_url} nome={u.nome} size={48} />
                <label className="btn btn-outline" style={{ padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
                  Trocar foto
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadFotoUser(u.id, f); e.target.value = ''; }} />
                </label>
              </div>
            )}
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-faint)', marginBottom: 4 }}>Nome</label>
              <input className="input" value={gerForm.nome} onChange={e => setGerForm(f => ({ ...f, nome: e.target.value }))} />
            </div>
            {isDono && (
              <>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--text-faint)', marginBottom: 4 }}>E-mail</label>
                  <input className="input" type="email" value={gerForm.email} onChange={e => setGerForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--text-faint)', marginBottom: 4 }}>@username (vazio = nenhum)</label>
                  <input className="input" value={gerForm.username} onChange={e => setGerForm(f => ({ ...f, username: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--text-faint)', marginBottom: 4 }}>Nova senha (vazio = mantém)</label>
                  <input className="input" type="text" placeholder="mín. 8 caracteres" value={gerForm.senha} onChange={e => setGerForm(f => ({ ...f, senha: e.target.value }))} />
                </div>
              </>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: isDono ? '1fr 1fr' : '1fr', gap: 10 }}>
              {isDono && (
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--text-faint)', marginBottom: 4 }}>Crédito (R$)</label>
                  <input className="input" type="number" min={0} step="0.01" value={gerForm.saldo} onChange={e => setGerForm(f => ({ ...f, saldo: e.target.value }))} />
                </div>
              )}
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-faint)', marginBottom: 4 }}>Multa (R$)</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className="input" type="number" min={0} step="0.01" value={gerForm.multa} onChange={e => setGerForm(f => ({ ...f, multa: e.target.value }))} />
                  <button className="btn btn-ghost" style={{ padding: '0 10px', fontSize: 11, whiteSpace: 'nowrap' }} onClick={() => setGerForm(f => ({ ...f, multa: '0' }))}>Zerar</button>
                </div>
              </div>
            </div>
            {gerMsg && <p style={{ fontSize: 12, color: gerMsg.includes('Salvo') || gerMsg.includes('atualizada') ? 'var(--success)' : 'var(--danger)' }}>{gerMsg}</p>}
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => salvarGerenciar(u.id)} disabled={gerSaving}>
              {gerSaving ? <><span className="spinner" />Salvando</> : 'Salvar alterações'}
            </button>
          </div>
        )}
      </>
    );
  }

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
    await fetch('/api/usuarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'promover', usuario_id: uid, novo_role: novoRole, unidade_id: novaUnidadeId || null }) });
    setSaving(false); setPromoTarget(null); setNovoRole('barbeiro'); setNovaUnidadeId(''); loadAdmin();
  }

  async function banir(uid: string) {
    if (!banMotivo.trim()) { alert('Informe o motivo'); return; }
    setSaving(true);
    await fetch('/api/usuarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'banir', usuario_id: uid, motivo: banMotivo }) });
    setSaving(false); setBanTarget(null); setBanMotivo(''); loadAdmin();
  }

  async function desbanir(uid: string) {
    if (!confirm('Desbanir este usuário?')) return;
    await fetch('/api/usuarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'desbanir', usuario_id: uid }) });
    loadAdmin();
  }

  function abrirGerenciar(u: UsuarioSafe) {
    setGerTarget(u.id); setGerMsg('');
    setGerForm({
      nome: u.nome || '', email: u.email || '', username: u.username || '',
      senha: '', saldo: String(u.credito_saldo ?? 0), multa: String(u.multa_pendente ?? 0),
    });
    setBanTarget(null); setPromoTarget(null); setDelTarget(null);
  }

  async function salvarGerenciar(uid: string) {
    setGerSaving(true); setGerMsg('');
    const body: Record<string, unknown> = {
      action: 'admin_editar', usuario_id: uid,
      nome: gerForm.nome, multa_pendente: Number(gerForm.multa) || 0,
    };
    // Campos sensíveis só o dono envia (gerente não pode).
    if (isDono) {
      body.email = gerForm.email;
      body.username = gerForm.username;
      body.credito_saldo = Number(gerForm.saldo) || 0;
      if (gerForm.senha) body.senha = gerForm.senha;
    }
    const res = await fetch('/api/usuarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    setGerSaving(false);
    if (!res.ok) { setGerMsg(d.error || 'Erro ao salvar'); return; }
    setGerMsg('Salvo!'); setGerForm(f => ({ ...f, senha: '' })); loadAdmin();
  }

  async function uploadFotoUser(uid: string, file: File) {
    const form = new FormData(); form.append('foto', file); form.append('usuario_id', uid);
    const res = await fetch('/api/usuarios', { method: 'POST', body: form });
    if (res.ok) { setGerMsg('Foto atualizada'); loadAdmin(); } else { setGerMsg('Falha ao enviar foto'); }
  }

  async function excluirUsuario(uid: string) {
    setSaving(true);
    const res = await fetch('/api/usuarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'excluir_usuario', usuario_id: uid }) });
    setSaving(false); setDelTarget(null);
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || 'Não foi possível excluir.'); return; }
    loadAdmin();
  }

  async function salvarManutencao(ativo: boolean, mensagem: string) {
    setMaintSaving(true);
    const res = await fetch('/api/manutencao', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ativo, mensagem }) });
    const d = await res.json(); setMaintSaving(false);
    if (res.ok) { setMaintenance(d.maintenance); setMaintSaved(true); setTimeout(() => setMaintSaved(false), 2000); }
  }

  async function salvarBarbeiro() {
    setBError(''); setBSaving(true);
    try {
      const esp = bEsp.split(',').map(s => s.trim()).filter(Boolean);
      const almoco = bAlmocoIni && bAlmocoFim ? { inicio: bAlmocoIni, fim: bAlmocoFim } : null;
      if (almoco && almoco.inicio >= almoco.fim) { setBError('Almoço: início deve ser antes do fim'); setBSaving(false); return; }
      if (bEditId) {
        await fetch('/api/barbeiros', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'editar', barbeiro_id: bEditId, nome: bNome, especialidades: esp, unidades: bUnidades, almoco, folgas: bFolgas }) });
        if (bFotoFile) { const form = new FormData(); form.append('barbeiro_id', bEditId); form.append('foto', bFotoFile); const fr = await fetch('/api/barbeiros', { method: 'POST', body: form }); if (!fr.ok) { const d = await fr.json().catch(() => ({})); setBError(d.error || 'Falha ao enviar foto'); setBSaving(false); return; } }
      } else {
        const res = await fetch('/api/barbeiros', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'criar', nome: bNome, especialidades: esp, unidades: bUnidades }) });
        const d = await res.json();
        if (d.barbeiro?.id) {
          if (bFotoFile) { const form = new FormData(); form.append('barbeiro_id', d.barbeiro.id); form.append('foto', bFotoFile); const fr = await fetch('/api/barbeiros', { method: 'POST', body: form }); if (!fr.ok) { const e = await fr.json().catch(() => ({})); setBError(e.error || 'Falha ao enviar foto'); setBSaving(false); return; } }
          if (almoco || bFolgas.length) await fetch('/api/barbeiros', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'editar', barbeiro_id: d.barbeiro.id, almoco, folgas: bFolgas }) });
        }
      }
      // Sincroniza bidirecionalmente: adiciona o ID do barbeiro nas unidades selecionadas
      if (bUnidades.length && bEditId) {
        const cfgRes = await fetch('/api/config');
        if (cfgRes.ok) {
          const { config } = await cfgRes.json();
          const novasUnidades = config.unidades.map((u: any) => {
            const lista: string[] = Array.isArray(u.barbeiros) ? [...u.barbeiros] : [];
            if (bUnidades.includes(u.id) && !lista.includes(bEditId)) lista.push(bEditId);
            else if (!bUnidades.includes(u.id)) {
              const i = lista.indexOf(bEditId);
              if (i >= 0) lista.splice(i, 1);
            }
            return { ...u, barbeiros: lista };
          });
          await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ unidades: novasUnidades }) });
        }
      }
      setBFormOpen(false); setBEditId(null); setBNome(''); setBEsp(''); setBUnidades([]); setBFotoFile(null); setBFotoPreview(null); setBAlmocoIni(''); setBAlmocoFim(''); setBFolgas([]);
      loadAdmin(); onRefresh();
    } catch { setBError('Erro ao salvar'); } finally { setBSaving(false); }
  }

  async function salvarLoja() {
    setStoreError(''); setStoreSaving(true);
    try {
      const res = await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(storeConfig) });
      const d = await res.json();
      if (!res.ok) { setStoreError(d.error || 'Erro'); return; }
      setStoreSaved(true); setTimeout(() => setStoreSaved(false), 2000);
      if (d.config) setStoreConfig(d.config);
      onRefresh();
    } catch { setStoreError('Falha de conexão'); } finally { setStoreSaving(false); }
  }

  const updateU = (idx: number, f: string, v: unknown) => setStoreConfig(p => { const u = [...p.unidades]; u[idx] = { ...u[idx], [f]: v }; return { ...p, unidades: u }; });
  const updateS = (idx: number, f: string, v: unknown) => setStoreConfig(p => { const s = [...p.servicos]; s[idx] = { ...s[idx], [f]: v }; return { ...p, servicos: s }; });
  const removeU = (idx: number) => setStoreConfig(p => ({ ...p, unidades: p.unidades.filter((_, i) => i !== idx) }));
  const removeS = (idx: number) => setStoreConfig(p => ({ ...p, servicos: p.servicos.filter((_, i) => i !== idx) }));
  const rolesDisponiveis: UserRole[] = isDono ? ['cliente', 'barbeiro', 'gerente', 'dono'] : ['cliente', 'barbeiro', 'gerente'];

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 12, color: ROLE_COLOR[session.role], textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{ROLE_LABEL[session.role]}</p>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>Gerência</h1>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 18 }}>
        {[{ label: 'Usuários', valor: usuarios.length }, { label: 'Agendamentos', valor: agendamentos.length }, { label: 'Pendentes', valor: agendamentos.filter(a => a.status === 'pendente').length }].map(s => (
          <div key={s.label} className="card" style={{ padding: 12, textAlign: 'center' }}>
            <p style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', lineHeight: 1 }}>{s.valor}</p>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>{s.label}</p>
          </div>
        ))}
      </div>

      <div className="tab-bar">
        <button className={`tab ${activeTab === 'usuarios' ? 'active' : ''}`} onClick={() => setActiveTab('usuarios')}>Usuários</button>
        <button className={`tab ${activeTab === 'barbeiros' ? 'active' : ''}`} onClick={() => setActiveTab('barbeiros')}>Barbeiros</button>
        {isDono && <button className={`tab ${activeTab === 'loja' ? 'active' : ''}`} onClick={() => setActiveTab('loja')}>Loja</button>}
        {isDono && <button className={`tab ${activeTab === 'manutencao' ? 'active' : ''}`} onClick={() => setActiveTab('manutencao')}>Manutenção</button>}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 32 }}><span className="spinner spinner-lg" /></div>
      ) : activeTab === 'usuarios' ? (
        <div>
          <input className="input" placeholder="Buscar nome, @ ou e-mail" value={userSearch} onChange={e => setUserSearch(e.target.value)} style={{ marginBottom: 12 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {usuarios.filter(u => u.role !== 'barbeiro').filter(u => {
              if (!userSearch) return true;
              const q = userSearch.toLowerCase();
              return u.nome.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q);
            }).map(u => {
              const isMe = u.id === session.id;
              const podeMexer = canDo(session.role, 'promover') && !isMe;
              const lvlAlvo = ROLE_LEVEL[u.role] ?? 0;
              const lvlMeu  = ROLE_LEVEL[session.role] ?? 0;
              const bloqueado = !isMe && lvlAlvo >= lvlMeu && session.role !== 'dono';
              const aberto = openUser === u.id;
              const temAcoes = (podeMexer && !bloqueado) || (!isMe && u.role !== 'dono' && canDo(session.role, 'promover'));
              return (
                <div key={u.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  {/* Cabeçalho clicável: só identidade */}
                  <button
                    onClick={() => { setOpenUser(aberto ? null : u.id); setBanTarget(null); setPromoTarget(null); setDelTarget(null); }}
                    style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, font: 'inherit', color: 'inherit' }}
                  >
                    <div style={{ display: 'flex', gap: 10, flex: 1, minWidth: 0, alignItems: 'center' }}>
                      <Avatar src={u.foto_url} nome={u.nome} size={36} accent={ROLE_COLOR[u.role]} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 2 }}>
                          <span style={{ fontWeight: 500, fontSize: 14 }}>{u.nome}</span>
                          {u.username && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)' }}>@{u.username}</span>}
                          <span className="badge" style={{ color: ROLE_COLOR[u.role], borderColor: 'currentColor', background: 'transparent' }}>{ROLE_LABEL[u.role]}</span>
                          {isMe && <span className="badge badge-gray">Você</span>}
                          {u.banido && <span className="badge badge-red">Banido</span>}
                        </div>
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</p>
                      </div>
                    </div>
                    <span style={{ flexShrink: 0, color: 'var(--text-faint)', fontSize: 20, lineHeight: 1, transition: 'transform 0.2s ease', transform: aberto ? 'rotate(90deg)' : 'none' }}>›</span>
                  </button>

                  {/* Corpo: ações só ao expandir */}
                  {aberto && (
                  <div style={{ padding: '0 14px 14px' }}>
                    {u.barbeiro_id && <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10 }}>Barbeiro vinculado: <strong>{barbeiros.find(b => b.id === u.barbeiro_id)?.nome || u.barbeiro_id}</strong></p>}
                    {temAcoes ? (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {podeMexer && !bloqueado && (
                          <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => { setPromoTarget(u.id === promoTarget ? null : u.id); setBanTarget(null); setDelTarget(null); }}>
                            {promoTarget === u.id ? 'Cancelar' : 'Cargo'}
                          </button>
                        )}
                        {!isMe && u.role !== 'dono' && canDo(session.role, 'promover') && (u.banido
                          ? <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => desbanir(u.id)}>Desbanir</button>
                          : <button className="btn btn-danger" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => { setBanTarget(u.id === banTarget ? null : u.id); setPromoTarget(null); setDelTarget(null); setBanMotivo(''); }}>{banTarget === u.id ? 'Cancelar' : 'Banir'}</button>
                        )}
                        {!isMe && u.role !== 'dono' && !bloqueado && canDo(session.role, 'gerenciar_usuarios') && (
                          <button className="btn btn-danger" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => { setDelTarget(u.id === delTarget ? null : u.id); setBanTarget(null); setPromoTarget(null); }}>
                            {delTarget === u.id ? 'Cancelar' : 'Excluir'}
                          </button>
                        )}
                      </div>
                    ) : !isDono ? (
                      <p style={{ fontSize: 12, color: 'var(--text-faint)' }}>Sem ações disponíveis para este usuário.</p>
                    ) : null}
                  {banTarget === u.id && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <input className="input" placeholder="Motivo do banimento" value={banMotivo} onChange={e => setBanMotivo(e.target.value)} />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => banir(u.id)} disabled={saving}>{saving ? 'Banindo...' : 'Confirmar banimento'}</button>
                        <button className="btn btn-outline" onClick={() => { setBanTarget(null); setBanMotivo(''); }}>Cancelar</button>
                      </div>
                    </div>
                  )}
                  {delTarget === u.id && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid color-mix(in srgb, var(--danger) 35%, transparent)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <p style={{ fontSize: 12.5, color: 'var(--danger)', lineHeight: 1.5 }}>
                        <strong>Excluir permanentemente</strong> a conta de <strong>{u.nome}</strong>? Ação irreversível — apaga a conta e o acesso dela. O histórico de agendamentos é mantido.
                      </p>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => excluirUsuario(u.id)} disabled={saving}>{saving ? 'Excluindo...' : 'Confirmar exclusão'}</button>
                        <button className="btn btn-outline" onClick={() => setDelTarget(null)}>Cancelar</button>
                      </div>
                    </div>
                  )}
                  {promoTarget === u.id && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>Novo cargo</label>
                        <select className="input" value={novoRole} onChange={e => setNovoRole(e.target.value as UserRole)}>
                          {rolesDisponiveis.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                        </select>
                      </div>
                      {novoRole === 'barbeiro' && (
                        <p style={{ fontSize: 11.5, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                          Vira barbeiro automaticamente e aparece na aba <strong>Barbeiros</strong>. Edite especialidades, foto e horários por lá.
                        </p>
                      )}
                      {(novoRole === 'barbeiro' || novoRole === 'gerente') && (
                        <div>
                          <label style={{ display: 'block', fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>Unidade</label>
                          <select className="input" value={novaUnidadeId} onChange={e => setNovaUnidadeId(e.target.value)}>
                            <option value="">Nenhuma</option>
                            {storeConfig.unidades.map(un => <option key={un.id} value={un.id}>{un.nome}</option>)}
                          </select>
                        </div>
                      )}
                      <button className="btn btn-primary" onClick={() => promover(u.id)} disabled={saving}>{saving ? 'Salvando...' : 'Confirmar'}</button>
                    </div>
                  )}

                  {/* Gerenciamento de conta (dono = completo, gerente = nome/multa) */}
                  {canGerenciarContas && gerenciarBloco(u)}
                  </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : activeTab === 'barbeiros' ? (
        <div>
          {bFormOpen && (
            <div className="card" style={{ padding: 16, marginBottom: 12 }}>
              <p style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>{bEditId ? 'Editar' : 'Novo barbeiro'}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input className="input" placeholder="Nome" value={bNome} onChange={e => setBNome(e.target.value)} />
                <input className="input" placeholder="Especialidades (separadas por vírgula)" value={bEsp} onChange={e => setBEsp(e.target.value)} />
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-dim)', marginBottom: 6 }}>Unidades</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {storeConfig.unidades.map(u => (
                      <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                        <input type="checkbox" checked={bUnidades.includes(u.id)} onChange={e => setBUnidades(p => e.target.checked ? [...p, u.id] : p.filter(x => x !== u.id))} />
                        {u.nome.replace(storeConfig.nome_loja + ' ', '')}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-dim)', marginBottom: 6 }}>Foto</label>
                  {bFotoPreview && <img src={bFotoPreview} alt="" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', marginBottom: 8 }} />}
                  <input ref={fotoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) { setBFotoFile(f); setBFotoPreview(URL.createObjectURL(f)); } }} />
                  <button className="btn btn-outline" style={{ width: '100%' }} onClick={() => fotoInputRef.current?.click()}>{bFotoPreview ? 'Trocar foto' : 'Adicionar foto'}</button>
                </div>

                {/* Almoço recorrente */}
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-dim)', marginBottom: 6 }}>Almoço (todo dia)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <select className="input" style={{ flex: 1 }} value={bAlmocoIni} onChange={e => setBAlmocoIni(e.target.value)}>
                      <option value="">—</option>
                      {TIME_OPTS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>até</span>
                    <select className="input" style={{ flex: 1 }} value={bAlmocoFim} onChange={e => setBAlmocoFim(e.target.value)}>
                      <option value="">—</option>
                      {TIME_OPTS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    {(bAlmocoIni || bAlmocoFim) && (
                      <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => { setBAlmocoIni(''); setBAlmocoFim(''); }}>Limpar</button>
                    )}
                  </div>
                </div>

                {/* Folgas */}
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-dim)', marginBottom: 6 }}>Folgas</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {bFolgas.map((f, i) => {
                      const upd = (patch: Partial<FolgaBlock>) => setBFolgas(p => p.map((x, j) => j === i ? { ...x, ...patch } : x));
                      return (
                        <div key={i} className="card" style={{ padding: 10, background: 'var(--surface)' }}>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
                            <select className="input" style={{ flex: 1 }} value={f.tipo} onChange={e => { const tipo = e.target.value as FolgaBlock['tipo']; upd(tipo === 'semanal' ? { tipo, weekday: f.weekday ?? 1 } : { tipo }); }}>
                              <option value="data">Data específica</option>
                              <option value="semanal">Toda semana</option>
                            </select>
                            {f.tipo === 'data' ? (
                              <input type="date" className="input" style={{ flex: 1 }} min={hojeSP()} value={f.data ?? ''} onChange={e => upd({ data: e.target.value })} />
                            ) : (
                              <select className="input" style={{ flex: 1 }} value={f.weekday ?? 1} onChange={e => upd({ weekday: Number(e.target.value) })}>
                                {DIAS_NOMES.map((d, wd) => <option key={wd} value={wd}>{d}</option>)}
                              </select>
                            )}
                            <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 14 }} onClick={() => setBFolgas(p => p.filter((_, j) => j !== i))}>×</button>
                          </div>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, cursor: 'pointer', marginBottom: f.dia_todo ? 0 : 8 }}>
                            <input type="checkbox" checked={f.dia_todo} onChange={e => upd({ dia_todo: e.target.checked })} />
                            Dia inteiro
                          </label>
                          {!f.dia_todo && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <select className="input" style={{ flex: 1 }} value={f.inicio ?? ''} onChange={e => upd({ inicio: e.target.value })}>
                                <option value="">início</option>
                                {TIME_OPTS.map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                              <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>até</span>
                              <select className="input" style={{ flex: 1 }} value={f.fim ?? ''} onChange={e => upd({ fim: e.target.value })}>
                                <option value="">fim</option>
                                {TIME_OPTS.map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <button className="btn btn-outline" style={{ fontSize: 12.5 }} onClick={() => setBFolgas(p => [...p, { tipo: 'data', data: '', dia_todo: true }])}>+ Adicionar folga</button>
                  </div>
                </div>

                {bError && <p style={{ color: 'var(--danger)', fontSize: 12 }}>{bError}</p>}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={salvarBarbeiro} disabled={bSaving}>{bSaving ? <><span className="spinner" />Salvando</> : 'Salvar'}</button>
                  <button className="btn btn-outline" onClick={() => { setBFormOpen(false); setBEditId(null); }}>Cancelar</button>
                </div>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {barbeiros.map(b => {
              const aberto = openBarber === b.id;
              return (
              <div key={b.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <button
                  onClick={() => setOpenBarber(aberto ? null : b.id)}
                  style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 12, display: 'flex', alignItems: 'center', gap: 12, font: 'inherit', color: 'inherit' }}
                >
                  <Avatar src={b.photo_url} nome={b.nome} size={42} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontWeight: 500, fontSize: 14 }}>{b.nome}</span>
                      {!b.ativo && <span className="badge badge-red">Inativo</span>}
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.unidades.map(uid => storeConfig.unidades.find(u => u.id === uid)?.bairro || uid).join(', ') || 'Sem unidade'}</p>
                  </div>
                  <span style={{ flexShrink: 0, color: 'var(--text-faint)', fontSize: 20, lineHeight: 1, transition: 'transform 0.2s ease', transform: aberto ? 'rotate(90deg)' : 'none' }}>›</span>
                </button>
                {aberto && (
                  <div style={{ padding: '0 12px 12px' }}>
                    {b.especialidades.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 10 }}>
                        {b.especialidades.map(e => <span key={e} className="badge badge-gray">{e}</span>)}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => abrirFormBarbeiro(b)}>Editar</button>
                      <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: 12 }} onClick={async () => { if (!confirm(b.ativo ? 'Desativar barbeiro? (some da agenda, mas pode reativar)' : 'Reativar barbeiro?')) return; await fetch('/api/barbeiros', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'editar', barbeiro_id: b.id, ativo: !b.ativo }) }); loadAdmin(); onRefresh(); }}>{b.ativo ? 'Desativar' : 'Reativar'}</button>
                      <button className="btn btn-danger" style={{ padding: '6px 12px', fontSize: 12 }} onClick={async () => { if (!confirm(`Excluir PERMANENTEMENTE "${b.nome}"?\n\nApaga o barbeiro e a foto, e remove das unidades. Ação irreversível. O histórico de cortes é mantido.`)) return; const res = await fetch('/api/barbeiros', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'excluir', barbeiro_id: b.id }) }); if (!res.ok) { alert('Não foi possível excluir.'); return; } setOpenBarber(null); loadAdmin(); onRefresh(); }}>Excluir</button>
                    </div>
                    {/* Conta do barbeiro (usuário vinculado) — gerir email/senha/saldo/multa */}
                    {canGerenciarContas && (() => {
                      const linkedUser = usuarios.find(x => x.barbeiro_id === b.id);
                      return linkedUser
                        ? gerenciarBloco(linkedUser)
                        : <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 10 }}>Barbeiro sem conta de login vinculada.</p>;
                    })()}
                  </div>
                )}
              </div>
              );
            })}
          </div>
        </div>
      ) : activeTab === 'manutencao' && isDono ? (
        <div className="card" style={{ padding: 16, border: maintenance?.ativo ? '1px solid rgba(207, 58, 58, 0.4)' : '1px solid var(--border)' }}>
          <p style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Modo manutenção</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 500 }}>{maintenance?.ativo ? 'Ativo — site bloqueado' : 'Desativado'}</p>
              <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>Apenas o dono acessa durante manutenção</p>
            </div>
            <button onClick={() => salvarManutencao(!maintenance?.ativo, maintenance?.mensagem || 'Site em manutenção. Voltamos em breve.')} disabled={maintSaving} className={`btn ${maintenance?.ativo ? 'btn-primary' : 'btn-danger'}`}>
              {maintSaving ? '...' : maintenance?.ativo ? 'Desativar' : 'Ativar'}
            </button>
          </div>
          <textarea className="input" rows={3} value={maintenance?.mensagem || ''} onChange={e => setMaintenance(prev => prev ? { ...prev, mensagem: e.target.value } : { ativo: false, mensagem: e.target.value })} style={{ resize: 'vertical', marginBottom: 10 }} placeholder="Mensagem exibida durante a manutenção" />
          {maintSaved && <p style={{ color: 'var(--success)', fontSize: 12, marginBottom: 8 }}>Salvo</p>}
          <button className="btn btn-outline" style={{ width: '100%' }} onClick={() => salvarManutencao(maintenance?.ativo ?? false, maintenance?.mensagem || '')}>
            {maintSaving ? <><span className="spinner" />Salvando</> : 'Salvar mensagem'}
          </button>
        </div>
      ) : activeTab === 'loja' && isDono ? (
        <div>
          <div className="card" style={{ padding: 16, marginBottom: 12 }}>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Identidade</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>Nome</label>
                <input className="input" value={storeConfig.nome_loja} onChange={e => setStoreConfig(p => ({ ...p, nome_loja: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>Slogan</label>
                <input className="input" value={storeConfig.slogan} onChange={e => setStoreConfig(p => ({ ...p, slogan: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>Cor de destaque</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  {(['blue', 'green', 'yellow', 'red', 'purple'] as const).map(cor => (
                    <button
                      key={cor}
                      className={`swatch ${storeConfig.tema_cor === cor ? 'active' : ''}`}
                      onClick={() => { setStoreConfig(p => ({ ...p, tema_cor: cor })); applyStoreTheme({ tema_cor: cor }); }}
                      style={{ background: TEMA_COR_MAP[cor] }}
                      title={cor}
                    />
                  ))}
                  <button
                    className={`swatch ${storeConfig.tema_cor === 'custom' ? 'active' : ''}`}
                    onClick={() => setStoreConfig(p => ({ ...p, tema_cor: 'custom' }))}
                    style={{ background: storeConfig.tema_cor_custom || '#1f6feb' }}
                    title="Personalizada"
                  />
                </div>
                {storeConfig.tema_cor === 'custom' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, padding: 10, background: 'var(--bg-elev)', borderRadius: 6, border: '1px solid var(--border)' }}>
                    <input
                      type="color"
                      value={storeConfig.tema_cor_custom || '#1f6feb'}
                      onChange={e => {
                        const hex = e.target.value;
                        setStoreConfig(p => ({ ...p, tema_cor: 'custom', tema_cor_custom: hex }));
                        applyStoreTheme({ tema_cor: 'custom', tema_cor_custom: hex });
                      }}
                      style={{ width: 40, height: 40, border: 'none', cursor: 'pointer', background: 'none', padding: 0 }}
                    />
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text)' }}>
                      {storeConfig.tema_cor_custom || '#1f6feb'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 16, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Unidades</p>
              <button className="btn btn-outline" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => { const id = 'u' + Date.now(); setStoreConfig(p => ({ ...p, unidades: [...p.unidades, { id, nome: p.nome_loja + ' Nova Unidade', endereco: '', bairro: '', cidade: '', horario: { abertura: 8, fechamento: 20 }, dias_semana: [1, 2, 3, 4, 5, 6], barbeiros: [], ativo: true }] })); }}>+ Adicionar</button>
            </div>
            {storeConfig.unidades.map((u, idx) => (
              <div key={u.id} style={{ borderBottom: idx < storeConfig.unidades.length - 1 ? '1px solid var(--border)' : 'none', paddingBottom: 12, marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <input className="input" value={u.nome} onChange={e => updateU(idx, 'nome', e.target.value)} style={{ fontWeight: 500 }} />
                  <button onClick={() => updateU(idx, 'ativo', !u.ativo)} className={`btn ${u.ativo ? 'btn-outline' : 'btn-primary'}`} style={{ padding: '6px 10px', fontSize: 11 }}>{u.ativo ? 'Ativo' : 'Inativo'}</button>
                  <button onClick={() => { if (confirm('Remover esta unidade?')) removeU(idx); }} className="btn btn-danger" style={{ padding: '6px 10px', fontSize: 11 }}>×</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 6 }}>
                  <input className="input" placeholder="Endereço" value={u.endereco} onChange={e => updateU(idx, 'endereco', e.target.value)} />
                  <input className="input" placeholder="Bairro" value={u.bairro} onChange={e => updateU(idx, 'bairro', e.target.value)} />
                  <input className="input" placeholder="Cidade" value={u.cidade} onChange={e => updateU(idx, 'cidade', e.target.value)} />
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Abre</span>
                  <input type="number" className="input" value={u.horario.abertura} min={0} max={23} onChange={e => updateU(idx, 'horario', { ...u.horario, abertura: +e.target.value })} style={{ width: 60 }} />
                  <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Fecha</span>
                  <input type="number" className="input" value={u.horario.fechamento} min={1} max={24} onChange={e => updateU(idx, 'horario', { ...u.horario, fechamento: +e.target.value })} style={{ width: 60 }} />
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {DIAS_NOMES.map((dia, dIdx) => (
                    <label key={dIdx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: 'pointer' }}>
                      <input type="checkbox" checked={u.dias_semana.includes(dIdx)} onChange={e => { const dias = e.target.checked ? [...u.dias_semana, dIdx].sort() : u.dias_semana.filter(d => d !== dIdx); updateU(idx, 'dias_semana', dias); }} />
                      <span style={{ fontSize: 11, color: u.dias_semana.includes(dIdx) ? 'var(--accent)' : 'var(--text-faint)' }}>{dia}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: 16, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Serviços</p>
              <button className="btn btn-outline" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => { const id = 's' + Date.now(); setStoreConfig(p => ({ ...p, servicos: [...p.servicos, { id, nome: 'Novo Serviço', valor: 30, duracao: 30, descricao: '', ativo: true }] })); }}>+ Adicionar</button>
            </div>
            {storeConfig.servicos.map((s, idx) => (
              <div key={s.id} style={{ borderBottom: idx < storeConfig.servicos.length - 1 ? '1px solid var(--border)' : 'none', paddingBottom: 10, marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <input className="input" value={s.nome} onChange={e => updateS(idx, 'nome', e.target.value)} style={{ fontWeight: 500 }} />
                  <button onClick={() => updateS(idx, 'ativo', !s.ativo)} className={`btn ${s.ativo ? 'btn-outline' : 'btn-primary'}`} style={{ padding: '6px 10px', fontSize: 11 }}>{s.ativo ? 'Ativo' : 'Inativo'}</button>
                  <button onClick={() => { if (confirm('Remover este serviço?')) removeS(idx); }} className="btn btn-danger" style={{ padding: '6px 10px', fontSize: 11 }}>×</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)', marginBottom: 2 }}>Valor (R$)</label>
                    <input type="number" className="input" value={s.valor} min={0} onChange={e => updateS(idx, 'valor', +e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)', marginBottom: 2 }}>Duração (min)</label>
                    <input type="number" className="input" value={s.duracao} min={5} step={5} onChange={e => updateS(idx, 'duracao', +e.target.value)} />
                  </div>
                </div>
                <input className="input" placeholder="Descrição" value={s.descricao} onChange={e => updateS(idx, 'descricao', e.target.value)} />
              </div>
            ))}
          </div>

          {storeError && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>{storeError}</p>}
          {storeSaved && <p style={{ color: 'var(--success)', fontSize: 13, marginBottom: 10 }}>Configurações salvas</p>}
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={salvarLoja} disabled={storeSaving}>
            {storeSaving ? <><span className="spinner" />Salvando</> : 'Salvar configurações'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
