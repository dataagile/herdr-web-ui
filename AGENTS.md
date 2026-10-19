# herdr-web-ui

Browser UI for the herdr terminal multiplexer: a React 19 + xterm.js client (`src/`), a Bun
backend (`server/`) that bridges herdr's unix-socket API, and the wire contract both import
(`shared/`). herdr owns every pty, scrollback and agent state; this app is only a bridge.

These files hold only the traps the code and tests do not show. Commands, layout, checks and
release steps are in [docs/development.md](docs/development.md); contributors follow
[CONTRIBUTING.md](CONTRIBUTING.md). Code conventions (imports, CSS tokens, i18n entries, fixed
sleeps, wording, icons) are enforced by the `conventions.test.ts` files, whose failures say what
to change. Also read [server/AGENTS.md](server/AGENTS.md) and [src/AGENTS.md](src/AGENTS.md).

## Bridge traps
- Never load node-pty inside Bun: it panics the runtime. PTY work goes through the Node sidecar.
- Never pass `--takeover` to `herdr terminal attach` on the server's own initiative; it cuts off
  whoever holds the pane. Only a user's explicit take-over request may.
- One herdr RPC connection per call: herdr closes the socket after each answer. Only
  `events.subscribe` stays open, and a second subscribe on it is ignored, so reopen with the full
  set. Caching answers is fine.
- `pane.process_info` takes `pane_id`, not `target` (with `target` herdr answers for the focused
  pane).
- Keep xterm `scrollback: 0` and never rebuild an attached terminal from `pane.read`: the attach
  stream is the truth. Only a mirrored pane (Windows, or no Node for the sidecar) is drawn from
  `pane.read`, so never assume a pty exists.
- Nothing the user typed is sent automatically after a disconnect: it waits in a draft until the
  user sends or discards it.
- Prompt answers go through `POST /api/pane/prompt/answer`, never guessed digit keys.
- Selecting a pane or tab in the browser never moves herdr's own focus; only an explicit action
  that needs it calls `pane.focus`.
- Never edit `shared/herdr-api.generated.ts`; run `bun run generate:types`.
- Theme colors are edited only in the theme blocks of `src/styles.css`. Never edit
  `src/lib/themes.generated.ts` or the generated copies in DESIGN.md, index.html and
  `public/manifest.webmanifest`; run `bun run generate:themes`.

## Tests and QA
- Tests never touch the user's herdr session or real state: they use the isolated test session,
  a `mkdtempSync` `stateDir` and `port: 0` for every `createServer`. Never run the real
  `herdr update` in a test.
- Screenshots and recordings come from the demo or a test session, never the user's live one.
- A web UI server an agent starts for someone to open (manual QA, a preview) binds to this PC's
  Tailscale address, not loopback: `HOST=$(tailscale ip -4) PORT=<free port> bun run server`,
  then hand over `http://<that address>:<port>`. A Tailscale-only bind stays inside the tailnet
  (`lanExposed` in `server/access.ts`); never bind `0.0.0.0` for it. Tests keep `port: 0` on
  loopback.

## Data Agile fork

