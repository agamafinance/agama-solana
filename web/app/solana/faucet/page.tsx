'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Copy, ExternalLink } from 'lucide-react';

import { TokenIcon } from '@/components/icons/TokenIcon';
import { asset, FAUCET_STOCK, FAUCET_USDC, PROGRAM_ID, STOCKS, usdcMint } from '@/lib/solana/config';
import { usePrivate, type PublicLeft } from '@/lib/solana/PrivateContext';
import { useSolanaWallet } from '@/lib/solana/WalletProvider';
import { ix, usd, useSnapshot } from '@/lib/solana/useSolana';
import { ActionStatus, statusFromError } from '@/components/solana/privacy';
import { Step } from '@/components/solana/ui';

const SOL_FAUCET = 'https://faucet.solana.com';

export default function SolanaFaucetPage() {
  const { address, provider, connect } = useSolanaWallet();
  const { snap, refresh } = useSnapshot(address);
  const priv = usePrivate();
  const busy = priv.busy;
  const [status, setStatus] = useState<{ text: string; sig?: string; left?: PublicLeft[] }>();
  const [copied, setCopied] = useState(false);

  const copyAddress = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address.toBase58());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  /// Eleven mints with their token accounts do not fit one transaction: four
  /// per transaction. Then everything minted goes straight into the private
  /// balance (set up the first time), all in one wallet approval.
  async function claim() {
    if (!address || !provider) return setStatus({ text: 'Connect a wallet first.' });
    setStatus({ text: 'Building the transactions...' });
    try {
      // Every click, a full set: 10,000 USDC and 10 of each stock.
      const tokens = [{ mint: usdcMint, amount: FAUCET_USDC }, ...STOCKS.map((s) => ({ mint: s.stockMint, amount: FAUCET_STOCK }))];
      const all = await ix.faucet(address);
      const want = tokens.map((t, i) => ({ ...t, ix: all[i] }));
      const ixGroups: typeof all[] = [];
      for (let i = 0; i < want.length; i += 4) ixGroups.push(want.slice(i, i + 4).map((t) => t.ix));
      const minted = want.map(({ mint, amount }) => ({ mint, amount }));
      const sigs = await priv.mintPrivately({ ixGroups, minted, progress: (text) => setStatus({ text }) });
      setStatus({ text: 'Done. 10,000 USDC and 10 of each stock are in your private balance.', sig: sigs[sigs.length - 1] });
    } catch (e) {
      setStatus(statusFromError(e));
    } finally {
      refresh();
    }
  }

  const usdc = address && snap && priv.unlocked ? priv.privateOf(usdcMint) + snap.usdc : undefined;
  const program = PROGRAM_ID.toBase58();

  return (
    <>
      <section className="px-6 md:px-24 pt-10 md:pt-14 pb-8">
        <div className="max-w-[1400px] mx-auto relative">
          <div aria-hidden className="pointer-events-none absolute right-4 top-2 z-20 hidden lg:block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={asset('/solana.svg')} alt="" className="h-[170px] w-[170px] drop-shadow-[0_18px_30px_rgba(20,50,35,0.25)]" />
          </div>

          <h1 className="mt-3 text-[34px] md:text-[44px] leading-[1.05] text-fg font-semibold">Get devnet funds</h1>
          <p className="mt-4 max-w-[640px] text-[15px] text-fg-muted">
            Grab devnet SOL for fees, then take the stand-in USDC, the nine xStocks and GLDY in one approval, straight
            into your private balance. Solana devnet carries none of them, so these are ours: Token-2022 mints with
            confidential transfers, priced live by the Chainlink CRE workflow.
          </p>

          <div className="mt-7 flex flex-wrap gap-8">
            <Stat label="Network" value="Solana Devnet" sub={`Program ${program.slice(0, 4)}...${program.slice(-4)}`} />
            <Stat label="Asset" value="xStocks" sub="9 stocks and GLDY gold" />
            <Stat
              label="USDC"
              value={usdc === undefined ? '-' : usd(usdc).replace('$', '')}
              sub={!address ? 'Stand-in USDC' : usdc === undefined ? 'Private, sign to show it' : 'In your private balance'}
            />
            <Stat label="SOL" value={address && snap ? snap.sol.toFixed(3) : '-'} sub="For fees" />
          </div>
        </div>
      </section>

      <section className="vault-panel relative z-10 rounded-t-[20px] px-6 md:px-24 pt-10 md:pt-14 pb-24">
        <div className="max-w-[1400px] mx-auto space-y-3">
          <h2 className="mb-2 text-[13px] uppercase tracking-wider text-fg-muted">Get funded</h2>

          <StepRow
            icon={
              // eslint-disable-next-line @next/next/no-img-element
              <img src={asset('/solana.svg')} alt="" className="h-10 w-10 shrink-0 rounded-full" />
            }
            title="SOL for fees"
            blurb="Solana devnet transactions are paid in SOL. Grab some from the Solana faucet (0.05 is plenty), it is the one thing here nobody can mint for you."
          >
            <FaucetLink href={SOL_FAUCET} label="Open SOL faucet" />
          </StepRow>

          <StepRow
            icon={
              <div className="flex shrink-0 -space-x-2">
                <TokenIcon symbol="USDC" size={40} />
                <TokenIcon symbol="TSLAx" size={40} />
                <TokenIcon symbol="NVDAx" size={40} />
              </div>
            }
            title="USDC, the nine stocks and gold"
            blurb="10,000 USDC, and 10 each of TSLAx, NVDAx, AAPLx, SPYx, QQQx, GOOGLx, MSFTx, AMZNx, METAx and GLDY, minted and shielded into your private balance. One approval."
          >
            <MintButton
              onClick={address ? claim : () => connect()}
              busy={busy}
              label={address ? 'Get the test tokens' : 'Connect a wallet'}
              busyLabel={status?.text}
              disabled={busy}
            />
          </StepRow>

          <p className="pt-2 text-[12px] text-fg-muted">
            {!address ? (
              <button type="button" onClick={() => connect()} className="underline hover:text-fg">
                Connect a wallet
              </button>
            ) : snap && snap.sol < 0.04 ? (
              `${snap.sol.toFixed(4)} SOL here: paste your address into the SOL faucet above first.`
            ) : (
              'Paste your address into the SOL faucet above.'
            )}
            <button
              type="button"
              onClick={copyAddress}
              disabled={!address}
              className="ml-3 inline-flex items-center gap-1.5 rounded-full bg-[#254839]/[0.08] px-3 py-1 text-[12px] text-[#254839] hover:bg-[#254839]/[0.16] disabled:opacity-40"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied!' : 'Copy address'}
            </button>
          </p>
          {!busy && <ActionStatus status={status} />}

          <Link href="/solana" className="group mt-6 flex items-center gap-4 rounded-2xl bg-[#254839] px-5 py-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={asset('/agama-logo-circle.svg')} alt="" className="h-10 w-10" />
            <div>
              <div className="text-[15px] font-medium text-[#fdf8ed]">Funded? Deposit your stock</div>
              <div className="text-[13px] text-[#fdf8ed]/70">Borrow against it and let the agents grow it</div>
            </div>
            <ArrowRight className="ml-auto h-5 w-5 text-[#fdf8ed]/80 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </section>
    </>
  );
}

function FaucetLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex h-11 items-center gap-1.5 whitespace-nowrap rounded-full bg-[#254839] px-6 text-[14px] font-medium text-[#fdf8ed] hover:bg-[#1F3D31]"
    >
      {label} <ExternalLink className="h-3.5 w-3.5" />
    </a>
  );
}

function MintButton({
  onClick, busy, label, busyLabel, disabled,
}: { onClick: () => void; busy: boolean; label: string; busyLabel?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-11 w-[184px] items-center justify-center whitespace-nowrap rounded-full bg-[#254839] px-4 text-[14px] font-medium text-[#fdf8ed] hover:bg-[#1F3D31] disabled:opacity-45"
    >
      {busy ? <Step text={busyLabel} /> : label}
    </button>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-[12px] uppercase tracking-wider text-fg-muted">{label}</div>
      <div className="text-[26px] font-semibold tabular-nums text-fg">{value}</div>
      {sub && <div className="text-[12px] text-fg-muted">{sub}</div>}
    </div>
  );
}

function StepRow({
  title, blurb, children, icon,
}: { title: string; blurb: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-[#fdfaf1] px-5 py-4 shadow-[0_1px_3px_rgba(20,50,35,0.06),0_10px_30px_rgba(20,50,35,0.09)] md:flex-row md:items-center">
      {icon}
      <div className="min-w-0">
        <div className="text-[15px] font-medium text-fg">{title}</div>
        <div className="text-[13px] text-fg-muted">{blurb}</div>
      </div>
      <div className="shrink-0 md:ml-auto">{children}</div>
    </div>
  );
}
