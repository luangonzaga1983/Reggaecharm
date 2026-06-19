import { NextRequest, NextResponse } from 'next/server';
import {
  getUsuarioById, updateUsuario, purgeUsuario, getAllUsuarios,
  getUsuarioByUsername, getUsuarioByEmail, uploadUserPhoto, banirUsuario, desbanirUsuario,
  createBarbeiro, getBarbeiroById, updateBarbeiro,
} from '@/lib/discord';
import { removerBarbeiroCompleto } from '@/lib/barbeiros';
import { getSession, getLiveSession, signToken, canDo, ROLE_LEVEL, cookieOptions, COOKIE_NAME } from '@/lib/auth';
import { ok, err, unauth, forbidden, notFound, serverErr } from '@/lib/api';
import { auditFromSession, sanitizeUserOut } from '@/lib/audit';
import { clientIp, verifyImageMagic, maintenanceGuard } from '@/lib/security';
import { validateRole, validateUsername, validateNome, validatePassword, validateEmail, validateImageFile, sanitizeString } from '@/validators';
import { isPasswordPwned } from '@/lib/pwned';
import type { TemaApp, UserRole } from '@/types';
import bcrypt from 'bcryptjs';

const TEMAS_VALIDOS: TemaApp[] = ['dark', 'light'];

export async function GET(req: NextRequest) {
  const session = await getLiveSession();
  if (!session) return unauth();

  try {
    if (new URL(req.url).searchParams.get('action') === 'todos') {
      if (!canDo(session.role, 'gerenciar_usuarios')) {
        auditFromSession(session, 'admin_access_denied', { meta: { route: 'usuarios?todos' } });
        return forbidden();
      }
      const all = await getAllUsuarios();
      const isAdmin = ROLE_LEVEL[session.role] >= ROLE_LEVEL.gerente;
      return NextResponse.json({
        usuarios: all.map(u => sanitizeUserOut(u, { isAdmin })),
      });
    }

    const u = await getUsuarioById(session.id);
    if (!u) return notFound();
    return NextResponse.json({ usuario: sanitizeUserOut(u, { isSelf: true }) });
  } catch {
    return serverErr();
  }
}

