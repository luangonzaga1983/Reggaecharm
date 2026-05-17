// lib/data.ts
// Static helpers only — dynamic data (unidades, servicos) now lives in StoreConfig via /api/config

export function gerarHorarios(abertura: number, fechamento: number): string[] {
  const slots: string[] = [];
  for (let h = abertura; h < fechamento; h++) {
    slots.push(String(h).padStart(2, '0') + ':00');
    slots.push(String(h).padStart(2, '0') + ':30');
  }
  return slots;
}
