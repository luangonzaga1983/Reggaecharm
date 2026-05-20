'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import type { BarbeiroDB, Agendamento, FotoBarbeiro } from '@/types';
import Avatar from '@/components/ui/Avatar';

interface Props {
  barbeiro: BarbeiroDB; agendamentos: Agendamento[];
  onClose: () => void; isProprietario?: boolean;
}

export default function PerfilBarbeiroModal({ barbeiro, agendamentos, onClose, isProprietario }: Props) {
  const [fotos, setFotos]               = useState<FotoBarbeiro[]>([]);
  const [fotosLoading, setFotosLoading] = useState(true);
  const [fotoAberta, setFotoAberta]     = useState<FotoBarbeiro | null>(null);
  const [uploading, setUploading]       = useState(false);
  const [uploadError, setUploadError]   = useState('');
  const [descricao, setDescricao]       = useState('');
  const [fotoFile, setFotoFile]         = useState<File | null>(null);
  const [preview, setPreview]           = useState<string | null>(null);
  const [showUpload, setShowUpload]     = useState(false);
  const [abaAtiva, setAbaAtiva]         = useState<'fotos' | 'cortes'>('fotos');
  const fileRef = useRef<HTMLInputElement>(null);

  const avs = agendamentos.filter(a => a.barbeiro_id === barbeiro.id && a.avaliacao);
  const mediaEstrelas = avs.length ? avs.reduce((s, a) => s + (a.avaliacao || 0), 0) / avs.length : 0;
  const totalCortes   = agendamentos.filter(a => a.barbeiro_id === barbeiro.id && a.status === 'confirmado').length;

  const carregarFotos = useCallback(async () => {
    setFotosLoading(true);
    try {
      const res = await fetch(`/api/barbeiros/fotos?barbeiro_id=${barbeiro.id}`);
      if (res.ok) { const d = await res.json(); setFotos(d.fotos || []); }
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
      const res = await fetch('/api/barbeiros/fotos', { method: 'POST', body: form });
      const d = await res.json();
      if (!res.ok) { setUploadError(d.error || 'Erro ao publicar'); return; }
      setFotoFile(null); setPreview(null); setDescricao(''); setShowUpload(false);
      await carregarFotos();
    } finally { setUploading(false); }
  }

  async function excluirFoto(foto: FotoBarbeiro) {
    if (!foto._messageId) return;
    await fetch('/api/barbeiros/fotos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'deletar', message_id: foto._messageId, barbeiro_id: barbeiro.id }) });
    setFotoAberta(null); await carregarFotos();
  }

  const cortesRecentes = agendamentos.filter(a => a.barbeiro_id === barbeiro.id).slice(0, 20);

  return (
    <div className="modal-back" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxHeight: '95vh', overflowY: 'auto', padding: 0, borderRadius: 20, maxWidth: 500 }}>
        <div style={{ padding: '20px 20px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <button className="btn btn-ghost" style={{ padding: '6px 10px' }} onClick={onClose}>← Voltar</button>
            {isProprietario && (
              <button className="btn btn-outline" style={{ fontSize: '0.78rem', padding: '6px 14px' }} onClick={() => setShowUpload(p => !p)}>
                {showUpload ? 'Cancelar' : '+ Postar foto'}
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', marginBottom: 20 }}>
            <div style={{ position: 'relative' }}>
              <Avatar src={barbeiro.photo_url} nome={barbeiro.nome} size={88} accent="var(--green)" />
              <div style={{ position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, background: 'var(--green)', borderRadius: '50%', border: '2px solid var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem' }}>✂</div>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 2 }}>{barbeiro.nome}</p>
              <p style={{ fontSize: '0.72rem', color: 'var(--green)', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>barbeiro profissional</p>
              <div style={{ display: 'flex', gap: 20, marginBottom: 10 }}>
                {[['fotos', fotos.length], ['cortes', totalCortes], ['★ média', mediaEstrelas ? mediaEstrelas.toFixed(1) : '—']].map(([l, v]) => (
                  <div key={l as string} style={{ textAlign: 'center' }}>
                    <p style={{ fontWeight: 800, fontSize: '1rem', lineHeight: 1 }}>{v}</p>
                    <p style={{ fontSize: '0.65rem', color: 'var(--text-faint)' }}>{l}</p>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {barbeiro.especialidades.map(e => <span key={e} className="badge badge-green" style={{ fontSize: '0.65rem' }}>{e}</span>)}
              </div>
            </div>
          </div>

          {showUpload && isProprietario && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 16 }}>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Nova publicação</p>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) { setFotoFile(f); setPreview(URL.createObjectURL(f)); } }} />
              {preview
                ? <img src={preview} alt="preview" style={{ width: '100%', height: 200, objectFit: 'cover', borderRadius: 10, marginBottom: 10 }} />
                : <button className="btn btn-outline" style={{ width: '100%', marginBottom: 10, padding: '32px 0' }} onClick={() => fileRef.current?.click()}>+ Escolher foto</button>
              }
              <input className="input" placeholder="Legenda..." value={descricao} onChange={e => setDescricao(e.target.value)} style={{ marginBottom: 10 }} />
              {uploadError && <p style={{ color: 'var(--red)', fontSize: '0.78rem', marginBottom: 8 }}>{uploadError}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                {preview && <button className="btn btn-outline" style={{ flex: 1, fontSize: '0.78rem' }} onClick={() => { setPreview(null); setFotoFile(null); }}>Trocar</button>}
                <button className="btn btn-green" style={{ flex: 2 }} onClick={postarFoto} disabled={!fotoFile || uploading}>
                  {uploading ? <><span className="spinner" />Publicando...</> : 'Publicar'}
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 0 }}>
            {(['fotos', 'cortes'] as const).map(aba => (
              <button key={aba} onClick={() => setAbaAtiva(aba)} style={{ flex: 1, padding: '10px 0', fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.08em', textTransform: 'uppercase', background: 'transparent', border: 'none', borderBottom: `2px solid ${abaAtiva === aba ? 'var(--green)' : 'transparent'}`, color: abaAtiva === aba ? 'var(--text)' : 'var(--text-faint)', cursor: 'pointer', marginBottom: -1 }}>
                {aba === 'fotos' ? `Fotos (${fotos.length})` : `Cortes (${totalCortes})`}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: '16px 20px 20px' }}>
          {abaAtiva === 'fotos' && (
            fotosLoading
              ? <div style={{ textAlign: 'center', padding: 32 }}><span className="spinner" /></div>
              : fotos.length === 0
                ? <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--text-faint)' }}>
                    <p style={{ fontSize: '2rem', marginBottom: 8 }}>✂</p>
                    <p style={{ fontSize: '0.88rem' }}>Nenhuma foto ainda</p>
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
          )}

          {abaAtiva === 'cortes' && (
            cortesRecentes.length === 0
              ? <p style={{ textAlign: 'center', color: 'var(--text-faint)', padding: '32px 20px', fontSize: '0.88rem' }}>Nenhum corte registrado</p>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {cortesRecentes.map(a => (
                    <div key={a.id} className="card" style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <p style={{ fontWeight: 600, fontSize: '0.88rem' }}>{a.servico}</p>
                          <p style={{ fontSize: '0.72rem', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                            {new Date(a.data + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })} · {a.horario}
                          </p>
                        </div>
                        <span className={`badge ${a.status === 'confirmado' ? 'badge-green' : a.status === 'pendente' ? 'badge-yellow' : 'badge-red'}`}>{a.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
          )}
        </div>
      </div>

      {fotoAberta && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setFotoAberta(null)}>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: 480, width: '100%', background: 'var(--surface)', borderRadius: 16, overflow: 'hidden', margin: '0 16px' }}>
            <img src={fotoAberta.foto_url || ''} alt={fotoAberta.descricao} style={{ width: '100%', maxHeight: '60vh', objectFit: 'cover' }} />
            <div style={{ padding: '14px 16px' }}>
              {fotoAberta.descricao && <p style={{ fontSize: '0.88rem', color: 'var(--text-dim)', marginBottom: 4 }}>{fotoAberta.descricao}</p>}
              <p style={{ fontSize: '0.7rem', color: 'var(--text-faint)' }}>{fotoAberta.data}</p>
              {isProprietario && <button className="btn btn-danger" style={{ marginTop: 12, fontSize: '0.75rem', padding: '6px 14px' }} onClick={() => excluirFoto(fotoAberta)}>Excluir foto</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
