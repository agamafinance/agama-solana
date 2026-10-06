//! End-to-end flows on LiteSVM, against the compiled program
//! (`anchor build` first). Every product path, the agents, and the guards.

use anchor_lang::prelude::{Clock, Pubkey};
use anchor_lang::solana_program::instruction::Instruction;
use anchor_lang::{AccountDeserialize, InstructionData, ToAccountMetas};
use anchor_spl::associated_token::{self, get_associated_token_address_with_program_id};
use anchor_spl::token_interface::{Mint, TokenAccount};
use litesvm::LiteSVM;
use solana_keypair::Keypair;
use solana_signer::Signer;
use solana_transaction::Transaction;

use agama_solana::state::*;
use agama_solana::{accounts, instruction, MarketParams, ProtocolParams};

const USDC: u64 = 1_000_000;
const SHARE: u64 = 100_000_000;
const PX: u64 = 100_000_000; // 1 USD in price_e8
const DAY: i64 = 86_400;

/// The Token-2022 associated account.
fn ata(owner: &Pubkey, mint: &Pubkey) -> Pubkey {
    get_associated_token_address_with_program_id(owner, mint, &anchor_spl::token_2022::ID)
}

fn pda(seeds: &[&[u8]]) -> Pubkey {
    Pubkey::find_program_address(seeds, &agama_solana::ID).0
}

struct World {
    svm: LiteSVM,
    admin: Keypair,
    keeper: Keypair,
    protocol: Pubkey,
    usdc_mint: Pubkey,
    lp_mint: Pubkey,
    pool_usdc: Pubkey,
    vault_usdc: Pubkey,
}

struct Mkt {
    market: Pubkey,
    stock_mint: Pubkey,
    custody: Pubkey,
}

impl World {
    fn new() -> Self {
        let mut svm = LiteSVM::new();
        svm.add_program_from_file(agama_solana::ID, "../../target/deploy/agama_solana.so")
            .expect("run `anchor build` first");
        let admin = Keypair::new();
        let keeper = Keypair::new();
        svm.airdrop(&admin.pubkey(), 100_000_000_000).unwrap();
        svm.airdrop(&keeper.pubkey(), 10_000_000_000).unwrap();
        let mut w = World {
            svm,
            admin,
            keeper,
            protocol: pda(&[PROTOCOL_SEED]),
            usdc_mint: pda(&[USDC_SEED]),
            lp_mint: pda(&[LP_SEED]),
            pool_usdc: pda(&[POOL_USDC_SEED]),
            vault_usdc: pda(&[VAULT_USDC_SEED]),
        };
        w.set_time(1_760_000_000);
        let ix = Instruction {
            program_id: agama_solana::ID,
            accounts: accounts::Initialize {
                admin: w.admin.pubkey(),
                protocol: w.protocol,
                usdc_mint: w.usdc_mint,
                lp_mint: w.lp_mint,
                pool_usdc: w.pool_usdc,
                vault_usdc: w.vault_usdc,
                token_program: anchor_spl::token_2022::ID,
                system_program: anchor_lang::system_program::ID,
            }
            .to_account_metas(None),
            data: instruction::Initialize { params: w.params() }.data(),
        };
        let admin = w.admin.insecure_clone();
        w.send(&[ix], &admin).unwrap();
        w
    }

    fn params(&self) -> ProtocolParams {
        ProtocolParams {
            keeper: self.keeper.pubkey(),
            base_rate_bps: 200,
            slope1_bps: 600,
            slope2_bps: 6_000,
            kink_bps: 8_000,
            vault_apr_bps: 1_100,
            min_borrow: USDC,
            min_compound: USDC / 10,
            dex_fee_bps: 5,
        }
    }

    fn now(&self) -> i64 {
        self.svm.get_sysvar::<Clock>().unix_timestamp
    }

    fn set_time(&mut self, t: i64) {
        let mut c = self.svm.get_sysvar::<Clock>();
        c.unix_timestamp = t;
        c.slot += 1;
        self.svm.set_sysvar(&c);
        self.svm.expire_blockhash();
    }

    fn warp(&mut self, secs: i64) {
        let t = self.now() + secs;
        self.set_time(t);
    }

    fn send(&mut self, ixs: &[Instruction], signer: &Keypair) -> Result<(), String> {
        let tx = Transaction::new_signed_with_payer(
            ixs,
            Some(&signer.pubkey()),
            &[signer],
            self.svm.latest_blockhash(),
        );
        let r = self
            .svm
            .send_transaction(tx)
            .map(|_| ())
            .map_err(|e| format!("{:?}\n{}", e.err, e.meta.logs.join("\n")));
        self.svm.expire_blockhash();
        r
    }

    fn user(&mut self) -> Keypair {
        let k = Keypair::new();
        self.svm.airdrop(&k.pubkey(), 10_000_000_000).unwrap();
        k
    }

    fn add_market(&mut self, sym: &str, ltv: u16, lt: u16, price: u64) -> Mkt {
        let mut symbol = [0u8; 8];
        symbol[..sym.len()].copy_from_slice(sym.as_bytes());
        let stock_mint = pda(&[STOCK_SEED, &symbol]);
        let market = pda(&[MARKET_SEED, stock_mint.as_ref()]);
        let custody = pda(&[CUSTODY_SEED, market.as_ref()]);
        let ix = Instruction {
            program_id: agama_solana::ID,
            accounts: accounts::AddMarket {
                admin: self.admin.pubkey(),
                protocol: self.protocol,
                stock_mint,
                market,
                custody,
                token_program: anchor_spl::token_2022::ID,
                system_program: anchor_lang::system_program::ID,
            }
            .to_account_metas(None),
            data: instruction::AddMarket {
                symbol,
                params: MarketParams {
                    ltv_bps: ltv,
                    lt_bps: lt,
                    liq_bonus_bps: 500,
                    offhours_buffer_bps: 500,
                    max_age: 600,
                    max_jump_bps: 1_500,
                },
            }
            .data(),
        };
        let admin = self.admin.insecure_clone();
        self.send(&[ix], &admin).unwrap();
        let m = Mkt {
            market,
            stock_mint,
            custody,
        };
        let now = self.now();
        self.push(&m, price, now, true).unwrap();
        m
    }

