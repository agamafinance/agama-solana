// UI end to end on Solana devnet with a real signer.
//
//   node scripts/ui-e2e.mjs [base_url]      default http://127.0.0.1:3031
//
// A headless Chromium opens the app with an injected wallet (window.solana)
// whose signTransaction is a throwaway Keypair held by this script, funded
// with 0.03 SOL from ~/.config/solana/id.json. Every click is a real devnet
// transaction. Flow: faucet, Earn open, move the slider, Amplify open and
// close, Lend supply and withdraw, Earn close, with a look at every tab.
// Screenshots land in /tmp/agama-solana-*.png. Fails on any page error or any
// error the app writes under a button.
//
// Needs `playwright` resolvable (PLAYWRIGHT_PATH) and a cached Chromium
// (CHROME_PATH), since this app does not depend on either.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import { Connection, Keypair, LAMPORTS_PER_SOL, SystemProgram, Transaction, VersionedTransaction, sendAndConfirmTransaction } from '@solana/web3.js';
import nacl from 'tweetnacl';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? 'playwright');
const BASE = (process.argv[2] ?? 'http://127.0.0.1:3031').replace(/\/$/, '');
const RPC = process.env.SOLANA_RPC ?? 'https://rpc.magicblock.app/devnet';
const conn = new Connection(RPC, 'confirmed');
const funder = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(path.join(os.homedir(), '.config/solana/id.json'), 'utf8'))),
);
const user = Keypair.generate();

// ---------------------------------------------------------------------------
// The private run (PRIVATE=1): a second wallet configured from here, the rest
// clicked in the app.
// ---------------------------------------------------------------------------
import {
  createKeyPairSignerFromBytes, createSolanaRpc, createTransactionMessage, createTransactionPlanExecutor,
  createTransactionPlanner, getBase64EncodedWireTransaction, getSignatureFromTransaction, pipe,
  setTransactionMessageFeePayerSigner, setTransactionMessageLifetimeUsingBlockhash, signTransactionMessageWithSigners,
  address as kaddress,
} from '@solana/kit';
import { fetchToken, findAssociatedTokenPda, TOKEN_2022_PROGRAM_ADDRESS } from '@solana-program/token-2022';
import {
  decryptConfidentialTransferBalance, deriveConfidentialKeys, getCreateConfidentialTransferAccountInstructionPlan,
} from '@solana-program/token-2022/confidential';
import { AeKey, ElGamalKeypair, ElGamalSecretKey } from '@solana/zk-sdk';
import { PublicKey } from '@solana/web3.js';

const idl = JSON.parse(fs.readFileSync(new URL('../lib/solana/idl.json', import.meta.url), 'utf8'));
const PROGRAM = new PublicKey(idl.address);
const pdaOf = (...seeds) => PublicKey.findProgramAddressSync(seeds.map((x) => (typeof x === 'string' ? Buffer.from(x) : x)), PROGRAM)[0];
const sym8 = (s) => { const b = Buffer.alloc(8); b.write(s); return b; };
const USDC_MINT = pdaOf('usdc.v2');
const TSLA_MINT = pdaOf('stock.v2', sym8('TSLA'));
const kitRpc = createSolanaRpc(RPC);

