'use client';
import { useState } from 'react';
import type { UnidadeConfig } from '@/types';
import { getUnidadeStatus, DIAS_NOMES } from '@/utils';

/**
 * Detalhe da unidade com mapa do Google embutido (pelo endereço, sem API key).
 * Cores normais. O iframe é maior que o container e centralizado, jogando TODOS
 * os controles/cards do Google (4 cantos) pra fora — mapa limpo, sem botões.
 */
export default function UnidadeModal({ unidade, onClose }: { unidade: UnidadeConfig; onClose: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const st = getUnidadeStatus(unidade);
  const enderecoFull = [unidade.endereco, unidade.bairro, unidade.cidade].filter(Boolean).join(', ');
  const mapQuery = encodeURIComponent(enderecoFull || unidade.nome);
  const mapSrc = `https://www.google.com/maps?q=${mapQuery}&z=15&output=embed`;
  const dias = (unidade.dias_semana ?? []).slice().sort().map(d => DIAS_NOMES[d]).join(', ');

  return (
    <div className="modal-back" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 480, padding: 0, overflow: 'hidden' }}>
        <div className="map-embed" style={{ position: 'relative', height: 220, background: 'var(--surface2)', overflow: 'hidden' }}>
          {enderecoFull ? (
            <iframe
              title={`Mapa ${unidade.nome}`}
              src={mapSrc}
              loading="eager"
              referrerPolicy="no-referrer-when-downgrade"
              onLoad={() => setLoaded(true)}
              style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                // Maior que o container e centralizado → controles dos 4 cantos
                // (tela-cheia, zoom, card, logo, termos) ficam fora da área visível.
                width: 'calc(100% + 180px)', height: 'calc(100% + 180px)',
                border: 0, display: 'block',
                pointerEvents: 'none',          // estático: sem zoom/arrastar
                opacity: loaded ? 1 : 0,
                transition: 'opacity 0.3s ease',
              }}
            />
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontSize: 13 }}>
              Endereço não cadastrado
            </div>
          )}
          {enderecoFull && !loaded && <div className="skeleton" style={{ position: 'absolute', inset: 0 }} />}
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{ position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 18, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', zIndex: 2 }}
          >×</button>
        </div>

        <div style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>{unidade.nome}</h2>
            {st.aberto ? <span className="open-indicator">{st.texto}</span> : <span className="closed-indicator">{st.texto}</span>}
          </div>
          {enderecoFull && <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.5 }}>{enderecoFull}</p>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="card" style={{ padding: 10 }}>
              <p style={{ fontSize: 10.5, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Horário</p>
              <p style={{ fontSize: 13, fontWeight: 600 }}>{String(unidade.horario?.abertura ?? 0).padStart(2, '0')}h–{String(unidade.horario?.fechamento ?? 0).padStart(2, '0')}h</p>
            </div>
            <div className="card" style={{ padding: 10 }}>
              <p style={{ fontSize: 10.5, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Dias</p>
              <p style={{ fontSize: 12.5, fontWeight: 600 }}>{dias || '—'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
