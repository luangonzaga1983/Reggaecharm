/**
 * Checagem de senha vazada via HaveIBeenPwned (modelo k-anonymity).
 *
 * A senha NUNCA sai do servidor. Calcula SHA-1 local, envia só os 5 primeiros
 * chars do hash; a API devolve a lista de sufixos vazados desse prefixo e a
 * comparação do sufixo acontece aqui. HIBP nunca vê a senha nem o hash completo.
 *
 * Fail-open: se a API cair/der timeout, NÃO bloqueia o cadastro (disponibilidade
 * > rigor aqui — a força mínima de tamanho já é exigida à parte).
 */
export async function isPasswordPwned(senha: string): Promise<boolean> {
  try {
    const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(senha));
    const hex = Array.from(new Uint8Array(digest))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
    const prefix = hex.slice(0, 5);
    const suffix = hex.slice(5);

    const ctrl = AbortSignal.timeout(2500);
    const r = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' }, // resposta com ruído — esconde o alvo real
      cache: 'no-store',
      signal: ctrl,
    });
    if (!r.ok) return false;
    const text = await r.text();
    // Cada linha: "<SUFIXO>:<contagem>". Vazada = contagem > 0.
    for (const line of text.split('\n')) {
      const [suf, count] = line.trim().split(':');
      if (suf === suffix && Number(count) > 0) return true;
    }
    return false;
  } catch {
    return false; // fail-open
  }
}
