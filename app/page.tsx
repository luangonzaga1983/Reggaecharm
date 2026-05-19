'use client';
import { useState, useEffect, useCallback, useRef } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type UserRole = 'cliente' | 'barbeiro' | 'gerente' | 'dono';

interface BarbeiroDB {
  id: string; nome: string; especialidades: string[];
  unidades: string[]; ativo: boolean; photo_url?: string | null; _messageId?: string;
}

interface Session { id: string; nome: string; email: string; role: UserRole; }

interface Usuario {
  id: string; nome: string; email: string; username?: string | null;
  foto_url?: string | null; barbeiro_favorito: string | null;
  servico_favorito: string | null; horario_favorito: string | null;
  unidade_favorita: string | null; pontos: number; tema: 'dark' | 'light';
  role: UserRole; barbeiro_id?: string | null; unidade_id?: string | null;
}

interface Agendamento {
  id: string; usuario_id: string; barbeiro_id: string; unidade_id: string;
  servico: string; data: string; horario: string; valor: number;
  status: string; avaliacao: number | null;
}

interface Stats { barbeiroId: string; mediaEstrelas: number; totalAvaliacoes: number; }

interface UnidadeConfig {
  id: string; nome: string; endereco: string; bairro: string; cidade: string;
  horario: { abertura: number; fechamento: number };
  dias_semana: number[]; barbeiros: string[]; ativo: boolean;
}

interface ServicoConfig {
  id: string; nome: string; valor: number; duracao: number; descricao: string; ativo: boolean;
}

interface StoreConfig {
  nome_loja: string; slogan: string; tema_cor: 'green'|'yellow'|'red'|'purple'|'blue';
  unidades: UnidadeConfig[]; servicos: ServicoConfig[]; _messageId?: string;
}

interface FotoBarbeiro {
  id: string; barbeiro_id: string; descricao: string; data: string;
  foto_url?: string | null; _messageId?: string;
}

// Tabs por papel:
// cliente:  dashboard | configuracoes
// barbeiro: dashboard | horarios | perfil | configuracoes
// gerente:  dashboard | horarios | perfil | configuracoes | gerencia
// dono:     dashboard | horarios | perfil | configuracoes | gerencia
type AppTab = 'dashboard' | 'horarios' | 'perfil' | 'configuracoes' | 'gerencia';
type Step   = 'unidade'  | 'barbeiro' | 'servico' | 'data' | 'termos' | 'sucesso';

const ROLE_LABEL: Record<UserRole, string> = {
  cliente: 'Cliente', barbeiro: 'Barbeiro', gerente: 'Gerente', dono: 'Dono',
};
const ROLE_COLOR: Record<UserRole, string> = {
  cliente: 'var(--text-faint)', barbeiro: 'var(--green)',
  gerente: 'var(--yellow)', dono: 'var(--red)',
};
const TEMA_COR_MAP: Record<string, string> = {
  green: '#00c853', yellow: '#ffd600', red: '#ff1744', purple: '#a78bfa', blue: '#38bdf8',
};
const DIAS_NOMES = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

function canDo(role: UserRole, action: string): boolean {
  const lvl = { cliente: 0, barbeiro: 1, gerente: 2, dono: 3 }[role] ?? 0;
  switch (action) {
    case 'cancelar_alheio':    return lvl >= 1;
    case 'ver_todos_ag':       return lvl >= 1;
    case 'gerenciar_usuarios': return lvl >= 2;
    case 'acesso_admin':       return lvl >= 2;
    case 'promover':           return lvl >= 2;
    case 'config_loja':        return lvl >= 3;
    case 'tem_perfil_aba':     return lvl >= 1;
    default: return false;
  }
}

function getTabsForRole(role: UserRole): AppTab[] {
  switch (role) {
    case 'cliente':  return ['dashboard', 'configuracoes'];
    case 'barbeiro': return ['dashboard', 'horarios', 'perfil', 'configuracoes'];
    case 'gerente':  return ['dashboard', 'horarios', 'perfil', 'configuracoes', 'gerencia'];
    case 'dono':     return ['dashboard', 'horarios', 'perfil', 'configuracoes', 'gerencia'];
  }
}

const TAB_LABEL: Record<AppTab, string> = {
  dashboard: 'Início', horarios: 'Horários', perfil: 'Meu Perfil',
  configuracoes: 'Conta', gerencia: 'Gerência',
};

function getUnidadeStatus(u: UnidadeConfig): { aberto: boolean; texto: string } {
  const now = new Date();
  const diaSemana = now.getDay();
  const total = now.getHours() * 60 + now.getMinutes();
  const abre  = u.horario.abertura   * 60;
  const fecha = u.horario.fechamento * 60;
  if (!u.dias_semana.includes(diaSemana)) {
    const proxDia = u.dias_semana.find(d => d > diaSemana) ?? u.dias_semana[0];
    return { aberto: false, texto: 'Abre ' + DIAS_NOMES[proxDia] };
  }
  const aberto = total >= abre && total < fecha;
  if (!aberto) {
    if (total < abre) return { aberto: false, texto: 'Abre às ' + String(u.horario.abertura).padStart(2,'0') + ':00' };
    return { aberto: false, texto: 'Fechado hoje' };
  }
  const resta = fecha - total;
  if (resta <= 60) return { aberto: true, texto: 'Fecha em ' + resta + ' min' };
  return { aberto: true, texto: 'Até ' + String(u.horario.fechamento).padStart(2,'0') + ':00' };
}

function gerarHorarios(abertura: number, fechamento: number): string[] {
  const slots: string[] = [];
  for (let h = abertura; h < fechamento; h++) {
    slots.push(String(h).padStart(2,'0') + ':00');
    slots.push(String(h).padStart(2,'0') + ':30');
  }
  return slots;
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ src, nome, size = 40, accent = 'var(--green)' }: {
  src?: string | null; nome: string; size?: number; accent?: string;
}) {
  const initials = nome.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: src ? 'transparent' : `${accent}22`,
      border: `1px solid ${accent}55`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', flexShrink: 0, fontSize: size * 0.35,
      fontWeight: 700, color: accent, letterSpacing: '0.04em',
    }}>
      {src ? <img src={src} alt={nome} style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : initials}
    </div>
  );
}

// ─── Stars ───────────────────────────────────────────────────────────────────

function Stars({ value, onChange, readonly }: {
  value: number; onChange?: (v: number) => void; readonly?: boolean;
}) {
  const [hover, setHover] = useState(0);
  return (
    <span style={{ display:'inline-flex', gap:2 }}>
      {[1,2,3,4,5].map(i => (
        <span key={i} className={'star'+(i<=(hover||value)?' on':'')}
          onMouseEnter={()=>!readonly&&setHover(i)}
          onMouseLeave={()=>!readonly&&setHover(0)}
          onClick={()=>!readonly&&onChange?.(i)}
          style={{ cursor: readonly?'default':'pointer' }}>★</span>
      ))}
    </span>
  );
}

// ─── Login ───────────────────────────────────────────────────────────────────

function Auth({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode] = useState<'login'|'registro'>('login');
  const [nome, setNome]   = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [showPass, setShowPass] = useState(false);

  async function submit() {
    setError(''); setLoading(true);
    try {
      const body: Record<string,string> = { action: mode, email, senha };
      if (mode === 'registro') body.nome = nome;
      const res = await fetch('/api/auth', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
      const d = await res.json();
      if (!res.ok) { setError(d.error||'Erro'); return; }
      onSuccess();
    } finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px 20px', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'fixed', inset:0, background:'var(--black)', zIndex:0 }} />
      <div style={{ position:'fixed', bottom:'-10%', left:'50%', transform:'translateX(-50%)', width:'70vw', height:'40vh', borderRadius:'50%', background:'radial-gradient(ellipse, rgba(0,200,83,0.15) 0%, transparent 70%)', pointerEvents:'none', zIndex:0 }} />
      <div style={{ width:'100%', maxWidth:400, position:'relative', zIndex:1 }}>
        <div style={{ marginBottom:40 }}>
          <div className="rasta-bar" style={{ width:48, borderRadius:2, marginBottom:24 }} />
          <div style={{ display:'flex', alignItems:'flex-end', gap:12, marginBottom:6 }}>
            <span style={{ fontFamily:'var(--font-display)', fontSize:'clamp(3rem,10vw,4.5rem)', lineHeight:0.9, letterSpacing:'0.03em', color:'var(--text)' }}>REGGAE</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <span style={{ fontFamily:'var(--font-display)', fontSize:'clamp(3rem,10vw,4.5rem)', lineHeight:0.9, letterSpacing:'0.03em', color:'var(--green)', textShadow:'0 0 40px rgba(0,200,83,0.4)' }}>CHARM</span>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.62rem', color:'var(--text-faint)', letterSpacing:'0.15em', textTransform:'uppercase', lineHeight:1.4, paddingBottom:4 }}>ONE LOVE<br/>ONE CUT</span>
          </div>
        </div>
        <div style={{ display:'flex', gap:0, marginBottom:28, borderBottom:'1px solid var(--border)' }}>
          {(['login','registro'] as const).map(m=>(
            <button key={m} onClick={()=>{ setMode(m); setError(''); }}
              style={{ flex:1, padding:'10px 0', fontFamily:'var(--font-ui)', fontWeight:700, fontSize:'0.8rem', letterSpacing:'0.08em', textTransform:'uppercase', background:'transparent', border:'none', borderBottom:`2px solid ${mode===m?'var(--green)':'transparent'}`, color:mode===m?'var(--text)':'var(--text-faint)', cursor:'pointer', transition:'all 0.18s', marginBottom:-1 }}>
              {m==='login'?'Entrar':'Cadastrar'}
            </button>
          ))}
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:20 }}>
          {mode==='registro'&&(
            <div>
              <label style={{ fontSize:'0.7rem', color:'var(--text-faint)', letterSpacing:'0.1em', textTransform:'uppercase', display:'block', marginBottom:6 }}>Nome</label>
              <input className="input" placeholder="Seu nome completo" value={nome} onChange={e=>setNome(e.target.value)} />
            </div>
          )}
          <div>
            <label style={{ fontSize:'0.7rem', color:'var(--text-faint)', letterSpacing:'0.1em', textTransform:'uppercase', display:'block', marginBottom:6 }}>E-mail</label>
            <input className="input" type="email" placeholder="seu@email.com" value={email} onChange={e=>setEmail(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize:'0.7rem', color:'var(--text-faint)', letterSpacing:'0.1em', textTransform:'uppercase', display:'block', marginBottom:6 }}>Senha</label>
            <div style={{ position:'relative' }}>
              <input className="input" type={showPass?'text':'password'} placeholder="••••••••" value={senha} onChange={e=>setSenha(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()} style={{ paddingRight:48 }} />
              <button onClick={()=>setShowPass(v=>!v)} style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text-faint)', fontSize:'0.9rem', padding:4 }}>
                {showPass?'ocultar':'ver'}
              </button>
            </div>
          </div>
        </div>
        {error&&<div style={{ background:'rgba(255,23,68,0.08)', border:'1px solid rgba(255,23,68,0.3)', borderRadius:8, padding:'10px 14px', fontSize:'0.82rem', color:'var(--red)', marginBottom:16 }}>{error}</div>}
        <button className="btn btn-green" style={{ width:'100%', height:50, fontSize:'0.95rem' }} onClick={submit} disabled={loading}>
          {loading?<><span className="spinner"/>{mode==='login'?'Entrando...':'Criando conta...'}</>:mode==='login'?'Entrar':'Criar conta'}
        </button>
        <p style={{ textAlign:'center', fontSize:'0.68rem', color:'var(--text-faint)', marginTop:24, lineHeight:1.7 }}>
          Uma conta por dispositivo. Dados protegidos pela LGPD.
        </p>
      </div>
    </div>
  );
}

// ─── Perfil do Barbeiro (modal) — busca fotos do Discord ─────────────────────

