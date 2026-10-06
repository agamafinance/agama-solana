'use client';

import { useState } from 'react';
import { PublicKey } from '@solana/web3.js';

import { useSolanaWallet } from '@/lib/solana/WalletProvider';
import { usePrivate } from '@/lib/solana/PrivateContext';
import { connection, errorText } from '@/lib/solana/useSolana';
import { PRIVATE_TOKENS, type Balance } from '@/lib/solana/privateTokens';

const lib = () => import('@/lib/solana/confidential');
import { card, Hero, Panel, parseAmount, primaryBtn, Stat, Status, toDecimal } from '@/components/solana/ui';

type Mode = 'shield' | 'unshield' | 'send';

const fmt = (v: bigint | undefined, d: number) =>
  v === undefined ? 'Locked' : (Number(v) / 10 ** d).toLocaleString('en-US', { maximumFractionDigits: d === 8 ? 4 : 2 });

const COST: Record<Mode, string> = {
  shield: '1 transaction, 2 the first time a token is shielded (its account gets an encrypted balance, with a proof that the key is valid).',
  unshield: '4 transactions in one approval: the equality and range proofs do not fit in one, so they are staged in accounts first. One more if a private send is waiting to be folded in.',
  send: '5 transactions in one approval: the proofs (ciphertext validity, equality, range) are staged in accounts first. One more if a private send is waiting to be folded in.',
};