    fn push_ix(&self, m: &Mkt, signer: Pubkey, price_e8: u64, t: i64, open: bool) -> Instruction {
        Instruction {
            program_id: agama_solana::ID,
            accounts: accounts::PushPrice {
                keeper: signer,
                protocol: self.protocol,
                market: m.market,
            }
            .to_account_metas(None),
            data: instruction::PushPrice {
                price_e8,
                publish_time: t,
                session_open: open,
            }
            .data(),
        }
    }

    fn push(&mut self, m: &Mkt, price_e8: u64, t: i64, open: bool) -> Result<(), String> {
        let ix = self.push_ix(m, self.keeper.pubkey(), price_e8, t, open);
        let k = self.keeper.insecure_clone();
        self.send(&[ix], &k)
    }

    /// Walk the price to `target` in steps the per-push bound allows.
    fn move_price(&mut self, m: &Mkt, target: u64) {
        loop {
            let cur = self.market(m).price_e8;
            if cur == target {
                return;
            }
            let step = cur / 10;
            let next = if target > cur {
                (cur + step).min(target)
            } else {
                (cur - step).max(target)
            };
            self.warp(1);
            let now = self.now();
            self.push(m, next, now, true).unwrap();
        }
    }

    fn faucet(&mut self, user: &Keypair, m: &Mkt) {
        let ixs = vec![
            Instruction {
                program_id: agama_solana::ID,
                accounts: accounts::FaucetUsdc {
                    user: user.pubkey(),
                    protocol: self.protocol,
                    usdc_mint: self.usdc_mint,
                    user_usdc: ata(&user.pubkey(), &self.usdc_mint),
                    token_program: anchor_spl::token_2022::ID,
                    associated_token_program: associated_token::ID,
                    system_program: anchor_lang::system_program::ID,
                }
                .to_account_metas(None),
                data: instruction::FaucetUsdc {}.data(),
            },
            Instruction {
                program_id: agama_solana::ID,
                accounts: accounts::FaucetStock {
                    user: user.pubkey(),
                    protocol: self.protocol,
                    market: m.market,
                    stock_mint: m.stock_mint,
                    user_stock: ata(&user.pubkey(), &m.stock_mint),
                    token_program: anchor_spl::token_2022::ID,
                    associated_token_program: associated_token::ID,
                    system_program: anchor_lang::system_program::ID,
                }
                .to_account_metas(None),
                data: instruction::FaucetStock {}.data(),
            },
        ];
        self.send(&ixs, user).unwrap();
    }

    fn lend_ix(&self, user: &Keypair, data: Vec<u8>) -> Instruction {
        Instruction {
            program_id: agama_solana::ID,
            accounts: accounts::Lend {
                user: user.pubkey(),
                protocol: self.protocol,
                usdc_mint: self.usdc_mint,
                lp_mint: self.lp_mint,
                pool_usdc: self.pool_usdc,
                user_usdc: ata(&user.pubkey(), &self.usdc_mint),
                user_lp: ata(&user.pubkey(), &self.lp_mint),
                token_program: anchor_spl::token_2022::ID,
                associated_token_program: associated_token::ID,
                system_program: anchor_lang::system_program::ID,
            }
            .to_account_metas(None),
            data,
        }
    }

    /// A lender with the faucet's 10k, all supplied, `times` over.
    fn seed_pool(&mut self, m: &Mkt, times: usize) -> Keypair {
        let lender = self.user();
        for _ in 0..times {
            self.faucet(&lender, m);
        }
        let ix = self.lend_ix(
            &lender,
            instruction::Supply {
                amount: 10_000 * USDC * times as u64,
            }
            .data(),
        );
        self.send(&[ix], &lender).unwrap();
        lender
    }

    fn position_pda(&self, owner: &Pubkey, m: &Mkt, kind: &[u8]) -> Pubkey {
        pda(&[POSITION_SEED, owner.as_ref(), m.market.as_ref(), kind])
    }

    fn earn_deposit(
        &mut self,
        user: &Keypair,
        m: &Mkt,
        amount: u64,
        target: u16,
    ) -> Result<(), String> {
        let ix = Instruction {
            program_id: agama_solana::ID,
            accounts: accounts::EarnDeposit {
                user: user.pubkey(),
                protocol: self.protocol,
                market: m.market,
                position: self.position_pda(&user.pubkey(), m, EARN_SEED),
                usdc_mint: self.usdc_mint,
                stock_mint: m.stock_mint,
                pool_usdc: self.pool_usdc,
                vault_usdc: self.vault_usdc,
                custody: m.custody,
                user_stock: ata(&user.pubkey(), &m.stock_mint),
                token_program: anchor_spl::token_2022::ID,
                system_program: anchor_lang::system_program::ID,
            }
            .to_account_metas(None),
            data: instruction::EarnDeposit {
                amount,
                target_ltv_bps: target,
            }
            .data(),
        };
        self.send(&[ix], user)
    }

    fn earn_close(&mut self, user: &Keypair, m: &Mkt) -> Result<(), String> {
        let ix = Instruction {
            program_id: agama_solana::ID,
            accounts: accounts::EarnClose {
                user: user.pubkey(),
                protocol: self.protocol,
                market: m.market,
                position: self.position_pda(&user.pubkey(), m, EARN_SEED),
                usdc_mint: self.usdc_mint,
                stock_mint: m.stock_mint,
                pool_usdc: self.pool_usdc,
                vault_usdc: self.vault_usdc,
                custody: m.custody,
                user_usdc: ata(&user.pubkey(), &self.usdc_mint),
                user_stock: ata(&user.pubkey(), &m.stock_mint),
                token_program: anchor_spl::token_2022::ID,
                associated_token_program: associated_token::ID,
                system_program: anchor_lang::system_program::ID,
            }
            .to_account_metas(None),
            data: instruction::EarnClose {}.data(),
        };
        self.send(&[ix], user)
    }