async function kitSend(msg) {
  const { value: bh } = await kitRpc.getLatestBlockhash().send();
  const tx = await signTransactionMessageWithSigners(setTransactionMessageLifetimeUsingBlockhash(bh, msg));
  const sig = getSignatureFromTransaction(tx);
  await kitRpc.sendTransaction(getBase64EncodedWireTransaction(tx), { encoding: 'base64', preflightCommitment: 'confirmed' }).send();
  for (let i = 0; i < 60; i++) {
    const { value } = await kitRpc.getSignatureStatuses([sig]).send();
    if (value[0]?.err) throw new Error(`${sig} failed`);
    if (value[0]?.confirmationStatus === 'confirmed' || value[0]?.confirmationStatus === 'finalized') return sig;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('timeout ' + sig);
}

async function recipientKeys(kp) {
  const signer = await createKeyPairSignerFromBytes(kp.secretKey);
  const k = await deriveConfidentialKeys({ signer });
  const secret = ElGamalSecretKey.fromBytes(k.elgamalKeypair.secretKey);
  return { signer, elgamal: ElGamalKeypair.fromSecretKey(secret), secret, ae: AeKey.fromBytes(k.aeKey) };
}

/// The recipient sets up private balances on their side, outside the app.
async function configureRecipient(keys, mints) {
  const planner = createTransactionPlanner({
    createTransactionMessage: () => pipe(createTransactionMessage({ version: 0 }), (m) => setTransactionMessageFeePayerSigner(keys.signer, m)),
  });
  const executor = createTransactionPlanExecutor({ executeTransactionMessage: async (_c, m) => ({ signature: await kitSend(m) }) });
  for (const mint of mints) {
    const plan = await getCreateConfidentialTransferAccountInstructionPlan({
      payer: keys.signer, owner: keys.signer, mint: kaddress(mint.toBase58()), rpc: kitRpc, elgamalKeypair: keys.elgamal, aesKey: keys.ae,
    });
    await executor(await planner(plan));
  }
}

async function privateOf(keys, mint) {
  const [token] = await findAssociatedTokenPda({ owner: keys.signer.address, mint: kaddress(mint.toBase58()), tokenProgram: TOKEN_2022_PROGRAM_ADDRESS });
  const acc = await fetchToken(kitRpc, token);
  const b = decryptConfidentialTransferBalance({ tokenAccount: acc.data, elgamalSecretKey: keys.secret, aesKey: keys.ae });
  return { public: acc.data.amount, private: b.availableBalance + b.pendingBalance };
}

const errors = [];
const sigs = [];

async function main() {
  await sendAndConfirmTransaction(
    conn,
    new Transaction().add(
      SystemProgram.transfer({ fromPubkey: funder.publicKey, toPubkey: user.publicKey, lamports: Number(process.env.FUND_SOL ?? 0.03) * LAMPORTS_PER_SOL }),
    ),
    [funder],
  );
  console.log('test wallet', user.publicKey.toBase58());

  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  globalThis.__page = page;
  globalThis.__console = [];
  page.on('console', (m) => globalThis.__console.push(`${m.type()}: ${m.text()}`.slice(0, 300)));
  page.on('pageerror', (e) => errors.push(String(e)));
  // Legacy transactions from the Anchor client, v0 ones from the confidential
  // flows (Kit), already carrying the proof accounts' own signatures.
  await page.exposeFunction('__agamaSign', (b64) => {
    const raw = Buffer.from(b64, 'base64');
    const v = VersionedTransaction.deserialize(raw);
    if (v.version === 'legacy') {
      const tx = Transaction.from(raw);
      tx.partialSign(user);
      return tx.serialize({ requireAllSignatures: false }).toString('base64');
    }
    v.sign([user]);
    return Buffer.from(v.serialize()).toString('base64');
  });
  await page.exposeFunction('__agamaSignMessage', (b64) =>
    Buffer.from(nacl.sign.detached(Buffer.from(b64, 'base64'), user.secretKey)).toString('base64'),
  );
  const pk = user.publicKey.toBase58();
  await page.addInitScript((pk) => {
    const key = { toString: () => pk, toBase58: () => pk };
    window.solana = {
      publicKey: key,
      connect: async () => ({ publicKey: key }),
      disconnect: async () => {},
      signTransaction: async (tx) => {
        const raw = 'version' in tx ? tx.serialize() : tx.serialize({ requireAllSignatures: false, verifySignatures: false });
        const signed = await window.__agamaSign(btoa(String.fromCharCode(...raw)));
        return { serialize: () => Uint8Array.from(atob(signed), (c) => c.charCodeAt(0)) };
      },
      signAllTransactions: async (txs) => Promise.all(txs.map((t) => window.solana.signTransaction(t))),
      signMessage: async (msg) => {
        const sig = await window.__agamaSignMessage(btoa(String.fromCharCode(...msg)));
        return { signature: Uint8Array.from(atob(sig), (c) => c.charCodeAt(0)) };
      },
    };
  }, pk);

  const shot = async (name) => {
    await page.waitForTimeout(1500);
    const f = `/tmp/agama-solana-${name}.png`;
    await page.screenshot({ path: f, fullPage: true });
    console.log('screenshot', f);
  };
  // Waits for the result line under the pressed button and fails on an error.
  // A status line counts only once: each action must produce a new signature.
  const settle = async (label) => {
    const seen = sigs.map(([, s]) => s);
    const handle = await page.waitForFunction(
      (seen) => {
        for (const el of document.querySelectorAll('[data-testid="status"]')) {
          const a = el.querySelector('a');
          const sig = a ? a.href.split('/tx/')[1]?.split('?')[0] : undefined;
          if (sig && seen.includes(sig)) continue;
          if (sig || !el.innerText.startsWith('Done.')) return { text: el.innerText, sig };
        }
        return false;
      },
      seen,
      { timeout: Number(process.env.SETTLE_MS ?? 90_000), polling: 500 },
    );
    const { text, sig } = await handle.jsonValue();
    if (!text.startsWith('Done.') || !sig) throw new Error(`${label}: ${text}`);
    sigs.push([label, sig]);
    console.log(`${label.padEnd(12)} ${sig}`);
  };
  const nav = (label) => page.locator('header nav').getByRole('link', { name: label, exact: true }).click();

  await page.goto(`${BASE}/solana`);
  await page.getByText('$', { exact: false }).first().waitFor();
  await page.waitForFunction(() => /\$\d/.test(document.body.innerText));
  await shot('earn-disconnected');

  await page.getByRole('button', { name: 'Connect Wallet' }).first().click();
  await page.getByRole('button', { name: 'Injected wallet' }).click();
  await page.getByText(pk.slice(0, 4)).first().waitFor();

  await nav('Faucet');
  await page.getByRole('button', { name: 'Mint test tokens' }).click();
  await settle('faucet');
  await shot('faucet');

  if (process.env.PRIVATE === '1') {
    const bob = Keypair.generate();
    await sendAndConfirmTransaction(conn, new Transaction().add(SystemProgram.transfer({ fromPubkey: funder.publicKey, toPubkey: bob.publicKey, lamports: LAMPORTS_PER_SOL / 2 })), [funder]);
    const bobKeys = await recipientKeys(bob);
    await configureRecipient(bobKeys, [TSLA_MINT]);
    console.log('recipient', bob.publicKey.toBase58(), 'configured for TSLAx');

    const cell = (k) => page.getByTestId(`private-${k}`).innerText();
    const row = (k) => page.getByTestId(`row-${k}`).click();
    await nav('Private');
    await page.getByRole('button', { name: 'Unlock private balances' }).waitFor();
    await shot('private-locked');
    await page.getByRole('button', { name: 'Unlock private balances' }).click();
    await page.waitForFunction(() => !document.body.innerText.includes('Locked'), null, { timeout: 30_000 });

    await row('USDC');
    await page.getByLabel('Private amount').fill('10000');
    await page.getByRole('button', { name: 'Shield USDC' }).click();
    await settle('shield USDC');
    await row('TSLA');
    await page.getByLabel('Private amount').fill('10');
    await page.getByRole('button', { name: 'Shield TSLAx' }).click();
    await settle('shield TSLAx');
    await page.waitForFunction(() => document.querySelector('[data-testid="private-TSLA"]')?.innerText.startsWith('10'), null, { timeout: 30_000 });
    await shot('private-shielded');

    await page.getByRole('button', { name: 'Send privately', exact: true }).click();
    await page.getByLabel('Private amount').fill('2');
    await page.getByLabel('Recipient').fill(bob.publicKey.toBase58());
    await page.getByRole('button', { name: 'Send privately TSLAx' }).click();
    await settle('private send');
    const bobTsla = await privateOf(bobKeys, TSLA_MINT);
    if (bobTsla.private !== 200_000_000n || bobTsla.public !== 0n) throw new Error(`recipient got ${bobTsla.private} private, ${bobTsla.public} public`);
    console.log('recipient decrypts 2 TSLAx, public 0');

    await nav('Earn');
    await page.waitForFunction(() => document.body.innerText.includes('private'), null, { timeout: 30_000 });
    await page.getByPlaceholder('0.00').fill('5');
    await page.getByRole('button', { name: 'Unshield and deposit' }).click();
    await settle('unshield + earn');
    await page.getByText('Agents running').waitFor({ timeout: 30_000 });
    await shot('private-earn');
    await page.getByLabel('Return it to my private balance').waitFor();
    await page.getByRole('button', { name: 'Close, get the stock back' }).click();
    await settle('close + shield back');

    await nav('Lend');
    await page.waitForFunction(() => /supply apr/i.test(document.body.innerText));
    await page.waitForFunction(() => document.body.innerText.includes('private'), null, { timeout: 30_000 }).catch(() => {});
    await page.getByPlaceholder('0.00').fill('100');
    await page.getByRole('button', { name: 'Unshield and supply USDC' }).click();
    await settle('unshield + supply');

    await nav('Private');
    await page.waitForFunction(() => /^[1-9]/.test(document.querySelector('[data-testid="private-LP"]')?.innerText ?? ''), null, { timeout: 45_000 });
    await shot('private-after');
    const tsla = await cell('TSLA');
    const lp = await cell('LP');
    const usdc = await cell('USDC');
    console.log(`private now: TSLAx ${tsla}, USDC ${usdc}, LP ${lp}`);
    if (!tsla.startsWith('8')) throw new Error(`expected 8 TSLAx private, got ${tsla}`);
    const pubText = await page.getByTestId('balances').innerText();
    console.log(pubText.replace(/\n/g, ' | '));

    await browser.close();
    if (errors.length) throw new Error(`page errors:\n${errors.join('\n')}`);
    console.log('PASS');
    return;
  }

  await nav('Earn');
  await page.waitForFunction(() => document.body.innerText.includes('held'), null, { timeout: 30_000 });
  await page.getByPlaceholder('0.00').fill('2');
  await page.getByRole('button', { name: 'Deposit and start earning' }).click();
  await settle('earn open');
  await page.getByText('Agents running').waitFor({ timeout: 30_000 });
  await shot('earn-position');

  await page.getByLabel('Target LTV').fill('1500');
  await page.getByRole('button', { name: /Move the target to/ }).click();
  await settle('slider');
  await page.waitForFunction(() => /Target level\s*15(\.0)?%/.test(document.body.innerText), null, { timeout: 30_000 });
  await shot('earn-slider');

  await nav('Portfolio');
  await page.getByText('Manage').first().waitFor({ timeout: 30_000 });
  await shot('portfolio');

  await nav('Amplify');
  await page.waitForFunction(() => /\d\.\d\dx max/.test(document.body.innerText));
  await shot('amplify');
  await page.getByPlaceholder('0.00').fill('2');
  await page.getByRole('button', { name: /^Amplify \d/ }).click();
  await settle('amplify open');
  await page.getByText('Agents running').waitFor({ timeout: 30_000 });
  await shot('amplify-position');
  await page.getByRole('button', { name: 'Close, sell what repays, keep the rest' }).click();
  await settle('amplify close');
  await shot('amplify-closed');

  await nav('Lend');
  await page.waitForFunction(() => /supply apr/i.test(document.body.innerText));
  await page.getByPlaceholder('0.00').fill('100');
  await page.getByRole('button', { name: 'Supply USDC' }).click();
  await settle('lend supply');
  await shot('lend');
  await page.getByRole('button', { name: 'withdraw', exact: true }).click();
  await page.waitForFunction(() => !/Balance 0\.00 ·/.test(document.body.innerText), null, { timeout: 30_000 });
  await page.getByRole('button', { name: /Balance .* Max/ }).click();
  await page.getByRole('button', { name: 'Withdraw USDC' }).click();
  await settle('lend withdraw');

  await nav('Earn');
  await page.getByRole('button', { name: 'Close, get the stock back' }).click();
  await settle('earn close');
  await shot('earn-closed');

  await browser.close();
  if (errors.length) throw new Error(`page errors:\n${errors.join('\n')}`);
  console.log('PASS');
}

main().catch(async (e) => {
  console.error('FAIL', e.message ?? e);
  try {
    const text = await globalThis.__page?.evaluate(() => document.body.innerText);
    if (text) console.error('page at failure:\n' + text.slice(0, 1500));
    console.error('console (last 25):\n' + (globalThis.__console ?? []).slice(-25).join('\n'));
  } catch {}
  process.exit(1);
});
