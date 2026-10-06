The public help page (`/ajuda`): a centred hero with two calls to action, then sections of soft cards with green line icons, numbered steps, profile tabs, a comparison, an FAQ accordion and a glossary — plus a guided tour overlay.

## When to use
Onboarding and explaining the portal to developers and non-developers, in Portuguese, without jargon ("Três ideias, sem jargão").

## Anatomy
`.help` (max 1080px) › `nav.help-nav` (brand + muted links + secondary **Entrar**) › `header.hero` (`h1` 34px, muted 17px lead, `.cta` with `.btn.btn-lg` + `.btn.secondary.btn-lg`) › `section` › `h2` (22px, sentence case here) + `p.lead` › `.cards` of `.card-soft` (`.ico > svg.ic` 22px green stroke icon, `h3` 15px, muted `p`) › `.steps` of `.step-card` (`.n` 28px green square) › `.tabs` (pill track) › `.cmp-grid` › `.acc details` › `.gloss`. Media: `.demo-video`, `.demo-gallery` figures of herdr screenshots (see the Screens assets).

## Variants and states
Tabs: the selected tab is a green pill; cards collapse to one column under 900px. The tour (`.tour`) is a dialog over `--portal-scrim` with a 4px blur, a two-column card (screen mock | kicker, title, list, dots, Anterior / Próximo).

## Tokens
`--portal-bg-elev`, `--portal-border`, `--portal-text`, `--portal-text-muted`, `--portal-accent`, `--portal-accent-ink`, `--portal-warn`, `--portal-scrim`, `--radius-portal`.

## Do / Don't
- Do use `--portal-accent-ink` on green fills. The source's selected tab and step numbers use white (1.8:1, fails AA) — fix when you touch them.
- Do draw icons as 2px green line icons (Feather/Lucide style), never emoji. (The source's CTA starts with a ▶ glyph.)
- Don't reuse the help page's mock colours (`#0f1720`, `#6ba0ff`, blue chat lines) as tokens: they illustrate herdr loosely; use the herdr components instead.

Source: public/ajuda.html · public/ajuda.css · public/ajuda.js
Preview: static rendition (markup + the repo's CSS, scoped under `.da-portal`).