    fn set_target(&mut self, user: &Keypair, m: &Mkt, target: u16) -> Result<(), String> {
        let ix = Instruction {
            program_id: agama_solana::ID,
            accounts: accounts::EarnOwner {
                user: user.pubkey(),
                protocol: self.protocol,
                market: m.market,
                position: self.position_pda(&user.pubkey(), m, EARN_SEED),
                usdc_mint: self.usdc_mint,
                stock_mint: m.stock_mint,
                pool_usdc: self.pool_usdc,
                vault_usdc: self.vault_usdc,
                custody: m.custody,
                token_program: anchor_spl::token_2022::ID,
            }
            .to_account_metas(None),
            data: instruction::EarnSetTarget {
                target_ltv_bps: target,
            }
            .data(),
        };
        self.send(&[ix], user)
    }

    fn amplify_open(
        &mut self,
        user: &Keypair,
        m: &Mkt,
        amount: u64,
        lev: u16,
    ) -> Result<(), String> {
        let ix = Instruction {
            program_id: agama_solana::ID,
            accounts: accounts::AmplifyOpen {
                user: user.pubkey(),
                protocol: self.protocol,
                market: m.market,
                position: self.position_pda(&user.pubkey(), m, AMPLIFY_SEED),
                usdc_mint: self.usdc_mint,
                stock_mint: m.stock_mint,
                pool_usdc: self.pool_usdc,
                vault_usdc: self.vault_usdc,
                custody: m.custody,
                user_stock: ata(&user.pubkey(), &m.stock_mint),
                token_program: anchor_spl::token_2022::ID,
                system_program: anchor_lang::system_program::ID,
            }
            .to_account_metas(None),
            data: instruction::AmplifyOpen {
                amount,
                leverage_bps: lev,
            }
            .data(),
        };
        self.send(&[ix], user)
    }

    fn amplify_close(&mut self, user: &Keypair, m: &Mkt) -> Result<(), String> {
        let ix = Instruction {
            program_id: agama_solana::ID,
            accounts: accounts::AmplifyClose {
                user: user.pubkey(),
                protocol: self.protocol,
                market: m.market,
                position: self.position_pda(&user.pubkey(), m, AMPLIFY_SEED),
                usdc_mint: self.usdc_mint,
                stock_mint: m.stock_mint,
                pool_usdc: self.pool_usdc,
                vault_usdc: self.vault_usdc,
                custody: m.custody,
                user_stock: ata(&user.pubkey(), &m.stock_mint),
                token_program: anchor_spl::token_2022::ID,
                associated_token_program: associated_token::ID,
                system_program: anchor_lang::system_program::ID,
            }
            .to_account_metas(None),
            data: instruction::AmplifyClose {}.data(),
        };
        self.send(&[ix], user)
    }

    fn agent_ix(&self, caller: &Keypair, m: &Mkt, position: Pubkey, data: Vec<u8>) -> Instruction {
        Instruction {
            program_id: agama_solana::ID,
            accounts: accounts::Agent {
                caller: caller.pubkey(),
                protocol: self.protocol,
                market: m.market,
                position,
                usdc_mint: self.usdc_mint,
                stock_mint: m.stock_mint,
                pool_usdc: self.pool_usdc,
                vault_usdc: self.vault_usdc,
                custody: m.custody,
                token_program: anchor_spl::token_2022::ID,
            }
            .to_account_metas(None),
            data,
        }
    }

    fn rebalance(&mut self, caller: &Keypair, m: &Mkt, position: Pubkey) -> Result<(), String> {
        let ix = self.agent_ix(caller, m, position, instruction::Rebalance {}.data());
        self.send(&[ix], caller)
    }

    fn compound(&mut self, caller: &Keypair, m: &Mkt, position: Pubkey) -> Result<(), String> {
        let ix = self.agent_ix(caller, m, position, instruction::Compound {}.data());
        self.send(&[ix], caller)
    }

    fn liquidate(
        &mut self,
        liq: &Keypair,
        m: &Mkt,
        position: Pubkey,
        max: u64,
    ) -> Result<(), String> {
        let ix = Instruction {
            program_id: agama_solana::ID,
            accounts: accounts::Liquidate {
                liquidator: liq.pubkey(),
                protocol: self.protocol,
                market: m.market,
                position,
                usdc_mint: self.usdc_mint,
                stock_mint: m.stock_mint,
                pool_usdc: self.pool_usdc,
                vault_usdc: self.vault_usdc,
                custody: m.custody,
                liquidator_usdc: ata(&liq.pubkey(), &self.usdc_mint),
                liquidator_stock: ata(&liq.pubkey(), &m.stock_mint),
                token_program: anchor_spl::token_2022::ID,
                associated_token_program: associated_token::ID,
                system_program: anchor_lang::system_program::ID,
            }
            .to_account_metas(None),
            data: instruction::Liquidate { max_repay: max }.data(),
        };
        self.send(&[ix], liq)
    }

    fn poke(&mut self) {
        let ix = Instruction {
            program_id: agama_solana::ID,
            accounts: accounts::Poke {
                protocol: self.protocol,
            }
            .to_account_metas(None),
            data: instruction::Poke {}.data(),
        };
        let k = self.keeper.insecure_clone();
        self.send(&[ix], &k).unwrap();
    }

    fn load<T: AccountDeserialize>(&self, k: &Pubkey) -> T {
        let acc = self.svm.get_account(k).expect("account missing");
        T::try_deserialize(&mut &acc.data[..]).unwrap()
    }

