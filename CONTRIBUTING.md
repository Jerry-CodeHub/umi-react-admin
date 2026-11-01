# Contributing Guide

> **中文版**：[CONTRIBUTING.zh-CN.md](./CONTRIBUTING.zh-CN.md) — the two copies are maintained in sync.

Thanks for your interest in umi-react-admin!

## Setting up

- Node.js 24 LTS (see `.nvmrc`; nvm / fnm recommended); minimum 22.22.2
- pnpm 11 (the `packageManager` field pins the version; pnpm 10 and corepack auto-switch). Configuration lives in `pnpm-workspace.yaml`; `.npmrc` only holds auth/registry. Switching from pnpm 10 requires rebuilding `node_modules` (add `--config.confirm-modules-purge=false` in non-interactive terminals).

```bash
pnpm install
cp .env.example .env.local   # fill in as needed
pnpm start:demo
```

## Workflow

1. Fork and branch off `master` with a short-lived branch (`feat/xxx`, `fix/xxx`)
2. Use conventional commit prefixes (`feat:` / `fix:` / `chore:` / `perf:` / `refactor:` / `test:` / `docs:`) — the commit-msg hook validates them
3. Run `pnpm check` before committing (typecheck + strict lint + vitest); run `pnpm test:coverage` when you touch the covered areas, `pnpm e2e:build` (browser smoke) when pages change, and `pnpm size` (bundle budget gate) when build configuration changes
4. Open a PR — CI runs the full quality gates (typecheck, lint, vitest, the coverage gate, build smoke, Playwright, artifact secret scanning and the integrity-manifest round trip)

## Conventions

- Naming: components PascalCase, utility functions camelCase, component directories PascalCase; route paths lowercase kebab-case (when changing a path, register the old one in `LEGACY_REDIRECTS` in `config/routes.ts`)
- No `console.log` (warn/error allowed); `===` enforced; avoid explicit `any`
- All UI copy goes through `src/locales` (zh/en key parity enforced by tests); Chinese literals in code are rejected by the `local/no-cjk-literal` rule (demo data in `src/demo` is exempt)
- Styling: antd tokens + Tailwind; third-party component skins use plain CSS scoped by a root class. styled-components / Less / CSS Modules are not used
- New pages use the `DemoPage` shell (description + view-source) and fetch data via `src/services` and the demo backend (`src/demo/server/routes.ts`) — never hard-code sample data in pages
- New files under `public/` must be registered in [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md) with source and license
- Docs are bilingual: `README`, `SECURITY`, `CONTRIBUTING`, `THIRD-PARTY-NOTICES` and `CODE_OF_CONDUCT` each have a `.zh-CN.md` copy that must stay **semantically identical** (technical nouns such as Cesium, Tailwind, Vite, AMap, Vercel, Docker, SHA-256, nginx stay English). [docs/demo/role-matrix.md](./docs/demo/role-matrix.md) is Chinese-only and is the acceptance baseline for permissions; `CHANGELOG.md` is a historical record and is not mirrored

## Security-sensitive changes

- **Permission points are single-source.** Add a new point to `PERMISSION_TREE` in `src/constants/permissions.ts`, then wire it in the same PR: `access` in `config/routes.ts` for pages, `src/access.ts` for buttons, the demo backend route in `src/demo/server/routes.ts`, and the API→permission table in [docs/demo/role-matrix.md](./docs/demo/role-matrix.md). Do not re-derive a role's permissions anywhere else — the matrix reproduces `DEFAULT_ROLE_PERMISSIONS` item by item and must stay exact.
- **Never describe demo mode as real authorization.** The in-browser demo backend demonstrates the contract; every check runs in the user's own browser, so the docs must always say that a real backend has to implement it. The same applies to audit logs, the role-assignment rules and coordinate precision.
- **New build-time credential.** Register it in `CREDENTIAL_DECLARATIONS` in `scripts/check-dist-secrets.mjs`, give it a typed `EXPECTED_*` declaration and a shape check, and declare it in every pipeline that injects it (Vercel env, Cloudflare Pages env, Docker build args, the Pages workflow's scan step). An injected-but-undeclared credential fails the scan by design.
- **Do not weaken a gate to land a change.** Thresholds, allowlists, CSP sources and security tests must not be relaxed; if a gate blocks you, fix the cause or raise it in the PR description. (The one deliberate amendment on record: dependency-advisory tiering, 2026-11-01 — runtime stays zero-ignore, build-chain-only advisories warn; rationale and scope in SECURITY.md.)

## Testing

- Unit tests: `src/**/*.test.ts` (vitest) — demo data sanity, demo backend endpoints, request layer, geo math, import/export
- Repo-level: `scripts/*.test.ts` — repository hygiene, CSP and security-header consistency across Vercel, nginx and Cloudflare Pages, AMap loader-host pinning, route table (components exist, legacy paths resolve, bilingual menu keys), deploy-routing fail-closed behaviour, Dockerfile frontend pinning, integrity manifest
- Browser: `e2e/` (Playwright, 112 cases green against the new contract) — every page free of errors / CSP violations, English UI without leftover Chinese, key business flows; cases tagged `@smoke` re-run against the live site after each deployment
- Accessibility: `e2e/a11y.spec.ts` injects axe-core from the existing transitive install (no new dependency; served same-origin because the CSP has no `unsafe-inline`) and runs **27 cases** in three groups — 11 routes × light (cold start), 11 routes × realDark (cold start), and 5 routes (`/login`, `/`, `/ops/devices`, `/ops/alarms`, `/ops/tickets`) × realDark reached by **clicking** the header theme toggle. The toggle group exists because umi's `setAntdConfig` deep-merges and the light/dark token sets were previously asymmetric, leaving light seeds behind on a hot switch; both sets now hold the same 13 keys and the toggle path was measured to produce byte-identical tokens to a cold-start dark across 17 CSS variables. Command `pnpm exec playwright test e2e/a11y.spec.ts --workers=1`; the gate is **0 critical and 0 serious across all cases** with the exclusion list empty (no rule excluded, no threshold lowered, nothing reclassified). This is **not** "axe clean": the moderate/minor findings are reported and stay non-gating — `landmark-no-duplicate-banner` and `landmark-unique` (moderate, 2 per route, ProLayout header/banner), Calendar `heading-order` (moderate) and FullCalendar's `empty-table-header` (minor ×7), plus a `region` moderate on the empty portal `<div>` antd creates when the toggle's tooltip opens (toggle cases only). Treat any newly appearing critical/serious result as a regression to fix, not to exclude.
- Coverage: `pnpm test:coverage` — the percentage is measured over the **selected include set** in `vitest.config.ts` (`src/utils`, `src/services`, `src/demo`, `src/pages/Login`, `src/pages/System/Users`, `src/pages/System/Roles`), not the whole project; thresholds (statements 60 / branches 50 / functions 60 / lines 60) gate that set in CI and must not be lowered. Final local figure: statements 79.38% / branches 74.48% / functions 75.55% / lines 81.51% over 54 files (644 passed, 5 skipped — the skips are the mode-conditional branches of `scripts/real-mode-artifact.test.ts`), against roughly 47.87% statements for whole-project `src/**`
- Lint: `react-hooks/exhaustive-deps` is an error and unused-disable reporting is on (an unused disable directive is itself an error). A disable line must carry a concrete written reason on the same or preceding line; the 6 `exhaustive-deps` disables currently in `src/` (`src/hooks/useApi.ts` plus five Cesium scene pages' clock/pure-function effects) each carry their reason on the line.
