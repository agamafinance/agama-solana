// Health of the live devnet demo; exits 1 on any problem (GitHub then emails).
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { MARKETS, connection, marketAccounts, programFor } from "./common";
import { Keypair } from "@solana/web3.js";

const KEEPER = new PublicKey("31aJvz8ThCmr8DNwQbXUJG2pCsrd3heixHvbzqrZvPpU");
const DRIP = new PublicKey("2cRyqAhkY9yJRJXbGfjVSqvAHTEfUrFU8oPDHfTN3os4");

async function main() {
  const conn = connection();
  const program = programFor(Keypair.generate(), conn);
  const now = Math.floor(Date.now() / 1000);
  const problems: string[] = [];
  for (const m of MARKETS) {
    const a: any = await (program.account as any).market.fetch(marketAccounts(m.symbol).market);
    const age = now - Number(a.priceTime);
    console.log(m.symbol.padEnd(6), `${age}s old`);
    if (age > 1800) problems.push(`${m.symbol} price ${age}s old`);
  }
  for (const [name, key, min] of [["keeper", KEEPER, 0.3], ["drip", DRIP, 0.3]] as const) {
    const sol = (await conn.getBalance(key)) / LAMPORTS_PER_SOL;
    console.log(name, sol.toFixed(3), "SOL");
    if (sol < min) problems.push(`${name} wallet low: ${sol.toFixed(3)} SOL`);
  }
  for (const url of ["https://app.agama.finance/solana", "https://app.agama.finance/solana/faucet"]) {
    const r = await fetch(url);
    console.log(url, r.status);
    if (r.status !== 200) problems.push(`${url} answered ${r.status}`);
  }
  if (problems.length) {
    console.error("PROBLEMS:\n" + problems.join("\n"));
    process.exit(1);
  }
  console.log("healthy");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
