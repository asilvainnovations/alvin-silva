// job-extract — controlled server-side retrieval of job postings (CIOMS D2/§4.2).
//
//   POST { "url": "https://…" }  ->  { text, title, finalUrl, retrievedAt, bytes, contentType }
//
// Pipeline: URL validation -> signed-in caller only -> optional domain
// allowlist -> DNS resolution with private-network rejection -> manual
// redirects (each hop re-validated, max 3) -> size and content-type limits
// -> HTML cleaning -> plain text. The text is returned as UNTRUSTED input;
// the browser shows it for verification before analysis.
//
// Env (optional):
//   ALLOWED_EMAILS   comma-separated; if set, only these accounts may call
//   ALLOWED_HOSTS    comma-separated host suffixes (e.g. reliefweb.int,devex.com)
//   ALLOWED_ORIGINS  comma-separated origins for CORS (default: the canonical site)
//
// Deploy: supabase functions deploy job-extract   (JWT verification stays ON)

const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;
const DEFAULT_ORIGINS = ["https://alvin-silva.asilvainnovations.com"];

const env = (k: string) => (Deno.env.get(k) ?? "").split(",").map((s) => s.trim()).filter(Boolean);

function cors(origin: string | null) {
  const allowed = env("ALLOWED_ORIGINS").length ? env("ALLOWED_ORIGINS") : DEFAULT_ORIGINS;
  const ok = origin && (allowed.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));
  return {
    "Access-Control-Allow-Origin": ok ? origin! : allowed[0],
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
}

/* ---------- private / reserved address detection (IPv4 + IPv6) ---------- */
function ipv4Private(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
    (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19));
}
function ipv6Private(ip: string): boolean {
  const s = ip.toLowerCase();
  if (s === "::" || s === "::1") return true;
  if (s.startsWith("::ffff:")) return ipv4Private(s.slice(7));
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(s);
}
const isIpLiteral = (h: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(":");

async function assertPublicHost(url: URL) {
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("only http(s) URLs are allowed");
  if (url.username || url.password) throw new Error("credentials in URLs are not allowed");
  if (url.port && !["80", "443"].includes(url.port)) throw new Error("non-standard ports are not allowed");
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) throw new Error("private host");
  const allow = env("ALLOWED_HOSTS");
  if (allow.length && !allow.some((a) => host === a || host.endsWith("." + a))) throw new Error("host is not on the allowlist");
  if (isIpLiteral(host)) {
    if (host.includes(":") ? ipv6Private(host) : ipv4Private(host)) throw new Error("private address");
    return;
  }
  const [v4, v6] = await Promise.all([
    Deno.resolveDns(host, "A").catch(() => [] as string[]),
    Deno.resolveDns(host, "AAAA").catch(() => [] as string[]),
  ]);
  if (!v4.length && !v6.length) throw new Error("host does not resolve");
  if (v4.some(ipv4Private) || v6.some(ipv6Private)) throw new Error("host resolves to a private address");
}

/* ---------------------------- HTML -> text ---------------------------- */
function htmlToText(html: string): { text: string; title: string } {
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s+/g, " ").trim();
  let body = html
    .replace(/<(script|style|noscript|svg|nav|footer|header|form|iframe)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const main = body.match(/<(main|article)[^>]*>([\s\S]*?)<\/\1>/i)?.[2];
  if (main && main.length > 800) body = main;
  const text = body
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)[^>]*>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n\s*\n+/g, "\n\n").trim();
  return { text: text.slice(0, 40_000), title };
}

async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) { await reader.cancel(); throw new Error("response too large"); }
    chunks.push(value);
  }
  const buf = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) { buf.set(c, o); o += c.byteLength; }
  return new TextDecoder().decode(buf);
}

async function callerEmail(req: Request): Promise<string | null> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "" },
  });
  if (!res.ok) return null;
  const u = await res.json();
  return u?.email ?? null;
}

Deno.serve(async (req) => {
  const headers = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return json({ error: "POST only" }, 405, headers);

  // Signed-in users only — the anon key alone must not turn this into an open proxy.
  const email = await callerEmail(req);
  if (!email) return json({ error: "sign in to use the retrieval service" }, 401, headers);
  const allowedEmails = env("ALLOWED_EMAILS").map((e) => e.toLowerCase());
  if (allowedEmails.length && !allowedEmails.includes(email.toLowerCase())) return json({ error: "not authorized" }, 403, headers);

  let target: URL;
  try {
    const body = await req.json();
    target = new URL(String(body?.url ?? ""));
  } catch {
    return json({ error: "body must be JSON with a valid url" }, 400, headers);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let current = target;
    let res: Response | null = null;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      await assertPublicHost(current);
      res = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": "CIOMS-job-extract/1.0 (+https://alvin-silva.asilvainnovations.com)", Accept: "text/html,text/plain;q=0.9" },
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        current = new URL(res.headers.get("location")!, current);
        await res.body?.cancel();
        continue;
      }
      break;
    }
    if (!res) throw new Error("no response");
    if (res.status >= 300 && res.status < 400) throw new Error("too many redirects");
    if (!res.ok) throw new Error(`source returned HTTP ${res.status}`);
    const ct = res.headers.get("content-type") ?? "";
    if (!/text\/html|text\/plain|application\/xhtml/.test(ct)) throw new Error(`unsupported content type: ${ct || "unknown"}`);
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > MAX_BYTES) throw new Error("response too large");
    const raw = await readCapped(res);
    const { text, title } = /text\/plain/.test(ct) ? { text: raw.slice(0, 40_000), title: "" } : htmlToText(raw);
    if (text.length < 200) throw new Error("page returned too little text (it may require sign-in or JavaScript)");
    return json({ text, title, finalUrl: current.href, retrievedAt: new Date().toISOString(), bytes: raw.length, contentType: ct }, 200, headers);
  } catch (e) {
    const msg = e instanceof Error ? (e.name === "AbortError" ? "timed out" : e.message) : "retrieval failed";
    return json({ error: msg }, 422, headers);
  } finally {
    clearTimeout(timer);
  }
});
