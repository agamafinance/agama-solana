// Fetch the latest Chainlink Data Streams reports (RWA Advanced, v11) for the
// nine xStocks' underlying shares, from the testnet REST API, and decode them.
// Credentials come from .keys/datastreams.env (never committed):
//   DATASTREAMS_API_KEY=<uuid>
//   DATASTREAMS_API_SECRET=<secret>
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { ROOT } from "./common";

const HOST = "https://api.testnet-dataengine.chain.link";
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, ".keys/datastreams.env"), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  }),
);
const feeds: Record<string, Record<string, string>> = JSON.parse(fs.readFileSync(path.join(ROOT, "cre/agama-prices/datastreams-feeds.json"), "utf8"));

export function authHeaders(method: string, pathWithQuery: string, key: string, secret: string, nowMs: number) {
  const bodyHash = crypto.createHash("sha256").update("").digest("hex");
  const toSign = `${method} ${pathWithQuery} ${bodyHash} ${key} ${nowMs}`;
  return {
    Authorization: key,
    "X-Authorization-Timestamp": String(nowMs),
    "X-Authorization-Signature-SHA256": crypto.createHmac("sha256", secret).update(toSign).digest("hex"),
  };
}

/** fullReport = abi(bytes32[3] ctx, bytes blob, bytes32[] rs, bytes32[] ss, bytes32 vs); blob = v11 fields, one 32-byte word each. */
export function decodeV11(fullReportHex: string) {
  const b = Buffer.from(fullReportHex.replace(/^0x/, ""), "hex");
  const word = (buf: Buffer, i: number) => buf.subarray(i * 32, i * 32 + 32);
  const blobOffset = Number(BigInt("0x" + word(b, 3).toString("hex")));
  const blobLen = Number(BigInt("0x" + b.subarray(blobOffset, blobOffset + 32).toString("hex")));
  const blob = b.subarray(blobOffset + 32, blobOffset + 32 + blobLen);
  const uint = (i: number) => BigInt("0x" + word(blob, i).toString("hex"));
  const int = (i: number) => BigInt.asIntN(256, uint(i));
  return {
    feedId: "0x" + word(blob, 0).toString("hex"),
    validFrom: Number(uint(1)),
    observedAt: Number(uint(2)),
    expiresAt: Number(uint(5)),
    mid: int(6),
    lastSeenNs: uint(7),
    bid: int(8),
    ask: int(10),
    lastTraded: int(12),
    marketStatus: Number(uint(13)),
  };
}

async function main() {
  const ids = Object.values(feeds).flatMap((f) => Object.values(f));
  const ts = Math.floor(Date.now() / 1000) - 2;
  const p = `/api/v1/reports/bulk?feedIDs=${ids.join(",")}&timestamp=${ts}`;
  const res = await fetch(HOST + p, { headers: authHeaders("GET", p, env.DATASTREAMS_API_KEY, env.DATASTREAMS_API_SECRET, Date.now()) });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 300)}`);
  const reports = (JSON.parse(text).reports ?? []) as { feedID: string; fullReport: string }[];
  const byId = new Map(reports.map((r) => [r.feedID.toLowerCase(), decodeV11(r.fullReport)]));
  const STATUS = ["unknown", "pre-market", "regular", "post-market", "overnight", "closed"];
  for (const [sym, f] of Object.entries(feeds)) {
    const row = Object.entries(f).map(([kind, id]) => {
      const r = byId.get(id.toLowerCase());
      return r ? `${kind} ${(Number(r.mid) / 1e18).toFixed(2)} ${STATUS[r.marketStatus] ?? r.marketStatus}` : `${kind} -`;
    });
    console.log(sym.padEnd(6), row.join(" | "));
  }
  console.log(`${reports.length} reports for ${ids.length} feeds at ${ts}`);
}

if (require.main === module) main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