export default function PrivatePage() {
  const { address, provider, connect } = useSolanaWallet();
  const { keys, unlocked, unlocking, unlock, balances, run } = usePrivate();
  const [sel, setSel] = useState(0);
  const [mode, setMode] = useState<Mode>('shield');
  const [amount, setAmount] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; sig?: string }>();

  const b: Balance | undefined = balances?.[sel];
  const t = PRIVATE_TOKENS[sel];
  const amt = parseAmount(amount, t.decimals);
  const priv = (b?.private ?? 0n) + (b?.pending ?? 0n);
  const max = mode === 'shield' ? (b?.public ?? 0n) : priv;
  let recipient: PublicKey | undefined;
  try {
    recipient = to.trim() ? new PublicKey(to.trim()) : undefined;
  } catch {
    recipient = undefined;
  }

  const totalPublic = balances?.reduce((n, x) => n + (x.public > 0n ? 1 : 0), 0) ?? 0;

  async function act() {
    if (!address || !provider || !keys) return;
    setBusy(true);
    setStatus({ text: 'Building the proofs...' });
    try {
      const progress = (text: string) => setStatus({ text });
      let sigs: string[];
      if (mode === 'shield') {
        sigs = await run(async () => (await lib()).shieldSteps(connection, address, keys, [{ mint: t.mint, amount: amt }]), progress);
      } else if (mode === 'unshield') {
        sigs = await run(async () => (await lib()).unshieldSteps(connection, address, keys, t.mint, amt), progress, t.mint);
      } else {
        sigs = await run(async () => (await lib()).sendSteps(connection, address, keys, t.mint, recipient!, amt), progress, t.mint);
      }
      setStatus({ text: `Done. ${sigs.length} transaction${sigs.length > 1 ? 's' : ''}.`, sig: sigs[sigs.length - 1] });
      setAmount('');
    } catch (e) {
      setStatus({ text: errorText(e) });
    } finally {
      setBusy(false);
    }
  }

  async function shieldEverything() {
    if (!address || !provider || !keys || !balances) return;
    setBusy(true);
    setStatus({ text: 'Building the proofs...' });
    try {
      const items = balances.filter((x) => x.public > 0n).map((x) => ({ mint: x.token.mint, amount: x.public }));
      const sigs = await run(async () => (await lib()).shieldSteps(connection, address, keys, items), (text) => setStatus({ text }));
      setStatus({ text: `Done. ${sigs.length} transaction${sigs.length > 1 ? 's' : ''}.`, sig: sigs[sigs.length - 1] });
    } catch (e) {
      setStatus({ text: errorText(e) });
    } finally {
      setBusy(false);
    }
  }

  const label = mode === 'shield' ? 'Shield' : mode === 'unshield' ? 'Unshield' : 'Send privately';
  const blocked = amt === 0n || amt > max || (mode === 'send' && !recipient);

  return (
    <>
      <Hero title="Private balances">
        <p className="mt-4 max-w-[680px] text-[15px] text-fg-muted">
          Every Agama token is a Token-2022 mint with confidential transfers. Shield a balance and it becomes a
          ciphertext only your keys can read; send it privately and nobody but you and the recipient learns the amount.
          The proofs are built in your browser and checked on chain by Solana&apos;s ZK ElGamal program.
        </p>
        <p className="mt-3 max-w-[680px] text-[13px] text-fg-muted">
          What stays public: who holds an account, and every amount that enters or leaves the protocol. The program
          prices loans in plain numbers, so deposits, withdrawals and positions are public state. Private is what you
          hold and what you send.
        </p>
        <div className="mt-7 flex flex-wrap gap-8">
          <Stat label="Tokens" value="6" sub="USDC, 4 stocks, the LP token" />
          <Stat label="Keys" value={unlocked ? 'Unlocked' : 'Locked'} sub="One signature, kept in memory only" />
        </div>
      </Hero>

      <Panel>
        <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr] items-start">
          <div className={card}>
            <div className="flex items-center justify-between">
              <h2 className="text-[17px] font-semibold text-fg">Your balances</h2>
              {address && unlocked && totalPublic > 0 && (
                <button onClick={shieldEverything} disabled={busy} className="text-[13px] underline text-fg-muted hover:text-fg">
                  Shield everything public
                </button>
              )}
            </div>
            <table className="mt-4 w-full text-[14px]" data-testid="balances">
              <thead>
                <tr className="text-left text-[12px] uppercase tracking-wider text-fg-muted">
                  <th className="pb-2 font-normal">Token</th>
                  <th className="pb-2 text-right font-normal">Public</th>
                  <th className="pb-2 text-right font-normal">Private</th>
                </tr>
              </thead>
              <tbody>
                {PRIVATE_TOKENS.map((tok, i) => {
                  const r = balances?.[i];
                  const p = r?.private === undefined ? undefined : r.private + (r.pending ?? 0n);
                  return (
                    <tr
                      key={tok.key}
                      onClick={() => (setSel(i), setAmount(''), setStatus(undefined))}
                      className={`cursor-pointer border-t border-[#254839]/10 ${i === sel ? 'bg-[#254839]/[0.06]' : ''}`}
                      data-testid={`row-${tok.key}`}
                    >
                      <td className="py-2.5 pl-2 font-medium text-fg">{tok.label}</td>
                      <td className="py-2.5 text-right tabular-nums">{address ? fmt(r?.public ?? 0n, tok.decimals) : '-'}</td>
                      <td className="py-2.5 pr-2 text-right tabular-nums" data-testid={`private-${tok.key}`}>
                        {!address ? '-' : fmt(p, tok.decimals)}
                        {r?.pending ? <span className="ml-1 text-[11px] text-fg-muted">({fmt(r.pending, tok.decimals)} incoming)</span> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-3 text-[12px] text-fg-muted">
              Anyone looking at your accounts sees the public column and an encrypted blob for the private one.
            </p>
          </div>

          <div className={card}>
            {!address ? (
              <button onClick={() => connect()} className={primaryBtn}>Connect Wallet</button>
            ) : !unlocked ? (
              <>
                <h2 className="text-[17px] font-semibold text-fg">Unlock</h2>
                <p className="mt-3 text-[14px] text-fg-muted">
                  Your private balances are encrypted under keys derived from one wallet signature over
                  &quot;solana-conf-bal/v1&quot;, the message every Token-2022 wallet signs for this, so the same keys
                  open them anywhere. Nothing is sent, and the keys stay in this tab.
                </p>
                <button
                  onClick={() => unlock().catch((e) => setStatus({ text: errorText(e) }))}
                  disabled={unlocking}
                  className={`mt-4 ${primaryBtn}`}
                >
                  {unlocking ? 'Sign in the wallet...' : 'Unlock private balances'}
                </button>
                {status && <Status text={status.text} />}
              </>
            ) : (
              <>
                <div className="flex items-center gap-1 rounded-full bg-[#254839]/[0.06] p-1 w-fit">
                  {(['shield', 'unshield', 'send'] as const).map((k) => (
                    <button
                      key={k}
                      onClick={() => (setMode(k), setAmount(''), setStatus(undefined))}
                      className={
                        k === mode
                          ? 'rounded-full bg-[#254839] px-4 py-1.5 text-[13px] font-medium text-[#fdf8ed]'
                          : 'rounded-full px-4 py-1.5 text-[13px] text-fg-muted hover:text-fg'
                      }
                    >
                      {k === 'send' ? 'Send privately' : k === 'shield' ? 'Shield' : 'Unshield'}
                    </button>
                  ))}
                </div>
                <div className="mt-4 rounded-2xl border border-[#254839]/12 bg-white/60 p-4">
                  <div className="flex items-center justify-between text-[12px] text-fg-muted">
                    <span>{mode === 'shield' ? 'From public' : 'From private'}</span>
                    <button onClick={() => setAmount(toDecimal(max, t.decimals))} className="hover:text-fg">
                      Balance {fmt(max, t.decimals)} · Max
                    </button>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <input
                      inputMode="decimal"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      aria-label="Private amount"
                      className="w-full bg-transparent text-[28px] font-semibold text-fg tabular-nums outline-none placeholder:text-fg-muted/40"
                    />
                    <span className="shrink-0 rounded-full bg-[#254839]/[0.06] px-3 py-1.5 text-[14px] font-medium text-fg">
                      {t.label}
                    </span>
                  </div>
                </div>
                {mode === 'send' && (
                  <input
                    placeholder="Recipient address"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    aria-label="Recipient"
                    className="mt-3 w-full rounded-xl border border-[#254839]/12 bg-white/60 px-4 py-3 text-[13px] text-fg outline-none"
                  />
                )}
                <p className="mt-3 text-[12px] text-fg-muted">{COST[mode]}</p>
                <button onClick={act} disabled={busy || blocked} className={`mt-4 ${primaryBtn}`}>
                  {busy ? status?.text : `${label} ${t.label}`}
                </button>
                {!busy && status && <Status text={status.text} sig={status.sig} />}
              </>
            )}
          </div>
        </div>
      </Panel>
    </>
  );
}
