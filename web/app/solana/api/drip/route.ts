import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';

// Devnet SOL for fees, so a first-time wallet (a judge, a partner) can try the
// app without hunting for a faucet. Sends 0.1 SOL (a full first run: faucet, Earn, Amplify) from a dedicated devnet
// wallet, only to a wallet holding less than 0.05 SOL. The key and the RPC
// live in Vercel env vars, never in the repo.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AMOUNT = 0.1 * LAMPORTS_PER_SOL;
const ONLY_BELOW = 0.05 * LAMPORTS_PER_SOL;
const recent = new Map<string, number>(); // per warm instance: one drip per wallet per 10 min

export async function POST(req: Request) {
  let address: PublicKey;
  try {
    address = new PublicKey(String((await req.json())?.address ?? ''));
  } catch {
    return Response.json({ error: 'Invalid address' }, { status: 400 });
  }
  const key = process.env.SOLANA_DRIP_KEY;
  if (!key) return Response.json({ error: 'Drip not configured' }, { status: 503 });
  const last = recent.get(address.toBase58()) ?? 0;
  if (Date.now() - last < 10 * 60_000) return Response.json({ error: 'Already sent recently' }, { status: 429 });

  const rpcs = (process.env.SOLANA_DRIP_RPCS ?? 'https://api.devnet.solana.com').split(',').filter(Boolean);
  const payer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(key)));
  let lastError = '';
  for (const url of rpcs) {
    try {
      const conn = new Connection(url, 'confirmed');
      // Devnet only: refuse to run against any other cluster.
      if ((await conn.getGenesisHash()) !== 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG') throw new Error('not devnet');
      const balance = await conn.getBalance(address);
      if (balance >= ONLY_BELOW) return Response.json({ error: 'This wallet already has devnet SOL', balance: balance / LAMPORTS_PER_SOL }, { status: 409 });
      const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed');
      const tx = new Transaction({ feePayer: payer.publicKey, blockhash, lastValidBlockHeight }).add(
        SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: address, lamports: AMOUNT }),
      );
      tx.sign(payer);
      const sig = await conn.sendRawTransaction(tx.serialize(), { preflightCommitment: 'confirmed' });
      // Poll rather than subscribe: no websocket from a serverless function.
      for (let i = 0; i < 30; i++) {
        const st = (await conn.getSignatureStatuses([sig])).value[0];
        if (st?.err) throw new Error('transfer failed');
        if (st?.confirmationStatus === 'confirmed' || st?.confirmationStatus === 'finalized') break;
        await new Promise((r) => setTimeout(r, 1000));
      }
      recent.set(address.toBase58(), Date.now());
      return Response.json({ sig, amount: AMOUNT / LAMPORTS_PER_SOL });
    } catch (e) {
      lastError = String((e as Error)?.message ?? e).slice(0, 200);
    }
  }
  return Response.json({ error: lastError || 'Could not send' }, { status: 502 });
}
