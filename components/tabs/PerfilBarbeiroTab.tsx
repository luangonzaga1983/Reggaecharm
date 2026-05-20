'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import type { Session, Usuario, Agendamento, BarbeiroDB, FotoBarbeiro } from '@/types';
import Avatar from '@/components/ui/Avatar';

interface Props {
  session: Session; usuario: Usuario | null; agendamentos: Agendamento[]; onRefresh: () => void;
}

export default function PerfilBarbeiroTab({ usuario, agendamentos, onRefresh }: Props) {
  const [barbeiro, setBarbeiro]             = useState<BarbeiroDB | null>(null);
  const [loading, setLoading]               = useState(true);
  const [fotoPreview, setFotoPreview]       = useState<string | null>(null);
  const [fotoFile, setFotoFile]             = useState<File | null>(null);
  const [savingFoto, setSavingFoto]         = useState(false);
  const [fotos, setFotos]                   = useState<FotoBarbeiro[]>([]);
  const [fotosLoading, setFotosLoading]     = useState(false);
  const [fotoAberta, setFotoAberta]         = useState<FotoBarbeiro | null>(null);
  const [showUpload, setShowUpload]         = useState(false);
  const [descricao, setDescricao]           = useState('');
  const [novaFotoFile, setNovaFotoFile]     = useState<File | null>(null);
  const [novaFotoPreview, setNovaFotoPreview] = useState<string | null>(null);
  const [uploading, setUploading]           = useState(false);
  const [uploadError, setUploadError]       = useState('');
  const fotoPerfilRef = useRef<HTMLInputElement>(null);
  const novaFotoRef   = useRef<HTMLInputElement>(null);

  const carregarBarbeiro = useCallback(async () => {
    if (!usuario?.barbeiro_id) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/barbeiros?id=${usuario.barbeiro_id}`);
      if (res.ok) { const d = await res.json(); setBarbeiro(d.barbeiro); setFotoPreview(d.barbeiro?.photo_url || null); }
    } finally { setLoading(false); }
  }, [usuario?.barbeiro_id]);

  const carregarFotos = useCallback(async () => {
    if (!usuario?.barbeiro_id) return;
    setFotosLoading(true);
    try {
      const res = await fetch(`/api/barbeiros/fotos?barbeiro_id=${usuario.barbeiro_id}`);
      if (res.ok) { const d = await res.json(); setFotos(d.fotos || []); }
    } finally { setFotosLoading(false); }
  }, [usuario?.barbeiro_id]);

  useEffect(() => { carregarBarbeiro(); carregarFotos(); }, [carregarBarbeiro, carregarFotos]);

  async function salvarFotoPerfil() {
    if (!fotoFile || !barbeiro) return;
    setSavingFoto(true);
    try {
      const form = new FormData();
      form.append('barbeiro_id', barbeiro.id);
      form.append('foto', fotoFile);
      await fetch('/api/barbeiros', { method: 'POST', body: form });
      setFotoFile(null); await carregarBarbeiro(); onRefresh();
    } finally { setSavingFoto(false); }
  }

  async function postarFoto() {
    if (!novaFotoFile || !barbeiro) return;
    setUploading(true); setUploadError('');
    try {
      const form = new FormData();
      form.append('barbeiro_id', barbeiro.id);
      form.append('descricao', descricao);
      form.append('foto', novaFotoFile);
      const res = await fetch('/api/barbeiros/fotos', { method: 'POST', body: form });
      const d = await res.json();
      if (!res.ok) { setUploadError(d.error || 'Erro'); return; }
      setNovaFotoFile(null); setNovaFotoPreview(null); setDescricao(''); setShowUpload(false);
      await carregarFotos();
    } finally { setUploading(false); }
  }

  async function excluirFoto(foto: FotoBarbeiro) {
    if (!foto._messageId) return;
    await fetch('/api/barbeiros/fotos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'deletar', message_id: foto._messageId, barbeiro_id: barbeiro?.id }) });
    setFotoAberta(null); await carregarFotos();
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><span className="spinner spinner-lg" /></div>;

  if (!usuario?.barbeiro_id || !barbeiro) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-faint)' }}>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', marginBottom: 12 }}>SEM VÍNCULO</p>
      <p style={{ fontSize: '0.88rem' }}>Sua conta não está vinculada a um perfil de barbeiro.</p>
      <p style={{ fontSize: '0.78rem', marginTop: 8 }}>Peça ao gerente para vincular sua conta.</p>
    </div>
  );

  const avs = agendamentos.filter(a => a.barbeiro_id === barbeiro.id && a.avaliacao);
  const mediaEstrelas = avs.length ? avs.reduce((s, a) => s + (a.avaliacao || 0), 0) / avs.length : 0;
  const totalCortes = agendamentos.filter(a => a.barbeiro_id === barbeiro.id && a.status === 'confirmado').length;

  return (
    <div>
      <div className="anim-up" style={{ marginBottom: 28 }}>
        <p style={{ fontSize: '0.72rem', color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Barbeiro</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem,6vw,3.5rem)' }}>MEU PERFIL</h1>
      </div>

      <div className="card anim-up" style={{ padding: '20px 22px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', marginBottom: 20 }}>
          <div style={{ position: 'relative' }}>
            <Avatar src={fotoPreview} nome={barbeiro.nome} size={88} accent="var(--green)" />
            <div style={{ position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, background: 'var(--green)', borderRadius: '50%', border: '2px solid var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem' }}>✂</div>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 800, fontSize: '1.2rem', marginBottom: 2 }}>{barbeiro.nome}</p>
            <p style={{ fontSize: '0.72rem', color: 'var(--green)', fontFamily: 'var(--font-mono)', marginBottom: 10 }}>barbeiro profissional</p>
            <div style={{ display: 'flex', gap: 24, marginBottom: 10 }}>
              {[['fotos', fotos.length], ['cortes', totalCortes], ['★ média', mediaEstrelas ? mediaEstrelas.toFixed(1) : '—']].map(([l, v]) => (
                <div key={l as string} style={{ textAlign: 'center' }}>
                  <p style={{ fontWeight: 800, fontSize: '1rem', lineHeight: 1 }}>{v}</p>
                  <p style={{ fontSize: '0.65rem', color: 'var(--text-faint)' }}>{l}</p>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{barbeiro.especialidades.map(e => <span key={e} className="badge badge-green" style={{ fontSize: '0.65rem' }}>{e}</span>)}</div>
          </div>
        </div>
        <p style={{ fontSize: '0.68rem', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Foto de capa</p>
        <input ref={fotoPerfilRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) { setFotoFile(f); setFotoPreview(URL.createObjectURL(f)); } }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => fotoPerfilRef.current?.click()}>{barbeiro.photo_url ? 'Trocar foto' : 'Adicionar foto'}</button>
          {fotoFile && (
            <button className="btn btn-green" onClick={salvarFotoPerfil} disabled={savingFoto}>
              {savingFoto ? <><span className="spinner" />Salvando...</> : 'Salvar'}
            </button>
          )}
        </div>
      </div>

      <div className="card anim-up" style={{ padding: '20px 22px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <p style={{ fontSize: '0.68rem', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Galeria ({fotos.length})</p>
          <button className="btn btn-outline" style={{ fontSize: '0.78rem', padding: '6px 14px' }} onClick={() => setShowUpload(p => !p)}>
            {showUpload ? 'Cancelar' : '+ Postar foto'}
          </button>
        </div>

        {showUpload && (
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <input ref={novaFotoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) { setNovaFotoFile(f); setNovaFotoPreview(URL.createObjectURL(f)); } }} />
            {novaFotoPreview
              ? <img src={novaFotoPreview} alt="preview" style={{ width: '100%', height: 200, objectFit: 'cover', borderRadius: 10, marginBottom: 10 }} />
              : <button className="btn btn-outline" style={{ width: '100%', marginBottom: 10, padding: '32px 0' }} onClick={() => novaFotoRef.current?.click()}>+ Escolher foto</button>
            }
            <input className="input" placeholder="Legenda..." value={descricao} onChange={e => setDescricao(e.target.value)} style={{ marginBottom: 10 }} />
            {uploadError && <p style={{ color: 'var(--red)', fontSize: '0.78rem', marginBottom: 8 }}>{uploadError}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              {novaFotoPreview && <button className="btn btn-outline" style={{ flex: 1, fontSize: '0.78rem' }} onClick={() => { setNovaFotoPreview(null); setNovaFotoFile(null); }}>Trocar</button>}
              <button className="btn btn-green" style={{ flex: 2 }} onClick={postarFoto} disabled={!novaFotoFile || uploading}>
                {uploading ? <><span className="spinner" />Publicando...</> : 'Publicar'}
              </button>
            </div>
          </div>
        )}

        {fotosLoading
          ? <div style={{ textAlign: 'center', padding: 32 }}><span className="spinner" /></div>
          : fotos.length === 0
            ? <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--text-faint)' }}>
                <p style={{ fontSize: '2rem', marginBottom: 8 }}>✂</p>
                <p style={{ fontSize: '0.88rem' }}>Nenhuma foto publicada ainda</p>
              </div>
            : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 2 }}>
                {fotos.map(foto => (
                  <div key={foto.id} onClick={() => setFotoAberta(foto)} style={{ aspectRatio: '1', cursor: 'pointer', overflow: 'hidden' }}
                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.opacity = '0.8'}
                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.opacity = '1'}>
                    <img src={foto.foto_url || ''} alt={foto.descricao} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ))}
              </div>
        }
      </div>

      {fotoAberta && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setFotoAberta(null)}>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: 480, width: '100%', background: 'var(--surface)', borderRadius: 16, overflow: 'hidden', margin: '0 16px' }}>
            <img src={fotoAberta.foto_url || ''} alt={fotoAberta.descricao} style={{ width: '100%', maxHeight: '60vh', objectFit: 'cover' }} />
            <div style={{ padding: '14px 16px' }}>
              {fotoAberta.descricao && <p style={{ fontSize: '0.88rem', color: 'var(--text-dim)', marginBottom: 4 }}>{fotoAberta.descricao}</p>}
              <p style={{ fontSize: '0.7rem', color: 'var(--text-faint)' }}>{fotoAberta.data}</p>
              <button className="btn btn-danger" style={{ marginTop: 12, fontSize: '0.75rem', padding: '6px 14px' }} onClick={() => excluirFoto(fotoAberta)}>Excluir foto</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