    fn protocol(&self) -> Protocol {
        self.load(&self.protocol)
    }
    fn market(&self, m: &Mkt) -> Market {
        self.load(&m.market)
    }
    fn position(&self, k: &Pubkey) -> Position {
        self.load(k)
    }
    fn exists(&self, k: &Pubkey) -> bool {
        self.svm
            .get_account(k)
            .map(|a| a.lamports > 0)
            .unwrap_or(false)
    }
    fn balance(&self, owner: &Pubkey, mint: &Pubkey) -> u64 {
        let ata = ata(owner, mint);
        match self.svm.get_account(&ata) {
            Some(a) if !a.data.is_empty() => {
                TokenAccount::try_deserialize(&mut &a.data[..])
                    .unwrap()
                    .amount
            }
            _ => 0,
        }
    }
    fn token_amount(&self, k: &Pubkey) -> u64 {
        self.load::<TokenAccount>(k).amount
    }

    /// LTV in bps the way the program sees it.
    fn ltv(&self, m: &Mkt, pos: &Pubkey) -> u64 {
        let p = self.protocol();
        let mk = self.market(m);
        let s = self.position(pos);
        let debt = s.debt(&p).unwrap();
        let value = mk.value(s.collateral).unwrap();
        debt * 10_000 / value
    }
}

fn err_has(r: Result<(), String>, what: &str) {
    let e = r.expect_err("expected a failure");
    assert!(e.contains(what), "expected `{what}` in:\n{e}");
}

// ---------------------------------------------------------------------------

#[test]
fn earn_opens_at_the_level_and_lands_in_the_vault() {
    let mut w = World::new();
    let tsla = w.add_market("TSLA", 3_000, 4_000, 400 * PX);
    w.seed_pool(&tsla, 10);
    let alice = w.user();
    w.faucet(&alice, &tsla);

    w.earn_deposit(&alice, &tsla, 10 * SHARE, 2_500).unwrap();
    let pos = w.position_pda(&alice.pubkey(), &tsla, EARN_SEED);
    let s = w.position(&pos);
    let p = w.protocol();
    assert_eq!(s.collateral, 10 * SHARE);
    // 10 * 400 * 25% = 1000 USDC borrowed, all of it in the vault.
    assert_eq!(s.debt(&p).unwrap(), 1_000 * USDC);
    assert_eq!(p.shares_value(s.shares).unwrap(), 1_000 * USDC);
    assert_eq!(w.token_amount(&w.vault_usdc), 1_000 * USDC);
    assert_eq!(w.token_amount(&tsla.custody), 10 * SHARE);
    assert_eq!(w.balance(&alice.pubkey(), &tsla.stock_mint), 0);
    assert_eq!(w.ltv(&tsla, &pos), 2_500);
}

#[test]
fn agents_hold_the_level_both_ways_without_selling_stock() {
    let mut w = World::new();
    let tsla = w.add_market("TSLA", 3_000, 4_000, 400 * PX);
    w.seed_pool(&tsla, 10);
    let alice = w.user();
    let bot = w.user();
    w.faucet(&alice, &tsla);
    w.earn_deposit(&alice, &tsla, 10 * SHARE, 2_500).unwrap();
    let pos = w.position_pda(&alice.pubkey(), &tsla, EARN_SEED);

    // Inside the band: nothing to do.
    err_has(w.rebalance(&bot, &tsla, pos), "AlreadyOnTarget");

    // Stock up 20%: the agent borrows the difference into the vault.
    w.move_price(&tsla, 480 * PX);
    let shares_before = w.position(&pos).shares;
    w.rebalance(&bot, &tsla, pos).unwrap();
    let s = w.position(&pos);
    assert_eq!(s.last_agent_op, OP_BORROWED_MORE);
    assert_eq!(s.last_agent, bot.pubkey());
    assert!(s.shares > shares_before);
    assert!((2_490..=2_500).contains(&w.ltv(&tsla, &pos)));

    // Stock down 30%: repaid out of the vault, the stock count does not move.
    w.move_price(&tsla, 336 * PX);
    w.rebalance(&bot, &tsla, pos).unwrap();
    let s = w.position(&pos);
    assert_eq!(s.last_agent_op, OP_REPAID_FROM_YIELD);
    assert_eq!(s.collateral, 10 * SHARE);
    assert!((2_495..=2_505).contains(&w.ltv(&tsla, &pos)));
}

#[test]
fn yield_comes_back_as_more_stock_and_close_returns_it() {
    let mut w = World::new();
    let tsla = w.add_market("TSLA", 3_000, 4_000, 400 * PX);
    w.seed_pool(&tsla, 10);
    let alice = w.user();
    let bot = w.user();
    w.faucet(&alice, &tsla);
    w.earn_deposit(&alice, &tsla, 10 * SHARE, 2_500).unwrap();
    let pos = w.position_pda(&alice.pubkey(), &tsla, EARN_SEED);

    err_has(w.compound(&bot, &tsla, pos), "NothingToCompound");

    // Half a year: the vault pays 11%, the pool charges ~2.2% at this usage.
    w.warp(182 * DAY);
    let now = w.now();
    w.push(&tsla, 400 * PX, now, true).unwrap();
    w.compound(&bot, &tsla, pos).unwrap();
    let s = w.position(&pos);
    assert_eq!(s.last_agent_op, OP_COMPOUNDED);
    assert!(s.collateral > 10 * SHARE, "the share count grows");
    // ~1000 * (11% - 2.2%) / 2 = ~44 USDC = ~0.11 TSLA
    let gained = s.collateral - 10 * SHARE;
    assert!(gained > 9_000_000 && gained < 12_000_000, "gained {gained}");
    assert_eq!(s.stock_from_yield, gained);
    // The buffer still covers the debt after the compound.
    let p = w.protocol();
    assert!(p.shares_value(s.shares).unwrap() + 1 >= s.debt(&p).unwrap());

    // ~1% more stock moves the LTV less than the band: no churn.
    err_has(w.rebalance(&bot, &tsla, pos), "AlreadyOnTarget");

    let usdc_before = w.balance(&alice.pubkey(), &w.usdc_mint);
    w.earn_close(&alice, &tsla).unwrap();
    assert!(!w.exists(&pos));
    assert_eq!(
        w.balance(&alice.pubkey(), &tsla.stock_mint),
        10 * SHARE + gained
    );
    assert!(w.balance(&alice.pubkey(), &w.usdc_mint) + 1 >= usdc_before);
    assert_eq!(w.token_amount(&tsla.custody), 0);
    let p = w.protocol();
    assert_eq!(p.total_scaled_debt, 0);
    // The vault paid out more than it was paid in: that is the coupon.
    assert!(p.coupons_paid > 0);
}

