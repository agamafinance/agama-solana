'use client';

import { usePrivate } from '@/lib/solana/PrivateContext';
import { errorText } from '@/lib/solana/useSolana';
import { useState } from 'react';

/// "Return it to my private balance", checked by default once unlocked. While
/// locked it offers the unlock instead: there is no key to shield with yet.
export function ReturnPrivately({ checked, onChange, what }: { checked: boolean; onChange: (v: boolean) => void; what: string }) {
  const { unlocked, unlocking, unlock } = usePrivate();
  const [err, setErr] = useState('');
  if (!unlocked) {
    return (
      <p className="mt-3 text-[12px] text-fg-muted">
        <button
          onClick={() => unlock().catch((e) => setErr(errorText(e)))}
          disabled={unlocking}
          className="underline hover:text-fg"
        >
          {unlocking ? 'Sign in the wallet...' : 'Unlock private balances'}
        </button>{' '}
        to send {what} straight back to your private balance. {err}
      </p>
    );
  }
  return (
    <label className="mt-3 flex items-start gap-2 text-[12px] text-fg-muted">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 accent-[#254839]"
        aria-label="Return it to my private balance"
      />
      <span>
        Return it to my private balance. One more approval, 1 to 2 transactions: {what} lands public first, the
        amount is visible as it leaves the protocol, then it is encrypted again, along with any public balance of the same token.
      </span>
    </label>
  );
}

/// The line under an amount box when the private balance is what covers it.
export function FromPrivateNote({ amount, label }: { amount: string; label: string }) {
  return (
    <p className="mt-2 text-[12px] text-fg-muted">
      {amount} {label} comes out of your private balance first: 4 transactions in one approval, because the proofs do
      not fit in one. The program sees the amount, as it does for any deposit.
    </p>
  );
}
