import { createDefaultRpcTransport, createSolanaRpcFromTransport, type RpcTransport } from '@solana/kit';

/// Three Solana devnet RPCs, all fronting the same cluster, relaying each
/// other: a rate limit (429), a 5xx or a dead endpoint moves the call on to
/// the next one, and the endpoint that failed sits out for 15 s. Solana's own
/// endpoint leads (it passed the full private-flow UI e2e); MagicBlock's comes
/// last, as it refused some confidential-transfer sends in preflight.
export const RPCS = process.env.NEXT_PUBLIC_SOLANA_RPC
  ? [process.env.NEXT_PUBLIC_SOLANA_RPC]
  : ['https://api.devnet.solana.com', 'https://devnet.rpcpool.com', 'https://rpc.magicblock.app/devnet'];

const bench = new Map<string, number>();
const order = () => {
  const now = Date.now();
  return [...RPCS.filter((u) => (bench.get(u) ?? 0) <= now), ...RPCS.filter((u) => (bench.get(u) ?? 0) > now)];
};
const limited = (status: number, text: string) =>
  status === 429 || status >= 500 || /"code":\s*(429|-32029|-32005)\b/.test(text);

/// A `fetch` for web3.js's Connection: the URL it is given is replaced in turn.
export const failoverFetch = async (_url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  let last: Response | undefined;
  let error: unknown;
  for (const url of order()) {
    try {
      const r = await fetch(url, init);
      const text = await r.clone().text();
      if (!limited(r.status, text)) return r;
      last = r;
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') throw e;
      error = e;
    }
    bench.set(url, Date.now() + 15_000);
  }
  if (last) return last;
  throw error;
};

/// The same, as a Kit transport (the confidential-balance client).
const transports = new Map(RPCS.map((u) => [u, createDefaultRpcTransport({ url: u })]));
const failoverTransport: RpcTransport = async (config) => {
  let error: unknown;
  for (const url of order()) {
    try {
      return await transports.get(url)!(config);
    } catch (e) {
      const status = (e as { context?: { statusCode?: number } })?.context?.statusCode;
      // An HTTP-level failure fails over; a JSON-RPC error (a refused transaction) is the answer.
      if (status !== undefined && status !== 429 && status < 500) throw e;
      error = e;
    }
    bench.set(url, Date.now() + 15_000);
  }
  throw error;
};
export const failoverKitRpc = () => createSolanaRpcFromTransport(failoverTransport);