#[test]
fn close_after_a_drop_takes_the_shortfall_from_the_wallet() {
    let mut w = World::new();
    let tsla = w.add_market("TSLA", 3_000, 4_000, 400 * PX);
    w.seed_pool(&tsla, 10);
    let alice = w.user();
    let bot = w.user();
    w.faucet(&alice, &tsla);
    w.earn_deposit(&alice, &tsla, 10 * SHARE, 3_000).unwrap();
    let pos = w.position_pda(&alice.pubkey(), &tsla, EARN_SEED);
    // A borrow rate above the vault's: interest outruns the buffer.
    let mut params = w.params();
    params.base_rate_bps = 3_000;
    let ix = Instruction {
        program_id: agama_solana::ID,
        accounts: accounts::AdminOnly {
            admin: w.admin.pubkey(),
            protocol: w.protocol,
        }
        .to_account_metas(None),
        data: instruction::SetParams { params }.data(),
    };
    let admin = w.admin.insecure_clone();
    w.send(&[ix], &admin).unwrap();
    w.warp(90 * DAY);
    let now = w.now();
    w.push(&tsla, 400 * PX, now, true).unwrap();
    err_has(w.compound(&bot, &tsla, pos), "NothingToCompound");
    w.poke();
    let p = w.protocol();
    let s = w.position(&pos);
    let shortfall = s.debt(&p).unwrap() - p.shares_value(s.shares).unwrap();
    assert!(shortfall > 0);
    let usdc_before = w.balance(&alice.pubkey(), &w.usdc_mint);
    w.earn_close(&alice, &tsla).unwrap();
    let paid = usdc_before - w.balance(&alice.pubkey(), &w.usdc_mint);
    assert!(
        paid >= shortfall && paid <= shortfall + 2,
        "paid {paid} vs {shortfall}"
    );
    assert_eq!(w.balance(&alice.pubkey(), &tsla.stock_mint), 10 * SHARE);
}

#[test]
fn amplify_loops_to_the_multiple_and_unwinds() {
    let mut w = World::new();
    let spy = w.add_market("SPY", 5_000, 6_000, 650 * PX);
    w.seed_pool(&spy, 10);
    let bob = w.user();
    let bot = w.user();
    w.faucet(&bob, &spy);

    // 2x on SPY sits right at the 50% LTV; the swap fee pushes it over.
    err_has(
        w.amplify_open(&bob, &spy, 10 * SHARE, 20_000),
        "LtvExceeded",
    );
    err_has(
        w.amplify_open(&bob, &spy, 10 * SHARE, 20_001),
        "LeverageOutOfRange",
    );
    w.amplify_open(&bob, &spy, 10 * SHARE, 18_000).unwrap();
    let pos = w.position_pda(&bob.pubkey(), &spy, AMPLIFY_SEED);
    let s = w.position(&pos);
    // 10 SPY + 8 SPY bought (less the 5 bps fee)
    assert!(s.collateral > 17_99 * SHARE / 100 && s.collateral < 18 * SHARE);
    assert_eq!(s.debt(&w.protocol()).unwrap(), 5_200 * USDC);
    let target = s.target_ltv_bps;
    assert!((4_440..=4_446).contains(&target), "target {target}");

    // Up 10%: the agent buys more SPY to get back to the multiple.
    w.move_price(&spy, 715 * PX);
    w.rebalance(&bot, &spy, pos).unwrap();
    let s = w.position(&pos);
    assert_eq!(s.last_agent_op, OP_BOUGHT_MORE);
    assert!((w.ltv(&spy, &pos) as i64 - target as i64).abs() <= 2);

    // Down 15%: it sells just enough to come back down.
    w.move_price(&spy, 608 * PX);
    w.rebalance(&bot, &spy, pos).unwrap();
    assert_eq!(w.position(&pos).last_agent_op, OP_SOLD_TO_REPAY);
    assert!((w.ltv(&spy, &pos) as i64 - target as i64).abs() <= 2);

    w.amplify_close(&bob, &spy).unwrap();
    assert!(!w.exists(&pos));
    let back = w.balance(&bob.pubkey(), &spy.stock_mint);
    // Bought high, sold lower: fewer shares than deposited, but most of them.
    assert!(back > 9 * SHARE && back < 10 * SHARE, "back {back}");
    assert_eq!(w.protocol().total_scaled_debt, 0);
}

#[test]
fn the_buffer_goes_before_the_liquidator() {
    let mut w = World::new();
    let nvda = w.add_market("NVDA", 3_000, 4_000, 180 * PX);
    w.seed_pool(&nvda, 10);
    let alice = w.user();
    let liq = w.user();
    w.faucet(&alice, &nvda);
    w.faucet(&liq, &nvda);
    w.earn_deposit(&alice, &nvda, 10 * SHARE, 3_000).unwrap();
    let pos = w.position_pda(&alice.pubkey(), &nvda, EARN_SEED);

    err_has(w.liquidate(&liq, &nvda, pos, 1_000 * USDC), "Healthy");
    // -30%: LTV 43%, above the 40% threshold, nobody rebalanced.
    w.move_price(&nvda, 126 * PX);
    w.liquidate(&liq, &nvda, pos, 1_000 * USDC).unwrap();
    let s = w.position(&pos);
    assert_eq!(s.last_agent_op, OP_DELEVERAGED);
    assert_eq!(s.collateral, 10 * SHARE, "no stock taken");
    assert_eq!(w.balance(&liq.pubkey(), &nvda.stock_mint), 10 * SHARE);
}

