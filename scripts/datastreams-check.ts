// Print the latest Chainlink Data Streams prices for every market: the three
// sessions of each share, and gold.
//   pnpm tsx scripts/datastreams-check.ts
import { FEEDS, latestReports } from "./datastreams";

const STATUS = ["unknown", "pre-market", "regular", "post-market", "overnight", "closed"];

async function main() {
  const ids = Object.values(FEEDS).flatMap((f) => Object.values(f));
  const byId = await latestReports(ids);
  if (!byId.size) throw new Error("no reports (credentials missing?)");
  const now = Math.floor(Date.now() / 1000);
  for (const [sym, f] of Object.entries(FEEDS)) {
    const row = Object.entries(f).map(([kind, id]) => {
      const r = byId.get(id.toLowerCase());
      return r ? `${kind} ${r.mid.toFixed(2)} ${STATUS[r.marketStatus] ?? r.marketStatus} ${now - r.observedAt}s` : `${kind} -`;
    });
    console.log(sym.padEnd(6), row.join(" | "));
  }
  console.log(`${byId.size} reports for ${ids.length} feeds`);
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
