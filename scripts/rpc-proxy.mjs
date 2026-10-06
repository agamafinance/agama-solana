// A failover JSON-RPC proxy for Solana devnet: one local URL in front of every
// free endpoint, for the CRE CLI (which takes a single RPC per chain) and the
// scripts. A request that comes back rate limited (429, -32029), unavailable
// (5xx) or unanswered goes to the next upstream; an upstream that limits us
// sits out for a while. Extra keyed upstreams (Helius, Alchemy... free tiers)
// can be listed in .keys/rpc.env as RPC_UPSTREAMS=url1,url2.
//
//   node scripts/rpc-proxy.mjs            # listens on 127.0.0.1:8910
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const PORT = Number(process.env.RPC_PROXY_PORT ?? 8910);
const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const extra = (() => {
  if (process.env.RPC_UPSTREAMS) return process.env.RPC_UPSTREAMS.split(",").filter(Boolean);
  try {
    const line = fs.readFileSync(path.join(root, ".keys/rpc.env"), "utf8").split("\n").find((l) => l.startsWith("RPC_UPSTREAMS="));
    return line ? line.slice("RPC_UPSTREAMS=".length).split(",").map((s) => s.trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
})();
// Keyed endpoints first (they have the most headroom), then the public ones.
// `noScan`: answers getProgramAccounts with an empty list, so never asked it.
const UPSTREAMS = [
  ...extra.map((url) => ({ url })),
  { url: "https://rpc.magicblock.app/devnet" },
  { url: "https://api.devnet.solana.com" },
  { url: "https://devnet.rpcpool.com" },
  { url: "https://api.devnet.sonic.game", noScan: true },
].map((u) => ({ ...u, until: 0, ok: 0, fail: 0 }));

const limited = (status, text) => status === 429 || status >= 500 || /"code":\s*(429|-32029|-32005)\b|Too many requests|rate limit/i.test(text);

async function forward(body, methods) {
  const now = Date.now();
  const candidates = UPSTREAMS.filter((u) => !(u.noScan && methods.includes("getProgramAccounts")));
  // Rested upstreams first, in order; benched ones only as a last resort.
  const order = [...candidates.filter((u) => u.until <= now), ...candidates.filter((u) => u.until > now)];
  let last = { status: 502, text: JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32000, message: "every upstream failed" } }) };
  for (const u of order) {
    try {
      const r = await fetch(u.url, { method: "POST", headers: { "Content-Type": "application/json" }, body, signal: AbortSignal.timeout(10_000) });
      const text = await r.text();
      if (!limited(r.status, text)) {
        u.ok++;
        return { status: r.status, text };
      }
      last = { status: r.status, text };
    } catch (e) {
      last = { status: 502, text: JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32000, message: String(e) } }) };
    }
    u.fail++;
    u.until = Date.now() + 15_000;
  }
  return last;
}

http
  .createServer((req, res) => {
    if (req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(UPSTREAMS.map(({ url, ok, fail, until }) => ({ url: url.replace(/(api[-_]?key=|\/v2\/)[^/&]+/i, "$1***"), ok, fail, benched: until > Date.now() })), null, 1));
    }
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", async () => {
      const body = Buffer.concat(chunks).toString();
      let methods = [];
      try {
        const j = JSON.parse(body);
        methods = (Array.isArray(j) ? j : [j]).map((x) => x.method);
      } catch {}
      const { status, text } = await forward(body, methods);
      res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(text);
    });
  })
  .listen(PORT, "127.0.0.1", () => console.log(`rpc proxy on http://127.0.0.1:${PORT}, ${UPSTREAMS.length} upstreams`));