#[test]
fn amplify_without_a_buffer_gets_liquidated_at_the_bonus() {
    let mut w = World::new();
    let nvda = w.add_market("NVDA", 3_000, 4_000, 180 * PX);
    w.seed_pool(&nvda, 10);
    let bob = w.user();
    let liq = w.user();
    w.faucet(&bob, &nvda);
    w.faucet(&liq, &nvda);
    w.amplify_open(&bob, &nvda, 10 * SHARE, 14_000).unwrap();
    let pos = w.position_pda(&bob.pubkey(), &nvda, AMPLIFY_SEED);
    w.move_price(&nvda, 125 * PX);
    let debt_before = w.position(&pos).debt(&w.protocol()).unwrap();
    let stock_before = w.balance(&liq.pubkey(), &nvda.stock_mint);
    w.liquidate(&liq, &nvda, pos, u64::MAX).unwrap();
    let s = w.position(&pos);
    assert_eq!(s.last_agent_op, OP_LIQUIDATED);
    let repaid = debt_before - s.debt(&w.protocol()).unwrap();
    assert!(repaid <= debt_before / 2 + 1);
    let seized = w.balance(&liq.pubkey(), &nvda.stock_mint) - stock_before;
    // repaid / 125 * 1.05
    let expect = repaid as u128 * 10_000_000_000 / (125 * PX) as u128 * 10_500 / 10_000;
    assert!(
        (seized as i128 - expect as i128).abs() <= 3,
        "{seized} vs {expect}"
    );
}

#[test]
fn lenders_earn_the_borrow_rate() {
    let mut w = World::new();
    let tsla = w.add_market("TSLA", 3_000, 4_000, 400 * PX);
    let lender = w.seed_pool(&tsla, 1);
    let alice = w.user();
    w.faucet(&alice, &tsla);
    w.earn_deposit(&alice, &tsla, 10 * SHARE, 2_500).unwrap();
    w.warp(365 * DAY);
    let now = w.now();
    w.push(&tsla, 400 * PX, now, true).unwrap();
    // 1000 of 10000 lent: ~2.75% on the borrowed tenth.
    let lp = w.balance(&lender.pubkey(), &w.lp_mint);
    let ix = w.lend_ix(&lender, instruction::Withdraw { lp: lp / 2 }.data());
    w.send(&[ix], &lender).unwrap();
    let got = w.balance(&lender.pubkey(), &w.usdc_mint);
    assert!(got > 5_000 * USDC + 12 * USDC, "got {got}");
    // Cannot take out cash that is lent.
    let ix = w.lend_ix(&lender, instruction::Withdraw { lp: lp / 2 }.data());
    err_has(w.send(&[ix], &lender), "WithdrawTooLarge");
}

#[test]
fn the_price_layer_is_bounded() {
    let mut w = World::new();
    let tsla = w.add_market("TSLA", 3_000, 4_000, 400 * PX);
    w.seed_pool(&tsla, 2);
    let alice = w.user();
    w.faucet(&alice, &tsla);
    let now = w.now();

    // Not the keeper.
    let ix = w.push_ix(&tsla, alice.pubkey(), 401 * PX, now, true);
    err_has(w.send(&[ix], &alice), "NotKeeper");
    // A jump past 15% in one push.
    err_has(w.push(&tsla, 470 * PX, now, true), "PriceJumpTooLarge");
    // Publish time going backwards, or from the future.
    err_has(w.push(&tsla, 401 * PX, now - 1, true), "BadPublishTime");
    err_has(w.push(&tsla, 401 * PX, now + 120, true), "BadPublishTime");

    // Stale: borrowing waits.
    w.warp(601);
    err_has(w.earn_deposit(&alice, &tsla, SHARE, 2_000), "StalePrice");

    // Out of session the terms tighten by the buffer: 30% becomes 25%.
    let now = w.now();
    w.push(&tsla, 400 * PX, now, false).unwrap();
    err_has(w.earn_deposit(&alice, &tsla, SHARE, 2_600), "TargetTooHigh");
    w.earn_deposit(&alice, &tsla, SHARE, 2_500).unwrap();
}

#[test]
fn the_slider_moves_the_position_now() {
    let mut w = World::new();
    let tsla = w.add_market("TSLA", 3_000, 4_000, 400 * PX);
    w.seed_pool(&tsla, 10);
    let alice = w.user();
    w.faucet(&alice, &tsla);
    w.earn_deposit(&alice, &tsla, 10 * SHARE, 1_000).unwrap();
    let pos = w.position_pda(&alice.pubkey(), &tsla, EARN_SEED);
    w.set_target(&alice, &tsla, 2_800).unwrap();
    assert_eq!(w.ltv(&tsla, &pos), 2_800);
    w.set_target(&alice, &tsla, 500).unwrap();
    assert!((499..=500).contains(&w.ltv(&tsla, &pos)));
    err_has(w.set_target(&alice, &tsla, 3_100), "TargetTooHigh");
    // A stranger cannot move it (the PDA is derived from the signer).
    let eve = w.user();
    assert!(w.set_target(&eve, &tsla, 2_000).is_err());
}

