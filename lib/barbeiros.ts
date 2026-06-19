import {
  deleteBarbeiro, getStoreConfig, saveStoreConfig,
  getAllAgendamentos, updateAgendamento, getUsuarioById, updateUsuario,
} from '@/lib/discord';
import { hojeSP } from '@/lib/datetime';

/**
 * Remoção COMPLETA de um barbeiro (excluir ou demitir/rebaixar):
 * - apaga o registro do barbeiro (e duplicatas);
 * - tira o id das unidades (sem refs órfãs);
 * - cancela cortes futuros pendentes e devolve crédito ao cliente
 *   (pago vira crédito cheio; não pago devolve só o crédito já abatido).
 * Sem notificações (sistema de push removido). Best-effort, nunca lança.
 */
export async function removerBarbeiroCompleto(barbeiroId: string): Promise<{ removidas: number; realocados: number }> {
  const removidas = await deleteBarbeiro(barbeiroId);

  try {
    const cfg = await getStoreConfig();
    let mudou = false;
    const unidades = cfg.unidades.map(u => {
      const lista = Array.isArray(u.barbeiros) ? u.barbeiros : [];
      if (lista.includes(barbeiroId)) { mudou = true; return { ...u, barbeiros: lista.filter(x => x !== barbeiroId) }; }
      return u;
    });
    if (mudou) await saveStoreConfig({ ...cfg, unidades });
  } catch { /* limpeza best-effort */ }

  let realocados = 0;
  try {
    const hoje = hojeSP();
    const afetados = (await getAllAgendamentos({ fresh: true }))
      .filter(a => a.barbeiro_id === barbeiroId && a.status !== 'cancelado' && a.data >= hoje && (a.presenca ?? 'pendente') === 'pendente')
      .slice(0, 300);
    for (const a of afetados) {
      a.status = 'cancelado';
      a.cancelado_motivo = 'barbeiro_removido';
      await updateAgendamento(a);
      const reembolso = a.pago ? a.valor : Number(a.credito_usado ?? 0);
      if (reembolso > 0) {
        const cli = await getUsuarioById(a.usuario_id);
        if (cli) {
          cli.credito_saldo = Math.round((Number(cli.credito_saldo ?? 0) + reembolso) * 100) / 100;
          await updateUsuario(cli);
        }
      }
      realocados++;
    }
  } catch (e) { console.error('[removerBarbeiroCompleto: realocação]', e); }

  return { removidas, realocados };
}
