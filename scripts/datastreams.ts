// Chainlink Data Streams over the REST API: signed requests, and the reports
// decoded. The shares use the RWA Advanced schema (v11: one feed per session,
// with a marketStatus); gold uses v3 (XAU/USDT and USDT/USD). The price sits
// in the same word in both. Credentials: DATASTREAMS_API_KEY and
// DATASTREAMS_API_SECRET in the environment, else .keys/datastreams.env
// (never committed).
import crypto from "crypto";
import fs from "fs";
import path from "path";

export const DS_HOST = process.env.DATASTREAMS_URL ?? "https://api.testnet-dataengine.chain.link";
export const FEEDS: Record<string, Record<string, string>> = JSON.parse(
  fs.readFileSync(path.join(__dirname, "datastreams-feeds.json"), "utf8"),
);

export function credentials(): { key: string; secret: string } | undefined {
  let key = process.env.DATASTREAMS_API_KEY;
  let secret = process.env.DATASTREAMS_API_SECRET;
  if (!key || !secret) {
    try {
      const env = Object.fromEntries(
        fs.readFileSync(path.join(__dirname, "../.keys/datastreams.env"), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => {
          const i = l.indexOf("=");
          return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
        }),
      );
      key = env.DATASTREAMS_API_KEY;
      secret = env.DATASTREAMS_API_SECRET;
    } catch {}
  }
  return key && secret ? { key, secret } : undefined;
}

export function authHeaders(method: string, pathWithQuery: string, key: string, secret: string, nowMs: number) {
  const bodyHash = crypto.createHash("sha256").update("").digest("hex");
  const toSign = `${method} ${pathWithQuery} ${bodyHash} ${key} ${nowMs}`;
  return {
    Authorization: key,
    "X-Authorization-Timestamp": String(nowMs),
    "X-Authorization-Signature-SHA256": crypto.createHmac("sha256", secret).update(toSign).digest("hex"),
  };
}

export type Report = { feedId: string; observedAt: number; expiresAt: number; mid: number; marketStatus: number };

/** fullReport = abi(bytes32[3] ctx, bytes blob, bytes32[] rs, bytes32[] ss, bytes32 vs); the blob is one
 *  32-byte word per field. Word 6 is the price (v11 mid, v3 benchmark), 18 decimals; word 13 is v11's
 *  marketStatus (0 unknown, 1 pre-market, 2 regular, 3 post-market, 4 overnight, 5 closed). */
export function decodeReport(fullReportHex: string): Report {
  const b = Buffer.from(fullReportHex.replace(/^0x/, ""), "hex");
  const word = (buf: Buffer, i: number) => buf.subarray(i * 32, i * 32 + 32);
  const blobOffset = Number(BigInt("0x" + word(b, 3).toString("hex")));
  const blobLen = Number(BigInt("0x" + b.subarray(blobOffset, blobOffset + 32).toString("hex")));
  const blob = b.subarray(blobOffset + 32, blobOffset + 32 + blobLen);
  const uint = (i: number) => BigInt("0x" + word(blob, i).toString("hex"));
  const feedId = "0x" + word(blob, 0).toString("hex");
  return {
    feedId,
    observedAt: Number(uint(2)),
    expiresAt: Number(uint(5)),
    mid: Number(BigInt.asIntN(256, uint(6))) / 1e18,
    marketStatus: feedId.startsWith("0x000b") && blob.length >= 14 * 32 ? Number(uint(13)) : 0,
  };
}

/** The latest report of each feed, by lowercase feed id. Empty without credentials or on any error. */
export async function latestReports(ids: string[]): Promise<Map<string, Report>> {
  const out = new Map<string, Report>();
  const creds = credentials();
  if (!creds || !ids.length) return out;
  const ts = Math.floor(Date.now() / 1000) - 2;
  const p = `/api/v1/reports/bulk?feedIDs=${ids.join(",")}&timestamp=${ts}`;
  const res = await fetch(DS_HOST + p, {
    headers: authHeaders("GET", p, creds.key, creds.secret, Date.now()),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`data streams ${res.status} ${(await res.text()).slice(0, 200)}`);
  for (const r of (await res.json()).reports ?? []) out.set(String(r.feedID).toLowerCase(), decodeReport(r.fullReport));
  return out;
}