#[test]
fn every_mint_is_confidential() {
    use spl_token_2022_interface::extension::confidential_transfer::ConfidentialTransferMint;
    use spl_token_2022_interface::extension::{BaseStateWithExtensions, StateWithExtensions};
    use spl_token_2022_interface::state::Mint as SplMint;

    let mut w = World::new();
    let tsla = w.add_market("TSLA", 3_000, 4_000, 400 * PX);
    for mint in [w.usdc_mint, w.lp_mint, tsla.stock_mint] {
        let acc = w.svm.get_account(&mint).unwrap();
        assert_eq!(acc.owner, anchor_spl::token_2022::ID);
        let state = StateWithExtensions::<SplMint>::unpack(&acc.data).unwrap();
        let ct = state.get_extension::<ConfidentialTransferMint>().unwrap();
        assert!(bool::from(ct.auto_approve_new_accounts));
        // No authority can change it, no auditor can read the balances.
        assert_eq!(Option::<Pubkey>::from(ct.authority), None);
        assert_eq!(ct.auditor_elgamal_pubkey, Default::default());
        assert_eq!(state.base.mint_authority, Some(w.protocol).into());
    }
    let _ = Mint::try_deserialize(&mut &w.svm.get_account(&w.usdc_mint).unwrap().data[..]).unwrap();
}

#[test]
fn close_never_needs_public_usdc_for_rounding() {
    // A holder whose USDC is all in a confidential balance has zero public
    // USDC. Closing right after opening leaves a few units of rounding
    // between the vault shares and the debt: that must not reach the wallet.
    let mut w = World::new();
    let tsla = w.add_market("TSLA", 3_000, 4_000, 400 * PX);
    w.seed_pool(&tsla, 10);
    let alice = w.user();
    w.faucet(&alice, &tsla);
    // Take the faucet USDC out of the public balance, as a shield would.
    let usdc = w.usdc_mint;
    let burn = Instruction {
        program_id: anchor_spl::token_2022::ID,
        accounts: vec![
            anchor_lang::solana_program::instruction::AccountMeta::new(
                ata(&alice.pubkey(), &usdc),
                false,
            ),
            anchor_lang::solana_program::instruction::AccountMeta::new(usdc, false),
            anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                alice.pubkey(),
                true,
            ),
        ],
        data: {
            let mut d = vec![8u8]; // Burn
            d.extend_from_slice(&(10_000 * USDC).to_le_bytes());
            d
        },
    };
    w.send(&[burn], &alice).unwrap();
    assert_eq!(w.balance(&alice.pubkey(), &w.usdc_mint), 0);

    // A month in, the borrow index and the vault NAV are no longer round
    // numbers. Then open and close in the same slot, so no yield has accrued
    // to cover the rounding: the vault value rounds down, the debt rounds up.
    w.warp(30 * DAY);
    let now = w.now();
    w.push(&tsla, 400 * PX, now, true).unwrap();
    w.poke();
    for (amount, target) in [
        (3 * SHARE + 7, 2_337u16),
        (SHARE / 3, 1_111),
        (7 * SHARE + 1, 2_999),
    ] {
        w.earn_deposit(&alice, &tsla, amount, target).unwrap();
        let pos = w.position_pda(&alice.pubkey(), &tsla, EARN_SEED);
        let (p, s) = (w.protocol(), w.position(&pos));
        assert!(
            s.debt(&p).unwrap() > p.shares_value(s.shares).unwrap(),
            "no rounding gap to cover"
        );
        w.earn_close(&alice, &tsla).unwrap();
    }
    assert_eq!(w.balance(&alice.pubkey(), &tsla.stock_mint), 10 * SHARE);
    assert_eq!(w.protocol().total_scaled_debt, 0);
}

// ---------------------------------------------------------------------------
// Chainlink CRE: reports relayed by Chainlink's own mock forwarder program
// (the one `cre workflow simulate` uses), loaded from tests/fixtures.
// ---------------------------------------------------------------------------

const MOCK_FORWARDER: Pubkey = anchor_lang::pubkey!("7kuEAA3mSC1Tz8gQjnvH7bKFda9xSPRRin9SZbH49cNK");

fn sha256(b: &[u8]) -> [u8; 32] {
    use sha2::Digest;
    sha2::Sha256::digest(b).into()
}

fn disc(name: &str) -> [u8; 8] {
    sha256(format!("global:{name}").as_bytes())[..8]
        .try_into()
        .unwrap()
}

fn sym(s: &str) -> [u8; 8] {
    let mut b = [0u8; 8];
    b[..s.len()].copy_from_slice(s.as_bytes());
    b
}

struct Cre {
    state: Pubkey,
    authority: Pubkey,
    cre: Pubkey,
}

fn setup_cre(w: &mut World, owner: [u8; 20]) -> Cre {
    w.svm
        .add_program_from_file(MOCK_FORWARDER, "tests/fixtures/mock_forwarder.so")
        .expect("run scripts/fetch-fixtures.sh first");
    let state = Keypair::new();
    let admin = w.admin.insecure_clone();
    let init = Instruction {
        program_id: MOCK_FORWARDER,
        accounts: vec![
            anchor_lang::solana_program::instruction::AccountMeta::new(state.pubkey(), true),
            anchor_lang::solana_program::instruction::AccountMeta::new(admin.pubkey(), true),
            anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                anchor_lang::system_program::ID,
                false,
            ),
        ],
        data: disc("initialize").to_vec(),
    };
    let tx = Transaction::new_signed_with_payer(
        &[init],
        Some(&admin.pubkey()),
        &[&admin, &state],
        w.svm.latest_blockhash(),
    );
    w.svm.send_transaction(tx).unwrap();
    w.svm.expire_blockhash();
    let cre = pda(&[CRE_SEED]);
    let ix = Instruction {
        program_id: agama_solana::ID,
        accounts: accounts::SetCre {
            admin: admin.pubkey(),
            protocol: w.protocol,
            cre,
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
        data: instruction::SetCre {
            forwarder_program: MOCK_FORWARDER,
            forwarder_state: state.pubkey(),
            workflow_owner: owner,
            simulation: true,
        }
        .data(),
    };
    w.send(&[ix], &admin).unwrap();
    let (authority, _) = Pubkey::find_program_address(
        &[
            b"forwarder",
            state.pubkey().as_ref(),
            agama_solana::ID.as_ref(),
        ],
        &MOCK_FORWARDER,
    );
    Cre {
        state: state.pubkey(),
        authority,
        cre,
    }
}

