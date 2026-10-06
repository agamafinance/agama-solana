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
import { Connection, Keypair, LAMPORTS_PER_SOL, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? 'playwright');
const BASE = (process.argv[2] ?? 'http://127.0.0.1:3031').replace(/\/$/, '');
const RPC = process.env.SOLANA_RPC ?? 'https://rpc.magicblock.app/devnet';
const conn = new Connection(RPC, 'confirmed');
const funder = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(path.join(os.homedir(), '.config/solana/id.json'), 'utf8'))),
);
const user = Keypair.generate();
const errors = [];
const sigs = [];

async function main() {
  await sendAndConfirmTransaction(
    conn,
    new Transaction().add(
      SystemProgram.transfer({ fromPubkey: funder.publicKey, toPubkey: user.publicKey, lamports: 0.03 * LAMPORTS_PER_SOL }),
    ),
    [funder],
  );
  console.log('test wallet', user.publicKey.toBase58());

  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.exposeFunction('__agamaSign', (b64) => {
    const tx = Transaction.from(Buffer.from(b64, 'base64'));
    tx.partialSign(user);
    return tx.serialize().toString('base64');
  });
  const pk = user.publicKey.toBase58();
  await page.addInitScript((pk) => {
    const key = { toString: () => pk, toBase58: () => pk };
    window.solana = {
      publicKey: key,
      connect: async () => ({ publicKey: key }),
      disconnect: async () => {},
      signTransaction: async (tx) => {
        const raw = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
        const signed = await window.__agamaSign(btoa(String.fromCharCode(...raw)));
        return { serialize: () => Uint8Array.from(atob(signed), (c) => c.charCodeAt(0)) };
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
      { timeout: 90_000, polling: 500 },
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

main().catch((e) => {
  console.error('FAIL', e.message ?? e);
  process.exit(1);
});