- This repository is Data Agile's fork. The design system for it and for the Portal Dev Data Agile (`dataagile/portal_desenvolvimento`, which signs people in and opens this app) is `design-system/` — start at `design-system/INDEX.md`. It mirrors `DESIGN.md` and `src/styles.css` value for value: a token change updates `src/styles.css`, `DESIGN.md` and `design-system/` (tokens.json, tokens.css, README) together, and the Claude design system artifact *Data Agile Dev* that it is exported from.
- **Every UI change follows `design-system/`, always** — code, mockups and prototypes alike. Before writing UI, read `design-system/INDEX.md`, `README.md` and the README of each component the change touches. Use the existing tokens and components: no new colour, size or radius literal, no new component when one in `design-system/components/` fits. A change that adds, removes or reshapes a component updates `design-system/` in the same PR — the component's `README.md` and `preview.html`, and its CSS copy in `components/bundle.css` — so it never documents UI that no longer exists.
- The product is named **DevDA** ("DevDA, da Data Agile" in prose): no user-visible string says "herdr" (the tool reads "session server" / "servidor de sessões"); internal names (binary, `HERDR_*`, storage keys, API paths) keep it. The app icon is the "<DA/>" mark (`design-system/assets/DevIcons/`, `docs/brand/icon-source.svg`), not upstream's ram. `scripts/generate-brand.ts` is disabled because it exports the ram; see `docs/brand/README.md`. Icon files are versioned `?v=da2`.
- i18n: every new `t("…")` also needs its entry in `src/lib/i18n.pt.ts` (fork-only), next to ko/ja/zh; `i18n.test.ts` checks all five.
- UI wording: "New project" (herdr calls it a workspace; code, API and protocol keep that name), not "New session".
- `src/lib/dataAgilePortal.ts` reads the Data Agile gateway's `GET /api/portal/me` (feedback, PC name, Add PC); upstream's own "Portal" (a public address for this PC) lives in `src/lib/portal.ts`. The gateway answers `/api/portal/me` itself, in front of this app.
- Keep upstream merges clean: fork-only changes stay in `design-system/`, `docs/brand/`, the icon files and this section.

## Maintainer workflow
- A session that changes code, in any harness, stops at an open PR: only the maintainer's merge
  pass merges, unless the maintainer asks that session to merge. One session that edits files per
  worktree; read-only sessions may share it.
- A worktree an agent adds with `git worktree add` that outlives its session (an open PR) goes
  under `~/.herdr/worktrees/herdr-web-ui-wt/`, named after its branch with `/` as `-`
  (`fix/pin-order` in `herdr-web-ui-wt/fix-pin-order`); a short-lived one may stay in the run's
  temp root, and skills that name their own path keep it. Once its PR merges, remove the
  worktree and its branch.
- After a merge, the merge pass also closes the herdr worktree workspace the PR came from (the
  one checked out on the PR's branch, under `~/.herdr/worktrees/herdr-web-ui/`), only when all
  hold: no pane in it has an agent `working`, `git status` there is clean, and the branch's tip
  is the PR's head commit (`gh pr view --json headRefOid`), so nothing was added after it. Close
  it with `herdr worktree remove --workspace <id>`, never `git worktree remove`, so the
  workspace leaves with its checkout. herdr keeps the branch: then `git branch -D` it (a squash
  merge leaves it unmerged to git; GitHub already deletes the remote one). A workspace that
  fails a check stays, and the merge report names it and why. A session never removes the
  worktree it runs in.
- Everything written to git and GitHub (commits, branches, PRs, reviews, issues, changelog
  fragments) is in English.
- Never push a `v*` tag by hand: installed updaters act on tags alone.
- The merge pass cuts releases ([steps](docs/development.md#releasing)); any other session may
  prepare the release PR but stops at it. When that PR raises `REMOTE_BUNDLE_VERSION`, the merge
  pass merges nothing touching `server/`, `shared/`, `bun.lock` or `patches/` from its merge until
  the Release run is done.
- Required checks: Fast checks, Integration and browser, Native Windows install. Resolve review
  threads before merging (branch protection does not enforce it).
- CodeRabbit's reviews are rationed per PR author, and agents open their PRs as one account:
  opening a PR, a push and each `@coderabbitai review` spend one, and past about 80 in a week
  one comes back per hour. Open verified work ready for review, not as a draft: the merge pass
  reviews every PR itself and stops at a draft. A draft is only for work still unfinished; push
  it once when it is ready. Do not open a stack of PRs at once, and ask for another review
  only after a commit that changes behaviour in `server/`, `src/` or `shared/`, an HTTP/WS
  contract or a workflow. A rebase, changelog fragment, docs, comment or test-only commit gets
  none.
- A rate-limited review still shows a passing CodeRabbit check; its "Review limit reached"
  comment means no review ran. A PR touching `--takeover`, observe permissions, queued input,
  authentication, an HTTP/WS contract or a workflow waits for a real review. Any other PR says
  in a comment that CodeRabbit did not review it, and merges on its checks and the maintainer.
- Changelog entries go in `changelog.d/` fragments ([format](changelog.d/README.md)), not
  CHANGELOG.md; only a release folds them in.