/// What the DON would sign, relayed through the mock forwarder's `report`.
fn cre_report_ix(
    c: &Cre,
    transmitter: &Pubkey,
    owner: [u8; 20],
    markets: &[Pubkey],
    updates: Vec<PriceUpdate>,
) -> Instruction {
    let payload = anchor_lang::prelude::borsh::to_vec(&PriceReport { updates }).unwrap();
    let mut keys = vec![c.state, c.authority, c.cre];
    keys.extend_from_slice(markets);
    let flat: Vec<u8> = keys.iter().flat_map(|k| k.to_bytes()).collect();
    let account_hash = sha256(&flat);
    let mut raw = vec![1u8; 45]; // forwarder metadata: version, execution id, ...
    raw.extend_from_slice(&[7u8; 32]); // workflow_cid
    raw.extend_from_slice(b"agamaprice"); // workflow_name (10)
    raw.extend_from_slice(&owner); // workflow_owner (20)
    raw.extend_from_slice(&[0, 1]); // report_id
    raw.extend_from_slice(&account_hash);
    raw.extend_from_slice(&(payload.len() as u32).to_le_bytes());
    raw.extend_from_slice(&payload);
    let mut data = vec![0u8]; // no signatures: the mock does not check them
    data.extend_from_slice(&raw);
    data.extend_from_slice(&[0u8; 96]); // report context
    let mut ix_data = disc("report").to_vec();
    ix_data.extend_from_slice(&(data.len() as u32).to_le_bytes());
    ix_data.extend_from_slice(&data);
    use anchor_lang::solana_program::instruction::AccountMeta;
    let mut metas = vec![
        AccountMeta::new_readonly(c.state, false),
        AccountMeta::new(*transmitter, true),
        AccountMeta::new_readonly(c.authority, false),
        AccountMeta::new_readonly(agama_solana::ID, false),
        AccountMeta::new_readonly(anchor_lang::system_program::ID, false),
        AccountMeta::new(c.cre, false),
    ];
    metas.extend(markets.iter().map(|m| AccountMeta::new(*m, false)));
    Instruction {
        program_id: MOCK_FORWARDER,
        accounts: metas,
        data: ix_data,
    }
}

const OWNER: [u8; 20] = [0xab; 20];

#[test]
fn cre_reports_price_the_markets() {
    let mut w = World::new();
    let tsla = w.add_market("TSLA", 3_000, 4_000, 400 * PX);
    let gldy = w.add_market("GLDY", 6_000, 7_000, 4_150 * PX);
    let c = setup_cre(&mut w, OWNER);
    let relayer = w.user();
    w.warp(30);
    let now = w.now();
    let ix = cre_report_ix(
        &c,
        &relayer.pubkey(),
        OWNER,
        &[tsla.market, gldy.market],
        vec![
            PriceUpdate {
                symbol: sym("TSLA"),
                price_e8: 410 * PX,
                publish_time: now,
                session_open: false,
            },
            PriceUpdate {
                symbol: sym("GLDY"),
                price_e8: 4_160 * PX,
                publish_time: now,
                session_open: true,
            },
        ],
    );
    w.send(&[ix], &relayer).unwrap();
    let t = w.market(&tsla);
    assert_eq!(
        (t.price_e8, t.price_time, t.session_open),
        (410 * PX, now, false)
    );
    assert_eq!(w.market(&gldy).price_e8, 4_160 * PX);
    let cfg: CreConfig = w.load(&c.cre);
    assert_eq!(cfg.reports, 1);

    // The same bounds as the keeper: a 20% jump in one report is refused.
    w.warp(30);
    let now = w.now();
    let ix = cre_report_ix(
        &c,
        &relayer.pubkey(),
        OWNER,
        &[tsla.market],
        vec![PriceUpdate {
            symbol: sym("TSLA"),
            price_e8: 492 * PX,
            publish_time: now,
            session_open: true,
        }],
    );
    err_has(w.send(&[ix], &relayer), "PriceJumpTooLarge");
}

#[test]
fn cre_refuses_what_did_not_come_from_our_workflow() {
    let mut w = World::new();
    let tsla = w.add_market("TSLA", 3_000, 4_000, 400 * PX);
    let c = setup_cre(&mut w, OWNER);
    let eve = w.user();
    let now = w.now();
    let upd = || {
        vec![PriceUpdate {
            symbol: sym("TSLA"),
            price_e8: 401 * PX,
            publish_time: now,
            session_open: true,
        }]
    };

    // Another workflow owner, through the right forwarder.
    let ix = cre_report_ix(&c, &eve.pubkey(), [0xcd; 20], &[tsla.market], upd());
    err_has(w.send(&[ix], &eve), "InvalidWorkflowOwner");

    // Calling on_report directly, signing as forwarder_authority with a plain key.
    let fake = Keypair::new();
    w.svm.airdrop(&fake.pubkey(), 1_000_000_000).unwrap();
    let mut metadata = vec![0u8; 64];
    metadata[42..62].copy_from_slice(&OWNER);
    let mut accs = accounts::OnReport {
        state: c.state,
        forwarder_authority: fake.pubkey(),
        cre: c.cre,
    }
    .to_account_metas(None);
    accs.push(anchor_lang::solana_program::instruction::AccountMeta::new(
        tsla.market,
        false,
    ));
    let ix = Instruction {
        program_id: agama_solana::ID,
        accounts: accs,
        data: instruction::OnReport {
            metadata,
            report: anchor_lang::prelude::borsh::to_vec(&PriceReport { updates: upd() }).unwrap(),
        }
        .data(),
    };
    err_has(w.send(&[ix], &fake), "InvalidForwarderAuthority");

    // A report naming a market it did not pass.
    let ix = cre_report_ix(&c, &eve.pubkey(), OWNER, &[], upd());
    err_has(w.send(&[ix], &eve), "MarketNotInReport");

    assert_eq!(w.market(&tsla).price_e8, 400 * PX);
}
