The portal's sign-in card: the Data Agile wordmark, "Entrar", Usuário and Senha fields, a full-width green submit and an inline alert.

## When to use
The first screen of herdr.dataagile.com.br (`/login`), and the same card shape for `/register?invite=…` and the first-run "Criar administrador" form. One card, centred on the glowing page ground.

## Anatomy
`.da-portal.center` page › `main.card` (max 420px, `--radius-portal`, `--shadow-portal`) › `.brand > img.brand-logo` (26px tall) › `h1` › `p.muted.small` › `form` (`label` + `input` pairs) › `button.submit` › `.alert[role="alert"]`.

## States
- Field focus: border `--portal-accent` plus a 3px `--portal-focus` halo.
- Submit pending: `button:disabled` (opacity .55).
- Errors: `.alert.error` (`--portal-danger-tint`, `--portal-error-text`); success: `.alert.ok` (`--portal-success-text`).

## The consumer provides
Labels and copy in Portuguese, `autocomplete` values (`username`, `current-password`, `new-password`), the alert text.

## Tokens
`--portal-bg`, `--portal-glow`, `--portal-bg-elev`, `--portal-bg-elev-2`, `--portal-border`, `--portal-text`, `--portal-text-muted`, `--portal-accent`, `--portal-accent-ink`, `--radius-portal`, `--radius-portal-control`, `--shadow-portal`, `--font-portal`.

## Do / Don't
- Do keep one primary action per card, in green with `--portal-accent-ink` text.
- Don't put the herdr amber here: the portal is Data Agile green; amber begins once the herdr web ui opens.
- Don't place the wordmark on a light ground — its "DATA" half is white outline.

Source: dataagile/portal_desenvolvimento · public/login.html · public/styles.css
Preview: static rendition (markup + the repo's CSS, scoped under `.da-portal`).
