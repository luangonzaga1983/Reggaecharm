# Reggae Charm v5 — Barbearia

> One Love, One Cut.

Stack: **Next.js 14 App Router · TypeScript · Tailwind CSS · Discord como banco de dados**

---

## Pré-requisitos

- Node.js 18+
- Bot do Discord com acesso a 3–5 canais de texto
- Variáveis de ambiente configuradas (veja `.env.example`)

## Instalação

```bash
cp .env.example .env.local
# preencha .env.local com seus tokens

npm install
npm run dev
```

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DISCORD_TOKEN` | ✅ | Token do bot Discord |
| `DISCORD_CHANNEL_USUARIOS` | ✅ | Canal para usuários |
| `DISCORD_CHANNEL_AGENDAMENTOS` | ✅ | Canal para agendamentos |
| `DISCORD_CHANNEL_BARBEIROS` | ✅ | Canal para barbeiros |
| `JWT_SECRET` | ✅ | Segredo JWT (mín. 64 chars) |
| `DISCORD_CHANNEL_CONFIG` | ➖ | Canal config/manutenção (usa USUARIOS se omitido) |
| `DISCORD_CHANNEL_FOTOS_BARBEIROS` | ➖ | Canal fotos (usa BARBEIROS se omitido) |

## Estrutura

```
app/
  api/             ← Rotas de API (server-side, validadas)
  layout.tsx       ← Root layout
  page.tsx         ← App shell (client)
  globals.css      ← Design system + variáveis CSS

components/
  modals/          ← Auth, Agendar, PerfilBarbeiro
  tabs/            ← Dashboard, Horários, Perfil, Configurações, Gerência
  ui/              ← Avatar, Stars (componentes atômicos)

hooks/
  useApp.ts        ← Estado global do app

lib/
  auth.ts          ← JWT utilities (server-only)
  discord.ts       ← Camada de dados Discord
  api.ts           ← Helpers de resposta HTTP

types/index.ts     ← Todos os tipos TypeScript
utils/index.ts     ← Funções puras compartilhadas
validators/index.ts ← Validação de inputs (server + client)
middleware.ts      ← Rate limiting + headers de segurança
```

## Roles

| Role | Permissões |
|---|---|
| `cliente` | Agendar, avaliar, ver próprios agendamentos |
| `barbeiro` | + Ver horários da agenda, gerenciar perfil e fotos |
| `gerente` | + Gerenciar usuários, confirmar/cancelar agendamentos |
| `dono` | + Configurar loja, manutenção, promover a qualquer role |

> O primeiro usuário cadastrado vira `dono` automaticamente.

## Segurança

- JWT httpOnly cookie (30 dias)
- Bcrypt rounds 12 para senhas
- Validação de todos os inputs no servidor
- Rate limiting: 20 req/15min (auth) · 120 req/min (geral)
- Headers: `X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`, `Referrer-Policy`
- Sem exposição de stack traces ou variáveis sensíveis no client
- Role-based access control em todas as rotas
