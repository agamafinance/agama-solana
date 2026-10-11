/// Ask the app's devnet faucet for 0.1 SOL (only sent to a wallet holding
/// less than 0.05). A relative path: the same on app.agama.finance/solana and
/// on the deployment's own domain.
export async function requestDrip(address: string): Promise<{ ok: boolean; text: string; sig?: string }> {
  try {
    const r = await fetch('/solana/api/drip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) return { ok: true, text: 'Sent 0.1 devnet SOL to your wallet.', sig: j.sig };
    return { ok: false, text: j.error ?? 'Could not send devnet SOL right now: try faucet.solana.com.' };
  } catch {
    return { ok: false, text: 'Could not send devnet SOL right now: try faucet.solana.com.' };
  }
}
