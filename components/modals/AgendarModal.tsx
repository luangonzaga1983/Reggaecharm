'use client';
import { useState, useEffect } from 'react';
import type { Session, BarbeiroDB, StoreConfig, BarbeiroStats } from '@/types';
import { gerarHorarios, getUnidadeStatus, formatDate } from '@/utils';
import Avatar from '@/components/ui/Avatar';
import Stars from '@/components/ui/Stars';
import Tilt from '@/components/ui/Tilt';
import PerfilBarbeiroModal from './PerfilBarbeiroModal';

/** ISO yyyy-mm-dd em horário local (sem deslocar fuso). */
function toLocalISO(d: Date): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }

type Step = 'unidade' | 'barbeiro' | 'servico' | 'data' | 'termos' | 'pagamento' | 'sucesso';

interface PixData {
  transactionId: string;
  qrCodeBase64: string;
  qrCodeText: string;
  amount: number;
  status: string;
  expiresAt: string;
}

interface Props {
  session: Session; stats: BarbeiroStats[]; barbeiros: BarbeiroDB[];
  storeConfig: StoreConfig; onClose: () => void; onSuccess: () => void;
}

export default function AgendarModal({ stats, barbeiros, storeConfig, onClose, onSuccess }: Props) {
  const [step, setStep]             = useState<Step>('unidade');
  const [unidadeId, setUnidadeId]   = useState('');
  const [barbeiroId, setBarbeiroId] = useState('');
  const [servicoId, setServicoId]   = useState('');
  const [data, setData]             = useState('');
  const [horario, setHorario]       = useState('');
  const [ocupados, setOcupados]     = useState<string[]>([]);
  const [reservados, setReservados] = useState<string[]>([]);
  const [folgaDia, setFolgaDia]     = useState(false);
  const [termos, setTermos]         = useState(false);
  const [metodoPg, setMetodoPg]     = useState<'pix' | 'dinheiro'>('pix');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [verPerfilB, setVerPerfilB] = useState<BarbeiroDB | null>(null);
  const [agId, setAgId]             = useState<string>('');
  const [pix, setPix]               = useState<PixData | null>(null);
  const [pixCopied, setPixCopied]   = useState(false);
  const [pago, setPago]             = useState(false);
  const [showCal, setShowCal]       = useState(false);

  const unidades = storeConfig.unidades.filter(u => u.ativo);
  const servicos = storeConfig.servicos.filter(s => s.ativo);
  const unidade  = unidades.find(u => u.id === unidadeId);
  const barbeiro = barbeiros.find(b => b.id === barbeiroId);
  const servico  = servicos.find(s => s.id === servicoId);
  const horarios = unidade ? gerarHorarios(unidade.horario.abertura, unidade.horario.fechamento) : [];
  const minDate  = new Date().toISOString().split('T')[0];

  // Fix: barbeiros disponíveis na unidade — usa b.unidades + unidade.barbeiros (qualquer lado)
  const barbeirosNaUnidade = barbeiros.filter(b =>
    b.ativo && (
      b.unidades?.includes(unidadeId) ||
      unidade?.barbeiros?.includes(b.id)
    )
  );

  useEffect(() => {
    if (barbeiroId && unidadeId && data) {
      fetch(`/api/agendamentos?action=horarios&barbeiro_id=${encodeURIComponent(barbeiroId)}&data=${encodeURIComponent(data)}`)
        .then(r => r.json()).then(d => { setOcupados(d.ocupados || []); setReservados(d.reservados || []); setFolgaDia(!!d.folga_dia_todo); })
        .catch(() => { setOcupados([]); setReservados([]); setFolgaDia(false); });
    }
  }, [barbeiroId, unidadeId, data]);

  const stepN = ({ unidade: 1, barbeiro: 2, servico: 3, data: 4, termos: 5, pagamento: 6, sucesso: 7 } as Record<string, number>)[step] ?? 1;

  async function confirmar() {
    if (!termos) return;
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/agendamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'criar', barbeiro_id: barbeiroId, unidade_id: unidadeId, servico: servico?.nome, data, horario, pagamento_metodo: metodoPg }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'Erro'); return; }
      const novoId: string = d.agendamento?.id;
      if (!novoId) { setError('Erro ao obter id do agendamento'); return; }
      setAgId(novoId);

      // Pagamento na barbearia (dinheiro): sem PIX, vai direto pro sucesso.
      if (metodoPg === 'dinheiro') { setStep('sucesso'); return; }

      // Gera PIX imediato
      const r2 = await fetch('/api/pix/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose: 'agendamento', agendamento_id: novoId }),
      });
      const p = await r2.json();
      if (!r2.ok) { setError(p.error || 'Erro ao gerar PIX'); setStep('pagamento'); return; }
      setPix({
        transactionId: p.transactionId,
        qrCodeBase64: p.qrCodeBase64,
        qrCodeText:   p.qrCodeText,
        amount: p.amount,
        status: p.status,
        expiresAt: p.expiresAt,
      });
      setStep('pagamento');
    } catch {
      setError('Erro de conexão');
    } finally { setLoading(false); }
  }

  // Entrar na fila de um horário ocupado (máx 1 pessoa por slot).
  async function reservarFila(h: string) {
    if (!confirm(`O horário ${h} está ocupado. Quer entrar na fila? Se a pessoa cancelar, vira seu agendamento e você recebe aviso para pagar.`)) return;
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/agendamentos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reservar_fila', barbeiro_id: barbeiroId, unidade_id: unidadeId, servico: servico?.nome, data, horario: h }),
      });
      const d = await res.json();
      if (!res.ok) { alert(d.error || 'Não foi possível entrar na fila'); return; }
      alert('Você entrou na fila! Se o horário vagar, vira seu agendamento.');
      onSuccess(); onClose();
    } catch { alert('Erro de conexão'); }
    finally { setLoading(false); }
  }

  // Poll status do PIX
  useEffect(() => {
    if (step !== 'pagamento' || !pix || pago) return;
    const iv = setInterval(async () => {
      try {
        const r = await fetch(`/api/pix/status?tx=${encodeURIComponent(pix.transactionId)}`);
        if (!r.ok) return;
        const d = await r.json();
        if (d.status === 'PAID') {
          setPago(true);
          clearInterval(iv);
          setTimeout(() => setStep('sucesso'), 1200);
        }
      } catch { /* ignore */ }
    }, 4000);
    return () => clearInterval(iv);
  }, [step, pix, pago]);

  async function copiarPix() {
    if (!pix?.qrCodeText) return;
    try {
      await navigator.clipboard.writeText(pix.qrCodeText);
      setPixCopied(true);
      setTimeout(() => setPixCopied(false), 2500);
    } catch { /* ignore */ }
  }

  if (verPerfilB) return <PerfilBarbeiroModal barbeiro={verPerfilB} agendamentos={[]} onClose={() => setVerPerfilB(null)} />;

  return (
    <div className="modal-back" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxHeight: '90vh', overflowY: 'auto', maxWidth: 520 }}>
        {step !== 'sucesso' && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600 }}>Novo agendamento</h2>
              <button className="btn btn-ghost" onClick={onClose} style={{ padding: '4px 10px' }}>×</button>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[1, 2, 3, 4, 5, 6].map(n => (
                <div key={n} className="progress-track" style={{ flex: 1 }}>
                  <div className="progress-fill" style={{ width: n <= stepN ? '100%' : '0%' }} />
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 8 }}>Passo {Math.min(stepN, 6)} de 6</p>
          </div>
        )}

        {step === 'unidade' && (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 14 }}>Selecione a unidade</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {unidades.map(u => {
                const st = getUnidadeStatus(u);
                return (
                  <button key={u.id} className="card" style={{ padding: 14, textAlign: 'left', background: 'var(--surface)', cursor: 'pointer', width: '100%' }} onClick={() => { setUnidadeId(u.id); setStep('barbeiro'); }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: 14 }}>{u.nome}</p>
                        <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{u.endereco} · {u.bairro}</p>
                      </div>
                      {st.aberto ? <span className="open-indicator">Aberto</span> : <span className="closed-indicator">Fechado</span>}
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 6 }}>{st.texto}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 'barbeiro' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <button className="btn btn-ghost" onClick={() => setStep('unidade')}>← Voltar</button>
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>Escolha o barbeiro</h3>
            </div>
            {barbeirosNaUnidade.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-dim)' }}>
                <p style={{ fontSize: 14, marginBottom: 6 }}>Nenhum barbeiro disponível nesta unidade</p>
                <p style={{ fontSize: 12, color: 'var(--text-faint)' }}>Selecione outra unidade ou contate o gerente.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {barbeirosNaUnidade.map(b => {
                  const stat = stats.find(s => s.barbeiroId === b.id);
                  const media = stat?.mediaEstrelas ?? 0;
                  return (
                    <div key={b.id} className="card" style={{ padding: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Avatar src={b.photo_url} nome={b.nome} size={44} />
                        <div style={{ flex: 1 }}>
                          <p style={{ fontWeight: 600, fontSize: 14 }}>{b.nome}</p>
                          <Stars value={Math.round(media)} readonly />
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                            {b.especialidades.map(e => <span key={e} className="badge badge-gray">{e}</span>)}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                        <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setVerPerfilB(b)}>Ver perfil</button>
                        <button className="btn btn-primary" style={{ flex: 2 }} onClick={() => { setBarbeiroId(b.id); setStep('servico'); }}>Selecionar</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {step === 'servico' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <button className="btn btn-ghost" onClick={() => setStep('barbeiro')}>← Voltar</button>
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>Serviço</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {servicos.map(s => (
                <button key={s.id} className="card" style={{ padding: 12, textAlign: 'left', cursor: 'pointer', width: '100%', background: 'var(--surface)' }} onClick={() => { setServicoId(s.id); setStep('data'); }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: 14 }}>{s.nome}</p>
                      {s.descricao && <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>{s.descricao}</p>}
                      <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>{s.duracao} min</p>
                    </div>
                    <p style={{ fontWeight: 600, color: 'var(--accent)', fontSize: 15 }}>R$ {s.valor}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'data' && (() => {
          const diasSemana = unidade?.dias_semana ?? [0, 1, 2, 3, 4, 5, 6];
          const melhores: { iso: string; weekday: string; short: string; isToday: boolean }[] = [];
          let cursor = new Date();
          for (let i = 0; i < 28 && melhores.length < 6; i++) {
            if (diasSemana.includes(cursor.getDay())) {
              melhores.push({
                iso: toLocalISO(cursor),
                weekday: i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : cap(cursor.toLocaleDateString('pt-BR', { weekday: 'long' })),
                short: cap(cursor.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })),
                isToday: i === 0,
              });
            }
            cursor = new Date(cursor.getTime() + 86400000);
          }
          const isOutra = data !== '' && !melhores.some(m => m.iso === data);
          return (
          <div className="scene">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <button className="btn btn-ghost" onClick={() => setStep('servico')}>← Voltar</button>
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>Quando?</h3>
            </div>

            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>Melhores opções</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
              {melhores.map(m => {
                const sel = data === m.iso;
                return (
                  <Tilt
                    key={m.iso}
                    max={12}
                    className="card"
                    onClick={() => { setData(m.iso); setHorario(''); setShowCal(false); }}
                    style={{
                      padding: '12px 10px', cursor: 'pointer', textAlign: 'center',
                      background: sel ? 'var(--accent)' : 'var(--surface)',
                      borderColor: sel ? 'var(--accent)' : 'var(--border)',
                    }}
                  >
                    <div className="tilt-pop-sm">
                      <p style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2, color: sel ? 'var(--accent-contrast)' : 'var(--text)' }}>{m.weekday}</p>
                      <p style={{ fontSize: 11, marginTop: 3, color: sel ? 'var(--accent-contrast)' : 'var(--text-faint)', opacity: sel ? 0.85 : 1 }}>{m.short}</p>
                    </div>
                  </Tilt>
                );
              })}
            </div>

            <button className="btn btn-ghost" style={{ fontSize: 12.5, marginBottom: 14 }} onClick={() => setShowCal(s => !s)}>
              {showCal || isOutra ? '— Esconder calendário' : '+ Escolher outra data'}
            </button>
            {(showCal || isOutra) && (
              <div style={{ marginBottom: 14 }}>
                <input type="date" className="input" min={minDate} value={data} onChange={e => { setData(e.target.value); setHorario(''); }} />
              </div>
            )}

            {data && (
              <div className="anim-in">
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-dim)', marginBottom: 6 }}>
                  Horário · {cap(new Date(data + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short' }))}
                </label>
                {folgaDia && (
                  <div className="card" style={{ padding: 12, marginBottom: 10, background: 'color-mix(in srgb, var(--warning) 8%, transparent)', borderColor: 'color-mix(in srgb, var(--warning) 30%, transparent)' }}>
                    <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--warning)' }}>{barbeiro?.nome?.split(' ')[0] || 'Barbeiro'} está de folga neste dia</p>
                    <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>Escolha outra data ou outro barbeiro.</p>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                  {horarios.map(h => {
                    const busy    = ocupados.includes(h);
                    const naFila  = reservados.includes(h);   // já tem 1 pessoa na fila
                    const filaCheia = busy && naFila;
                    const podeFila  = busy && !naFila;          // ocupado e fila vazia → pode reservar
                    const sel     = horario === h;
                    return (
                      <button
                        key={h}
                        disabled={filaCheia || loading}
                        onClick={() => busy ? reservarFila(h) : (setHorario(h), setStep('termos'))}
                        title={podeFila ? 'Ocupado — entrar na fila' : filaCheia ? 'Ocupado, fila cheia' : ''}
                        style={{
                          padding: '9px 4px',
                          borderRadius: 8,
                          fontSize: filaCheia || podeFila ? 10.5 : 13,
                          fontWeight: 600,
                          fontFamily: 'var(--font-mono)',
                          cursor: filaCheia ? 'not-allowed' : 'pointer',
                          border: podeFila ? '1px dashed var(--warning)' : '1px solid',
                          background: busy ? 'transparent' : sel ? 'var(--accent)' : 'var(--surface2)',
                          color: filaCheia ? 'var(--text-faint)' : podeFila ? 'var(--warning)' : sel ? 'var(--accent-contrast)' : 'var(--text)',
                          borderColor: podeFila ? 'var(--warning)' : sel ? 'var(--accent)' : 'var(--border)',
                          lineHeight: 1.2,
                          transition: 'transform 0.12s ease',
                        }}
                      >
                        {filaCheia ? `${h} · fila` : podeFila ? `${h} · fila?` : h}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          );
        })()}

        {step === 'termos' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <button className="btn btn-ghost" onClick={() => setStep('data')}>← Voltar</button>
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>Confirmar</h3>
            </div>
            <div className="card" style={{ padding: 14, marginBottom: 16 }}>
              {[['Unidade', unidade?.nome], ['Barbeiro', barbeiro?.nome], ['Serviço', servico?.nome], ['Data', data ? formatDate(data, { weekday: 'short', day: '2-digit', month: 'short' }) : ''], ['Horário', horario], ['Valor', servico ? 'R$ ' + servico.valor.toFixed(2) : '']].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{k}</span>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>
            <div className="card" style={{ padding: 12, marginBottom: 14, background: 'color-mix(in srgb, var(--warning) 8%, transparent)', borderColor: 'color-mix(in srgb, var(--warning) 30%, transparent)' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--warning)', marginBottom: 4 }}>Política de comparecimento</p>
              <p style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                Faltar ao horário marcado sem cancelar gera <strong>multa de R$ 10,00</strong>, que deverá ser quitada antes do próximo agendamento.
              </p>
            </div>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginBottom: 16 }}>
              <input type="checkbox" checked={termos} onChange={e => setTermos(e.target.checked)} style={{ width: 16, height: 16, marginTop: 2 }} />
              <span style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                Concordo com os termos, me comprometo a comparecer no horário agendado e aceito a multa de R$ 10,00 em caso de falta sem aviso prévio.
              </span>
            </label>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>Como você quer pagar?</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              {([
                { id: 'pix', titulo: 'PIX agora', desc: 'Garante na hora' },
                { id: 'dinheiro', titulo: 'Dinheiro na barbearia', desc: 'Paga ao chegar' },
              ] as const).map(opt => {
                const sel = metodoPg === opt.id;
                return (
                  <button key={opt.id} onClick={() => setMetodoPg(opt.id)}
                    style={{
                      padding: '12px 10px', borderRadius: 10, textAlign: 'left', cursor: 'pointer',
                      border: '1px solid', borderColor: sel ? 'var(--accent)' : 'var(--border)',
                      background: sel ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'var(--surface)',
                    }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: sel ? 'var(--accent)' : 'var(--text)' }}>{opt.titulo}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>{opt.desc}</p>
                  </button>
                );
              })}
            </div>
            {metodoPg === 'dinheiro' && (
              <p style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.5 }}>
                O horário fica reservado. Pague em dinheiro direto com o barbeiro ao chegar. A política de falta continua valendo.
              </p>
            )}
            {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>{error}</p>}
            <button className="btn btn-primary" style={{ width: '100%' }} disabled={!termos || loading} onClick={confirmar}>
              {loading ? <><span className="spinner" />Confirmando...</> : metodoPg === 'dinheiro' ? 'Confirmar reserva' : 'Confirmar e pagar'}
            </button>
          </div>
        )}

        {step === 'pagamento' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>Pagamento PIX</h3>
            </div>
            {!pix ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                {error ? (
                  <>
                    <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>{error}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                      Seu agendamento foi criado mas o pagamento falhou. Acesse "Meus agendamentos" para gerar PIX novamente.
                    </p>
                  </>
                ) : <span className="spinner" />}
              </div>
            ) : pago ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: 'rgba(46, 160, 67, 0.15)', border: '1px solid var(--success)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 12px', color: 'var(--success)', fontSize: 26,
                }}>✓</div>
                <p style={{ fontWeight: 600 }}>Pagamento confirmado!</p>
                <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>R$ {pix.amount.toFixed(2)}</p>
              </div>
            ) : (
              <>
                <div className="card" style={{ padding: 16, textAlign: 'center', marginBottom: 12 }}>
                  <div style={{ background: '#fff', padding: 10, borderRadius: 8, display: 'inline-block', marginBottom: 12 }}>
                    {pix.qrCodeBase64 ? (
                      <img
                        src={`data:image/png;base64,${pix.qrCodeBase64}`}
                        alt="QR Code PIX"
                        style={{ width: 200, height: 200, display: 'block', imageRendering: 'pixelated' }}
                      />
                    ) : (
                      <div style={{ width: 200, height: 200, color: '#888', fontSize: 12 }}>QR indisponível</div>
                    )}
                  </div>
                  <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>R$ {pix.amount.toFixed(2)}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-faint)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
                    Aguardando pagamento...
                  </p>
                </div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>PIX copia e cola</label>
                <div
                  onClick={copiarPix}
                  style={{
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 8, padding: '10px 12px', fontSize: 11,
                    color: 'var(--text-dim)', wordBreak: 'break-all', cursor: 'pointer',
                    fontFamily: 'var(--font-mono)', marginBottom: 10, lineHeight: 1.5,
                  }}
                >
                  {pix.qrCodeText.length > 80 ? pix.qrCodeText.slice(0, 80) + '...' : pix.qrCodeText}
                </div>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={copiarPix}>
                  {pixCopied ? '✓ Copiado!' : 'Copiar código PIX'}
                </button>
                <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-faint)', marginTop: 12 }}>
                  Pagamento processado com segurança · SSL 256-bit
                </p>
              </>
            )}
          </div>
        )}

        {step === 'sucesso' && (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'rgba(46, 160, 67, 0.15)', border: '1px solid var(--success)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 14px', color: 'var(--success)', fontSize: 22,
            }}>✓</div>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Agendamento criado</h3>
            <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 4 }}>{barbeiro?.nome} · {servico?.nome}</p>
            <p style={{ color: 'var(--text-faint)', fontSize: 12, marginBottom: 20 }}>
              {data ? formatDate(data, { weekday: 'long', day: '2-digit', month: 'long' }) : ''} às {horario}
            </p>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => { onSuccess(); onClose(); }}>Fechar</button>
          </div>
        )}
      </div>
    </div>
  );
}
