'use client';
import { useEffect, useMemo, useState } from 'react';
import type { Agendamento, BarbeiroDB, StoreConfig } from '@/types';
import Tilt from '@/components/ui/Tilt';
import Reveal from '@/components/ui/Reveal';
import LineChart from '@/components/ui/LineChart';

interface Props {
  barbeiros: BarbeiroDB[];
  agendamentos: Agendamento[];
  storeConfig: StoreConfig;
  onRefresh: () => void;
}

type Periodo = 'hoje' | 'semana' | 'mes';

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmt(v: number): string {
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const eyebrow: React.CSSProperties = { fontSize: 11, color: 'var(--text-faint)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 12 };

export default function FinanceiroPanel({ barbeiros, agendamentos, storeConfig, onRefresh }: Props) {
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [pct, setPct]         = useState<Record<string, number>>(storeConfig.comissoes ?? {});
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { const t = setTimeout(() => setMounted(true), 60); return () => clearTimeout(t); }, [periodo]);
  useEffect(() => { setPct(storeConfig.comissoes ?? {}); }, [storeConfig.comissoes]);

  const hoje = new Date();
  const hojeISO = toISO(hoje);

  // Cortes efetivamente realizados (compareceu).
  const feitos = useMemo(() => agendamentos.filter(a => a.presenca === 'compareceu'), [agendamentos]);

  const noPeriodo = useMemo(() => {
    if (periodo === 'hoje') return feitos.filter(a => a.data === hojeISO);
    if (periodo === 'mes')  return feitos.filter(a => a.data.slice(0, 7) === hojeISO.slice(0, 7));
    // semana: últimos 7 dias
    const lim = toISO(new Date(hoje.getTime() - 6 * 86400000));
    return feitos.filter(a => a.data >= lim && a.data <= hojeISO);
  }, [feitos, periodo, hojeISO]);

  const faturamento = noPeriodo.reduce((s, a) => s + (a.valor || 0), 0);
  const totalCortes = noPeriodo.length;
  const ticket      = totalCortes ? faturamento / totalCortes : 0;

  // Por barbeiro (no período)
  const porBarbeiro = useMemo(() => {
    return barbeiros.map(b => {
      const cortes = noPeriodo.filter(a => a.barbeiro_id === b.id);
      const receita = cortes.reduce((s, a) => s + (a.valor || 0), 0);
      const comissao = Number(pct[b.id] ?? 0);
      return { b, qtd: cortes.length, receita, comissao, salario: receita * comissao / 100 };
    }).sort((x, y) => y.receita - x.receita);
  }, [barbeiros, noPeriodo, pct]);

  const totalComissoes = porBarbeiro.reduce((s, r) => s + r.salario, 0);
  const lucroCasa      = faturamento - totalComissoes;
  const maxReceita     = Math.max(1, ...porBarbeiro.map(r => r.receita));

  // Série temporal de faturamento (últimos 30 dias) para o gráfico de linha.
  const dias30 = useMemo(() => {
    const out: { label: string; valor: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(hoje.getTime() - i * 86400000);
      const iso = toISO(d);
      const valor = feitos.filter(a => a.data === iso).reduce((s, a) => s + (a.valor || 0), 0);
      // rótulo curto "dd/mm" só em alguns pontos (o componente espaça)
      out.push({ label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`, valor });
    }
    return out;
  }, [feitos]);

  async function salvarComissoes() {
    setSaving(true); setSaved(false);
    const res = await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ comissoes: pct }) });
    setSaving(false);
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); onRefresh(); }
  }

  const metricas = [
    { label: 'Faturamento', valor: fmt(faturamento) },
    { label: 'Cortes', valor: String(totalCortes) },
    { label: 'Ticket médio', valor: fmt(ticket) },
    { label: 'A pagar (comissões)', valor: fmt(totalComissoes) },
  ];

  return (
    <div>
      <header style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 12, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Dono</p>
        <h1 className="text-display" style={{ fontSize: 26 }}>Financeiro</h1>
        <p style={{ fontSize: 12.5, color: 'var(--text-faint)', marginTop: 4 }}>Caixa, métricas e comissões da barbearia.</p>
      </header>

      {/* Período */}
      <div className="tab-bar" style={{ marginBottom: 16 }}>
        {([['hoje', 'Hoje'], ['semana', 'Semana'], ['mes', 'Mês']] as const).map(([k, l]) => (
          <button key={k} className={`tab ${periodo === k ? 'active' : ''}`} onClick={() => setPeriodo(k)}>{l}</button>
        ))}
      </div>

      {/* Métricas */}
      <div className="scene" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16 }}>
        {metricas.map((m, i) => (
          <Tilt key={m.label} max={12} className="card" style={{ padding: 16 }}>
            <div className="tilt-pop-sm">
              <p style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 6 }}>{m.label}</p>
              <p className="text-display" style={{ fontSize: i === 0 ? 24 : 22, lineHeight: 1 }}>{m.valor}</p>
            </div>
          </Tilt>
        ))}
      </div>

      {/* Lucro da casa */}
      <Reveal>
        <div className="card" style={{ padding: 16, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '3px solid var(--success)' }}>
          <div>
            <p style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 4 }}>Lucro da casa ({periodo})</p>
            <p className="text-display" style={{ fontSize: 24, color: 'var(--success)' }}>{fmt(lucroCasa)}</p>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', textAlign: 'right' }}>Faturamento {fmt(faturamento)}<br />− comissões {fmt(totalComissoes)}</p>
        </div>
      </Reveal>

      {/* Gráfico de linha — faturamento últimos 30 dias */}
      <Reveal>
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
            <p style={{ ...eyebrow, marginBottom: 0 }}>Faturamento · últimos 30 dias</p>
            <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>R$ por dia</span>
          </div>
          <LineChart data={dias30} height={240} formatValue={v => 'R$ ' + (v >= 1000 ? (v / 1000).toFixed(1).replace('.', ',') + 'k' : String(Math.round(v)))} />
        </div>
      </Reveal>

      {/* Por barbeiro + comissões */}
      <Reveal>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <p style={{ ...eyebrow, marginBottom: 0 }}>Por barbeiro ({periodo})</p>
            <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={salvarComissoes} disabled={saving}>
              {saving ? <><span className="spinner" />Salvando</> : saved ? 'Salvo ✓' : 'Salvar comissões'}
            </button>
          </div>

          {porBarbeiro.length === 0 ? (
            <p style={{ color: 'var(--text-faint)', fontSize: 13, textAlign: 'center', padding: 16 }}>Nenhum barbeiro.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {porBarbeiro.map(r => (
                <div key={r.b.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5, gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{r.b.nome}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{r.qtd} corte{r.qtd === 1 ? '' : 's'} · {fmt(r.receita)}</span>
                  </div>
                  {/* barra de receita */}
                  <div style={{ height: 8, background: 'var(--surface2)', borderRadius: 99, overflow: 'hidden', marginBottom: 8 }}>
                    <div style={{ height: '100%', borderRadius: 99, background: 'var(--accent)', width: mounted ? `${(r.receita / maxReceita) * 100}%` : '0%', transition: 'width 0.8s cubic-bezier(.2,.8,.25,1)' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-dim)' }}>
                      Comissão
                      <input
                        type="number" min={0} max={100} className="input"
                        style={{ width: 78, padding: '6px 8px' }}
                        value={r.comissao}
                        onChange={e => setPct(p => ({ ...p, [r.b.id]: Math.max(0, Math.min(100, Number(e.target.value))) }))}
                      />
                      %
                    </label>
                    <span style={{ fontSize: 13, marginLeft: 'auto' }}>
                      Salário: <strong style={{ color: 'var(--success)' }}>{fmt(r.salario)}</strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 14, lineHeight: 1.5 }}>
            Comissão = % sobre o valor de cada corte realizado. Salário do período = soma das comissões dos cortes confirmados como “compareceu”.
          </p>
        </div>
      </Reveal>
    </div>
  );
}
