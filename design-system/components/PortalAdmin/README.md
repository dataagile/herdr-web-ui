The portal's administration page: stat tiles, then stacked panels (users, targets, invites, usage, audit) with forms, tables, pill badges and compact row actions.

## When to use
`/admin` only — admins manage accounts, machine targets (machine + OS user + backend URL), invite links and see usage and the audit log.

## Anatomy
`.wrap` (max 1100px) › `.topbar` › `.stats` (4 columns, 2 under 720px) of `.stat` (`.n` 26px bold number, `.l` uppercase muted label) › `section.panel` (`--portal-bg-elev`, `--radius-portal`, 20px padding) › `.panel-head` (`h2` uppercase muted + a secondary **Atualizar**) › `form.inline-form` / `form.grid-2` › `table` (uppercase muted `th`, hairline rows) › `.actions` (small buttons) › `.token-out` (strong + selectable `code`) › `pre.audit`.

## Variants
- Buttons: primary (green fill, `--portal-accent-ink`), `.secondary` (transparent, `--portal-border`), `.danger` (red text and edge, tinted on hover).
- Badges: neutral ("usuário"), `.ok` ("ativo", "online"), `.off` ("inativo", "esgotado", "expirado"), `.admin`.

## The consumer provides
Counts, rows, invite URLs and tokens (shown once, in `code` with `user-select: all`).

## Tokens
`--portal-bg-elev`, `--portal-bg-elev-2`, `--portal-border`, `--portal-text`, `--portal-text-muted`, `--portal-accent`, `--portal-danger`, `--portal-danger-edge`, `--radius-portal`, `--radius-portal-control`.

## Do / Don't
- Do keep destructive actions as `.danger` outline buttons at the end of `.actions`.
- Don't add colour to section headings: h2s are uppercase `--portal-text-muted`.

Source: public/admin.html · public/admin.js · public/styles.css
Preview: static rendition (markup + the repo's CSS, scoped under `.da-portal`).