function PerfilBarbeiroModal({ barbeiro, agendamentos, onClose, isProprietario }: {
  barbeiro: BarbeiroDB; agendamentos: Agendamento[];
  onClose: () => void; isProprietario?: boolean;
}) {
  const [fotos, setFotos]           = useState<FotoBarbeiro[]>([]);
  const [fotosLoading, setFotosLoading] = useState(true);
  const [fotoAberta, setFotoAberta] = useState<FotoBarbeiro|null>(null);
  const [uploading, setUploading]   = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [descricao, setDescricao]   = useState('');
  const [fotoFile, setFotoFile]     = useState<File|null>(null);
  const [preview, setPreview]       = useState<string|null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [abaAtiva, setAbaAtiva]     = useState<'fotos'|'cortes'>('fotos');
  const fileRef = useRef<HTMLInputElement>(null);

  const mediaEstrelas = (() => {
    const avs = agendamentos.filter(a=>a.barbeiro_id===barbeiro.id&&a.avaliacao);
    if (!avs.length) return 0;
    return avs.reduce((s,a)=>s+(a.avaliacao||0),0)/avs.length;
  })();
  const totalCortes = agendamentos.filter(a=>a.barbeiro_id===barbeiro.id&&a.status==='confirmado').length;

  const carregarFotos = useCallback(async () => {
    setFotosLoading(true);
    try {
      const res = await fetch(`/api/barbeiros/fotos?barbeiro_id=${barbeiro.id}`);
      if (res.ok) { const d = await res.json(); setFotos(d.fotos||[]); }
    } finally { setFotosLoading(false); }
  }, [barbeiro.id]);

  useEffect(() => { carregarFotos(); }, [carregarFotos]);

  async function postarFoto() {
    if (!fotoFile) return;
    setUploading(true); setUploadError('');
    try {
      const form = new FormData();
      form.append('barbeiro_id', barbeiro.id);
      form.append('descricao', descricao);
      form.append('foto', fotoFile);
      const res = await fetch('/api/barbeiros/fotos', { method:'POST', body:form });
      const d = await res.json();
      if (!res.ok) { setUploadError(d.error||'Erro ao publicar'); return; }
      setFotoFile(null); setPreview(null); setDescricao(''); setShowUpload(false);
      await carregarFotos();
    } finally { setUploading(false); }
  }

  async function excluirFoto(foto: FotoBarbeiro) {
    if (!foto._messageId) return;
    await fetch('/api/barbeiros/fotos', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ action:'deletar', message_id:foto._messageId, barbeiro_id:barbeiro.id }) });
    setFotoAberta(null);
    await carregarFotos();
  }

  const cortesRecentes = agendamentos.filter(a=>a.barbeiro_id===barbeiro.id).slice(0,20);
  const statusBadge: Record<string,string> = { confirmado:'badge-green', pendente:'badge-yellow', cancelado:'badge-red' };

  return (
    <div className="modal-back" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-box" style={{ maxHeight:'95vh', overflowY:'auto', padding:0, borderRadius:20, maxWidth:500 }}>
        <div style={{ padding:'20px 20px 0' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
            <button className="btn btn-ghost" style={{ padding:'6px 10px' }} onClick={onClose}>← Voltar</button>
            {isProprietario&&(
              <button className="btn btn-outline" style={{ fontSize:'0.78rem', padding:'6px 14px' }} onClick={()=>setShowUpload(p=>!p)}>
                {showUpload?'Cancelar':'+ Postar foto'}
              </button>
            )}
          </div>

          <div style={{ display:'flex', gap:20, alignItems:'flex-start', marginBottom:20 }}>
            <div style={{ position:'relative' }}>
              <Avatar src={barbeiro.photo_url} nome={barbeiro.nome} size={88} accent="var(--green)" />
              <div style={{ position:'absolute', bottom:0, right:0, width:20, height:20, background:'var(--green)', borderRadius:'50%', border:'2px solid var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.55rem' }}>✂</div>
            </div>
            <div style={{ flex:1 }}>
              <p style={{ fontWeight:800, fontSize:'1.1rem', marginBottom:2 }}>{barbeiro.nome}</p>
              <p style={{ fontSize:'0.72rem', color:'var(--green)', fontFamily:'var(--font-mono)', marginBottom:8 }}>barbeiro profissional</p>
              <div style={{ display:'flex', gap:20, marginBottom:10 }}>
                {[['fotos',fotos.length],['cortes',totalCortes],['★ média',mediaEstrelas?mediaEstrelas.toFixed(1):'—']].map(([l,v])=>(
                  <div key={l as string} style={{ textAlign:'center' }}>
                    <p style={{ fontWeight:800, fontSize:'1rem', lineHeight:1 }}>{v}</p>
                    <p style={{ fontSize:'0.65rem', color:'var(--text-faint)' }}>{l}</p>
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                {barbeiro.especialidades.map(e=><span key={e} className="badge badge-green" style={{ fontSize:'0.65rem' }}>{e}</span>)}
              </div>
            </div>
          </div>

          {showUpload&&isProprietario&&(
            <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, padding:16, marginBottom:16 }}>
              <p style={{ fontSize:'0.7rem', color:'var(--text-faint)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:12 }}>Nova publicação</p>
              <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={e=>{ const f=e.target.files?.[0]; if(f){setFotoFile(f);setPreview(URL.createObjectURL(f));} }} />
              {preview
                ?<img src={preview} alt="preview" style={{ width:'100%', height:200, objectFit:'cover', borderRadius:10, marginBottom:10 }}/>
                :<button className="btn btn-outline" style={{ width:'100%', marginBottom:10, padding:'32px 0' }} onClick={()=>fileRef.current?.click()}>+ Escolher foto</button>
              }
              <input className="input" placeholder="Legenda..." value={descricao} onChange={e=>setDescricao(e.target.value)} style={{ marginBottom:10 }}/>
              {uploadError&&<p style={{ color:'var(--red)', fontSize:'0.78rem', marginBottom:8 }}>{uploadError}</p>}
              <div style={{ display:'flex', gap:8 }}>
                {preview&&<button className="btn btn-outline" style={{ flex:1, fontSize:'0.78rem' }} onClick={()=>{setPreview(null);setFotoFile(null);}}>Trocar</button>}
                <button className="btn btn-green" style={{ flex:2 }} onClick={postarFoto} disabled={!fotoFile||uploading}>
                  {uploading?<><span className="spinner"/>Publicando...</>:'Publicar'}
                </button>
              </div>
            </div>
          )}

          <div style={{ display:'flex', borderBottom:'1px solid var(--border)', marginBottom:0 }}>
            {(['fotos','cortes'] as const).map(aba=>(
              <button key={aba} onClick={()=>setAbaAtiva(aba)} style={{ flex:1, padding:'10px 0', background:'none', border:'none', cursor:'pointer', fontSize:'0.75rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:abaAtiva===aba?'var(--green)':'var(--text-faint)', borderBottom:abaAtiva===aba?'2px solid var(--green)':'2px solid transparent', transition:'all 0.2s' }}>
                {aba==='fotos'?`Galeria (${fotos.length})`:`Agendamentos (${cortesRecentes.length})`}
              </button>
            ))}
          </div>
        </div>

        {abaAtiva==='fotos'?(
          fotosLoading
            ?<div style={{ textAlign:'center', padding:40 }}><span className="spinner spinner-lg"/></div>
            :fotos.length===0
              ?<div style={{ textAlign:'center', padding:'48px 20px', color:'var(--text-faint)' }}>
                <p style={{ fontSize:'2rem', marginBottom:8 }}>✂</p>
                <p style={{ fontSize:'0.88rem' }}>Nenhuma foto publicada ainda</p>
                {isProprietario&&<p style={{ fontSize:'0.75rem', marginTop:4 }}>Clique em "+ Postar foto" para começar</p>}
              </div>
              :<div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:2, padding:2 }}>
                {fotos.map(foto=>(
                  <div key={foto.id} onClick={()=>setFotoAberta(foto)} style={{ aspectRatio:'1', cursor:'pointer', overflow:'hidden' }}
                    onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.opacity='0.8'}
                    onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.opacity='1'}>
                    <img src={foto.foto_url||''} alt={foto.descricao} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                  </div>
                ))}
              </div>
        ):(
          <div style={{ padding:'12px 16px', display:'flex', flexDirection:'column', gap:8 }}>
            {cortesRecentes.length===0
              ?<p style={{ textAlign:'center', color:'var(--text-faint)', padding:32, fontSize:'0.88rem' }}>Nenhum agendamento registrado</p>
              :cortesRecentes.map(a=>(
                <div key={a.id} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 14px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <p style={{ fontWeight:600, fontSize:'0.88rem' }}>{a.servico}</p>
                      <p style={{ fontSize:'0.72rem', color:'var(--text-faint)', fontFamily:'var(--font-mono)', marginTop:2 }}>
                        {new Date(a.data+'T12:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'2-digit'})} · {a.horario}
                      </p>
                      {a.avaliacao?<Stars value={a.avaliacao} readonly/>:null}
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <span className={'badge '+(statusBadge[a.status]||'badge-gray')}>{a.status}</span>
                      <p style={{ color:'var(--green)', fontWeight:700, fontSize:'0.88rem', marginTop:4 }}>R${a.valor}</p>
                    </div>
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {fotoAberta&&(
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.92)', zIndex:200, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }} onClick={()=>setFotoAberta(null)}>
            <div onClick={e=>e.stopPropagation()} style={{ maxWidth:480, width:'100%', background:'var(--surface)', borderRadius:16, overflow:'hidden', margin:'0 16px' }}>
              <img src={fotoAberta.foto_url||''} alt={fotoAberta.descricao} style={{ width:'100%', maxHeight:'60vh', objectFit:'cover' }}/>
              <div style={{ padding:'14px 16px' }}>
                <p style={{ fontWeight:700, fontSize:'0.88rem', marginBottom:2 }}>{barbeiro.nome}</p>
                {fotoAberta.descricao&&<p style={{ fontSize:'0.82rem', color:'var(--text-dim)' }}>{fotoAberta.descricao}</p>}
                <p style={{ fontSize:'0.7rem', color:'var(--text-faint)', marginTop:4 }}>{fotoAberta.data}</p>
                {isProprietario&&(
                  <button className="btn btn-danger" style={{ marginTop:12, fontSize:'0.75rem', padding:'6px 14px' }}
                    onClick={()=>excluirFoto(fotoAberta)}>Excluir foto</button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Modal Agendamento ────────────────────────────────────────────────────────

function AgendarModal({ session, stats, barbeiros, storeConfig, onClose, onSuccess }: {
  session: Session; stats: Stats[]; barbeiros: BarbeiroDB[];
  storeConfig: StoreConfig; onClose: () => void; onSuccess: () => void;
}) {
  const [step, setStep]         = useState<Step>('unidade');
  const [unidadeId, setUnidadeId] = useState('');
  const [barbeiroId, setBarbeiroId] = useState('');
  const [servicoId, setServicoId] = useState('');
  const [data, setData]         = useState('');
  const [horario, setHorario]   = useState('');
  const [ocupados, setOcupados] = useState<string[]>([]);
  const [termos, setTermos]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [verPerfilB, setVerPerfilB] = useState<BarbeiroDB|null>(null);

  const unidades = storeConfig.unidades.filter(u=>u.ativo);
  const servicos = storeConfig.servicos.filter(s=>s.ativo);
  const unidade  = unidades.find(u=>u.id===unidadeId);
  const barbeiro = barbeiros.find(b=>b.id===barbeiroId);
  const servico  = servicos.find(s=>s.id===servicoId);
  const horarios = unidade ? gerarHorarios(unidade.horario.abertura, unidade.horario.fechamento) : [];
  const minDate  = new Date().toISOString().split('T')[0];

  useEffect(()=>{
    if (barbeiroId&&unidadeId&&data) {
      fetch(`/api/agendamentos?action=horarios&barbeiro_id=${barbeiroId}&data=${data}`)
        .then(r=>r.json()).then(d=>setOcupados(d.ocupados||[]));
    }
  },[barbeiroId,unidadeId,data]);

  const stepN = ({ unidade:1, barbeiro:2, servico:3, data:4, termos:5, sucesso:6 } as Record<string,number>)[step as string] ?? 1;

  async function confirmar() {
    if (!termos) return;
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/agendamentos', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ action:'criar', barbeiro_id:barbeiroId, unidade_id:unidadeId, servico:servico?.nome, data, horario }) });
      const d = await res.json();
      if (!res.ok) { setError(d.error||'Erro'); return; }
      setStep('sucesso');
    } finally { setLoading(false); }
  }

  if (verPerfilB) return <PerfilBarbeiroModal barbeiro={verPerfilB} agendamentos={[]} onClose={()=>setVerPerfilB(null)} />;

  return (
    <div className="modal-back" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-box" style={{ maxHeight:'90vh', overflowY:'auto' }}>
        {step!=='sucesso'&&(
          <div style={{ marginBottom:24 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <span style={{ fontFamily:'var(--font-display)', fontSize:'1.6rem', letterSpacing:'0.04em', color:'var(--green)' }}>AGENDAR</span>
              <button className="btn btn-ghost" style={{ padding:'6px 12px' }} onClick={onClose}>x</button>
            </div>
            <div style={{ display:'flex', gap:4 }}>
              {[1,2,3,4,5].map(n=>(<div key={n} className="progress-track" style={{ flex:1 }}><div className="progress-fill" style={{ width:n<=stepN?'100%':'0%' }}/></div>))}
            </div>
            <p style={{ fontSize:'0.72rem', color:'var(--text-faint)', marginTop:6, fontFamily:'var(--font-mono)' }}>PASSO {Math.min(stepN,5)} / 5</p>
          </div>
        )}

        {step==='unidade'&&(
          <div className="anim-in">
            <h2 style={{ fontFamily:'var(--font-display)', fontSize:'2rem', marginBottom:20 }}>UNIDADE</h2>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {unidades.map(u=>{ const st=getUnidadeStatus(u); return (
                <button key={u.id} className="card card-green" style={{ padding:'16px', textAlign:'left', border:'1px solid var(--border)', cursor:'pointer', width:'100%', background:'var(--surface)' }} onClick={()=>{setUnidadeId(u.id);setStep('barbeiro');}}>
                  <div style={{ display:'flex', justifyContent:'space-between' }}>
                    <div><p style={{ fontWeight:700, fontSize:'0.95rem' }}>{u.nome}</p><p style={{ fontSize:'0.78rem', color:'var(--text-dim)', marginTop:2 }}>{u.endereco} · {u.bairro}</p></div>
                    {st.aberto?<span className="open-indicator"><span className="dot-live"/>Aberto</span>:<span className="closed-indicator">Fechado</span>}
                  </div>
                  <p style={{ fontSize:'0.75rem', color:st.aberto?'var(--green)':'var(--text-faint)', marginTop:8 }}>{st.texto}</p>
                </button>
              );})}
            </div>
          </div>
        )}

        {step==='barbeiro'&&(
          <div className="anim-in">
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
              <button className="btn btn-ghost" style={{ padding:'6px 10px' }} onClick={()=>setStep('unidade')}>←</button>
              <h2 style={{ fontFamily:'var(--font-display)', fontSize:'2rem' }}>BARBEIRO</h2>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {unidade?.barbeiros.map(bid=>{ const b=barbeiros.find(x=>x.id===bid); if(!b) return null; const stat=stats.find(s=>s.barbeiroId===bid); return (
                <div key={bid} className="card" style={{ padding:'16px 20px', border:'1px solid var(--border)', background:'var(--surface)' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                    <Avatar src={b.photo_url} nome={b.nome} size={48}/>
                    <div style={{ flex:1 }}>
                      <p style={{ fontWeight:700 }}>{b.nome}</p>
                      <Stars value={Math.round(stat?.mediaEstrelas||0)} readonly/>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:6 }}>{b.especialidades.map(e=><span key={e} className="badge badge-gray">{e}</span>)}</div>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:8, marginTop:12 }}>
                    <button className="btn btn-outline" style={{ flex:1, fontSize:'0.78rem' }} onClick={()=>setVerPerfilB(b)}>Ver perfil</button>
                    <button className="btn btn-green" style={{ flex:2 }} onClick={()=>{setBarbeiroId(bid);setStep('servico');}}>Selecionar →</button>
                  </div>
                </div>
              );})}
            </div>
          </div>
        )}

        {step==='servico'&&(
          <div className="anim-in">
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
              <button className="btn btn-ghost" style={{ padding:'6px 10px' }} onClick={()=>setStep('barbeiro')}>←</button>
              <h2 style={{ fontFamily:'var(--font-display)', fontSize:'2rem' }}>CORTE</h2>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {servicos.map(s=>(
                <button key={s.id} className="card card-yellow" style={{ padding:'14px 18px', textAlign:'left', cursor:'pointer', width:'100%', background:'var(--surface)', border:'1px solid var(--border)' }} onClick={()=>{setServicoId(s.id);setStep('data');}}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <p style={{ fontWeight:700, fontSize:'0.95rem' }}>{s.nome}</p>
                      <p style={{ fontSize:'0.75rem', color:'var(--text-dim)', marginTop:2 }}>{s.descricao}</p>
                      <p style={{ fontSize:'0.7rem', color:'var(--text-faint)', marginTop:2, fontFamily:'var(--font-mono)' }}>{s.duracao} min</p>
                    </div>
                    <p style={{ fontWeight:800, color:'var(--green)', fontSize:'1.1rem' }}>R${s.valor}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step==='data'&&(
          <div className="anim-in">
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
              <button className="btn btn-ghost" style={{ padding:'6px 10px' }} onClick={()=>setStep('servico')}>←</button>
              <h2 style={{ fontFamily:'var(--font-display)', fontSize:'2rem' }}>HORÁRIO</h2>
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:'0.78rem', color:'var(--text-dim)', display:'block', marginBottom:6 }}>Data</label>
              <input type="date" className="input" min={minDate} value={data} onChange={e=>setData(e.target.value)} style={{ colorScheme:'dark' }}/>
            </div>
            {data&&(
              <div>
                <label style={{ fontSize:'0.78rem', color:'var(--text-dim)', display:'block', marginBottom:8 }}>Horário disponível</label>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 }}>
                  {horarios.map(h=>{ const busy=ocupados.includes(h); return (
                    <button key={h} disabled={busy} onClick={()=>{setHorario(h);setStep('termos');}}
                      style={{ padding:'10px 6px', borderRadius:8, fontSize:'0.8rem', fontWeight:700, fontFamily:'var(--font-mono)', cursor:busy?'not-allowed':'pointer', border:'1px solid', background:busy?'transparent':horario===h?'var(--green)':'var(--surface2)', color:busy?'var(--text-faint)':horario===h?'#000':'var(--text)', borderColor:busy?'var(--border)':horario===h?'var(--green)':'var(--border)', textDecoration:busy?'line-through':'none', transition:'all 0.15s' }}>{h}</button>
                  );})}
                </div>
              </div>
            )}
          </div>
        )}

        {step==='termos'&&(
          <div className="anim-in">
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
              <button className="btn btn-ghost" style={{ padding:'6px 10px' }} onClick={()=>setStep('data')}>←</button>
              <h2 style={{ fontFamily:'var(--font-display)', fontSize:'2rem' }}>CONFIRMAR</h2>
            </div>
            <div className="card" style={{ padding:16, marginBottom:20 }}>
              {[['Unidade',unidade?.nome],['Barbeiro',barbeiro?.nome],['Serviço',servico?.nome],['Data',data?new Date(data+'T12:00').toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'short'}):''],['Horário',horario],['Valor',servico?'R$ '+servico.valor.toFixed(2):'']].map(([k,v])=>(
                <div key={k} style={{ display:'flex', justifyContent:'space-between', paddingBottom:6, marginBottom:6, borderBottom:'1px solid var(--border)' }}>
                  <span style={{ fontSize:'0.78rem', color:'var(--text-faint)' }}>{k}</span>
                  <span style={{ fontSize:'0.85rem', fontWeight:600 }}>{v}</span>
                </div>
              ))}
            </div>
            <label style={{ display:'flex', alignItems:'flex-start', gap:12, cursor:'pointer', marginBottom:20 }}>
              <input type="checkbox" checked={termos} onChange={e=>setTermos(e.target.checked)} style={{ width:18, height:18, marginTop:2, accentColor:'var(--green)' }}/>
              <span style={{ fontSize:'0.82rem', color:'var(--text-dim)', lineHeight:1.5 }}>Li e aceito os termos de uso e me comprometo a comparecer no horário agendado.</span>
            </label>
            {error&&<p style={{ color:'var(--red)', fontSize:'0.82rem', marginBottom:12 }}>{error}</p>}
            <button className="btn btn-green" style={{ width:'100%', opacity:termos?1:0.4 }} disabled={!termos||loading} onClick={confirmar}>
              {loading?<><span className="spinner"/>Confirmando...</>:'Confirmar agendamento'}
            </button>
          </div>
        )}

        {step==='sucesso'&&(
          <div className="anim-in" style={{ textAlign:'center', padding:'20px 0' }}>
            <div style={{ width:64, height:64, borderRadius:'50%', background:'rgba(0,200,83,0.15)', border:'2px solid var(--green)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', fontSize:'1.8rem', color:'var(--green)' }}>✓</div>
            <p style={{ fontFamily:'var(--font-display)', fontSize:'2.5rem', color:'var(--green)', marginBottom:8 }}>AGENDADO!</p>
            <p style={{ color:'var(--text-dim)', fontSize:'0.9rem', marginBottom:6 }}>{barbeiro?.nome} · {servico?.nome}</p>
            <p style={{ color:'var(--text-faint)', fontFamily:'var(--font-mono)', fontSize:'0.82rem', marginBottom:24 }}>
              {data?new Date(data+'T12:00').toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'}):''} às {horario}
            </p>
            <button className="btn btn-green" style={{ width:'100%' }} onClick={()=>{onSuccess();onClose();}}>Fechar</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

const SLOT_ACCENTS = [
  { color:'#00c853', glow:'rgba(0,200,83,0.25)', border:'rgba(0,200,83,0.35)' },
  { color:'#ffd600', glow:'rgba(255,214,0,0.2)',  border:'rgba(255,214,0,0.35)' },
  { color:'#ff1744', glow:'rgba(255,23,68,0.2)',  border:'rgba(255,23,68,0.35)' },
];

function Dashboard({ session, usuario, stats, agendamentos, barbeiros, storeConfig, onAgendar, onRefresh, onVerPerfil }: {
  session: Session; usuario: Usuario|null; stats: Stats[];
  agendamentos: Agendamento[]; barbeiros: BarbeiroDB[]; storeConfig: StoreConfig;
  onAgendar: ()=>void; onRefresh: ()=>void; onVerPerfil: (b:BarbeiroDB)=>void;
}) {
  const [avaliacoes, setAvaliacoes] = useState<Record<string,number>>({});
  const [savingAv, setSavingAv] = useState<string|null>(null);
  const [mostrarTodos, setMostrarTodos] = useState(false);

  useEffect(()=>{ const av:Record<string,number>={}; agendamentos.forEach(a=>{if(a.avaliacao)av[a.id]=a.avaliacao;}); setAvaliacoes(av); },[agendamentos]);

  async function salvarAvaliacao(id:string, estrelas:number) {
    setSavingAv(id); setAvaliacoes(p=>({...p,[id]:estrelas}));
    await fetch('/api/agendamentos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'avaliar',agendamento_id:id,estrelas})});
    setSavingAv(null); onRefresh();
  }
  async function cancelar(id:string) {
    if(!confirm('Cancelar este agendamento?')) return;
    await fetch('/api/agendamentos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'cancelar',agendamento_id:id})});
    onRefresh();
  }

  const hoje = new Date().toISOString().split('T')[0];
  const proximos = agendamentos.filter(a=>a.data>=hoje&&a.status!=='cancelado');
  const passados  = agendamentos.filter(a=>a.data<hoje||a.status==='cancelado');
  const hoje_ag   = agendamentos.find(a=>a.data===hoje&&a.status!=='cancelado');
  const getBarbeiro = (id:string) => barbeiros.find(b=>b.id===id);
  const getUnidade  = (id:string) => storeConfig.unidades.find(u=>u.id===id);
  const statusBadge:Record<string,string> = {confirmado:'badge-green',pendente:'badge-yellow',cancelado:'badge-red'};

  const rankBarbeiros = [...barbeiros].filter(b=>b.ativo)
    .map(b=>({...b, stat:stats.find(s=>s.barbeiroId===b.id)}))
    .sort((a,b)=>(b.stat?.mediaEstrelas||0)-(a.stat?.mediaEstrelas||0));
  const top3 = rankBarbeiros.slice(0,3);
  const displayName = usuario?.username?`@${usuario.username}`:session.nome.split(' ')[0];

  return (
    <div>
      {/* Header */}
      <div className="anim-up" style={{ marginBottom:36 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <Avatar src={usuario?.foto_url} nome={session.nome} size={44}/>
            <div>
              <p style={{ fontFamily:'var(--font-mono)', fontSize:'0.65rem', color:'var(--text-faint)', letterSpacing:'0.16em', textTransform:'uppercase', marginBottom:2 }}>{storeConfig.slogan}</p>
              <p style={{ fontWeight:800, fontSize:'1.05rem' }}>
                {displayName}
                {usuario&&<span style={{ fontFamily:'var(--font-mono)', fontSize:'0.72rem', color:'var(--yellow)', marginLeft:10, fontWeight:400 }}>★ {usuario.pontos}pts</span>}
              </p>
              <span style={{ fontSize:'0.7rem', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:ROLE_COLOR[session.role] }}>{ROLE_LABEL[session.role]}</span>
            </div>
          </div>
          <div style={{ textAlign:'right' }}>
            <p style={{ fontFamily:'var(--font-display)', fontSize:'1.4rem', lineHeight:1, color:'var(--text-faint)' }}>{storeConfig.nome_loja.split(' ')[0]}</p>
            <p style={{ fontFamily:'var(--font-display)', fontSize:'1.4rem', lineHeight:1, color:'var(--green)', textShadow:'0 0 24px rgba(0,200,83,0.5)' }}>{storeConfig.nome_loja.split(' ').slice(1).join(' ')||'CHARM'}</p>
          </div>
        </div>
        <div className="rasta-bar" style={{ borderRadius:2 }}/>
      </div>

      {/* Unidades */}
      <div className="anim-up d-1" style={{ marginBottom:28 }}>
        <p style={{ fontFamily:'var(--font-mono)', fontSize:'0.62rem', color:'var(--text-faint)', letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:10 }}>Unidades</p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
          {storeConfig.unidades.filter(u=>u.ativo).map((u,i)=>{ const st=getUnidadeStatus(u); const accents=['var(--green)','var(--yellow)','var(--red)','#a78bfa']; const accent=accents[i]; return (
            <div key={u.id} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderTop:`2px solid ${accent}`, borderRadius:'0 0 12px 12px', padding:'12px 12px 14px', position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:40, background:`linear-gradient(to bottom,${accent}18,transparent)`, pointerEvents:'none' }}/>
              <p style={{ fontSize:'0.6rem', color:'var(--text-faint)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:4 }}>{u.bairro}</p>
              <p style={{ fontWeight:800, fontSize:'0.82rem', marginBottom:8, lineHeight:1.2 }}>{u.nome.replace(storeConfig.nome_loja+' ','')}</p>
              {st.aberto
                ?<div style={{ display:'flex', alignItems:'center', gap:5 }}><span style={{ width:6, height:6, borderRadius:'50%', background:'var(--green)', boxShadow:'0 0 6px var(--green)' }}/><span style={{ fontSize:'0.68rem', color:'var(--green)', fontWeight:600 }}>{st.texto}</span></div>
                :<span style={{ fontSize:'0.68rem', color:'var(--text-faint)' }}>{st.texto}</span>
              }
            </div>
          );})}
        </div>
      </div>

      {/* CTA */}
      <div className="anim-up d-2" style={{ marginBottom:32 }}>
        {hoje_ag?(
          <div style={{ background:'var(--surface)', border:'1px solid rgba(0,200,83,0.4)', borderLeft:'3px solid var(--green)', borderRadius:14, padding:'18px 22px' }}>
            <p style={{ fontFamily:'var(--font-mono)', fontSize:'0.62rem', color:'var(--green)', letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:10 }}>corte hoje</p>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
              <div>
                <p style={{ fontFamily:'var(--font-display)', fontSize:'1.8rem', lineHeight:1 }}>{getBarbeiro(hoje_ag.barbeiro_id)?.nome}</p>
                <p style={{ color:'var(--text-dim)', fontSize:'0.82rem', marginTop:4 }}>{hoje_ag.servico} · {hoje_ag.horario} · {getUnidade(hoje_ag.unidade_id)?.bairro}</p>
              </div>
              <span className={'badge '+(statusBadge[hoje_ag.status]||'badge-gray')}>{hoje_ag.status}</span>
            </div>
          </div>
        ):(
          <button onClick={onAgendar} style={{ width:'100%', background:'var(--green)', border:'none', borderRadius:14, padding:0, cursor:'pointer', position:'relative', overflow:'hidden', display:'block' }}
            onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.boxShadow='0 0 40px rgba(0,200,83,0.5)';}}
            onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.boxShadow='none';}}>
            <div style={{ position:'absolute', inset:0, backgroundImage:'repeating-linear-gradient(45deg,transparent,transparent 10px,rgba(0,0,0,0.06) 10px,rgba(0,0,0,0.06) 20px)', pointerEvents:'none' }}/>
            <div style={{ position:'relative', padding:'20px 32px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontFamily:'var(--font-display)', fontSize:'clamp(1.4rem,5vw,2rem)', letterSpacing:'0.06em', color:'#000' }}>AGENDAR HORÁRIO</span>
              <span style={{ fontFamily:'var(--font-display)', fontSize:'1.4rem', color:'#000', opacity:0.5 }}>→</span>
            </div>
          </button>
        )}
      </div>

      {/* Top 3 Barbeiros */}
      <div className="anim-up d-3" style={{ marginBottom:32 }}>
        <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:14 }}>
          <p style={{ fontFamily:'var(--font-mono)', fontSize:'0.62rem', color:'var(--text-faint)', letterSpacing:'0.14em', textTransform:'uppercase' }}>Top Barbeiros</p>
          <p style={{ fontFamily:'var(--font-mono)', fontSize:'0.6rem', color:'var(--text-faint)' }}>por avaliação</p>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
          {top3.map((b,i)=>{ const acc=SLOT_ACCENTS[i]; const media=b.stat?.mediaEstrelas||0; const total=b.stat?.totalAvaliacoes||0; return (
            <div key={b.id} style={{ background:'var(--surface)', border:`1px solid ${acc.border}`, borderRadius:16, padding:'20px 16px 14px', position:'relative', overflow:'hidden', transition:'transform 0.2s,box-shadow 0.2s' }}
              onMouseEnter={e=>{(e.currentTarget as HTMLDivElement).style.transform='translateY(-3px)';(e.currentTarget as HTMLDivElement).style.boxShadow=`0 8px 32px ${acc.glow}`;}}
              onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.transform='none';(e.currentTarget as HTMLDivElement).style.boxShadow='none';}}>
              <div style={{ position:'absolute', top:10, right:10, fontFamily:'var(--font-display)', fontSize:'1.4rem', color:acc.color, opacity:0.25 }}>#{i+1}</div>
              <div style={{ marginBottom:12 }}><Avatar src={b.photo_url} nome={b.nome} size={48} accent={acc.color}/></div>
              <p style={{ fontWeight:800, fontSize:'0.88rem', marginBottom:2 }}>{b.nome.split(' ')[0]}</p>
              <p style={{ fontSize:'0.68rem', color:'var(--text-faint)', marginBottom:8 }}>{b.nome.split(' ').slice(1).join(' ')}</p>
              <div style={{ display:'flex', gap:2, marginBottom:3 }}>{[1,2,3,4,5].map(n=><span key={n} style={{ fontSize:'0.85rem', color:n<=Math.round(media)?acc.color:'var(--surface3)' }}>★</span>)}</div>
              <p style={{ fontFamily:'var(--font-mono)', fontSize:'0.65rem', color:'var(--text-faint)', marginBottom:10 }}>{media?media.toFixed(1):'—'} · {total} av.</p>
              <button onClick={()=>onVerPerfil(b)} style={{ width:'100%', padding:'7px 0', borderRadius:8, background:'none', border:`1px solid ${acc.border}`, color:acc.color, fontSize:'0.72rem', fontWeight:700, cursor:'pointer', transition:'background 0.15s' }}
                onMouseEnter={e=>(e.currentTarget as HTMLButtonElement).style.background=acc.color+'22'}
                onMouseLeave={e=>(e.currentTarget as HTMLButtonElement).style.background='none'}>
                Ver perfil
              </button>
            </div>
          );})}
        </div>
        {rankBarbeiros.length>3&&(
          <>
            <button onClick={()=>setMostrarTodos(p=>!p)} style={{ width:'100%', marginTop:12, padding:'12px 0', borderRadius:10, background:'none', border:'1px solid var(--border)', color:'var(--text-faint)', fontSize:'0.8rem', fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, transition:'all 0.2s' }}
              onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor='var(--green)';(e.currentTarget as HTMLButtonElement).style.color='var(--green)';}}
              onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor='var(--border)';(e.currentTarget as HTMLButtonElement).style.color='var(--text-faint)';}}>
              {mostrarTodos?'↑ Mostrar menos':`↓ Ver todos os barbeiros (${rankBarbeiros.length})`}
            </button>
            {mostrarTodos&&(
              <div style={{ marginTop:12, display:'flex', flexDirection:'column', gap:8 }}>
                {rankBarbeiros.map(b=>{ const media=b.stat?.mediaEstrelas||0; return (
                  <div key={b.id} className="card" style={{ padding:'14px 16px', display:'flex', alignItems:'center', gap:14 }}>
                    <Avatar src={b.photo_url} nome={b.nome} size={44}/>
                    <div style={{ flex:1 }}>
                      <p style={{ fontWeight:700, fontSize:'0.9rem' }}>{b.nome}</p>
                      <div style={{ display:'flex', gap:2 }}>{[1,2,3,4,5].map(n=><span key={n} style={{ fontSize:'0.75rem', color:n<=Math.round(media)?'var(--yellow)':'var(--surface3)' }}>★</span>)}</div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginTop:4 }}>{b.especialidades.map(e=><span key={e} className="badge badge-gray" style={{ fontSize:'0.62rem' }}>{e}</span>)}</div>
                    </div>
                    <button onClick={()=>onVerPerfil(b)} className="btn btn-outline" style={{ fontSize:'0.75rem', padding:'7px 14px' }}>Perfil</button>
                  </div>
                );})}
              </div>
            )}
          </>
        )}
      </div>

      {/* Agendamentos */}
      <div className="anim-up d-4">
        {proximos.length>0&&(
          <div style={{ marginBottom:24 }}>
            <p style={{ fontFamily:'var(--font-mono)', fontSize:'0.62rem', color:'var(--text-faint)', letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:12 }}>Próximos</p>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {proximos.slice(0,5).map(a=>{ const b=getBarbeiro(a.barbeiro_id); const u=getUnidade(a.unidade_id); return (
                <div key={a.id} className="card" style={{ padding:'14px 18px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                        <Avatar src={b?.photo_url} nome={b?.nome||'?'} size={28}/>
                        <p style={{ fontWeight:700, fontSize:'0.9rem' }}>{b?.nome}</p>
                        <span className={'badge '+(statusBadge[a.status]||'badge-gray')}>{a.status}</span>
                      </div>
                      <p style={{ fontSize:'0.78rem', color:'var(--text-dim)' }}>{a.servico}</p>
                      <p style={{ fontSize:'0.72rem', color:'var(--text-faint)', fontFamily:'var(--font-mono)', marginTop:2 }}>
                        {new Date(a.data+'T12:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})} · {a.horario} · {u?.bairro}
                      </p>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <p style={{ color:'var(--green)', fontWeight:700 }}>R${a.valor}</p>
                      {a.status==='pendente'&&a.data>=hoje&&(
                        <button className="btn btn-danger" style={{ padding:'4px 10px', fontSize:'0.72rem', marginTop:6 }} onClick={()=>cancelar(a.id)}>Cancelar</button>
                      )}
                    </div>
                  </div>
                </div>
              );})}
            </div>
          </div>
        )}
        {passados.length>0&&(
          <div>
            <p style={{ fontSize:'0.72rem', color:'var(--text-faint)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:12 }}>Histórico</p>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {passados.slice(0,8).map(a=>{ const b=getBarbeiro(a.barbeiro_id); const av=avaliacoes[a.id]||a.avaliacao||0; const podeAvaliar=a.status==='confirmado'&&!a.avaliacao; return (
                <div key={a.id} className="card" style={{ padding:'14px 18px', opacity:a.status==='cancelado'?0.5:1 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                        <Avatar src={b?.photo_url} nome={b?.nome||'?'} size={28}/>
                        <p style={{ fontWeight:600, fontSize:'0.85rem' }}>{b?.nome}</p>
                        <span className={'badge '+(statusBadge[a.status]||'badge-gray')}>{a.status}</span>
                      </div>
                      <p style={{ fontSize:'0.72rem', color:'var(--text-faint)', fontFamily:'var(--font-mono)' }}>
                        {new Date(a.data+'T12:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'2-digit'})} · {a.horario}
                      </p>
                      <div style={{ marginTop:6 }}>
                        <Stars value={av} readonly={!podeAvaliar||savingAv===a.id} onChange={v=>salvarAvaliacao(a.id,v)}/>
                        {podeAvaliar&&<span style={{ fontSize:'0.68rem', color:'var(--text-faint)', marginLeft:6 }}>clique para avaliar</span>}
                      </div>
                    </div>
                    <p style={{ color:'var(--text-faint)', fontSize:'0.82rem' }}>R${a.valor}</p>
                  </div>
                </div>
              );})}
            </div>
          </div>
        )}
        {agendamentos.length===0&&(
          <div style={{ textAlign:'center', padding:'40px 20px', color:'var(--text-faint)' }}>
            <div style={{ width:56, height:56, borderRadius:14, background:'var(--surface2)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px', fontFamily:'var(--font-display)', fontSize:'1.4rem', color:'var(--text-faint)' }}>RC</div>
            <p style={{ fontSize:'0.9rem' }}>Nenhum agendamento ainda</p>
            <button className="btn btn-green" style={{ marginTop:16 }} onClick={onAgendar}>Agendar agora</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Aba de Horários (barbeiro/gerente/dono) ──────────────────────────────────

function HorariosTab({ session, usuario, barbeiros, agendamentos, storeConfig, onRefresh }: {
  session: Session; usuario: Usuario|null; barbeiros: BarbeiroDB[];
  agendamentos: Agendamento[]; storeConfig: StoreConfig; onRefresh: ()=>void;
}) {
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroData, setFiltroData] = useState('');

  const filtrados = agendamentos.filter(a=>{
    if (filtroStatus!=='todos'&&a.status!==filtroStatus) return false;
    if (filtroData&&a.data!==filtroData) return false;
    return true;
  }).sort((a,b)=>a.data.localeCompare(b.data)||a.horario.localeCompare(b.horario));

  const hoje = new Date().toISOString().split('T')[0];
  const pendentesHoje = filtrados.filter(a=>a.data===hoje&&a.status==='pendente').length;
  const getBarbeiro = (id:string) => barbeiros.find(b=>b.id===id);
  const getUnidade  = (id:string) => storeConfig.unidades.find(u=>u.id===id);
  const statusBadge:Record<string,string> = {confirmado:'badge-green',pendente:'badge-yellow',cancelado:'badge-red'};

  async function confirmarAg(id:string) {
    await fetch('/api/agendamentos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'confirmar',agendamento_id:id})});
    onRefresh();
  }
  async function cancelarAg(id:string) {
    if(!confirm('Cancelar este agendamento?')) return;
    await fetch('/api/agendamentos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'cancelar',agendamento_id:id})});
    onRefresh();
  }

  return (
    <div>
      <div className="anim-up" style={{ marginBottom:28 }}>
        <p style={{ fontSize:'0.72rem', color:'var(--text-faint)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:4 }}>Painel</p>
        <h1 style={{ fontFamily:'var(--font-display)', fontSize:'clamp(2rem,6vw,3.5rem)' }}>HORÁRIOS</h1>
      </div>

      {pendentesHoje>0&&(
        <div style={{ background:'rgba(255,214,0,0.08)', border:'1px solid rgba(255,214,0,0.3)', borderRadius:12, padding:'12px 16px', marginBottom:20, display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:'1.2rem' }}>⚠</span>
          <p style={{ fontSize:'0.85rem', color:'var(--yellow)' }}>Você tem <strong>{pendentesHoje}</strong> agendamento{pendentesHoje>1?'s':''} pendente{pendentesHoje>1?'s':''} hoje</p>
        </div>
      )}

      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        <select className="input" style={{ flex:1, minWidth:130 }} value={filtroStatus} onChange={e=>setFiltroStatus(e.target.value)}>
          <option value="todos">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="confirmado">Confirmado</option>
          <option value="cancelado">Cancelado</option>
        </select>
        <input type="date" className="input" style={{ flex:1, minWidth:130, colorScheme:'dark' }} value={filtroData} onChange={e=>setFiltroData(e.target.value)}/>
        {filtroData&&<button className="btn btn-ghost" style={{ padding:'8px 12px' }} onClick={()=>setFiltroData('')}>✕</button>}
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {filtrados.length===0
          ?<p style={{ textAlign:'center', color:'var(--text-faint)', padding:40, fontSize:'0.88rem' }}>Nenhum agendamento encontrado</p>
          :filtrados.map(a=>{ const b=getBarbeiro(a.barbeiro_id); const u=getUnidade(a.unidade_id); const isHoje=a.data===hoje; return (
            <div key={a.id} className="card" style={{ padding:'14px 18px', borderLeft:isHoje?'3px solid var(--green)':undefined }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:6, flexWrap:'wrap' }}>
                    {session.role!=='barbeiro'&&b&&<Avatar src={b.photo_url} nome={b.nome} size={24}/>}
                    {session.role!=='barbeiro'&&<span style={{ fontWeight:600, fontSize:'0.82rem' }}>{b?.nome}</span>}
                    <span className={'badge '+(statusBadge[a.status]||'badge-gray')}>{a.status}</span>
                    {isHoje&&<span className="badge badge-green">hoje</span>}
                  </div>
                  <p style={{ fontSize:'0.88rem', fontWeight:600, marginBottom:2 }}>{a.servico}</p>
                  <p style={{ fontFamily:'var(--font-mono)', fontSize:'0.7rem', color:'var(--text-faint)' }}>
                    {new Date(a.data+'T12:00').toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'short',year:'2-digit'})} · {a.horario}
                  </p>
                  {u&&<p style={{ fontSize:'0.7rem', color:'var(--text-faint)', marginTop:2 }}>{u.bairro} — {u.nome}</p>}
                  {a.avaliacao&&<div style={{ marginTop:4 }}><Stars value={a.avaliacao} readonly/></div>}
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <p style={{ fontWeight:700, color:'var(--green)', marginBottom:6 }}>R${a.valor}</p>
                  <div style={{ display:'flex', gap:4, justifyContent:'flex-end', flexDirection:'column' }}>
                    {a.status==='pendente'&&<button className="btn btn-green" style={{ padding:'4px 10px', fontSize:'0.72rem' }} onClick={()=>confirmarAg(a.id)}>Confirmar</button>}
                    {a.status!=='cancelado'&&<button className="btn btn-danger" style={{ padding:'4px 10px', fontSize:'0.72rem' }} onClick={()=>cancelarAg(a.id)}>Cancelar</button>}
                  </div>
                </div>
              </div>
            </div>
          );})}
      </div>
    </div>
  );
}

// ─── Aba de Perfil (barbeiro gerencia seu próprio perfil público) ──────────────

function PerfilBarbeiroTab({ session, usuario, agendamentos, onRefresh }: {
  session: Session; usuario: Usuario|null; agendamentos: Agendamento[]; onRefresh: ()=>void;
}) {
  const [barbeiro, setBarbeiro]       = useState<BarbeiroDB|null>(null);
  const [loading, setLoading]         = useState(true);
  const [fotoPreview, setFotoPreview] = useState<string|null>(null);
  const [fotoFile, setFotoFile]       = useState<File|null>(null);
  const [savingFoto, setSavingFoto]   = useState(false);
  const [fotos, setFotos]             = useState<FotoBarbeiro[]>([]);
  const [fotosLoading, setFotosLoading] = useState(false);
  const [fotoAberta, setFotoAberta]   = useState<FotoBarbeiro|null>(null);
  const [showUpload, setShowUpload]   = useState(false);
  const [descricao, setDescricao]     = useState('');
  const [novaFotoFile, setNovaFotoFile] = useState<File|null>(null);
  const [novaFotoPreview, setNovaFotoPreview] = useState<string|null>(null);
  const [uploading, setUploading]     = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fotoPerfilRef = useRef<HTMLInputElement>(null);
  const novaFotoRef   = useRef<HTMLInputElement>(null);

  const carregarBarbeiro = useCallback(async ()=>{
    if (!usuario?.barbeiro_id) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/barbeiros?id=${usuario.barbeiro_id}`);
      if (res.ok) { const d=await res.json(); setBarbeiro(d.barbeiro); setFotoPreview(d.barbeiro?.photo_url||null); }
    } finally { setLoading(false); }
  },[usuario?.barbeiro_id]);

  const carregarFotos = useCallback(async ()=>{
    if (!usuario?.barbeiro_id) return;
    setFotosLoading(true);
    try {
      const res = await fetch(`/api/barbeiros/fotos?barbeiro_id=${usuario.barbeiro_id}`);
      if (res.ok) { const d=await res.json(); setFotos(d.fotos||[]); }
    } finally { setFotosLoading(false); }
  },[usuario?.barbeiro_id]);

  useEffect(()=>{ carregarBarbeiro(); carregarFotos(); },[carregarBarbeiro,carregarFotos]);

  async function salvarFotoPerfil() {
    if (!fotoFile||!barbeiro?._messageId) return;
    setSavingFoto(true);
    try {
      const form=new FormData(); form.append('barbeiro_id',barbeiro.id); form.append('foto',fotoFile);
      await fetch('/api/barbeiros',{method:'POST',body:form});
      setFotoFile(null); await carregarBarbeiro(); onRefresh();
    } finally { setSavingFoto(false); }
  }

  async function postarFoto() {
    if (!novaFotoFile||!barbeiro) return;
    setUploading(true); setUploadError('');
    try {
      const form=new FormData(); form.append('barbeiro_id',barbeiro.id); form.append('descricao',descricao); form.append('foto',novaFotoFile);
      const res=await fetch('/api/barbeiros/fotos',{method:'POST',body:form}); const d=await res.json();
      if (!res.ok) { setUploadError(d.error||'Erro'); return; }
      setNovaFotoFile(null); setNovaFotoPreview(null); setDescricao(''); setShowUpload(false); await carregarFotos();
    } finally { setUploading(false); }
  }

  async function excluirFoto(foto: FotoBarbeiro) {
    if (!foto._messageId) return;
    await fetch('/api/barbeiros/fotos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'deletar',message_id:foto._messageId,barbeiro_id:barbeiro?.id})});
    setFotoAberta(null); await carregarFotos();
  }

  if (loading) return <div style={{ textAlign:'center', padding:60 }}><span className="spinner spinner-lg"/></div>;

  if (!usuario?.barbeiro_id||!barbeiro) return (
    <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--text-faint)' }}>
      <p style={{ fontFamily:'var(--font-display)', fontSize:'1.8rem', marginBottom:12 }}>SEM VÍNCULO</p>
      <p style={{ fontSize:'0.88rem' }}>Sua conta não está vinculada a um perfil de barbeiro.</p>
      <p style={{ fontSize:'0.78rem', marginTop:8 }}>Peça ao gerente para vincular sua conta.</p>
    </div>
  );

  const mediaEstrelas = (()=>{ const avs=agendamentos.filter(a=>a.barbeiro_id===barbeiro.id&&a.avaliacao); if(!avs.length) return 0; return avs.reduce((s,a)=>s+(a.avaliacao||0),0)/avs.length; })();
  const totalCortes = agendamentos.filter(a=>a.barbeiro_id===barbeiro.id&&a.status==='confirmado').length;

  return (
    <div>
      <div className="anim-up" style={{ marginBottom:28 }}>
        <p style={{ fontSize:'0.72rem', color:'var(--green)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:4 }}>Barbeiro</p>
        <h1 style={{ fontFamily:'var(--font-display)', fontSize:'clamp(2rem,6vw,3.5rem)' }}>MEU PERFIL</h1>
      </div>

      {/* Cabeçalho */}
      <div className="card anim-up" style={{ padding:'20px 22px', marginBottom:16 }}>
        <div style={{ display:'flex', gap:20, alignItems:'flex-start', marginBottom:20 }}>
          <div style={{ position:'relative' }}>
            <Avatar src={fotoPreview} nome={barbeiro.nome} size={88} accent="var(--green)"/>
            <div style={{ position:'absolute', bottom:0, right:0, width:20, height:20, background:'var(--green)', borderRadius:'50%', border:'2px solid var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.55rem' }}>✂</div>
          </div>
          <div style={{ flex:1 }}>
            <p style={{ fontWeight:800, fontSize:'1.2rem', marginBottom:2 }}>{barbeiro.nome}</p>
            <p style={{ fontSize:'0.72rem', color:'var(--green)', fontFamily:'var(--font-mono)', marginBottom:10 }}>barbeiro profissional</p>
            <div style={{ display:'flex', gap:24, marginBottom:10 }}>
              {[['fotos',fotos.length],['cortes',totalCortes],['★ média',mediaEstrelas?mediaEstrelas.toFixed(1):'—']].map(([l,v])=>(
                <div key={l as string} style={{ textAlign:'center' }}>
                  <p style={{ fontWeight:800, fontSize:'1rem', lineHeight:1 }}>{v}</p>
                  <p style={{ fontSize:'0.65rem', color:'var(--text-faint)' }}>{l}</p>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>{barbeiro.especialidades.map(e=><span key={e} className="badge badge-green" style={{ fontSize:'0.65rem' }}>{e}</span>)}</div>
          </div>
        </div>
        <p style={{ fontSize:'0.68rem', color:'var(--text-faint)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:10 }}>Foto de capa</p>
        <input ref={fotoPerfilRef} type="file" accept="image/*" style={{ display:'none' }} onChange={e=>{ const f=e.target.files?.[0]; if(f){setFotoFile(f);setFotoPreview(URL.createObjectURL(f));} }}/>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-outline" style={{ flex:1 }} onClick={()=>fotoPerfilRef.current?.click()}>
            {barbeiro.photo_url?'Trocar foto':'Adicionar foto'}
          </button>
          {fotoFile&&(
            <button className="btn btn-green" onClick={salvarFotoPerfil} disabled={savingFoto}>
              {savingFoto?<><span className="spinner"/>Salvando...</>:'Salvar'}
            </button>
          )}
        </div>
      </div>

      {/* Galeria */}
      <div className="card anim-up" style={{ padding:'20px 22px', marginBottom:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <p style={{ fontSize:'0.68rem', color:'var(--text-faint)', textTransform:'uppercase', letterSpacing:'0.1em' }}>Galeria ({fotos.length})</p>
          <button className="btn btn-outline" style={{ fontSize:'0.78rem', padding:'6px 14px' }} onClick={()=>setShowUpload(p=>!p)}>
            {showUpload?'Cancelar':'+ Postar foto'}
          </button>
        </div>

        {showUpload&&(
          <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:12, padding:16, marginBottom:16 }}>
            <input ref={novaFotoRef} type="file" accept="image/*" style={{ display:'none' }} onChange={e=>{ const f=e.target.files?.[0]; if(f){setNovaFotoFile(f);setNovaFotoPreview(URL.createObjectURL(f));} }}/>
            {novaFotoPreview
              ?<img src={novaFotoPreview} alt="preview" style={{ width:'100%', height:200, objectFit:'cover', borderRadius:10, marginBottom:10 }}/>
              :<button className="btn btn-outline" style={{ width:'100%', marginBottom:10, padding:'32px 0' }} onClick={()=>novaFotoRef.current?.click()}>+ Escolher foto</button>
            }
            <input className="input" placeholder="Legenda..." value={descricao} onChange={e=>setDescricao(e.target.value)} style={{ marginBottom:10 }}/>
            {uploadError&&<p style={{ color:'var(--red)', fontSize:'0.78rem', marginBottom:8 }}>{uploadError}</p>}
            <div style={{ display:'flex', gap:8 }}>
              {novaFotoPreview&&<button className="btn btn-outline" style={{ flex:1, fontSize:'0.78rem' }} onClick={()=>{setNovaFotoPreview(null);setNovaFotoFile(null);}}>Trocar</button>}
              <button className="btn btn-green" style={{ flex:2 }} onClick={postarFoto} disabled={!novaFotoFile||uploading}>
                {uploading?<><span className="spinner"/>Publicando...</>:'Publicar'}
              </button>
            </div>
          </div>
        )}

        {fotosLoading
          ?<div style={{ textAlign:'center', padding:32 }}><span className="spinner"/></div>
          :fotos.length===0
            ?<div style={{ textAlign:'center', padding:'32px 20px', color:'var(--text-faint)' }}>
              <p style={{ fontSize:'2rem', marginBottom:8 }}>✂</p>
              <p style={{ fontSize:'0.88rem' }}>Nenhuma foto publicada ainda</p>
              <p style={{ fontSize:'0.75rem', marginTop:4 }}>Clique em "+ Postar foto" para começar</p>
            </div>
            :<div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:2 }}>
              {fotos.map(foto=>(
                <div key={foto.id} onClick={()=>setFotoAberta(foto)} style={{ aspectRatio:'1', cursor:'pointer', overflow:'hidden' }}
                  onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.opacity='0.8'}
                  onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.opacity='1'}>
                  <img src={foto.foto_url||''} alt={foto.descricao} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                </div>
              ))}
            </div>
        }
      </div>

      {fotoAberta&&(
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.92)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center' }} onClick={()=>setFotoAberta(null)}>
          <div onClick={e=>e.stopPropagation()} style={{ maxWidth:480, width:'100%', background:'var(--surface)', borderRadius:16, overflow:'hidden', margin:'0 16px' }}>
            <img src={fotoAberta.foto_url||''} alt={fotoAberta.descricao} style={{ width:'100%', maxHeight:'60vh', objectFit:'cover' }}/>
            <div style={{ padding:'14px 16px' }}>
              {fotoAberta.descricao&&<p style={{ fontSize:'0.88rem', color:'var(--text-dim)', marginBottom:4 }}>{fotoAberta.descricao}</p>}
              <p style={{ fontSize:'0.7rem', color:'var(--text-faint)' }}>{fotoAberta.data}</p>
              <button className="btn btn-danger" style={{ marginTop:12, fontSize:'0.75rem', padding:'6px 14px' }} onClick={()=>excluirFoto(fotoAberta)}>Excluir foto</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Configurações ────────────────────────────────────────────────────────────

function Configuracoes({ session, usuario, barbeiros, storeConfig, onUpdate, onLogout }: {
  session: Session; usuario: Usuario|null; barbeiros: BarbeiroDB[];
  storeConfig: StoreConfig; onUpdate: ()=>void; onLogout: ()=>void;
}) {
  const [tema, setTema]             = useState<'dark'|'light'>(usuario?.tema||'dark');
  const [barbeiroFav, setBarbeiroFav] = useState(usuario?.barbeiro_favorito||'');
  const [servicoFav, setServicoFav] = useState(usuario?.servico_favorito||'');
  const [horarioFav, setHorarioFav] = useState(usuario?.horario_favorito||'');
  const [unidadeFav, setUnidadeFav] = useState(usuario?.unidade_favorita||'');
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [senhaNova, setSenhaNova]   = useState('');
  const [senhaConfirm, setSenhaConfirm] = useState('');
  const [senhaError, setSenhaError] = useState('');
  const [senhaOk, setSenhaOk]       = useState(false);
  const [savingSenha, setSavingSenha] = useState(false);
  const [showSenhaSection, setShowSenhaSection] = useState(false);
  const [showSenhaAtual, setShowSenhaAtual]     = useState(false);
  const [showSenhaNova, setShowSenhaNova]       = useState(false);
  const [showSenhaConfirm, setShowSenhaConfirm] = useState(false);
  const [nomeEdit, setNomeEdit]     = useState(session.nome);
  const [usernameEdit, setUsernameEdit] = useState(usuario?.username||'');
  const [perfilError, setPerfilError] = useState('');
  const [perfilOk, setPerfilOk]     = useState(false);
  const [savingPerfil, setSavingPerfil] = useState(false);
  const [fotoPreview, setFotoPreview] = useState<string|null>(usuario?.foto_url||null);
  const [fotoFile, setFotoFile]     = useState<File|null>(null);
  const [savingFoto, setSavingFoto] = useState(false);
  const fotoRef = useRef<HTMLInputElement>(null);

  const horarios = ['07:00','07:30','08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00'];

  async function salvarPrefs() {
    setSaving(true);
    await fetch('/api/usuarios',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'prefs',tema,barbeiro_favorito:barbeiroFav||null,servico_favorito:servicoFav||null,horario_favorito:horarioFav||null,unidade_favorita:unidadeFav||null})});
    setSaving(false); setSaved(true); setTimeout(()=>setSaved(false),2500); onUpdate();
  }
  async function salvarPerfil() {
    setPerfilError(''); setPerfilOk(false); setSavingPerfil(true);
    const res=await fetch('/api/usuarios',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'perfil',nome:nomeEdit,username:usernameEdit})});
    const d=await res.json(); setSavingPerfil(false);
    if (!res.ok) { setPerfilError(d.error||'Erro'); return; }
    setPerfilOk(true); setTimeout(()=>setPerfilOk(false),2500); onUpdate();
  }
  async function uploadFoto() {
    if (!fotoFile) return; setSavingFoto(true);
    const form=new FormData(); form.append('foto',fotoFile);
    const res=await fetch('/api/usuarios',{method:'POST',body:form}); const d=await res.json();
    setSavingFoto(false);
    if (res.ok&&d.foto_url) { setFotoPreview(d.foto_url); setFotoFile(null); onUpdate(); }
  }
  async function alterarSenha() {
    setSenhaError(''); setSenhaOk(false);
    if (senhaNova!==senhaConfirm) { setSenhaError('Senhas não coincidem'); return; }
    if (senhaNova.length<6) { setSenhaError('Mínimo 6 caracteres'); return; }
    setSavingSenha(true);
    const res=await fetch('/api/usuarios',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'senha',senha_atual:senhaAtual,senha_nova:senhaNova})});
    const d=await res.json(); setSavingSenha(false);
    if (!res.ok) { setSenhaError(d.error||'Erro'); return; }
    setSenhaOk(true); setSenhaAtual(''); setSenhaNova(''); setSenhaConfirm('');
    setTimeout(()=>{ setSenhaOk(false); setShowSenhaSection(false); },2500);
  }
  async function excluirConta() {
    if (!confirm('Tem certeza? Irreversível.')) return;
    const c=prompt('Digite "EXCLUIR" para confirmar:');
    if (c!=='EXCLUIR') return;
    await fetch('/api/usuarios',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'excluir'})});
    onLogout();
  }

  const S=({title,children}:{title:string;children:React.ReactNode})=>(
    <div className="card anim-up" style={{ padding:'20px 22px', marginBottom:16 }}>
      <p style={{ fontSize:'0.68rem', textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--text-faint)', marginBottom:16 }}>{title}</p>
      {children}
    </div>
  );

  return (
    <div>
      <div className="anim-up" style={{ marginBottom:28 }}>
        <p style={{ fontSize:'0.72rem', color:'var(--text-faint)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:4 }}>Painel</p>
        <h1 style={{ fontFamily:'var(--font-display)', fontSize:'clamp(2rem,6vw,3.5rem)' }}>CONTA</h1>
      </div>

      <S title="Foto de perfil">
        <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:16 }}>
          <Avatar src={fotoPreview} nome={session.nome} size={72}/>
          <div>
            <p style={{ fontSize:'0.88rem', fontWeight:600, marginBottom:4 }}>{session.nome}</p>
            {usuario?.username&&<p style={{ fontFamily:'var(--font-mono)', fontSize:'0.78rem', color:'var(--green)' }}>@{usuario.username}</p>}
          </div>
        </div>
        <input ref={fotoRef} type="file" accept="image/*" style={{ display:'none' }} onChange={e=>{ const f=e.target.files?.[0]; if(f){setFotoFile(f);setFotoPreview(URL.createObjectURL(f));} }}/>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-outline" style={{ flex:1 }} onClick={()=>fotoRef.current?.click()}>{fotoPreview?'Trocar foto':'Adicionar foto'}</button>
          {fotoFile&&<button className="btn btn-green" onClick={uploadFoto} disabled={savingFoto}>{savingFoto?<><span className="spinner"/>Enviando...</>:'Salvar'}</button>}
        </div>
      </S>

      <S title="Dados pessoais">
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <div>
            <label style={{ fontSize:'0.78rem', color:'var(--text-faint)', display:'block', marginBottom:4 }}>Nome</label>
            <input className="input" value={nomeEdit} onChange={e=>setNomeEdit(e.target.value)}/>
          </div>
          <div>
            <label style={{ fontSize:'0.78rem', color:'var(--text-faint)', display:'block', marginBottom:4 }}>Username (@)</label>
            <div style={{ position:'relative' }}>
              <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'var(--green)', fontFamily:'var(--font-mono)', fontSize:'0.9rem' }}>@</span>
              <input className="input" value={usernameEdit} onChange={e=>setUsernameEdit(e.target.value.replace(/^@/,''))} placeholder="seuusername" style={{ paddingLeft:30, fontFamily:'var(--font-mono)' }}/>
            </div>
            <p style={{ fontSize:'0.7rem', color:'var(--text-faint)', marginTop:4 }}>3-30 caracteres: letras, números, . ou _</p>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', paddingTop:4 }}>
            <span style={{ fontSize:'0.78rem', color:'var(--text-dim)' }}>E-mail</span>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.75rem', color:'var(--text-faint)' }}>{session.email}</span>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between' }}>
            <span style={{ fontSize:'0.78rem', color:'var(--text-dim)' }}>Nível</span>
            <span style={{ fontWeight:700, color:ROLE_COLOR[session.role] }}>{ROLE_LABEL[session.role]}</span>
          </div>
          {perfilError&&<p style={{ color:'var(--red)', fontSize:'0.8rem' }}>{perfilError}</p>}
          {perfilOk&&<p style={{ color:'var(--green)', fontSize:'0.8rem' }}>Perfil atualizado</p>}
          <button className="btn btn-green" onClick={salvarPerfil} disabled={savingPerfil}>
            {savingPerfil?<><span className="spinner"/>Salvando...</>:'Salvar perfil'}
          </button>
        </div>
      </S>

      <S title="Aparência">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:'0.88rem', color:'var(--text-dim)' }}>Tema</span>
          <div style={{ display:'flex', gap:8 }}>
            {(['dark','light'] as const).map(t=>(
              <button key={t} onClick={()=>setTema(t)} className="btn" style={{ padding:'6px 14px', fontSize:'0.8rem', background:tema===t?'var(--green)':'var(--surface2)', color:tema===t?'#000':'var(--text-dim)', border:'1px solid '+(tema===t?'var(--green)':'var(--border)') }}>
                {t==='dark'?'Escuro':'Claro'}
              </button>
            ))}
          </div>
        </div>
      </S>

      <S title="Preferências">
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[
            ['Barbeiro favorito', barbeiroFav, setBarbeiroFav, barbeiros.map(b=>({v:b.id,l:b.nome}))],
            ['Serviço favorito', servicoFav, setServicoFav, storeConfig.servicos.filter(s=>s.ativo).map(s=>({v:s.id,l:s.nome}))],
            ['Horário favorito', horarioFav, setHorarioFav, horarios.map(h=>({v:h,l:h}))],
            ['Unidade favorita', unidadeFav, setUnidadeFav, storeConfig.unidades.filter(u=>u.ativo).map(u=>({v:u.id,l:u.nome}))],
          ].map(([label,val,setter,opts]:any)=>(
            <div key={label}>
              <label style={{ fontSize:'0.78rem', color:'var(--text-faint)', display:'block', marginBottom:4 }}>{label}</label>
              <select className="input" value={val} onChange={(e:React.ChangeEvent<HTMLSelectElement>)=>setter(e.target.value)}>
                <option value="">Nenhum</option>
                {opts.map((o:any)=><option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </div>
          ))}
          <button className="btn btn-green" onClick={salvarPrefs} disabled={saving} style={{ marginTop:6 }}>
            {saving?<><span className="spinner"/>Salvando...</>:saved?'Salvo!':'Salvar preferências'}
          </button>
        </div>
      </S>

      <div className="card anim-up" style={{ padding:'20px 22px', marginBottom:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <p style={{ fontSize:'0.68rem', textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--text-faint)' }}>Segurança</p>
          <button className="btn btn-outline" style={{ fontSize:'0.72rem', padding:'5px 12px' }} onClick={()=>setShowSenhaSection(p=>!p)}>
            {showSenhaSection?'Cancelar':'Alterar senha'}
          </button>
        </div>
        {showSenhaSection&&(
          <div style={{ marginTop:16, display:'flex', flexDirection:'column', gap:10 }}>
            {[
              [senhaAtual,setSenhaAtual,'Senha atual',showSenhaAtual,()=>setShowSenhaAtual((p:boolean)=>!p)],
              [senhaNova,setSenhaNova,'Nova senha',showSenhaNova,()=>setShowSenhaNova((p:boolean)=>!p)],
              [senhaConfirm,setSenhaConfirm,'Confirmar nova senha',showSenhaConfirm,()=>setShowSenhaConfirm((p:boolean)=>!p)],
            ].map(([val,setter,ph,show,toggle]:any)=>(
              <div key={ph} style={{ position:'relative' }}>
                <input type={show?'text':'password'} className="input" placeholder={ph} value={val} onChange={(e:React.ChangeEvent<HTMLInputElement>)=>setter(e.target.value)} style={{ paddingRight:72 }}/>
                <button onClick={toggle} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'var(--text-faint)', cursor:'pointer', fontSize:'0.7rem', fontFamily:'var(--font-mono)', padding:'4px 6px' }}>
                  {show?'ocultar':'mostrar'}
                </button>
              </div>
            ))}
            {senhaError&&<p style={{ color:'var(--red)', fontSize:'0.8rem' }}>{senhaError}</p>}
            {senhaOk&&<p style={{ color:'var(--green)', fontSize:'0.8rem' }}>Senha alterada com sucesso</p>}
            <button className="btn btn-green" onClick={alterarSenha} disabled={savingSenha}>
              {savingSenha?<><span className="spinner"/>Salvando...</>:'Confirmar alteração'}
            </button>
          </div>
        )}
      </div>

      <S title="Sessão">
        <button className="btn btn-outline" style={{ width:'100%', marginBottom:10 }} onClick={onLogout}>Sair da sessão</button>
        <button className="btn btn-danger" style={{ width:'100%' }} onClick={excluirConta}>Excluir conta</button>
      </S>
    </div>
  );
}

// ─── Painel de Gerência (gerente / dono) ─────────────────────────────────────

function GerenciaPanel({ session, barbeiros: barbeirosInit, storeConfig: storeConfigInit, onRefresh }: {
  session: Session; barbeiros: BarbeiroDB[]; storeConfig: StoreConfig; onRefresh: ()=>void;
}) {
  type GTab = 'usuarios'|'barbeiros'|'loja'|'manutencao';
  const [usuarios, setUsuarios]       = useState<(Usuario&{_messageId?:string})[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [barbeiros, setBarbeiros]     = useState<BarbeiroDB[]>(barbeirosInit);
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState<GTab>('usuarios');
  const [banTarget, setBanTarget]     = useState<string|null>(null);
  const [banMotivo, setBanMotivo]     = useState('');
  const [maintenance, setMaintenance] = useState<{ativo:boolean;mensagem:string;_messageId?:string}|null>(null);
  const [maintSaving, setMaintSaving] = useState(false);
  const [maintSaved, setMaintSaved]   = useState(false);
  const [userSearch, setUserSearch]   = useState('');
  const [promoTarget, setPromoTarget] = useState<string|null>(null);
  const [novoRole, setNovoRole]       = useState<UserRole>('barbeiro');
  const [novoBarbeiroId, setNovoBarbeiroId] = useState('');
  const [novaUnidadeId, setNovaUnidadeId]   = useState('');
  const [saving, setSaving]           = useState(false);
  const [bFormOpen, setBFormOpen]     = useState(false);
  const [bEditId, setBEditId]         = useState<string|null>(null);
  const [bNome, setBNome]             = useState('');
  const [bEsp, setBEsp]               = useState('');
  const [bUnidades, setBUnidades]     = useState<string[]>([]);
  const [bFotoFile, setBFotoFile]     = useState<File|null>(null);
  const [bFotoPreview, setBFotoPreview] = useState<string|null>(null);
  const [bSaving, setBSaving]         = useState(false);
  const [bError, setBError]           = useState('');
  const fotoInputRef = useRef<HTMLInputElement>(null);
  const [storeConfig, setStoreConfig] = useState<StoreConfig>(storeConfigInit);
  const [storeSaving, setStoreSaving] = useState(false);
  const [storeSaved, setStoreSaved]   = useState(false);
  const [storeError, setStoreError]   = useState('');
  const isDono = session.role==='dono';

  const loadAdmin = useCallback(async ()=>{
    setLoading(true);
    const reqs: Promise<Response>[] = [fetch('/api/usuarios?action=todos'), fetch('/api/agendamentos?action=admin'), fetch('/api/barbeiros?todos=1')];
    if (isDono) reqs.push(fetch('/api/manutencao'));
    const results = await Promise.all(reqs);
    if (results[0].ok) { const d=await results[0].json(); setUsuarios(d.usuarios||[]); }
    if (results[1].ok) { const d=await results[1].json(); setAgendamentos(d.agendamentos||[]); }
    if (results[2].ok) { const d=await results[2].json(); setBarbeiros(d.barbeiros||[]); }
    if (isDono&&results[3]?.ok) { const d=await results[3].json(); setMaintenance(d.maintenance||null); }
    setLoading(false);
  },[isDono]);

  useEffect(()=>{ loadAdmin(); },[loadAdmin]);

  async function promover(uid:string) {
    setSaving(true);
    await fetch('/api/usuarios',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'promover',usuario_id:uid,novo_role:novoRole,barbeiro_id:novoBarbeiroId||null,unidade_id:novaUnidadeId||null})});
    setSaving(false); setPromoTarget(null); setNovoRole('barbeiro'); setNovoBarbeiroId(''); setNovaUnidadeId(''); loadAdmin();
  }
  async function banir(uid:string) {
    if (!banMotivo.trim()) { alert('Informe o motivo'); return; }
    setSaving(true);
    await fetch('/api/usuarios',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'banir',usuario_id:uid,motivo:banMotivo})});
    setSaving(false); setBanTarget(null); setBanMotivo(''); loadAdmin();
  }
  async function desbanir(uid:string) {
    if (!confirm('Desbanir?')) return;
    await fetch('/api/usuarios',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'desbanir',usuario_id:uid})});
    loadAdmin();
  }
  async function salvarManutencao(ativo:boolean, mensagem:string) {
    setMaintSaving(true);
    const res=await fetch('/api/manutencao',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ativo,mensagem})});
    const d=await res.json(); setMaintSaving(false);
    if (res.ok) { setMaintenance(d.maintenance); setMaintSaved(true); setTimeout(()=>setMaintSaved(false),2500); }
  }
  async function salvarBarbeiro() {
    setBError(''); setBSaving(true);
    try {
      const esp=bEsp.split(',').map(s=>s.trim()).filter(Boolean);
      if (bEditId) {
        await fetch('/api/barbeiros',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'editar',barbeiro_id:bEditId,nome:bNome,especialidades:esp,unidades:bUnidades})});
        if (bFotoFile) { const form=new FormData(); form.append('barbeiro_id',bEditId); form.append('foto',bFotoFile); await fetch('/api/barbeiros',{method:'POST',body:form}); }
      } else {
        const res=await fetch('/api/barbeiros',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'criar',nome:bNome,especialidades:esp,unidades:bUnidades})});
        const d=await res.json();
        if (bFotoFile&&d.barbeiro?.id) { const form=new FormData(); form.append('barbeiro_id',d.barbeiro.id); form.append('foto',bFotoFile); await fetch('/api/barbeiros',{method:'POST',body:form}); }
      }
      setBFormOpen(false); setBEditId(null); setBNome(''); setBEsp(''); setBUnidades([]); setBFotoFile(null); setBFotoPreview(null);
      loadAdmin(); onRefresh();
    } catch { setBError('Erro ao salvar'); } finally { setBSaving(false); }
  }
  async function salvarLoja() {
    setStoreError(''); setStoreSaving(true);
    try {
      const res=await fetch('/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(storeConfig)});
      const d=await res.json(); if (!res.ok) { setStoreError(d.error||'Erro'); return; }
      setStoreSaved(true); setTimeout(()=>setStoreSaved(false),2500); if (d.config) setStoreConfig(d.config); onRefresh();
    } catch { setStoreError('Falha de conexão.'); } finally { setStoreSaving(false); }
  }
  const updateU=(idx:number,f:string,v:unknown)=>{ setStoreConfig(p=>{ const u=[...p.unidades]; u[idx]={...u[idx],[f]:v}; return {...p,unidades:u}; }); };
  const updateS=(idx:number,f:string,v:unknown)=>{ setStoreConfig(p=>{ const s=[...p.servicos]; s[idx]={...s[idx],[f]:v}; return {...p,servicos:s}; }); };

  const rolesDisponiveis:UserRole[] = isDono?['cliente','barbeiro','gerente','dono']:['cliente','barbeiro','gerente'];
  const statusBadge:Record<string,string>={confirmado:'badge-green',pendente:'badge-yellow',cancelado:'badge-red'};

  return (
    <div>
      <div className="anim-up" style={{ marginBottom:28 }}>
        <div className="rasta-bar" style={{ width:40, borderRadius:2, marginBottom:16 }}/>
        <p style={{ fontSize:'0.72rem', color:ROLE_COLOR[session.role], textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:4 }}>{ROLE_LABEL[session.role]}</p>
        <h1 style={{ fontFamily:'var(--font-display)', fontSize:'clamp(2rem,6vw,3rem)' }}>GERÊNCIA</h1>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:24 }}>
        {[{label:'Usuários',valor:usuarios.length,color:'var(--green)'},{label:'Agendamentos',valor:agendamentos.length,color:'var(--yellow)'},{label:'Pendentes',valor:agendamentos.filter(a=>a.status==='pendente').length,color:'var(--red)'}].map(s=>(
          <div key={s.label} className="card" style={{ padding:'16px 14px', textAlign:'center' }}>
            <p style={{ fontFamily:'var(--font-display)', fontSize:'2rem', color:s.color, lineHeight:1 }}>{s.valor}</p>
            <p style={{ fontSize:'0.65rem', color:'var(--text-faint)', textTransform:'uppercase', letterSpacing:'0.08em', marginTop:4 }}>{s.label}</p>
          </div>
        ))}
      </div>

      <div className="tab-bar" style={{ marginBottom:20, flexWrap:'wrap' }}>
        <button className={'tab'+(activeTab==='usuarios'?' active':'')} onClick={()=>setActiveTab('usuarios')}>Usuários</button>
        <button className={'tab'+(activeTab==='barbeiros'?' active':'')} onClick={()=>setActiveTab('barbeiros')}>Barbeiros</button>
        {isDono&&<button className={'tab'+(activeTab==='loja'?' active':'')} onClick={()=>setActiveTab('loja')}>Loja</button>}
        {isDono&&<button className={'tab'+(activeTab==='manutencao'?' active':'')} onClick={()=>setActiveTab('manutencao')} style={{ color:maintenance?.ativo?'var(--red)':undefined }}>Manutenção</button>}
      </div>

      {loading?<div style={{ textAlign:'center', padding:40 }}><span className="spinner spinner-lg"/></div>
      :activeTab==='usuarios'?(
        <div>
          <input className="input" placeholder="Buscar por nome, @ ou e-mail..." value={userSearch} onChange={e=>setUserSearch(e.target.value)} style={{ marginBottom:12 }}/>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {usuarios.filter(u=>{ if (!userSearch) return true; const q=userSearch.toLowerCase(); return u.nome.toLowerCase().includes(q)||u.email.toLowerCase().includes(q)||(u.username||'').toLowerCase().includes(q); }).map(u=>{
              const isMe=u.id===session.id;
              const podeMexer=canDo(session.role,'promover')&&!isMe;
              const lvlAlvo={cliente:0,barbeiro:1,gerente:2,dono:3}[u.role as UserRole]??0;
              const lvlMeu={cliente:0,barbeiro:1,gerente:2,dono:3}[session.role]??0;
              const bloqueado=!isMe&&lvlAlvo>=lvlMeu&&session.role!=='dono';
              return (
                <div key={u.id} className="card" style={{ padding:'16px 18px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
                    <div style={{ display:'flex', gap:12, flex:1 }}>
                      <Avatar src={u.foto_url} nome={u.nome} size={40} accent={ROLE_COLOR[u.role as UserRole]}/>
                      <div>
                        <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center', marginBottom:2 }}>
                          <span style={{ fontWeight:700, fontSize:'0.9rem' }}>{u.nome}</span>
                          {u.username&&<span style={{ fontFamily:'var(--font-mono)', fontSize:'0.72rem', color:'var(--green)' }}>@{u.username}</span>}
                          <span className="badge" style={{ color:ROLE_COLOR[u.role as UserRole], borderColor:ROLE_COLOR[u.role as UserRole]+'44', background:ROLE_COLOR[u.role as UserRole]+'11' }}>{ROLE_LABEL[u.role as UserRole]}</span>
                          {isMe&&<span className="badge badge-gray">Você</span>}
                          {(u as any).banido&&<span className="badge badge-red">Banido</span>}
                          {u.barbeiro_id&&<span className="badge badge-green">{barbeiros.find(b=>b.id===u.barbeiro_id)?.nome||u.barbeiro_id}</span>}
                        </div>
                        <p style={{ fontFamily:'var(--font-mono)', fontSize:'0.7rem', color:'var(--text-faint)' }}>{u.email}</p>
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                      {podeMexer&&!bloqueado&&<button className="btn btn-ghost" style={{ padding:'4px 10px', fontSize:'0.75rem' }} onClick={()=>{ setPromoTarget(u.id===promoTarget?null:u.id); setBanTarget(null); }}>{promoTarget===u.id?'Cancelar':'Cargo'}</button>}
                      {!isMe&&u.role!=='dono'&&canDo(session.role,'promover')&&((u as any).banido
                        ?<button className="btn btn-green" style={{ padding:'4px 10px', fontSize:'0.75rem' }} onClick={()=>desbanir(u.id)}>Desbanir</button>
                        :<button className="btn btn-danger" style={{ padding:'4px 10px', fontSize:'0.75rem' }} onClick={()=>{ setBanTarget(u.id===banTarget?null:u.id); setPromoTarget(null); setBanMotivo(''); }}>Banir</button>
                      )}
                    </div>
                  </div>
                  {banTarget===u.id&&(
                    <div style={{ marginTop:14, paddingTop:14, borderTop:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:10 }}>
                      <p style={{ fontSize:'0.72rem', color:'var(--red)', textTransform:'uppercase', letterSpacing:'0.1em' }}>Banir usuário</p>
                      <input className="input" placeholder="Motivo..." value={banMotivo} onChange={e=>setBanMotivo(e.target.value)}/>
                      <div style={{ display:'flex', gap:8 }}>
                        <button className="btn btn-danger" style={{ flex:1 }} onClick={()=>banir(u.id)} disabled={saving}>{saving?<><span className="spinner"/>Banindo...</>:'Confirmar'}</button>
                        <button className="btn btn-outline" onClick={()=>{ setBanTarget(null); setBanMotivo(''); }}>Cancelar</button>
                      </div>
                    </div>
                  )}
                  {promoTarget===u.id&&(
                    <div style={{ marginTop:14, paddingTop:14, borderTop:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:10 }}>
                      <div>
                        <label style={{ fontSize:'0.72rem', color:'var(--text-faint)', display:'block', marginBottom:4 }}>Novo cargo</label>
                        <select className="input" value={novoRole} onChange={e=>setNovoRole(e.target.value as UserRole)}>
                          {rolesDisponiveis.map(r=><option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                        </select>
                      </div>
                      {novoRole==='barbeiro'&&<div><label style={{ fontSize:'0.72rem', color:'var(--text-faint)', display:'block', marginBottom:4 }}>Barbeiro vinculado</label><select className="input" value={novoBarbeiroId} onChange={e=>setNovoBarbeiroId(e.target.value)}><option value="">Nenhum</option>{barbeiros.map(b=><option key={b.id} value={b.id}>{b.nome}</option>)}</select></div>}
                      {(novoRole==='barbeiro'||novoRole==='gerente')&&<div><label style={{ fontSize:'0.72rem', color:'var(--text-faint)', display:'block', marginBottom:4 }}>Unidade</label><select className="input" value={novaUnidadeId} onChange={e=>setNovaUnidadeId(e.target.value)}><option value="">Nenhuma</option>{storeConfig.unidades.map(un=><option key={un.id} value={un.id}>{un.nome}</option>)}</select></div>}
                      <button className="btn btn-green" onClick={()=>promover(u.id)} disabled={saving}>{saving?<><span className="spinner"/>Salvando...</>:'Confirmar alteração'}</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ):activeTab==='barbeiros'?(
        <div>
          <button className="btn btn-green" style={{ width:'100%', marginBottom:16 }} onClick={()=>{ setBFormOpen(true); setBEditId(null); setBNome(''); setBEsp(''); setBUnidades([]); setBFotoFile(null); setBFotoPreview(null); }}>+ Novo Barbeiro</button>
          {bFormOpen&&(
            <div className="card" style={{ padding:20, marginBottom:16 }}>
              <p style={{ fontSize:'0.72rem', color:'var(--text-faint)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:16 }}>{bEditId?'Editar':'Novo barbeiro'}</p>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <input className="input" placeholder="Nome" value={bNome} onChange={e=>setBNome(e.target.value)}/>
                <input className="input" placeholder="Especialidades (sep. por vírgula)" value={bEsp} onChange={e=>setBEsp(e.target.value)}/>
                <div>
                  <label style={{ fontSize:'0.78rem', color:'var(--text-faint)', display:'block', marginBottom:6 }}>Unidades</label>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                    {storeConfig.unidades.map(u=>(
                      <label key={u.id} style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:'0.82rem' }}>
                        <input type="checkbox" checked={bUnidades.includes(u.id)} onChange={e=>setBUnidades(p=>e.target.checked?[...p,u.id]:p.filter(x=>x!==u.id))} style={{ accentColor:'var(--green)' }}/>
                        {u.nome.replace(storeConfig.nome_loja+' ','')}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize:'0.78rem', color:'var(--text-faint)', display:'block', marginBottom:6 }}>Foto</label>
                  {bFotoPreview&&<img src={bFotoPreview} alt="preview" style={{ width:80, height:80, borderRadius:'50%', objectFit:'cover', marginBottom:8 }}/>}
                  <input ref={fotoInputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={e=>{ const f=e.target.files?.[0]; if(f){setBFotoFile(f);setBFotoPreview(URL.createObjectURL(f));} }}/>
                  <button className="btn btn-outline" style={{ width:'100%' }} onClick={()=>fotoInputRef.current?.click()}>{bFotoPreview?'Trocar foto':'Adicionar foto'}</button>
                </div>
                {bError&&<p style={{ color:'var(--red)', fontSize:'0.8rem' }}>{bError}</p>}
                <div style={{ display:'flex', gap:8 }}>
                  <button className="btn btn-green" style={{ flex:1 }} onClick={salvarBarbeiro} disabled={bSaving}>{bSaving?<><span className="spinner"/>Salvando...</>:'Salvar'}</button>
                  <button className="btn btn-outline" onClick={()=>{ setBFormOpen(false); setBEditId(null); }}>Cancelar</button>
                </div>
              </div>
            </div>
          )}
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {barbeiros.map(b=>(
              <div key={b.id} className="card" style={{ padding:'16px 18px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                  <Avatar src={b.photo_url} nome={b.nome} size={48}/>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center', marginBottom:4 }}>
                      <span style={{ fontWeight:700 }}>{b.nome}</span>
                      {!b.ativo&&<span className="badge badge-red">Inativo</span>}
                    </div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>{b.especialidades.map(e=><span key={e} className="badge badge-gray">{e}</span>)}</div>
                    <p style={{ fontSize:'0.7rem', color:'var(--text-faint)', marginTop:4 }}>{b.unidades.map(uid=>storeConfig.unidades.find(u=>u.id===uid)?.bairro||uid).join(', ')}</p>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    <button className="btn btn-outline" style={{ padding:'4px 10px', fontSize:'0.72rem' }} onClick={()=>{ setBFormOpen(true); setBEditId(b.id); setBNome(b.nome); setBEsp(b.especialidades.join(', ')); setBUnidades([...b.unidades]); setBFotoPreview(b.photo_url||null); }}>Editar</button>
                    <button className="btn btn-danger" style={{ padding:'4px 10px', fontSize:'0.72rem' }} onClick={async()=>{ if (!confirm(b.ativo?'Desativar?':'Reativar?')) return; await fetch('/api/barbeiros',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'editar',barbeiro_id:b.id,ativo:!b.ativo})}); loadAdmin(); onRefresh(); }}>{b.ativo?'Desativar':'Reativar'}</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ):activeTab==='manutencao'&&isDono?(
        <div>
          <div className="card" style={{ padding:20, marginBottom:16, border:maintenance?.ativo?'1px solid rgba(255,23,68,0.4)':'1px solid var(--border)' }}>
            <p style={{ fontSize:'0.68rem', textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--text-faint)', marginBottom:16 }}>Modo Manutenção</p>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <div>
                <p style={{ fontWeight:700, fontSize:'0.95rem' }}>{maintenance?.ativo?'Ativo — Site bloqueado':'Desativado — Site normal'}</p>
                <p style={{ fontSize:'0.78rem', color:'var(--text-faint)', marginTop:3 }}>Apenas o dono acessa durante manutenção</p>
              </div>
              <button onClick={()=>salvarManutencao(!maintenance?.ativo,maintenance?.mensagem||'Site em manutenção. Voltamos em breve.')} disabled={maintSaving} style={{ padding:'10px 20px', borderRadius:10, fontWeight:700, fontSize:'0.82rem', cursor:'pointer', border:'none', background:maintenance?.ativo?'var(--green)':'var(--red)', color:'#fff', minWidth:100 }}>
                {maintSaving?'...':maintenance?.ativo?'Desativar':'Ativar'}
              </button>
            </div>
            <textarea className="input" rows={3} value={maintenance?.mensagem||''} onChange={e=>setMaintenance(prev=>prev?{...prev,mensagem:e.target.value}:{ativo:false,mensagem:e.target.value})} style={{ resize:'vertical', fontFamily:'var(--font-ui)', marginBottom:12 }}/>
            {maintSaved&&<p style={{ color:'var(--green)', fontSize:'0.8rem', marginBottom:10 }}>Salvo</p>}
            <button className="btn btn-outline" style={{ width:'100%' }} onClick={()=>salvarManutencao(maintenance?.ativo??false,maintenance?.mensagem||'')}>
              {maintSaving?<><span className="spinner"/>Salvando...</>:'Salvar mensagem'}
            </button>
          </div>
        </div>
      ):activeTab==='loja'&&isDono?(
        <div>
          <div className="card" style={{ padding:20, marginBottom:16 }}>
            <p style={{ fontSize:'0.68rem', textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--text-faint)', marginBottom:16 }}>Identidade da loja</p>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div><label style={{ fontSize:'0.78rem', color:'var(--text-faint)', display:'block', marginBottom:4 }}>Nome</label><input className="input" value={storeConfig.nome_loja} onChange={e=>setStoreConfig(p=>({...p,nome_loja:e.target.value}))}/></div>
              <div><label style={{ fontSize:'0.78rem', color:'var(--text-faint)', display:'block', marginBottom:4 }}>Slogan</label><input className="input" value={storeConfig.slogan} onChange={e=>setStoreConfig(p=>({...p,slogan:e.target.value}))}/></div>
              <div>
                <label style={{ fontSize:'0.78rem', color:'var(--text-faint)', display:'block', marginBottom:8 }}>Cor principal</label>
                <div style={{ display:'flex', gap:8 }}>
                  {(['green','yellow','red','purple','blue'] as const).map(cor=>(
                    <button key={cor} onClick={()=>setStoreConfig(p=>({...p,tema_cor:cor}))} style={{ width:36, height:36, borderRadius:'50%', background:TEMA_COR_MAP[cor], border:storeConfig.tema_cor===cor?'3px solid white':'3px solid transparent', cursor:'pointer' }}/>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {/* Unidades */}
          <div className="card" style={{ padding:20, marginBottom:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <p style={{ fontSize:'0.68rem', textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--text-faint)' }}>Unidades</p>
              <button className="btn btn-outline" style={{ padding:'6px 14px', fontSize:'0.78rem' }} onClick={()=>{ const id='u'+Date.now(); setStoreConfig(p=>({...p,unidades:[...p.unidades,{id,nome:p.nome_loja+' Nova Unidade',endereco:'',bairro:'',cidade:'',horario:{abertura:8,fechamento:20},dias_semana:[1,2,3,4,5,6],barbeiros:[],ativo:true}]})); }}>+ Adicionar</button>
            </div>
            {storeConfig.unidades.map((u,idx)=>(
              <div key={u.id} style={{ borderBottom:idx<storeConfig.unidades.length-1?'1px solid var(--border)':'none', paddingBottom:16, marginBottom:16 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                  <input className="input" value={u.nome} onChange={e=>updateU(idx,'nome',e.target.value)} style={{ fontWeight:700 }}/>
                  <button onClick={()=>updateU(idx,'ativo',!u.ativo)} className={'btn '+(u.ativo?'btn-outline':'btn-green')} style={{ padding:'6px 12px', fontSize:'0.72rem', flexShrink:0 }}>{u.ativo?'Ativo':'Inativo'}</button>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
                  <input className="input" placeholder="Endereço" value={u.endereco} onChange={e=>updateU(idx,'endereco',e.target.value)} style={{ fontSize:'0.82rem' }}/>
                  <input className="input" placeholder="Bairro" value={u.bairro} onChange={e=>updateU(idx,'bairro',e.target.value)} style={{ fontSize:'0.82rem' }}/>
                  <input className="input" placeholder="Cidade" value={u.cidade} onChange={e=>updateU(idx,'cidade',e.target.value)} style={{ fontSize:'0.82rem' }}/>
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginBottom:8 }}>
                  <span style={{ fontSize:'0.78rem', color:'var(--text-faint)' }}>Abre:</span>
                  <input type="number" className="input" value={u.horario.abertura} min={0} max={23} onChange={e=>updateU(idx,'horario',{...u.horario,abertura:+e.target.value})} style={{ width:70 }}/>
                  <span style={{ fontSize:'0.78rem', color:'var(--text-faint)' }}>Fecha:</span>
                  <input type="number" className="input" value={u.horario.fechamento} min={0} max={24} onChange={e=>updateU(idx,'horario',{...u.horario,fechamento:+e.target.value})} style={{ width:70 }}/>
                </div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {DIAS_NOMES.map((dia,dIdx)=>(
                    <label key={dIdx} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, cursor:'pointer' }}>
                      <input type="checkbox" checked={u.dias_semana.includes(dIdx)} onChange={e=>{ const dias=e.target.checked?[...u.dias_semana,dIdx].sort():u.dias_semana.filter(d=>d!==dIdx); updateU(idx,'dias_semana',dias); }} style={{ accentColor:'var(--green)' }}/>
                      <span style={{ fontSize:'0.65rem', color:u.dias_semana.includes(dIdx)?'var(--green)':'var(--text-faint)' }}>{dia}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {/* Serviços */}
          <div className="card" style={{ padding:20, marginBottom:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <p style={{ fontSize:'0.68rem', textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--text-faint)' }}>Serviços</p>
              <button className="btn btn-outline" style={{ padding:'6px 14px', fontSize:'0.78rem' }} onClick={()=>{ const id='s'+Date.now(); setStoreConfig(p=>({...p,servicos:[...p.servicos,{id,nome:'Novo Serviço',valor:30,duracao:30,descricao:'',ativo:true}]})); }}>+ Adicionar</button>
            </div>
            {storeConfig.servicos.map((s,idx)=>(
              <div key={s.id} style={{ borderBottom:idx<storeConfig.servicos.length-1?'1px solid var(--border)':'none', paddingBottom:14, marginBottom:14 }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8, alignItems:'center', marginBottom:8 }}>
                  <input className="input" value={s.nome} onChange={e=>updateS(idx,'nome',e.target.value)} style={{ fontWeight:700 }}/>
                  <button onClick={()=>updateS(idx,'ativo',!s.ativo)} className={'btn '+(s.ativo?'btn-outline':'btn-green')} style={{ padding:'6px 12px', fontSize:'0.72rem' }}>{s.ativo?'Ativo':'Inativo'}</button>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
                  <div><label style={{ fontSize:'0.72rem', color:'var(--text-faint)', display:'block', marginBottom:3 }}>Valor (R$)</label><input type="number" className="input" value={s.valor} min={0} onChange={e=>updateS(idx,'valor',+e.target.value)}/></div>
                  <div><label style={{ fontSize:'0.72rem', color:'var(--text-faint)', display:'block', marginBottom:3 }}>Duração (min)</label><input type="number" className="input" value={s.duracao} min={10} step={5} onChange={e=>updateS(idx,'duracao',+e.target.value)}/></div>
                </div>
                <input className="input" placeholder="Descrição" value={s.descricao} onChange={e=>updateS(idx,'descricao',e.target.value)} style={{ fontSize:'0.82rem' }}/>
              </div>
            ))}
          </div>
          {storeError&&<p style={{ color:'var(--red)', fontSize:'0.8rem', marginBottom:10 }}>{storeError}</p>}
          {storeSaved&&<p style={{ color:'var(--green)', fontSize:'0.8rem', marginBottom:10 }}>Configurações salvas</p>}
          <button className="btn btn-green" style={{ width:'100%' }} onClick={salvarLoja} disabled={storeSaving}>
            {storeSaving?<><span className="spinner"/>Salvando...</>:'Salvar todas as configurações'}
          </button>
        </div>
      ):null}
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab]               = useState<AppTab>('dashboard');
  const [session, setSession]       = useState<Session|null>(null);
  const [usuario, setUsuario]       = useState<Usuario|null>(null);
  const [stats, setStats]           = useState<Stats[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [adminAgs, setAdminAgs]     = useState<Agendamento[]>([]);
  const [barbeiros, setBarbeiros]   = useState<BarbeiroDB[]>([]);
  const [storeConfig, setStoreConfig] = useState<StoreConfig|null>(null);
  const [loading, setLoading]       = useState(true);
  const [agendarOpen, setAgendarOpen] = useState(false);
  const [authed, setAuthed]         = useState(false);
  const [maintenanceMsg, setMaintenanceMsg] = useState<string|null>(null);
  const [perfilAberto, setPerfilAberto] = useState<BarbeiroDB|null>(null);

  const loadAll = useCallback(async () => {
    const [sessRes, userRes, agRes, statsRes, barbRes, configRes] = await Promise.all([
      fetch('/api/auth'), fetch('/api/usuarios'), fetch('/api/agendamentos?action=meus'),
      fetch('/api/agendamentos?action=stats'), fetch('/api/barbeiros'), fetch('/api/config'),
    ]);
    const sessData = await sessRes.json();
    if (sessData.banned) { alert('Conta banida. Motivo: '+(sessData.motivo||'Violação dos termos')); setLoading(false); return; }
    if (sessData.maintenance) { setMaintenanceMsg(sessData.mensagem||'Site em manutenção.'); setLoading(false); return; }
    if (sessData.session) { setSession(sessData.session); setAuthed(true); }
    if (userRes.ok) { const d=await userRes.json(); setUsuario(d.usuario||null); }
    if (agRes.ok)   { const d=await agRes.json();   setAgendamentos(d.agendamentos||[]); }
    if (statsRes.ok){ const d=await statsRes.json(); setStats(d.stats||[]); }
    if (barbRes.ok) { const d=await barbRes.json();  setBarbeiros(d.barbeiros||[]); }
    if (configRes.ok){ const d=await configRes.json(); setStoreConfig(d.config||null); }
    setLoading(false);
  },[]);

  const loadAdminAgs = useCallback(async (role: UserRole) => {
    if (!canDo(role,'ver_todos_ag')) return;
    const res = await fetch('/api/agendamentos?action=admin');
    if (res.ok) { const d=await res.json(); setAdminAgs(d.agendamentos||[]); }
  },[]);

  useEffect(()=>{ loadAll(); },[loadAll]);
  useEffect(()=>{ if (session?.role) loadAdminAgs(session.role); },[session?.role, loadAdminAgs]);

  async function logout() {
    await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});
    setSession(null); setAuthed(false); setUsuario(null); setAgendamentos([]); setAdminAgs([]);
  }

  async function handleRefresh() {
    await loadAll();
    if (session?.role) await loadAdminAgs(session.role);
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
      <div className="rasta-bar" style={{ width:80, borderRadius:2 }}/>
      <span className="spinner spinner-lg"/>
    </div>
  );

  if (maintenanceMsg) return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px 20px', textAlign:'center' }}>
      <div className="rasta-bar" style={{ width:64, borderRadius:2, marginBottom:32 }}/>
      <p style={{ fontFamily:'var(--font-display)', fontSize:'clamp(2rem,8vw,4rem)', color:'var(--yellow)', marginBottom:12 }}>MANUTENÇÃO</p>
      <p style={{ color:'var(--text-dim)', fontSize:'0.95rem', maxWidth:360, lineHeight:1.7 }}>{maintenanceMsg}</p>
      <button className="btn btn-outline" style={{ marginTop:28 }} onClick={loadAll}>Tentar novamente</button>
    </div>
  );

  if (!authed||!session) return <Auth onSuccess={loadAll}/>;
  if (!storeConfig) return <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}><span className="spinner spinner-lg"/></div>;

  const tabs = getTabsForRole(session.role);
  const activeTab: AppTab = tabs.includes(tab) ? tab : tabs[0];

  return (
    <div style={{ minHeight:'100vh' }}>
      <div style={{ position:'fixed', inset:0, background:'radial-gradient(ellipse 120% 60% at 50% -10%, rgba(0,200,83,0.06), transparent)', pointerEvents:'none', zIndex:0 }}/>
      <div className="rasta-bar" style={{ position:'fixed', top:0, left:0, right:0, zIndex:50 }}/>

      <div style={{ maxWidth:680, margin:'0 auto', padding:'40px 16px 120px', position:'relative', zIndex:1 }}>
        {activeTab==='dashboard'&&(
          <Dashboard session={session} usuario={usuario} stats={stats} agendamentos={agendamentos}
            barbeiros={barbeiros} storeConfig={storeConfig} onAgendar={()=>setAgendarOpen(true)}
            onRefresh={handleRefresh} onVerPerfil={b=>setPerfilAberto(b)}/>
        )}
        {activeTab==='horarios'&&(
          <HorariosTab session={session} usuario={usuario} barbeiros={barbeiros}
            agendamentos={adminAgs} storeConfig={storeConfig} onRefresh={handleRefresh}/>
        )}
        {activeTab==='perfil'&&(
          <PerfilBarbeiroTab session={session} usuario={usuario}
            agendamentos={adminAgs} onRefresh={handleRefresh}/>
        )}
        {activeTab==='configuracoes'&&(
          <Configuracoes session={session} usuario={usuario} barbeiros={barbeiros}
            storeConfig={storeConfig} onUpdate={handleRefresh} onLogout={logout}/>
        )}
        {activeTab==='gerencia'&&canDo(session.role,'acesso_admin')&&(
          <GerenciaPanel session={session} barbeiros={barbeiros}
            storeConfig={storeConfig} onRefresh={handleRefresh}/>
        )}
      </div>

      {/* Bottom nav */}
      <div style={{ position:'fixed', bottom:0, left:0, right:0, padding:'12px 16px', background:'rgba(5,5,5,0.95)', backdropFilter:'blur(20px)', borderTop:'1px solid var(--border)', zIndex:50 }}>
        <div className="rasta-bar" style={{ position:'absolute', top:0, left:0, right:0, opacity:0.5 }}/>
        <div style={{ maxWidth:480, margin:'0 auto', display:'flex', gap:4, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:4 }}>
          {tabs.map(t=>(
            <button key={t} onClick={()=>setTab(t)} className={'tab'+(activeTab===t?' active':'')}
              style={{ flex:1, position:'relative', fontSize:tabs.length>3?'0.7rem':undefined }}>
              {TAB_LABEL[t]}
              {t==='gerencia'&&session.role==='dono'&&(
                <span style={{ position:'absolute', top:4, right:6, width:6, height:6, borderRadius:'50%', background:'var(--red)', boxShadow:'0 0 6px var(--red)' }}/>
              )}
            </button>
          ))}
        </div>
      </div>

      {agendarOpen&&(
        <AgendarModal session={session} stats={stats} barbeiros={barbeiros}
          storeConfig={storeConfig} onClose={()=>setAgendarOpen(false)} onSuccess={handleRefresh}/>
      )}

      {perfilAberto&&(
        <PerfilBarbeiroModal barbeiro={perfilAberto} agendamentos={agendamentos}
          onClose={()=>setPerfilAberto(null)}
          isProprietario={session.role==='barbeiro'&&usuario?.barbeiro_id===perfilAberto.id}/>
      )}
    </div>
  );
}
