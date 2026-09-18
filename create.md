# Repository Creation Log

Every command executed to scaffold this project, in order. Run from the repo
root on Windows (PowerShell / Git Bash), Node.js 24, npm 11.

## 1. Next.js base

```bash
npx create-next-app@latest . \
  --typescript --tailwind --eslint --app --src-dir \
  --import-alias "@/*" --use-npm --no-turbopack --disable-git
```

Generated: App Router + TypeScript (strict) + Tailwind CSS v4 + ESLint flat
config, under `src/`.

## 2. Runtime dependencies

```bash
npm i drizzle-orm postgres zod next-intl next-themes
```

| Package       | Purpose                       |
| ------------- | ----------------------------- |
| `drizzle-orm` | ORM                           |
| `postgres`    | PostgreSQL driver             |
| `zod`         | Schema validation             |
| `next-intl`   | i18n (Spanish + English)      |
| `next-themes` | Light / dark / system theming |

## 3. Dev dependencies

```bash
# create-next-app pins @types/node ^20; vitest 5 requires ^22 || >=24
npm pkg set devDependencies.@types/node="^24"

npm i -D \
  drizzle-kit dotenv \
  vitest @vitejs/plugin-react jsdom \
  @testing-library/react @testing-library/dom \
  @testing-library/jest-dom @testing-library/user-event \
  prettier eslint-config-prettier eslint-plugin-prettier \
  prettier-plugin-tailwindcss

npm i -D tsx   # runs src/db/seed.ts
```

> `vite-tsconfig-paths` was installed first, then removed in favor of Vite's
> native `resolve.tsconfigPaths` option:
>
> ```bash
> npm uninstall vite-tsconfig-paths
> ```

## 4. shadcn/ui

```bash
npx shadcn@latest init -d --force

npx shadcn@latest add button card input label dropdown-menu sonner table --yes
npx shadcn@latest add sidebar breadcrumb separator sheet skeleton tooltip avatar --yes
```

`init -d` uses the `base-nova` style (`@base-ui/react` primitives, `cn` helper)
with the `neutral` base color, writing `components.json` and updating
`src/app/globals.css` with the light/dark design tokens.

## 5. npm scripts

```bash
npm pkg set \
  scripts.dev="next dev" \
  scripts.build="next build" \
  scripts.start="next start" \
  scripts.lint="eslint" \
  scripts.format="prettier --write ." \
  scripts.format:check="prettier --check ." \
  scripts.typecheck="tsc --noEmit" \
  scripts.test="vitest run" \
  scripts.test:watch="vitest" \
  scripts["db:generate"]="drizzle-kit generate" \
  scripts["db:migrate"]="drizzle-kit migrate" \
  scripts["db:push"]="drizzle-kit push" \
  scripts["db:studio"]="drizzle-kit studio" \
  scripts["db:seed"]="tsx src/db/seed.ts"
```

## 6. Environment file

```bash
cp .env.example .env
```

`.env.example` contents:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/justifia"
```

## 7. Files authored manually

Not commands, but part of the scaffold:

| Path                                                                         | Purpose                                    |
| ---------------------------------------------------------------------------- | ------------------------------------------ |
| `drizzle.config.ts`                                                          | Drizzle Kit config (postgresql dialect)    |
| `src/env.ts`                                                                 | Zod-validated environment variables        |
| `src/db/schema.ts`                                                           | `users`, `audit_logs` tables + relations   |
| `src/db/index.ts`                                                            | Drizzle client (pooled, hot-reload safe)   |
| `src/db/seed.ts`                                                             | Demo users seed                            |
| `src/i18n/config.ts` `locale.ts` `request.ts`                                | next-intl setup, cookie-based locale       |
| `messages/es.json` `messages/en.json`                                        | Translation catalogs                       |
| `next.config.ts`                                                             | Wrapped with `createNextIntlPlugin`        |
| `src/app/layout.tsx`                                                         | `NextIntlClientProvider` + `ThemeProvider` |
| `src/components/theme-provider.tsx` `theme-toggle.tsx` `locale-switcher.tsx` | Theme + locale controls                    |
| `src/components/app-sidebar.tsx` `dashboard-header.tsx`                      | Backoffice shell                           |
| `src/app/(dashboard)/layout.tsx` `page.tsx` `users/page.tsx`                 | Dashboard route group                      |
| `src/lib/data/users.ts`                                                      | Server-side queries with DB-down fallback  |
| `src/lib/validations/user.ts`                                                | Zod schemas                                |
| `vitest.config.mts` `vitest.setup.ts`                                        | Vitest (jsdom) config                      |
| `src/lib/validations/user.test.ts` `src/components/theme-toggle.test.tsx`    | Tests                                      |
| `.prettierrc.json` `.prettierignore`                                         | Prettier config                            |
| `eslint.config.mjs`                                                          | Added `eslint-plugin-prettier/recommended` |
| `src/hooks/use-mobile.ts`                                                    | Rewritten with `useSyncExternalStore`      |
| `.gitignore`                                                                 | Added `!.env.example`                      |

## 8. Format, lint fix, migration

```bash
npx prettier --write .
npx eslint . --fix
npx drizzle-kit generate --name init   # -> drizzle/0000_init.sql
```

## 9. Verification

```bash
npx tsc --noEmit     # pass
npx vitest run       # 6 passed
npx next build       # pass (TypeScript checked)
npx next start -p 3123   # / and /users -> 200
```

## Next steps

```bash
npm install
cp .env.example .env        # set DATABASE_URL
npm run db:push             # needs a running PostgreSQL
npm run db:seed             # optional
npm run dev
```