export async function POST(req: NextRequest) {
  const session = await getLiveSession();
  if (!session) return unauth();
  const blocked = await maintenanceGuard(session);
  if (blocked) return blocked;
  const ip = clientIp(req);
  const ua = req.headers.get('user-agent') || undefined;

  try {
    if (req.headers.get('content-type')?.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('foto') as File | null;
      if (!file) return err('Foto obrigatória');

      const imgErr = validateImageFile(file);
      if (imgErr) return err(imgErr);

      // Dono pode trocar a foto de QUALQUER conta (usuario_id); outros, só a sua.
      const alvoId = sanitizeString(form.get('usuario_id'), 64);
      const targetSelf = !alvoId || alvoId === session.id;
      if (!targetSelf && session.role !== 'dono') return forbidden();
      const u = await getUsuarioById(targetSelf ? session.id : alvoId);
      if (!u) return notFound();

      // Magic-byte check — confirma que bytes batem com MIME declarado
      const buf = await file.arrayBuffer();
      if (!verifyImageMagic(buf, file.type)) return err('Conteúdo de imagem inválido');

      const url = await uploadUserPhoto(u, buf, file.name, file.type || 'image/jpeg');
      auditFromSession(session, 'photo_upload', { target_id: u.id, ip, ua });
      return ok({ foto_url: url });
    }

    const raw = await req.text();
    if (raw.length > 16_000) return err('Payload muito grande');
    const body = raw ? JSON.parse(raw) : null;
    if (!body || typeof body !== 'object') return err('Payload inválido');
    const { action } = body;
    const u = await getUsuarioById(session.id);
    if (!u) return notFound();

    if (action === 'prefs') {
      if (body.barbeiro_favorito !== undefined) u.barbeiro_favorito = sanitizeString(body.barbeiro_favorito, 64) || null;
      if (body.servico_favorito  !== undefined) u.servico_favorito  = sanitizeString(body.servico_favorito, 64)  || null;
      if (body.horario_favorito  !== undefined) u.horario_favorito  = sanitizeString(body.horario_favorito, 8)   || null;
      if (body.unidade_favorita  !== undefined) u.unidade_favorita  = sanitizeString(body.unidade_favorita, 64)  || null;
      if (body.tema !== undefined && TEMAS_VALIDOS.includes(body.tema)) u.tema = body.tema;
      await updateUsuario(u);
      return ok({ usuario: sanitizeUserOut(u, { isSelf: true }) });
    }

    if (action === 'perfil') {
      const nome = validateNome(body.nome);
      if (nome) u.nome = nome;

      if (body.username !== undefined) {
        const clean = validateUsername(body.username);
        if (clean === null) return err('@username deve ter 3-30 chars: letras, números, . ou _');
        if (clean && clean !== u.username) {
          const taken = await getUsuarioByUsername(clean);
          if (taken && taken.id !== session.id) return err('Este @ já está em uso', 409);
          u.username = clean;
        } else if (!clean) {
          u.username = null;
        }
      }
      await updateUsuario(u);
      return ok({ usuario: sanitizeUserOut(u, { isSelf: true }) });
    }

    if (action === 'senha') {
      const { senha_atual, senha_nova } = body;
      if (typeof senha_atual !== 'string' || !senha_atual) return err('Senha atual obrigatória');
      if (!validatePassword(senha_nova)) return err('Nova senha deve ter 8-128 caracteres');
      if (senha_atual === senha_nova) return err('Nova senha deve ser diferente da atual');
      if (await isPasswordPwned(senha_nova)) return err('Essa senha já apareceu em vazamentos. Escolha outra.', 400);
      if (!(await bcrypt.compare(senha_atual, u.senha))) return err('Senha atual incorreta');
      u.senha = await bcrypt.hash(senha_nova, 12);
      u.token_version = (u.token_version ?? 0) + 1; // derruba outras sessões ao trocar senha
      await updateUsuario(u);
      // Reemite o cookie do próprio usuário com o novo tv (senão ele se desloga sozinho)
      const res = ok();
      res.cookies.set(
        COOKIE_NAME,
        await signToken({ id: u.id, email: u.email, nome: u.nome, role: u.role, tv: u.token_version }),
        cookieOptions(),
      );
      return res;
    }

    if (action === 'excluir') {
      if (u.role === 'dono') {
        const todos = await getAllUsuarios();
        const donos = todos.filter(x => x.role === 'dono');
        if (donos.length <= 1) return err('Você é o único dono. Promova outro usuário antes de excluir sua conta.');
      }
      if (!u._messageId) return notFound();
      await purgeUsuario({ id: u.id, email: u.email }); // apaga conta + duplicatas (libera o e-mail)
      auditFromSession(session, 'delete_user', { target_id: u.id, target_label: u.email, ip, ua });
      const res = ok();
      res.cookies.set(COOKIE_NAME, '', { ...cookieOptions(), maxAge: 0 });
      return res;
    }

    if (action === 'apelido') {
      // Staff (barbeiro+) define apelido global — só de clientes.
      if (!canDo(session.role, 'ver_todos_ag')) return forbidden();
      const alvo = await getUsuarioById(sanitizeString(body.usuario_id, 64));
      if (!alvo) return notFound();
      if (alvo.role !== 'cliente') return err('Apelido só para clientes');
      alvo.apelido = sanitizeString(body.apelido, 40) || null;
      await updateUsuario(alvo);
      return ok({ usuario: sanitizeUserOut(alvo, {}) });
    }

    if (action === 'promover') {
      if (!canDo(session.role, 'promover')) {
        auditFromSession(session, 'admin_access_denied', { meta: { action: 'promover' }, ip, ua });
        return forbidden();
      }
      const novoRole = validateRole(body.novo_role);
      if (!novoRole) return err('Role inválido');
      if (novoRole === 'dono' && session.role !== 'dono') return forbidden();

      const alvoId = sanitizeString(body.usuario_id, 64);
      const alvo = await getUsuarioById(alvoId);
      if (!alvo) return notFound();
      if (session.role !== 'dono' && ROLE_LEVEL[alvo.role] >= ROLE_LEVEL[session.role]) return forbidden();
      if (session.role !== 'dono' && ROLE_LEVEL[novoRole] >= ROLE_LEVEL[session.role]) return forbidden();
      if (alvo.id === session.id && alvo.role === 'dono' && novoRole !== 'dono') {
        const todos = await getAllUsuarios();
        if (todos.filter(x => x.role === 'dono').length <= 1) return err('Promova outro dono antes de se rebaixar');
      }

      const roleAntes = alvo.role;
      alvo.role = novoRole;
      // Rebaixamento revoga as sessões ativas do alvo na hora (papel do JWT some).
      if (ROLE_LEVEL[novoRole] < ROLE_LEVEL[roleAntes]) {
        alvo.token_version = (alvo.token_version ?? 0) + 1;
      }
      if (body.unidade_id !== undefined) alvo.unidade_id = sanitizeString(body.unidade_id, 64) || null;

      // Barbeiro DIRETO: virar barbeiro cria/reativa o registro automaticamente
      // (sem vínculo manual). Deixar de ser barbeiro desativa o registro.
      if (novoRole === 'barbeiro') {
        if (alvo.barbeiro_id) {
          const b = await getBarbeiroById(alvo.barbeiro_id);
          if (b) { if (!b.ativo) { b.ativo = true; await updateBarbeiro(b); } }
          else alvo.barbeiro_id = null; // vínculo órfão → recria abaixo
        }
        if (!alvo.barbeiro_id) {
          const novoB = await createBarbeiro({
            id: 'b' + crypto.randomUUID().replace(/-/g, '').slice(0, 8),
            nome: alvo.nome,
            especialidades: [],
            unidades: alvo.unidade_id ? [alvo.unidade_id] : [],
            ativo: true,
            photo_message_id: null,
          });
          alvo.barbeiro_id = novoB.id;
        }
      } else if (roleAntes === 'barbeiro' && alvo.barbeiro_id) {
        // Demitir: remove o registro de barbeiro (some da aba Barbeiros), realoca
        // clientes e desvincula. Vira conta de cliente normal — sistema de cargo.
        await removerBarbeiroCompleto(alvo.barbeiro_id);
        alvo.barbeiro_id = null;
      }

      await updateUsuario(alvo);
      auditFromSession(
        session,
        ROLE_LEVEL[novoRole] > ROLE_LEVEL[roleAntes] ? 'promote' : 'demote',
        { target_id: alvo.id, target_label: alvo.email, meta: { from: roleAntes, to: novoRole }, ip, ua },
      );
      return ok();
    }

    if (action === 'banir') {
      if (!canDo(session.role, 'banir')) {
        auditFromSession(session, 'admin_access_denied', { meta: { action: 'banir' }, ip, ua });
        return forbidden();
      }
      const alvo = await getUsuarioById(sanitizeString(body.usuario_id, 64));
      if (!alvo) return notFound();
      if (alvo.role === 'dono') return forbidden();
      if (alvo.id === session.id) return err('Não pode se banir');
      if (session.role !== 'dono' && ROLE_LEVEL[alvo.role] >= ROLE_LEVEL[session.role]) return forbidden();
      const motivo = sanitizeString(body.motivo, 300) || 'Sem motivo informado';
      await banirUsuario(
        alvo,
        motivo,
        sanitizeString(body.ban_ip, 64) || undefined,
      );
      auditFromSession(session, 'ban', { target_id: alvo.id, target_label: alvo.email, meta: { motivo }, ip, ua });
      return ok();
    }

    if (action === 'desbanir') {
      if (!canDo(session.role, 'banir')) {
        auditFromSession(session, 'admin_access_denied', { meta: { action: 'desbanir' }, ip, ua });
        return forbidden();
      }
      const alvo = await getUsuarioById(sanitizeString(body.usuario_id, 64));
      if (!alvo) return notFound();
      await desbanirUsuario(alvo);
      auditFromSession(session, 'unban', { target_id: alvo.id, target_label: alvo.email, ip, ua });
      return ok();
    }

    if (action === 'admin_editar') {
      // Dono = gerência completa. Gerente = só nome + multa, e não mexe em staff.
      const isDonoReq  = session.role === 'dono';
      const isGerente  = session.role === 'gerente';
      if (!isDonoReq && !isGerente) {
        auditFromSession(session, 'admin_access_denied', { meta: { action: 'admin_editar' }, ip, ua });
        return forbidden();
      }
      const alvo = await getUsuarioById(sanitizeString(body.usuario_id, 64));
      if (!alvo) return notFound();

      // Gerente não edita dono/gerente (exceto a própria conta) e não toca em
      // campos sensíveis (e-mail, senha, @, crédito) — esses são só do dono.
      if (isGerente) {
        if ((alvo.role === 'dono' || alvo.role === 'gerente') && alvo.id !== session.id) return forbidden();
        const pediuSensivel = body.email !== undefined || body.username !== undefined
          || body.credito_saldo !== undefined || (typeof body.senha === 'string' && body.senha.length > 0);
        if (pediuSensivel) return err('Apenas o dono altera e-mail, senha, @ ou crédito.', 403);
      }

      const campos: string[] = [];
      let senhaTrocada = false;

      if (body.nome !== undefined) {
        const n = validateNome(body.nome);
        if (!n) return err('Nome inválido');
        alvo.nome = n; campos.push('nome');
      }
      if (body.email !== undefined) {
        const e = validateEmail(body.email);
        if (!e) return err('E-mail inválido');
        // Só checa unicidade se o e-mail REALMENTE mudou — senão salvar a conta sem
        // mexer no e-mail acusava "já está em uso" (a própria conta / duplicata).
        if (e !== alvo.email) {
          const taken = await getUsuarioByEmail(e, { fresh: true });
          if (taken && taken.id !== alvo.id) return err('E-mail já está em uso', 409);
          alvo.email = e; campos.push('email');
        }
      }
      if (body.username !== undefined) {
        const clean = validateUsername(body.username);
        if (clean === null) return err('@username inválido (3-30: letras, números, . ou _)');
        if (clean) {
          const taken = await getUsuarioByUsername(clean);
          if (taken && taken.id !== alvo.id) return err('Este @ já está em uso', 409);
          alvo.username = clean;
        } else { alvo.username = null; }
        campos.push('username');
      }
      if (typeof body.senha === 'string' && body.senha.length > 0) {
        if (!validatePassword(body.senha)) return err('Senha deve ter 8-128 caracteres');
        alvo.senha = await bcrypt.hash(body.senha, 12);
        alvo.token_version = (alvo.token_version ?? 0) + 1; // derruba sessões do alvo
        senhaTrocada = true; campos.push('senha');
      }
      if (body.credito_saldo !== undefined) {
        const v = Number(body.credito_saldo);
        if (!Number.isFinite(v) || v < 0 || v > 100000) return err('Saldo inválido (0–100000)');
        alvo.credito_saldo = Math.round(v * 100) / 100; campos.push('credito_saldo');
      }
      if (body.multa_pendente !== undefined) {
        const v = Number(body.multa_pendente);
        if (!Number.isFinite(v) || v < 0 || v > 100000) return err('Multa inválida (0–100000)');
        alvo.multa_pendente = Math.round(v * 100) / 100; campos.push('multa');
      }

      if (!campos.length) return err('Nada para alterar');

      await updateUsuario(alvo);
      auditFromSession(session, 'config_change', {
        target_id: alvo.id, target_label: alvo.email,
        meta: { entity: 'admin_editar', campos }, ip, ua,
      });

      // Dono editou a própria senha → reemite cookie pra não se deslogar.
      if (alvo.id === session.id && senhaTrocada) {
        const res = ok({ usuario: sanitizeUserOut(alvo, { isSelf: true, isAdmin: true }) });
        res.cookies.set(
          COOKIE_NAME,
          await signToken({ id: alvo.id, email: alvo.email, nome: alvo.nome, role: alvo.role, tv: alvo.token_version ?? 0 }),
          cookieOptions(),
        );
        return res;
      }
      return ok({ usuario: sanitizeUserOut(alvo, { isAdmin: true }) });
    }

    if (action === 'excluir_usuario') {
      // Exclusão de conta ALHEIA por staff. Apenas gerente/dono (gerenciar_usuarios).
      if (!canDo(session.role, 'gerenciar_usuarios')) {
        auditFromSession(session, 'admin_access_denied', { meta: { action: 'excluir_usuario' }, ip, ua });
        return forbidden();
      }
      const alvo = await getUsuarioById(sanitizeString(body.usuario_id, 64));
      if (!alvo) return notFound();
      // Proteções: não exclui dono, não exclui a si mesmo (use 'excluir'),
      // e gerente não exclui igual/superior (só dono passa por cima de níveis).
      if (alvo.role === 'dono') return forbidden();
      if (alvo.id === session.id) return err('Use a exclusão da própria conta nas configurações');
      if (session.role !== 'dono' && ROLE_LEVEL[alvo.role] >= ROLE_LEVEL[session.role]) return forbidden();
      if (!alvo._messageId) return notFound();

      await purgeUsuario({ id: alvo.id, email: alvo.email }); // conta + duplicatas
      auditFromSession(session, 'delete_user', {
        target_id: alvo.id, target_label: alvo.email,
        meta: { by: 'admin', alvo_role: alvo.role }, ip, ua,
      });
      return ok();
    }

    return err('Ação inválida');
  } catch (e) {
    console.error('[usuarios POST]', e);
    return serverErr();
  }
}
