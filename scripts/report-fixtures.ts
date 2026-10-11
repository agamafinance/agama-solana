// Test fixture: real Chainlink Data Streams reports, signed by the testnet DON,
// for the LiteSVM suite (programs/agama-solana/tests/fixtures/reports.json).
// Needs the Data Streams credentials; the output is committed, so the tests
// do not. Run again to refresh it:  pnpm tsx scripts/report-fixtures.ts
import fs from "fs";
import path from "path";
import { PublicKey } from "@solana/web3.js";
// @ts-ignore no types
import SnappyJS from "snappyjs";
import { DS_HOST, FEEDS, authHeaders, credentials, decodeReport } from "./datastreams";
import { VERIFIER } from "./common";

const OUT = path.join(__dirname, "../programs/agama-solana/tests/fixtures/reports.json");
const snappy = (b: Buffer) => Buffer.from(SnappyJS.compress(new Uint8Array(b))).toString("hex");

async function latest(feed: string) {
  const c = credentials();
  if (!c) throw new Error("no Data Streams credentials");
  const p = `/api/v1/reports/latest?feedID=${feed}`;
  const res = await fetch(DS_HOST + p, { headers: authHeaders("GET", p, c.key, c.secret, Date.now()) });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return Buffer.from((await res.json()).report.fullReport.replace(/^0x/, ""), "hex");
}

async function main() {
  const out: Record<string, unknown> = {};
  for (const [name, feed] of [["tsla_regular", FEEDS.TSLA.regular], ["tsla_overnight", FEEDS.TSLA.overnight], ["xau", FEEDS.XAU.xau], ["usdt", FEEDS.XAU.usdt]]) {
    const raw = await latest(feed);
    const r = decodeReport(raw.toString("hex"));
    // The same report with one bit of its price flipped: the DON never signed it.
    const forged = Buffer.from(raw);
    const blobOffset = Number(BigInt("0x" + raw.subarray(96, 128).toString("hex")));
    forged[blobOffset + 32 + 6 * 32 + 31] ^= 1;
    out[name] = {
      feed,
      observed_at: r.observedAt,
      market_status: r.marketStatus,
      price: r.mid,
      config: PublicKey.findProgramAddressSync([raw.subarray(0, 32)], VERIFIER)[0].toBase58(),
      signed: snappy(raw),
      forged: snappy(forged),
    };
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
  console.log(Object.entries(out).map(([k, v]: any) => `${k} ${v.price} status ${v.market_status} config ${v.config}`).join("\n"));
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
