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
  const totalCortes = agendamentos.filter(a => a.barbeiro_id === barbeiro.id && a.status === 'confirmado').length;

  const carregarFotos = useCallback(async () => {
    setFotosLoading(true);
    try {
      const res = await fetch(`/api/barbeiros/fotos?barbeiro_id=${encodeURIComponent(barbeiro.id)}`);
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
      if (!res.ok) { setUploadError(d.error || 'Erro'); return; }
      setFotoFile(null); setPreview(null); setDescricao(''); setShowUpload(false);
      await carregarFotos();
    } finally { setUploading(false); }
  }

  async function excluirFoto(foto: FotoBarbeiro) {
    if (!foto._messageId) return;
    if (!confirm('Excluir esta foto?')) return;
    await fetch('/api/barbeiros/fotos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'deletar', message_id: foto._messageId, barbeiro_id: barbeiro.id }) });
    setFotoAberta(null); await carregarFotos();
  }

  const cortesRecentes = agendamentos.filter(a => a.barbeiro_id === barbeiro.id).slice(0, 20);

  return (
    <div className="modal-back" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxHeight: '95vh', overflowY: 'auto', padding: 0, maxWidth: 520 }}>
        <div style={{ padding: '16px 16px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <button className="btn btn-ghost" onClick={onClose}>← Voltar</button>
            {isProprietario && (
              <button className="btn btn-outline" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => setShowUpload(p => !p)}>
                {showUpload ? 'Cancelar' : '+ Postar'}
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 14 }}>
            <Avatar src={barbeiro.photo_url} nome={barbeiro.nome} size={72} />
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 600, fontSize: 15 }}>{barbeiro.nome}</p>
              <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 6 }}>Barbeiro profissional</p>
              <div style={{ display: 'flex', gap: 16, marginBottom: 6 }}>
                {[['fotos', fotos.length], ['cortes', totalCortes], ['★ média', mediaEstrelas ? mediaEstrelas.toFixed(1) : '—']].map(([l, v]) => (
                  <div key={l as string} style={{ textAlign: 'center' }}>
                    <p style={{ fontWeight: 600, fontSize: 13, lineHeight: 1 }}>{v}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-faint)' }}>{l}</p>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {barbeiro.especialidades.map(e => <span key={e} className="badge badge-gray">{e}</span>)}
              </div>
            </div>
          </div>

          {showUpload && isProprietario && (
            <div className="card" style={{ padding: 12, marginBottom: 12, background: 'var(--bg-elev)' }}>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) { setFotoFile(f); setPreview(URL.createObjectURL(f)); } }} />
              {preview
                ? <img src={preview} alt="" style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 6, marginBottom: 8 }} />
                : <button className="btn btn-outline" style={{ width: '100%', marginBottom: 8, padding: '24px 0' }} onClick={() => fileRef.current?.click()}>Escolher foto</button>
              }
              <input className="input" placeholder="Legenda" value={descricao} onChange={e => setDescricao(e.target.value)} style={{ marginBottom: 8 }} />
              {uploadError && <p style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 6 }}>{uploadError}</p>}
              <div style={{ display: 'flex', gap: 6 }}>
                {preview && <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => { setPreview(null); setFotoFile(null); }}>Trocar</button>}
                <button className="btn btn-primary" style={{ flex: 2 }} onClick={postarFoto} disabled={!fotoFile || uploading}>
                  {uploading ? <><span className="spinner" />Publicando</> : 'Publicar'}
                </button>
              </div>
            </div>
          )}

          <div className="tab-bar" style={{ marginBottom: 0 }}>
            {(['fotos', 'cortes'] as const).map(aba => (
              <button key={aba} onClick={() => setAbaAtiva(aba)} className={`tab ${abaAtiva === aba ? 'active' : ''}`} style={{ flex: 1 }}>
                {aba === 'fotos' ? `Fotos (${fotos.length})` : `Cortes (${totalCortes})`}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: '12px 16px 16px' }}>
          {abaAtiva === 'fotos' && (
            fotosLoading ? (
              <div style={{ textAlign: 'center', padding: 24 }}><span className="spinner" /></div>
            ) : fotos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--text-faint)' }}>
                <p style={{ fontSize: 13 }}>Nenhuma foto ainda</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
                {fotos.map(foto => (
                  <div key={foto.id} onClick={() => setFotoAberta(foto)} style={{ aspectRatio: '1', cursor: 'pointer', overflow: 'hidden', borderRadius: 4 }}>
                    <img src={foto.foto_url || ''} alt={foto.descricao} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ))}
              </div>
            )
          )}

          {abaAtiva === 'cortes' && (
            cortesRecentes.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-faint)', padding: '24px 12px', fontSize: 13 }}>Nenhum corte registrado</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {cortesRecentes.map(a => (
                  <div key={a.id} className="card" style={{ padding: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <p style={{ fontWeight: 500, fontSize: 13 }}>{a.servico}</p>
                        <p style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                          {new Date(a.data + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })} · {a.horario}
                        </p>
                      </div>
                      <span className={`badge ${a.status === 'confirmado' ? 'badge-green' : a.status === 'pendente' ? 'badge-yellow' : 'badge-red'}`}>{a.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {fotoAberta && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.85)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setFotoAberta(null)}>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: 480, width: '100%', background: 'var(--surface)', borderRadius: 8, overflow: 'hidden', margin: '0 16px' }}>
            <img src={fotoAberta.foto_url || ''} alt={fotoAberta.descricao} style={{ width: '100%', maxHeight: '60vh', objectFit: 'cover' }} />
            <div style={{ padding: 14 }}>
              {fotoAberta.descricao && <p style={{ fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>{fotoAberta.descricao}</p>}
              <p style={{ fontSize: 11, color: 'var(--text-faint)' }}>{fotoAberta.data}</p>
              {isProprietario && <button className="btn btn-danger" style={{ marginTop: 10, padding: '4px 12px', fontSize: 12 }} onClick={() => excluirFoto(fotoAberta)}>Excluir foto</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
