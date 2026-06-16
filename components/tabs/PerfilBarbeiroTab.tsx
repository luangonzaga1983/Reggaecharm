'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import type { Session, Usuario, Agendamento, BarbeiroDB, FotoBarbeiro } from '@/types';
import Avatar from '@/components/ui/Avatar';

interface Props {
  session: Session; usuario: Usuario | null; agendamentos: Agendamento[]; onRefresh: () => void;
}

export default function PerfilBarbeiroTab({ usuario, agendamentos, onRefresh }: Props) {
  const [barbeiro, setBarbeiro]           = useState<BarbeiroDB | null>(null);
  const [loading, setLoading]             = useState(true);
  const [fotoPreview, setFotoPreview]     = useState<string | null>(null);
  const [fotoFile, setFotoFile]           = useState<File | null>(null);
  const [savingFoto, setSavingFoto]       = useState(false);
  const [fotos, setFotos]                 = useState<FotoBarbeiro[]>([]);
  const [fotosLoading, setFotosLoading]   = useState(false);
  const [fotoAberta, setFotoAberta]       = useState<FotoBarbeiro | null>(null);
  const [showUpload, setShowUpload]       = useState(false);
  const [descricao, setDescricao]         = useState('');
  const [novaFotoFile, setNovaFotoFile]   = useState<File | null>(null);
  const [novaFotoPreview, setNovaFotoPreview] = useState<string | null>(null);
  const [uploading, setUploading]         = useState(false);
  const [uploadError, setUploadError]     = useState('');
  const fotoPerfilRef = useRef<HTMLInputElement>(null);
  const novaFotoRef   = useRef<HTMLInputElement>(null);

  const carregarBarbeiro = useCallback(async () => {
    if (!usuario?.barbeiro_id) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/barbeiros?id=${encodeURIComponent(usuario.barbeiro_id)}`);
      if (res.ok) { const d = await res.json(); setBarbeiro(d.barbeiro); setFotoPreview(d.barbeiro?.photo_url || null); }
    } finally { setLoading(false); }
  }, [usuario?.barbeiro_id]);

  const carregarFotos = useCallback(async () => {
    if (!usuario?.barbeiro_id) return;
    setFotosLoading(true);
    try {
      const res = await fetch(`/api/barbeiros/fotos?barbeiro_id=${encodeURIComponent(usuario.barbeiro_id)}`);
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
      const res = await fetch('/api/barbeiros', { method: 'POST', body: form });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setUploadError(d.error || 'Falha ao enviar foto'); return; }
      setUploadError(''); setFotoFile(null); await carregarBarbeiro(); onRefresh();
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
    if (!confirm('Excluir esta foto?')) return;
    await fetch('/api/barbeiros/fotos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'deletar', message_id: foto._messageId, barbeiro_id: barbeiro?.id }) });
    setFotoAberta(null); await carregarFotos();
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}><span className="spinner spinner-lg" /></div>;

  if (!usuario?.barbeiro_id || !barbeiro) return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-dim)' }}>
      <h2 style={{ fontSize: 16, fontWeight: 500, marginBottom: 6 }}>Sem vínculo</h2>
      <p style={{ fontSize: 13 }}>Sua conta não está vinculada a um perfil de barbeiro.</p>
      <p style={{ fontSize: 12, marginTop: 4, color: 'var(--text-faint)' }}>Peça ao gerente para vincular sua conta.</p>
    </div>
  );

  const avs = agendamentos.filter(a => a.barbeiro_id === barbeiro.id && a.avaliacao);
  const mediaEstrelas = avs.length ? avs.reduce((s, a) => s + (a.avaliacao || 0), 0) / avs.length : 0;
  const totalCortes = agendamentos.filter(a => a.barbeiro_id === barbeiro.id && a.status === 'confirmado').length;

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 12, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Barbeiro</p>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>Meu perfil</h1>
      </header>

      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 14 }}>
          <Avatar src={fotoPreview} nome={barbeiro.nome} size={76} />
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 600, fontSize: 16 }}>{barbeiro.nome}</p>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>Barbeiro profissional</p>
            <div style={{ display: 'flex', gap: 20, marginBottom: 8 }}>
              {[['fotos', fotos.length], ['cortes', totalCortes], ['★ média', mediaEstrelas ? mediaEstrelas.toFixed(1) : '—']].map(([l, v]) => (
                <div key={l as string} style={{ textAlign: 'center' }}>
                  <p style={{ fontWeight: 600, fontSize: 14, lineHeight: 1 }}>{v}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-faint)' }}>{l}</p>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {barbeiro.especialidades.map(e => <span key={e} className="badge badge-gray">{e}</span>)}
            </div>
          </div>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Foto de capa</p>
        <input ref={fotoPerfilRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) { setFotoFile(f); setFotoPreview(URL.createObjectURL(f)); } }} />
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => fotoPerfilRef.current?.click()}>{barbeiro.photo_url ? 'Trocar foto' : 'Adicionar foto'}</button>
          {fotoFile && (
            <button className="btn btn-primary" onClick={salvarFotoPerfil} disabled={savingFoto}>
              {savingFoto ? <><span className="spinner" />Salvando</> : 'Salvar'}
            </button>
          )}
        </div>
        {uploadError && <p style={{ color: 'var(--danger)', fontSize: 12, marginTop: 6 }}>{uploadError}</p>}
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <p style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Galeria ({fotos.length})</p>
          <button className="btn btn-outline" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => setShowUpload(p => !p)}>
            {showUpload ? 'Cancelar' : '+ Postar'}
          </button>
        </div>

        {showUpload && (
          <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 6, padding: 12, marginBottom: 12 }}>
            <input ref={novaFotoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) { setNovaFotoFile(f); setNovaFotoPreview(URL.createObjectURL(f)); } }} />
            {novaFotoPreview
              ? <img src={novaFotoPreview} alt="" style={{ width: '100%', height: 200, objectFit: 'cover', borderRadius: 6, marginBottom: 8 }} />
              : <button className="btn btn-outline" style={{ width: '100%', marginBottom: 8, padding: '24px 0' }} onClick={() => novaFotoRef.current?.click()}>Escolher foto</button>
            }
            <input className="input" placeholder="Legenda" value={descricao} onChange={e => setDescricao(e.target.value)} style={{ marginBottom: 8 }} />
            {uploadError && <p style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 6 }}>{uploadError}</p>}
            <div style={{ display: 'flex', gap: 6 }}>
              {novaFotoPreview && <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => { setNovaFotoPreview(null); setNovaFotoFile(null); }}>Trocar</button>}
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={postarFoto} disabled={!novaFotoFile || uploading}>
                {uploading ? <><span className="spinner" />Publicando</> : 'Publicar'}
              </button>
            </div>
          </div>
        )}

        {fotosLoading ? (
          <div style={{ textAlign: 'center', padding: 24 }}><span className="spinner" /></div>
        ) : fotos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--text-faint)' }}>
            <p style={{ fontSize: 13 }}>Nenhuma foto publicada ainda</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
            {fotos.map(foto => (
              <div key={foto.id} onClick={() => setFotoAberta(foto)} style={{ aspectRatio: '1', cursor: 'pointer', overflow: 'hidden', borderRadius: 4 }}>
                <img src={foto.foto_url || ''} alt={foto.descricao} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ))}
          </div>
        )}
      </div>

      {fotoAberta && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.85)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setFotoAberta(null)}>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: 480, width: '100%', background: 'var(--surface)', borderRadius: 8, overflow: 'hidden', margin: '0 16px' }}>
            <img src={fotoAberta.foto_url || ''} alt={fotoAberta.descricao} style={{ width: '100%', maxHeight: '60vh', objectFit: 'cover' }} />
            <div style={{ padding: 14 }}>
              {fotoAberta.descricao && <p style={{ fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>{fotoAberta.descricao}</p>}
              <p style={{ fontSize: 11, color: 'var(--text-faint)' }}>{fotoAberta.data}</p>
              <button className="btn btn-danger" style={{ marginTop: 10, padding: '4px 12px', fontSize: 12 }} onClick={() => excluirFoto(fotoAberta)}>Excluir foto</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
