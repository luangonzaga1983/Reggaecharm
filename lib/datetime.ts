/**
 * Datas no fuso da barbearia (America/Sao_Paulo), não em UTC.
 *
 * Bug que isto corrige: `new Date().toISOString().split('T')[0]` devolve a data
 * em UTC. No Brasil (UTC−3), depois das ~21h o UTC já virou o dia seguinte, então
 * "hoje" ficava errado e agendar para o dia corrente dava "data no passado".
 */
const TZ = 'America/Sao_Paulo';
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

/** 'yyyy-mm-dd' de hoje no fuso de São Paulo. */
export function hojeSP(): string {
  return fmt.format(new Date());
}

/** 'yyyy-mm-dd' deslocado em N dias (ex: dataSP(1) = amanhã) no fuso de SP. */
export function dataSP(offsetDias = 0): string {
  return fmt.format(new Date(Date.now() + offsetDias * 86_400_000));
}
