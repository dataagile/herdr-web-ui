/**
 * Masking by value for the feedback a user sends, run in the browser before anything leaves it.
 * A port of AgentOS's `services/scrub.ts`; the cases in `feedbackScrub.vectors.json` are that
 * project's shared table (its Python side tests the same file), so a rule changes here and there
 * together. Input is untrusted (console text, URLs, page text): the 100 KB cases in
 * `feedbackScrub.test.ts` guard against catastrophic backtracking.
 */

const BEARER_RE = /\b(bearer)\s+[\w.~+/=-]+/gi;
const AUTHORIZATION_RE = /(?<![A-Za-z0-9])(authorization)\s*[:=]\s*(?!\[|bearer \[token\])\S+(?: \S+)?/gi;
const COOKIE_RE = /(?<![A-Za-z0-9])(cookie\s*:\s*)[^\r\n]+/gi;
// Palavra sensível ancorada: `tokens:`/`keyboard:` não casam; `access_token`, `x-api-key` casam.
const KV_RE =
  /(?<![A-Za-z0-9])((?:token|password|passwd|senha|secret|api[_-]?key)(?![A-Za-z0-9_-])["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s&"']+)/gi;
const PROVIDER_KEY_RE = /sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16}/g;
const CARD_RE = /(?<![0-9])\d{4}[ -]\d{4}[ -]\d{4}[ -]\d{4}(?![0-9])/g;
const CPF_RE = /(?<![0-9])\d{3}[. ]\d{3}[. ]\d{3}[-. ]\d{2}(?![0-9])/g;
const CNPJ_RE = /(?<![0-9])\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}(?![0-9])/g;
const DOC_PLAIN_RE = /(?<![0-9])(?:\d{11}|\d{14})(?![0-9])/g;
const NUM_LONG_RE = /(?<![0-9])\d{13,}(?![0-9])/g;
const EMAIL_STOP_RE = /[\s@<>()[\]"',;]/;
const EMAIL_DOMAIN_RE = /[\w-]+(?:\.[\w-]+)+/y;

/** JWT linear: o regex `eyJ[\w-]+\.[\w-]+\.[\w-]+` é quadrático em `eyJeyJ…`; aqui cada corrida `[\w.-]+` é varrida uma vez. */
function scrubJwt(text: string): string {
  return text.replace(/[\w.-]+/g, (run) => {
    if (!run.includes("eyJ")) return run;
    const segs = run.split(".");
    let out = "";
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i]!;
      const p = seg.indexOf("eyJ");
      if (p >= 0 && segs[i + 1] && segs[i + 2]) {
        out += (out ? "." : "") + seg.slice(0, p) + "[TOKEN]";
        i += 2;
      } else {
        out += (out || i ? "." : "") + seg;
      }
    }
    return out;
  });
}

/** E-mail linear: acha cada `@` e expande para os lados, sem regex com corrida à esquerda. */
function scrubEmails(t: string): string {
  let out = "";
  let last = 0;
  let at = t.indexOf("@");
  while (at >= 0) {
    let start = at;
    while (start > last && !EMAIL_STOP_RE.test(t[start - 1]!)) start--;
    EMAIL_DOMAIN_RE.lastIndex = at + 1;
    const m = start < at ? EMAIL_DOMAIN_RE.exec(t) : null;
    if (m) {
      out += t.slice(last, start) + "[EMAIL]";
      last = at + 1 + m[0].length;
      at = t.indexOf("@", last);
    } else {
      at = t.indexOf("@", at + 1);
    }
  }
  return out + t.slice(last);
}

/** Texto livre (console, message): JWT, Bearer, chave=valor, provedores, e-mail, cartão, CPF/CNPJ, >=13 dígitos. */
export function scrubText(text: string): string {
  let t = scrubJwt(text.normalize("NFKC"));
  t = t.replace(BEARER_RE, "$1 [TOKEN]");
  t = t.replace(AUTHORIZATION_RE, "$1: [TOKEN]");
  t = t.replace(COOKIE_RE, "$1[TOKEN]");
  t = t.replace(KV_RE, (m, pre: string) => {
    const q = m.charAt(pre.length);
    return q === '"' || q === "'" ? `${pre}${q}[TOKEN]${q}` : `${pre}[TOKEN]`;
  });
  t = t.replace(PROVIDER_KEY_RE, "[TOKEN]");
  t = scrubEmails(t);
  t = t.replace(CARD_RE, "[NUM]");
  t = t.replace(CPF_RE, "[DOC]").replace(CNPJ_RE, "[DOC]");
  t = t.replace(DOC_PLAIN_RE, "[DOC]");
  return t.replace(NUM_LONG_RE, "[NUM]");
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AUTH_TOKEN_PATH_RE = /^\/api\/v\d+\/auth\/(?:password-reset|invitations)\/[^/?#]+/;
const SCHEME_HOST_RE = /^(?:[a-z][a-z0-9+.-]*:)?\/\/[^/?#]*/i;

function scrubSegment(s: string): string {
  if (UUID_RE.test(s)) return s;
  if (/^\d{13,}$/.test(s)) return "[NUM]";
  if (s.length >= 20 && /^[A-Za-z0-9_-]+$/.test(s) && /\d/.test(s) && /[A-Za-z]/.test(s)) return "[TOKEN]";
  return s;
}

function scrubPath(path: string): string {
  const m = AUTH_TOKEN_PATH_RE.exec(path);
  if (!m) return path.split("/").map(scrubSegment).join("/");
  // Token da rota de auth sempre some (até UUID); o que vier depois passa pela regra normal.
  const head = m[0].slice(0, m[0].lastIndexOf("/") + 1);
  return head + "[TOKEN]" + path.slice(m[0].length).split("/").map(scrubSegment).join("/");
}

/** Path + query: segmento-token em path, `/auth/*` sempre `[TOKEN]`, todo valor de query vira `[Q]`. */
export function scrubUrl(url: string): string {
  let rest = url.replace(SCHEME_HOST_RE, "");
  const hadHost = rest.length !== url.length;
  const hash = rest.indexOf("#");
  if (hash >= 0) rest = rest.slice(0, hash);
  const qi = rest.indexOf("?");
  let path = qi >= 0 ? rest.slice(0, qi) : rest;
  if (hadHost && !path) path = "/"; // host sem path vira `/`, como no back
  const query = qi >= 0 ? rest.slice(qi + 1) : "";
  const q = query
    ? "?" +
      query
        .split("&")
        .map((kv) => {
          const eq = kv.indexOf("=");
          return eq >= 0 ? `${kv.slice(0, eq)}=[Q]` : kv;
        })
        .join("&")
    : "";
  return scrubPath(path) + q;
}

/** Texto que veio do chat: só o tamanho (`[TEXTO OMITIDO n chars]`). */
export function scrubChatText(text: string): string {
  return `[TEXTO OMITIDO ${[...text].length} chars]`;
}

const SENSITIVE_WORDS = new Set([
  "password", "passwd", "pass", "senha", "token", "secret", "key", "credential", "credentials",
  "auth", "authorization", "cert", "pem", "cpf", "cnpj", "cookie", "jwt", "apikey",
]);

/** Chave sensível por PALAVRA (não substring): `keyboard`/`author` false, `api_key`/`authToken` true. */
export function isSensitiveKey(key: string): boolean {
  return key
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .split(/[_\-\s.]+/)
    .some((w) => SENSITIVE_WORDS.has(w));
}
