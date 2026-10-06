"Minhas máquinas": the list of machines (targets) a portal account may open, each with a live health badge and an Abrir button that hands off to that machine's herdr web ui.

## When to use
`/portal`, when an account has more than one target (with one, login goes straight to herdr). Also the shape for any list of machines or sessions in the portal.

## Anatomy
`main.card` › `.topbar` (brand left; `.who` with the username, an `admin` badge and a secondary **Sair**) › `h1` › `p.muted.small` › `.target-list` (grid, 12px gap) › `.target` rows (`--portal-bg-elev-2`, `--radius-portal-row`): `strong` label + `.badge[data-health]`, `.meta` line ("usuário joao · máquina vps-a · /home/joao · sessão x"), and a primary `button` **Abrir**. Footer link "Administração do portal" for admins.

## States
- Health: `.badge` "verificando…" (neutral) → `.badge.ok` "online" or `.badge.off` "offline" (tooltip carries the error).
- Abrir is disabled while the redirect is requested; a failure shows in `.alert.error`.
- Empty: `p.muted` "Nenhuma máquina liberada para esta conta ainda."
- ≤720px: rows stack (button under the text).

## The consumer provides
Target label, OS user, SSH host, home path, herdr session name, health result.

## Tokens
`--portal-bg-elev`, `--portal-bg-elev-2`, `--portal-border`, `--portal-text-muted`, `--portal-accent`, `--portal-ok`, `--portal-danger`, `--radius-portal-row`.

## Do / Don't
- Do always write health as a word as well as a colour.
- Don't open a machine on row click: the button is the action.

Source: public/portal.html · public/portal.js (targetRow) · public/styles.css
Preview: static rendition (markup + the repo's CSS, scoped under `.da-portal`).
