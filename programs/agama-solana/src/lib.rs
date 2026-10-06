//! Agama on Solana: deposit a tokenized stock, get more of it back.
//!
//! The same product as the X Layer build, written for Solana:
//!
//! - **Earn.** Deposit a stock, pick a level. The program borrows USDC against
//!   it, puts the USDC in the Agama private credit vault, and permissionless
//!   agents hold the level: the stock rises, they borrow the difference; it
//!   falls, they repay out of the yield, never by selling the stock. The yield
//!   above the debt is bought back as more stock.
//! - **Amplify.** One slider: borrow against the stock, buy more of the same
//!   stock, pledge it, in one instruction. The agents hold the multiple.
//! - **Lend.** Supply USDC to the pool, earn the borrow rate.
//!
//! One program, one PDA (`protocol`) that signs for the pool, the vault, the
//! stock custodies and every devnet mint.

use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_2022::Token2022;
use anchor_spl::token_interface::{self as token, Mint, TokenAccount, TransferChecked};

pub mod errors;
pub mod math;
pub mod mints;
pub mod ops;
pub mod state;

use errors::AgamaError;
use math::*;
use ops::*;
use state::*;

declare_id!("6YdZN72p68ynpGH1SwZ86EseFokch6zPAQPAq9NxPY7D");

pub const FAUCET_USDC: u64 = 10_000 * 1_000_000;
pub const FAUCET_STOCK: u64 = 10 * 100_000_000;
/// Drift around the target the agents tolerate before acting.
pub const REBALANCE_BAND_BPS: u64 = 100;
/// Debt left after the vault shares, small enough to write off at close
/// rather than take from the wallet (100 units = 0.0001 USDC).
pub const CLOSE_DUST: u64 = 100;
/// Out-of-band publish time the keeper may claim, in seconds.
pub const MAX_FUTURE_SKEW: i64 = 60;

macro_rules! pipes {
    ($a:expr) => {
        Pipes {
            token_program: $a.token_program.key(),
            authority: $a.protocol.to_account_info(),
            bump: $a.protocol.bump,
            usdc_mint: $a.usdc_mint.to_account_info(),
            stock_mint: $a.stock_mint.to_account_info(),
            pool_usdc: $a.pool_usdc.to_account_info(),
            vault_usdc: $a.vault_usdc.to_account_info(),
            custody: $a.custody.to_account_info(),
        }
    };
}

fn user_transfer<'info>(
    token_program: &Program<'info, Token2022>,
    from: AccountInfo<'info>,
    to: AccountInfo<'info>,
    mint: AccountInfo<'info>,
    decimals: u8,
    authority: AccountInfo<'info>,
    amount: u64,
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }
    token::transfer_checked(
        CpiContext::new(
            token_program.key(),
            TransferChecked {
                from,
                mint,
                to,
                authority,
            },
        ),
        amount,
        decimals,
    )
}

#[program]
pub mod agama_solana {
    use super::*;

    // =====================================================================
    //                               ADMIN
    // =====================================================================

    pub fn initialize(ctx: Context<Initialize>, params: ProtocolParams) -> Result<()> {
        params.validate()?;
        let now = Clock::get()?.unix_timestamp;
        let a = &ctx.accounts;
        let (payer, tp, sp) = (
            a.admin.to_account_info(),
            a.token_program.to_account_info(),
            a.system_program.to_account_info(),
        );
        let authority = a.protocol.key();
        let b = &ctx.bumps;
        mints::create_confidential_mint(
            &payer,
            &a.usdc_mint,
            &[USDC_SEED, &[b.usdc_mint]],
            USDC_DECIMALS,
            &authority,
            &tp,
            &sp,
        )?;
        mints::create_confidential_mint(
            &payer,
            &a.lp_mint,
            &[LP_SEED, &[b.lp_mint]],
            USDC_DECIMALS,
            &authority,
            &tp,
            &sp,
        )?;
        let protocol_ai = a.protocol.to_account_info();
        mints::create_token_account(
            &payer,
            &a.pool_usdc,
            &[POOL_USDC_SEED, &[b.pool_usdc]],
            &a.usdc_mint,
            &protocol_ai,
            &tp,
            &sp,
        )?;
        mints::create_token_account(
            &payer,
            &a.vault_usdc,
            &[VAULT_USDC_SEED, &[b.vault_usdc]],
            &a.usdc_mint,
            &protocol_ai,
            &tp,
            &sp,
        )?;

        let p = &mut ctx.accounts.protocol;
        p.admin = ctx.accounts.admin.key();
        p.keeper = params.keeper;
        p.usdc_mint = ctx.accounts.usdc_mint.key();
        p.lp_mint = ctx.accounts.lp_mint.key();
        p.pool_usdc = ctx.accounts.pool_usdc.key();
        p.vault_usdc = ctx.accounts.vault_usdc.key();
        p.bump = ctx.bumps.protocol;
        p.borrow_index = WAD;
        p.nav_wad = WAD;
        p.last_accrual = now;
        params.apply(p);
        Ok(())
    }

    pub fn set_params(ctx: Context<AdminOnly>, params: ProtocolParams) -> Result<()> {
        params.validate()?;
        let now = Clock::get()?.unix_timestamp;
        let p = &mut ctx.accounts.protocol;
        // Rates change from now on, not retroactively.
        p.accrue(now)?;
        p.keeper = params.keeper;
        params.apply(p);
        Ok(())
    }

    pub fn add_market(
        ctx: Context<AddMarket>,
        symbol: [u8; 8],
        params: MarketParams,
    ) -> Result<()> {
        params.validate()?;
        let a = &ctx.accounts;
        let (payer, tp, sp) = (
            a.admin.to_account_info(),
            a.token_program.to_account_info(),
            a.system_program.to_account_info(),
        );
        let b = &ctx.bumps;
        mints::create_confidential_mint(
            &payer,
            &a.stock_mint,
            &[STOCK_SEED, symbol.as_ref(), &[b.stock_mint]],
            STOCK_DECIMALS,
            &a.protocol.key(),
            &tp,
            &sp,
        )?;
        let market_key = a.market.key();
        mints::create_token_account(
            &payer,
            &a.custody,
            &[CUSTODY_SEED, market_key.as_ref(), &[b.custody]],
            &a.stock_mint,
            &a.protocol.to_account_info(),
            &tp,
            &sp,
        )?;

        let m = &mut ctx.accounts.market;
        m.stock_mint = ctx.accounts.stock_mint.key();
        m.custody = ctx.accounts.custody.key();
        m.symbol = symbol;
        m.bump = ctx.bumps.market;
        params.apply(m);
        ctx.accounts.protocol.market_count += 1;
        Ok(())
    }

    pub fn set_market(ctx: Context<SetMarket>, params: MarketParams) -> Result<()> {
        params.validate()?;
        params.apply(&mut ctx.accounts.market);
        Ok(())
    }

    /// The keeper relays Pyth: the equity feed while the session trades, the
    /// xStock token's own 24/7 feed outside it. Bounded per push, and the
    /// publish time only moves forward.
    pub fn push_price(
        ctx: Context<PushPrice>,
        price_e8: u64,
        publish_time: i64,
        session_open: bool,
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let m = &mut ctx.accounts.market;
        m.apply_price(price_e8, publish_time, session_open, now)?;
        emit!(PricePushed {
            market: m.key(),
            price_e8,
            publish_time,
            session_open
        });
        Ok(())
    }

    // =====================================================================
    //                          CHAINLINK CRE
    // =====================================================================

    /// Point the receiver at a forwarder deployment and, optionally, pin the
    /// workflow owner.
    pub fn set_cre(
        ctx: Context<SetCre>,
        forwarder_program: Pubkey,
        forwarder_state: Pubkey,
        workflow_owner: [u8; 20],
        simulation: bool,
    ) -> Result<()> {
        let c = &mut ctx.accounts.cre;
        c.forwarder_program = forwarder_program;
        c.forwarder_state = forwarder_state;
        c.workflow_owner = workflow_owner;
        c.simulation = simulation;
        c.bump = ctx.bumps.cre;
        Ok(())
    }

    /// The Chainlink CRE receiver. The Keystone Forwarder calls this after
    /// verifying the DON's signatures; the markets to price follow `cre` in the
    /// accounts. Same bounds as the keeper: CRE replaces who brings the price,
    /// not what a price is allowed to do.
    pub fn on_report<'info>(
        ctx: Context<'info, OnReport<'info>>,
        metadata: Vec<u8>,
        report: Vec<u8>,
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let cre = &mut ctx.accounts.cre;
        let state = &ctx.accounts.state;
        require_keys_eq!(
            state.key(),
            cre.forwarder_state,
            AgamaError::InvalidForwarder
        );
        require_keys_eq!(
            *state.owner,
            cre.forwarder_program,
            AgamaError::InvalidForwarder
        );
        let (authority, _) = Pubkey::find_program_address(
            &[b"forwarder", state.key().as_ref(), crate::ID.as_ref()],
            &cre.forwarder_program,
        );
        require_keys_eq!(
            ctx.accounts.forwarder_authority.key(),
            authority,
            AgamaError::InvalidForwarderAuthority
        );
        // metadata = workflow_cid (32) | workflow_name (10) | workflow_owner (20) | report_id (2)
        require!(metadata.len() >= 62, AgamaError::InvalidReport);
        let mut owner = [0u8; 20];
        owner.copy_from_slice(&metadata[42..62]);
        if cre.workflow_owner != [0u8; 20] {
            require!(
                owner == cre.workflow_owner,
                AgamaError::InvalidWorkflowOwner
            );
        }
        let parsed =
            PriceReport::try_from_slice(&report).map_err(|_| error!(AgamaError::InvalidReport))?;

        for u in &parsed.updates {
            let ai = ctx
                .remaining_accounts
                .iter()
                .find(|ai| {
                    ai.owner == &crate::ID
                        && ai.is_writable
                        && Account::<Market>::try_from(ai)
                            .map(|m| m.symbol == u.symbol)
                            .unwrap_or(false)
                })
                .ok_or(AgamaError::MarketNotInReport)?;
            let mut m: Account<Market> = Account::try_from(ai)?;
            let expected = Pubkey::create_program_address(
                &[MARKET_SEED, m.stock_mint.as_ref(), &[m.bump]],
                &crate::ID,
            )
            .map_err(|_| error!(AgamaError::MarketNotInReport))?;
            require_keys_eq!(ai.key(), expected, AgamaError::MarketNotInReport);
            m.apply_price(u.price_e8, u.publish_time, u.session_open, now)?;
            m.exit(&crate::ID)?;
            emit!(PricePushed {
                market: ai.key(),
                price_e8: u.price_e8,
                publish_time: u.publish_time,
                session_open: u.session_open
            });
        }
        cre.reports += 1;
        cre.last_report_at = now;
        emit!(CreReportReceived {
            workflow_owner: owner,
            simulation: cre.simulation,
            report: parsed,
        });
        Ok(())
    }

    // =====================================================================
    //                              FAUCET
    // =====================================================================

    pub fn faucet_usdc(ctx: Context<FaucetUsdc>) -> Result<()> {
        let a = &ctx.accounts;
        let bump = [a.protocol.bump];
        let seeds: &[&[u8]] = &[PROTOCOL_SEED, &bump];
        token::mint_to(
            CpiContext::new_with_signer(
                a.token_program.key(),
                token::MintTo {
                    mint: a.usdc_mint.to_account_info(),
                    to: a.user_usdc.to_account_info(),
                    authority: a.protocol.to_account_info(),
                },
                &[seeds],
            ),
            FAUCET_USDC,
        )
    }

    pub fn faucet_stock(ctx: Context<FaucetStock>) -> Result<()> {
        let a = &ctx.accounts;
        let bump = [a.protocol.bump];
        let seeds: &[&[u8]] = &[PROTOCOL_SEED, &bump];
        token::mint_to(
            CpiContext::new_with_signer(
                a.token_program.key(),
                token::MintTo {
                    mint: a.stock_mint.to_account_info(),
                    to: a.user_stock.to_account_info(),
                    authority: a.protocol.to_account_info(),
                },
                &[seeds],
            ),
            FAUCET_STOCK,
        )
    }

    // =====================================================================
    //                               LEND
    // =====================================================================

    pub fn supply(ctx: Context<Lend>, amount: u64) -> Result<()> {
        require!(amount > 0, AgamaError::ZeroAmount);
        let now = Clock::get()?.unix_timestamp;
        let a = ctx.accounts;
        a.protocol.accrue(now)?;
        let supply = a.lp_mint.supply;
        let assets = a.protocol.total_assets()?;
        let lp = if supply == 0 || assets == 0 {
            amount
        } else {
            to_u64(mul_div(amount as u128, supply as u128, assets as u128)?)?
        };
        require!(lp > 0, AgamaError::ZeroAmount);
        user_transfer(
            &a.token_program,
            a.user_usdc.to_account_info(),
            a.pool_usdc.to_account_info(),
            a.usdc_mint.to_account_info(),
            USDC_DECIMALS,
            a.user.to_account_info(),
            amount,
        )?;
        let bump = [a.protocol.bump];
        let seeds: &[&[u8]] = &[PROTOCOL_SEED, &bump];
        token::mint_to(
            CpiContext::new_with_signer(
                a.token_program.key(),
                token::MintTo {
                    mint: a.lp_mint.to_account_info(),
                    to: a.user_lp.to_account_info(),
                    authority: a.protocol.to_account_info(),
                },
                &[seeds],
            ),
            lp,
        )?;
        a.protocol.cash += amount;
        emit!(Supplied {
            user: a.user.key(),
            usdc: amount,
            lp
        });
        Ok(())
    }

    pub fn withdraw(ctx: Context<Lend>, lp: u64) -> Result<()> {
        require!(lp > 0, AgamaError::ZeroAmount);
        let now = Clock::get()?.unix_timestamp;
        let a = ctx.accounts;
        a.protocol.accrue(now)?;
        let usdc = to_u64(mul_div(
            lp as u128,
            a.protocol.total_assets()? as u128,
            a.lp_mint.supply as u128,
        )?)?;
        require!(usdc <= a.protocol.cash, AgamaError::WithdrawTooLarge);
        token::burn(
            CpiContext::new(
                a.token_program.key(),
                token::Burn {
                    mint: a.lp_mint.to_account_info(),
                    from: a.user_lp.to_account_info(),
                    authority: a.user.to_account_info(),
                },
            ),
            lp,
        )?;
        let bump = [a.protocol.bump];
        let seeds: &[&[u8]] = &[PROTOCOL_SEED, &bump];
        token::transfer_checked(
            CpiContext::new_with_signer(
                a.token_program.key(),
                TransferChecked {
                    from: a.pool_usdc.to_account_info(),
                    mint: a.usdc_mint.to_account_info(),
                    to: a.user_usdc.to_account_info(),
                    authority: a.protocol.to_account_info(),
                },
                &[seeds],
            ),
            usdc,
            USDC_DECIMALS,
        )?;
        a.protocol.cash -= usdc;
        emit!(Withdrawn {
            user: a.user.key(),
            usdc,
            lp
        });
        Ok(())
    }

    // =====================================================================
    //                               EARN
    // =====================================================================

    /// Deposit stock (open or top up) and set the level. Borrows up to it at
    /// once; from then on the agents keep it there.
    pub fn earn_deposit(ctx: Context<EarnDeposit>, amount: u64, target_ltv_bps: u16) -> Result<()> {
        require!(amount > 0, AgamaError::ZeroAmount);
        let now = Clock::get()?.unix_timestamp;
        let a = ctx.accounts;
        a.market.require_fresh(now)?;
        require!(
            target_ltv_bps > 0 && (target_ltv_bps as u64) <= a.market.ltv(),
            AgamaError::TargetTooHigh
        );
        a.protocol.accrue(now)?;
        let pos = &mut a.position;
        if pos.owner == Pubkey::default() {
            pos.owner = a.user.key();
            pos.market = a.market.key();
            pos.kind = KIND_EARN;
            pos.bump = ctx.bumps.position;
            pos.opened_at = now;
        }
        user_transfer(
            &a.token_program,
            a.user_stock.to_account_info(),
            a.custody.to_account_info(),
            a.stock_mint.to_account_info(),
            STOCK_DECIMALS,
            a.user.to_account_info(),
            amount,
        )?;
        pos.collateral += amount;
        pos.deposited += amount;
        pos.target_ltv_bps = target_ltv_bps;
        a.market.total_collateral += amount;

        let pipes = pipes!(a);
        let moved = earn_move(&mut a.protocol, &mut a.market, &mut a.position, &pipes, 0)?;
        emit!(EarnDeposited {
            owner: a.user.key(),
            market: a.market.key(),
            stock: amount,
            borrowed: moved.map(|(_, x)| x).unwrap_or(0),
            target_ltv_bps,
        });
        Ok(())
    }

    /// Move the slider. The position goes there now, both ways.
    pub fn earn_set_target(ctx: Context<EarnOwner>, target_ltv_bps: u16) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let a = ctx.accounts;
        a.market.require_fresh(now)?;
        require!(
            target_ltv_bps > 0 && (target_ltv_bps as u64) <= a.market.ltv(),
            AgamaError::TargetTooHigh
        );
        a.protocol.accrue(now)?;
        a.position.target_ltv_bps = target_ltv_bps;
        let pipes = pipes!(a);
        earn_move(&mut a.protocol, &mut a.market, &mut a.position, &pipes, 0)?;
        Ok(())
    }

    /// Repay out of the vault shares first, then the wallet for any shortfall,
    /// hand the stock back and the leftover yield as USDC.
    pub fn earn_close(ctx: Context<EarnClose>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let a = ctx.accounts;
        a.protocol.accrue(now)?;
        let pipes = pipes!(a);
        let p = &mut a.protocol;
        let m = &mut a.market;
        let pos = &mut a.position;

        let debt = pos.debt(p)?;
        let from_buffer = repay_from_buffer(p, m, pos, &pipes, debt)?;
        let mut shortfall = pos.debt(p)?;
        if shortfall > 0 && shortfall <= CLOSE_DUST {
            // Rounding between the vault and the debt, a few millionths of a
            // dollar. Asking the wallet for it would fail for a holder whose
            // USDC is all in a confidential balance, so the pool absorbs it.
            write_off(p, m, pos);
            shortfall = 0;
        }
        if shortfall > 0 {
            user_transfer(
                &a.token_program,
                a.user_usdc.to_account_info(),
                a.pool_usdc.to_account_info(),
                a.usdc_mint.to_account_info(),
                USDC_DECIMALS,
                a.user.to_account_info(),
                shortfall,
            )?;
            repay(p, m, pos, shortfall)?;
        }
        let leftover = p.shares_value(pos.shares)?;
        vault_take(p, pos, &pipes, leftover)?;
        pipes.send_usdc(&pipes.vault_usdc, &a.user_usdc.to_account_info(), leftover)?;
        // Rounding dust: shares worth less than a unit.
        p.vault_shares = p.vault_shares.saturating_sub(pos.shares);
        pos.shares = 0;

        let stock = pos.collateral;
        pipes.send_stock(&pipes.custody, &a.user_stock.to_account_info(), stock)?;
        m.total_collateral -= stock;
        pos.collateral = 0;
        emit!(EarnClosed {
            owner: a.user.key(),
            market: m.key(),
            repaid: debt,
            from_buffer,
            from_wallet: shortfall,
            usdc_out: leftover,
            stock_out: stock,
        });
        Ok(())
    }

    // =====================================================================
    //                              AMPLIFY
    // =====================================================================

    /// Deposit stock, loop it to `leverage_bps` (10_000 = 1x) in one go: the
    /// borrow buys more of the same stock, pledged with the rest.
    pub fn amplify_open(ctx: Context<AmplifyOpen>, amount: u64, leverage_bps: u16) -> Result<()> {
        require!(amount > 0, AgamaError::ZeroAmount);
        let now = Clock::get()?.unix_timestamp;
        let a = ctx.accounts;
        a.market.require_fresh(now)?;
        // A loop at L carries an LTV of (L - 1) / L: the market's LTV caps L.
        let ltv = a.market.ltv() as u128;
        let max_lev = BPS * BPS / (BPS - ltv);
        require!(
            (leverage_bps as u128) > BPS && (leverage_bps as u128) <= max_lev,
            AgamaError::LeverageOutOfRange
        );
        a.protocol.accrue(now)?;
        let pos = &mut a.position;
        pos.owner = a.user.key();
        pos.market = a.market.key();
        pos.kind = KIND_AMPLIFY;
        pos.bump = ctx.bumps.position;
        pos.opened_at = now;
        pos.leverage_bps = leverage_bps;
        user_transfer(
            &a.token_program,
            a.user_stock.to_account_info(),
            a.custody.to_account_info(),
            a.stock_mint.to_account_info(),
            STOCK_DECIMALS,
            a.user.to_account_info(),
            amount,
        )?;
        pos.collateral = amount;
        pos.deposited = amount;
        a.market.total_collateral += amount;

        let pipes = pipes!(a);
        let p = &mut a.protocol;
        let m = &mut a.market;
        let pos = &mut a.position;
        let borrow_usdc = to_u64(m.value(amount)? as u128 * (leverage_bps as u128 - BPS) / BPS)?;
        borrow(p, m, pos, borrow_usdc)?;
        let pool = pipes.pool_usdc.clone();
        let bought = buy_stock(p, m, pos, &pipes, &pool, borrow_usdc)?;

        let value = m.value(pos.collateral)? as u128;
        let debt = pos.debt(p)? as u128;
        require!(
            debt * BPS <= value * m.ltv() as u128,
            AgamaError::LtvExceeded
        );
        pos.target_ltv_bps = (debt * BPS / value) as u16;
        emit!(AmplifyOpened {
            owner: a.user.key(),
            market: m.key(),
            stock_in: amount,
            stock_bought: bought,
            debt: debt as u64,
            leverage_bps,
        });
        Ok(())
    }

    /// Sell just enough stock to repay, hand the rest back.
    pub fn amplify_close(ctx: Context<AmplifyClose>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let a = ctx.accounts;
        a.protocol.accrue(now)?;
        let pipes = pipes!(a);
        let p = &mut a.protocol;
        let m = &mut a.market;
        let pos = &mut a.position;
        let debt = pos.debt(p)?;
        let mut sold = 0;
        if debt > 0 {
            m.require_fresh(now)?;
            sold = sell_stock_for(p, m, pos, &pipes, debt)?;
            repay(p, m, pos, debt)?;
        }
        let stock = pos.collateral;
        pipes.send_stock(&pipes.custody, &a.user_stock.to_account_info(), stock)?;
        m.total_collateral -= stock;
        pos.collateral = 0;
        emit!(AmplifyClosed {
            owner: a.user.key(),
            market: m.key(),
            repaid: debt,
            stock_sold: sold,
            stock_out: stock,
        });
        Ok(())
    }

    // =====================================================================
    //                    AGENTS (permissionless)
    // =====================================================================

    /// Hold the level the owner picked, both ways, with a 1% band.
    pub fn rebalance(ctx: Context<Agent>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let a = ctx.accounts;
        a.market.require_fresh(now)?;
        a.protocol.accrue(now)?;
        let pipes = pipes!(a);
        let moved = if a.position.kind == KIND_EARN {
            earn_move(
                &mut a.protocol,
                &mut a.market,
                &mut a.position,
                &pipes,
                REBALANCE_BAND_BPS,
            )?
        } else {
            amplify_move(
                &mut a.protocol,
                &mut a.market,
                &mut a.position,
                &pipes,
                REBALANCE_BAND_BPS,
            )?
        };
        let (op, amount) = moved.ok_or(AgamaError::AlreadyOnTarget)?;
        a.position.record(a.caller.key(), now, op, amount);
        emit!(AgentActed {
            agent: a.caller.key(),
            position: a.position.key(),
            op,
            amount
        });
        Ok(())
    }

    /// Turn the vault yield above the debt into more of the stock. The swap is
    /// priced off the same oracle the market uses, so the caller has nothing
    /// to choose and nothing to skim.
    pub fn compound(ctx: Context<Agent>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let a = ctx.accounts;
        require!(a.position.kind == KIND_EARN, AgamaError::WrongKind);
        a.market.require_fresh(now)?;
        a.protocol.accrue(now)?;
        let pipes = pipes!(a);
        let p = &mut a.protocol;
        let m = &mut a.market;
        let pos = &mut a.position;
        let buffer = p.shares_value(pos.shares)?;
        let debt = pos.debt(p)?;
        // Only the surplus over the debt is profit; the rest is the buffer
        // that protects the stock. 0.1% of the debt stays behind as well, so
        // interest that accrues before the next close never reaches the wallet.
        let surplus = buffer.saturating_sub(debt + debt / 1_000);
        require!(
            surplus >= p.min_compound.max(1),
            AgamaError::NothingToCompound
        );
        vault_take(p, pos, &pipes, surplus)?;
        let vault = pipes.vault_usdc.clone();
        let stock = buy_stock(p, m, pos, &pipes, &vault, surplus)?;
        pos.stock_from_yield += stock;
        pos.record(a.caller.key(), now, OP_COMPOUNDED, stock);
        emit!(AgentActed {
            agent: a.caller.key(),
            position: pos.key(),
            op: OP_COMPOUNDED,
            amount: stock
        });
        Ok(())
    }

    /// Backstop. The yield buffer goes first; only if that is not enough does
    /// the liquidator repay and take stock at the bonus.
    pub fn liquidate(ctx: Context<Liquidate>, max_repay: u64) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let a = ctx.accounts;
        a.market.require_fresh(now)?;
        a.protocol.accrue(now)?;
        let pipes = pipes!(a);
        let p = &mut a.protocol;
        let m = &mut a.market;
        let pos = &mut a.position;
        require!(is_liquidatable(p, m, pos)?, AgamaError::Healthy);

        if pos.kind == KIND_EARN && pos.shares > 0 {
            let debt = pos.debt(p)?;
            let paid = repay_from_buffer(p, m, pos, &pipes, debt)?;
            if paid > 0 {
                pos.record(a.liquidator.key(), now, OP_DELEVERAGED, paid);
            }
            if !is_liquidatable(p, m, pos)? {
                emit!(AgentActed {
                    agent: a.liquidator.key(),
                    position: pos.key(),
                    op: OP_DELEVERAGED,
                    amount: paid
                });
                return Ok(());
            }
        }

        let debt = pos.debt(p)?;
        // Half the debt per call, unless the position is small.
        let close_cap = if debt <= p.min_borrow.saturating_mul(10) {
            debt
        } else {
            debt / 2
        };
        let repay_amt = max_repay.min(close_cap);
        require!(repay_amt > 0, AgamaError::ZeroAmount);
        let base = stock_for_usdc(repay_amt, m.price_e8, 0)? as u128;
        let seize = to_u64(base * (BPS + m.liq_bonus_bps as u128) / BPS)?.min(pos.collateral);
        user_transfer(
            &a.token_program,
            a.liquidator_usdc.to_account_info(),
            a.pool_usdc.to_account_info(),
            a.usdc_mint.to_account_info(),
            USDC_DECIMALS,
            a.liquidator.to_account_info(),
            repay_amt,
        )?;
        repay(p, m, pos, repay_amt)?;
        pipes.send_stock(&pipes.custody, &a.liquidator_stock.to_account_info(), seize)?;
        pos.collateral -= seize;
        m.total_collateral -= seize;
        pos.record(a.liquidator.key(), now, OP_LIQUIDATED, seize);
        emit!(Liquidated {
            liquidator: a.liquidator.key(),
            position: pos.key(),
            repaid: repay_amt,
            seized: seize
        });
        Ok(())
    }

    /// Accrue interest and vault yield. Anyone, any time.
    pub fn poke(ctx: Context<Poke>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        ctx.accounts.protocol.accrue(now)
    }
}

// =========================================================================
//                               PARAMS
// =========================================================================

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ProtocolParams {
    pub keeper: Pubkey,
    pub base_rate_bps: u32,
    pub slope1_bps: u32,
    pub slope2_bps: u32,
    pub kink_bps: u32,
    pub vault_apr_bps: u32,
    pub min_borrow: u64,
    pub min_compound: u64,
    pub dex_fee_bps: u32,
}

impl ProtocolParams {
    fn validate(&self) -> Result<()> {
        require!(
            self.kink_bps > 0
                && (self.kink_bps as u128) < BPS
                && self.vault_apr_bps <= 5_000
                && self.dex_fee_bps <= 300
                && self.base_rate_bps + self.slope1_bps + self.slope2_bps <= 50_000,
            AgamaError::BadParams
        );
        Ok(())
    }

    fn apply(&self, p: &mut Protocol) {
        p.base_rate_bps = self.base_rate_bps;
        p.slope1_bps = self.slope1_bps;
        p.slope2_bps = self.slope2_bps;
        p.kink_bps = self.kink_bps;
        p.vault_apr_bps = self.vault_apr_bps;
        p.min_borrow = self.min_borrow;
        p.min_compound = self.min_compound;
        p.dex_fee_bps = self.dex_fee_bps;
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct MarketParams {
    pub ltv_bps: u16,
    pub lt_bps: u16,
    pub liq_bonus_bps: u16,
    pub offhours_buffer_bps: u16,
    pub max_age: u32,
    pub max_jump_bps: u16,
}

impl MarketParams {
    fn validate(&self) -> Result<()> {
        require!(
            self.ltv_bps > 0
                && self.lt_bps > self.ltv_bps
                && (self.lt_bps as u128 + self.liq_bonus_bps as u128) < BPS
                && self.offhours_buffer_bps < self.ltv_bps
                && self.max_age > 0
                && self.max_jump_bps > 0,
            AgamaError::BadParams
        );
        Ok(())
    }

    fn apply(&self, m: &mut Market) {
        m.ltv_bps = self.ltv_bps;
        m.lt_bps = self.lt_bps;
        m.liq_bonus_bps = self.liq_bonus_bps;
        m.offhours_buffer_bps = self.offhours_buffer_bps;
        m.max_age = self.max_age;
        m.max_jump_bps = self.max_jump_bps;
    }
}

// =========================================================================
//                              ACCOUNTS
// =========================================================================

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(init, payer = admin, space = 8 + Protocol::INIT_SPACE, seeds = [PROTOCOL_SEED], bump)]
    pub protocol: Box<Account<'info, Protocol>>,
    /// CHECK: created in the handler as a confidential Token-2022 mint.
    #[account(mut, seeds = [USDC_SEED], bump)]
    pub usdc_mint: UncheckedAccount<'info>,
    /// CHECK: created in the handler as a confidential Token-2022 mint.
    #[account(mut, seeds = [LP_SEED], bump)]
    pub lp_mint: UncheckedAccount<'info>,
    /// CHECK: created in the handler, a USDC account owned by `protocol`.
    #[account(mut, seeds = [POOL_USDC_SEED], bump)]
    pub pool_usdc: UncheckedAccount<'info>,
    /// CHECK: created in the handler, a USDC account owned by `protocol`.
    #[account(mut, seeds = [VAULT_USDC_SEED], bump)]
    pub vault_usdc: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AdminOnly<'info> {
    pub admin: Signer<'info>,
    #[account(mut, seeds = [PROTOCOL_SEED], bump = protocol.bump, has_one = admin @ AgamaError::NotAdmin)]
    pub protocol: Box<Account<'info, Protocol>>,
}

#[derive(Accounts)]
#[instruction(symbol: [u8; 8])]
pub struct AddMarket<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(mut, seeds = [PROTOCOL_SEED], bump = protocol.bump, has_one = admin @ AgamaError::NotAdmin)]
    pub protocol: Box<Account<'info, Protocol>>,
    /// CHECK: created in the handler as a confidential Token-2022 mint.
    #[account(mut, seeds = [STOCK_SEED, symbol.as_ref()], bump)]
    pub stock_mint: UncheckedAccount<'info>,
    #[account(
        init, payer = admin, space = 8 + Market::INIT_SPACE,
        seeds = [MARKET_SEED, stock_mint.key().as_ref()], bump,
    )]
    pub market: Box<Account<'info, Market>>,
    /// CHECK: created in the handler, a stock account owned by `protocol`.
    #[account(mut, seeds = [CUSTODY_SEED, market.key().as_ref()], bump)]
    pub custody: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetMarket<'info> {
    pub admin: Signer<'info>,
    #[account(seeds = [PROTOCOL_SEED], bump = protocol.bump, has_one = admin @ AgamaError::NotAdmin)]
    pub protocol: Box<Account<'info, Protocol>>,
    #[account(mut, seeds = [MARKET_SEED, market.stock_mint.as_ref()], bump = market.bump)]
    pub market: Box<Account<'info, Market>>,
}

#[derive(Accounts)]
pub struct PushPrice<'info> {
    pub keeper: Signer<'info>,
    #[account(seeds = [PROTOCOL_SEED], bump = protocol.bump, has_one = keeper @ AgamaError::NotKeeper)]
    pub protocol: Box<Account<'info, Protocol>>,
    #[account(mut, seeds = [MARKET_SEED, market.stock_mint.as_ref()], bump = market.bump)]
    pub market: Box<Account<'info, Market>>,
}

#[derive(Accounts)]
pub struct SetCre<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(seeds = [PROTOCOL_SEED], bump = protocol.bump, has_one = admin @ AgamaError::NotAdmin)]
    pub protocol: Box<Account<'info, Protocol>>,
    #[account(init_if_needed, payer = admin, space = 8 + CreConfig::INIT_SPACE, seeds = [CRE_SEED], bump)]
    pub cre: Box<Account<'info, CreConfig>>,
    pub system_program: Program<'info, System>,
}

/// The forwarder supplies `state` and `forwarder_authority`; `cre` and the
/// markets are the receiver accounts the workflow lists after them.
#[derive(Accounts)]
pub struct OnReport<'info> {
    /// CHECK: matched against `cre.forwarder_state` and its owner in the handler.
    pub state: UncheckedAccount<'info>,
    pub forwarder_authority: Signer<'info>,
    #[account(mut, seeds = [CRE_SEED], bump = cre.bump)]
    pub cre: Box<Account<'info, CreConfig>>,
}

#[derive(Accounts)]
pub struct FaucetUsdc<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(seeds = [PROTOCOL_SEED], bump = protocol.bump)]
    pub protocol: Box<Account<'info, Protocol>>,
    #[account(mut, address = protocol.usdc_mint)]
    pub usdc_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        init_if_needed, payer = user,
        associated_token::mint = usdc_mint, associated_token::authority = user,
        associated_token::token_program = token_program,
    )]
    pub user_usdc: Box<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FaucetStock<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(seeds = [PROTOCOL_SEED], bump = protocol.bump)]
    pub protocol: Box<Account<'info, Protocol>>,
    #[account(seeds = [MARKET_SEED, market.stock_mint.as_ref()], bump = market.bump)]
    pub market: Box<Account<'info, Market>>,
    #[account(mut, address = market.stock_mint)]
    pub stock_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        init_if_needed, payer = user,
        associated_token::mint = stock_mint, associated_token::authority = user,
        associated_token::token_program = token_program,
    )]
    pub user_stock: Box<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Lend<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut, seeds = [PROTOCOL_SEED], bump = protocol.bump)]
    pub protocol: Box<Account<'info, Protocol>>,
    #[account(address = protocol.usdc_mint)]
    pub usdc_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(mut, address = protocol.lp_mint)]
    pub lp_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(mut, address = protocol.pool_usdc)]
    pub pool_usdc: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = user, associated_token::token_program = token_program)]
    pub user_usdc: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        init_if_needed, payer = user,
        associated_token::mint = lp_mint, associated_token::authority = user,
        associated_token::token_program = token_program,
    )]
    pub user_lp: Box<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct EarnDeposit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut, seeds = [PROTOCOL_SEED], bump = protocol.bump)]
    pub protocol: Box<Account<'info, Protocol>>,
    #[account(mut, seeds = [MARKET_SEED, market.stock_mint.as_ref()], bump = market.bump)]
    pub market: Box<Account<'info, Market>>,
    #[account(
        init_if_needed, payer = user, space = 8 + Position::INIT_SPACE,
        seeds = [POSITION_SEED, user.key().as_ref(), market.key().as_ref(), EARN_SEED], bump,
    )]
    pub position: Box<Account<'info, Position>>,
    #[account(mut, address = protocol.usdc_mint)]
    pub usdc_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(mut, address = market.stock_mint)]
    pub stock_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(mut, address = protocol.pool_usdc)]
    pub pool_usdc: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, address = protocol.vault_usdc)]
    pub vault_usdc: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, address = market.custody)]
    pub custody: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, associated_token::mint = stock_mint, associated_token::authority = user, associated_token::token_program = token_program)]
    pub user_stock: Box<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct EarnOwner<'info> {
    pub user: Signer<'info>,
    #[account(mut, seeds = [PROTOCOL_SEED], bump = protocol.bump)]
    pub protocol: Box<Account<'info, Protocol>>,
    #[account(mut, seeds = [MARKET_SEED, market.stock_mint.as_ref()], bump = market.bump)]
    pub market: Box<Account<'info, Market>>,
    #[account(
        mut,
        seeds = [POSITION_SEED, user.key().as_ref(), market.key().as_ref(), EARN_SEED],
        bump = position.bump,
    )]
    pub position: Box<Account<'info, Position>>,
    #[account(mut, address = protocol.usdc_mint)]
    pub usdc_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(mut, address = market.stock_mint)]
    pub stock_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(mut, address = protocol.pool_usdc)]
    pub pool_usdc: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, address = protocol.vault_usdc)]
    pub vault_usdc: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, address = market.custody)]
    pub custody: Box<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Program<'info, Token2022>,
}

#[derive(Accounts)]
pub struct EarnClose<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut, seeds = [PROTOCOL_SEED], bump = protocol.bump)]
    pub protocol: Box<Account<'info, Protocol>>,
    #[account(mut, seeds = [MARKET_SEED, market.stock_mint.as_ref()], bump = market.bump)]
    pub market: Box<Account<'info, Market>>,
    #[account(
        mut, close = user,
        seeds = [POSITION_SEED, user.key().as_ref(), market.key().as_ref(), EARN_SEED],
        bump = position.bump,
    )]
    pub position: Box<Account<'info, Position>>,
    #[account(mut, address = protocol.usdc_mint)]
    pub usdc_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(mut, address = market.stock_mint)]
    pub stock_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(mut, address = protocol.pool_usdc)]
    pub pool_usdc: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, address = protocol.vault_usdc)]
    pub vault_usdc: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, address = market.custody)]
    pub custody: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        init_if_needed, payer = user,
        associated_token::mint = usdc_mint, associated_token::authority = user,
        associated_token::token_program = token_program,
    )]
    pub user_usdc: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        init_if_needed, payer = user,
        associated_token::mint = stock_mint, associated_token::authority = user,
        associated_token::token_program = token_program,
    )]
    pub user_stock: Box<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AmplifyOpen<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut, seeds = [PROTOCOL_SEED], bump = protocol.bump)]
    pub protocol: Box<Account<'info, Protocol>>,
    #[account(mut, seeds = [MARKET_SEED, market.stock_mint.as_ref()], bump = market.bump)]
    pub market: Box<Account<'info, Market>>,
    #[account(
        init, payer = user, space = 8 + Position::INIT_SPACE,
        seeds = [POSITION_SEED, user.key().as_ref(), market.key().as_ref(), AMPLIFY_SEED], bump,
    )]
    pub position: Box<Account<'info, Position>>,
    #[account(mut, address = protocol.usdc_mint)]
    pub usdc_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(mut, address = market.stock_mint)]
    pub stock_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(mut, address = protocol.pool_usdc)]
    pub pool_usdc: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, address = protocol.vault_usdc)]
    pub vault_usdc: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, address = market.custody)]
    pub custody: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, associated_token::mint = stock_mint, associated_token::authority = user, associated_token::token_program = token_program)]
    pub user_stock: Box<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AmplifyClose<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut, seeds = [PROTOCOL_SEED], bump = protocol.bump)]
    pub protocol: Box<Account<'info, Protocol>>,
    #[account(mut, seeds = [MARKET_SEED, market.stock_mint.as_ref()], bump = market.bump)]
    pub market: Box<Account<'info, Market>>,
    #[account(
        mut, close = user,
        seeds = [POSITION_SEED, user.key().as_ref(), market.key().as_ref(), AMPLIFY_SEED],
        bump = position.bump,
    )]
    pub position: Box<Account<'info, Position>>,
    #[account(mut, address = protocol.usdc_mint)]
    pub usdc_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(mut, address = market.stock_mint)]
    pub stock_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(mut, address = protocol.pool_usdc)]
    pub pool_usdc: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, address = protocol.vault_usdc)]
    pub vault_usdc: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, address = market.custody)]
    pub custody: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        init_if_needed, payer = user,
        associated_token::mint = stock_mint, associated_token::authority = user,
        associated_token::token_program = token_program,
    )]
    pub user_stock: Box<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Agent<'info> {
    pub caller: Signer<'info>,
    #[account(mut, seeds = [PROTOCOL_SEED], bump = protocol.bump)]
    pub protocol: Box<Account<'info, Protocol>>,
    #[account(mut, seeds = [MARKET_SEED, market.stock_mint.as_ref()], bump = market.bump)]
    pub market: Box<Account<'info, Market>>,
    #[account(
        mut, has_one = market,
        seeds = [POSITION_SEED, position.owner.as_ref(), market.key().as_ref(), position.kind_seed()],
        bump = position.bump,
    )]
    pub position: Box<Account<'info, Position>>,
    #[account(mut, address = protocol.usdc_mint)]
    pub usdc_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(mut, address = market.stock_mint)]
    pub stock_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(mut, address = protocol.pool_usdc)]
    pub pool_usdc: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, address = protocol.vault_usdc)]
    pub vault_usdc: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, address = market.custody)]
    pub custody: Box<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Program<'info, Token2022>,
}

#[derive(Accounts)]
pub struct Liquidate<'info> {
    #[account(mut)]
    pub liquidator: Signer<'info>,
    #[account(mut, seeds = [PROTOCOL_SEED], bump = protocol.bump)]
    pub protocol: Box<Account<'info, Protocol>>,
    #[account(mut, seeds = [MARKET_SEED, market.stock_mint.as_ref()], bump = market.bump)]
    pub market: Box<Account<'info, Market>>,
    #[account(
        mut, has_one = market,
        seeds = [POSITION_SEED, position.owner.as_ref(), market.key().as_ref(), position.kind_seed()],
        bump = position.bump,
    )]
    pub position: Box<Account<'info, Position>>,
    #[account(mut, address = protocol.usdc_mint)]
    pub usdc_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(mut, address = market.stock_mint)]
    pub stock_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(mut, address = protocol.pool_usdc)]
    pub pool_usdc: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, address = protocol.vault_usdc)]
    pub vault_usdc: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, address = market.custody)]
    pub custody: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = liquidator, associated_token::token_program = token_program)]
    pub liquidator_usdc: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        init_if_needed, payer = liquidator,
        associated_token::mint = stock_mint, associated_token::authority = liquidator,
        associated_token::token_program = token_program,
    )]
    pub liquidator_stock: Box<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Poke<'info> {
    #[account(mut, seeds = [PROTOCOL_SEED], bump = protocol.bump)]
    pub protocol: Box<Account<'info, Protocol>>,
}

// =========================================================================
//                               EVENTS
// =========================================================================

#[event]
pub struct PricePushed {
    pub market: Pubkey,
    pub price_e8: u64,
    pub publish_time: i64,
    pub session_open: bool,
}

#[event]
pub struct CreReportReceived {
    pub workflow_owner: [u8; 20],
    pub simulation: bool,
    pub report: PriceReport,
}

#[event]
pub struct Supplied {
    pub user: Pubkey,
    pub usdc: u64,
    pub lp: u64,
}

#[event]
pub struct Withdrawn {
    pub user: Pubkey,
    pub usdc: u64,
    pub lp: u64,
}

#[event]
pub struct EarnDeposited {
    pub owner: Pubkey,
    pub market: Pubkey,
    pub stock: u64,
    pub borrowed: u64,
    pub target_ltv_bps: u16,
}

#[event]
pub struct EarnClosed {
    pub owner: Pubkey,
    pub market: Pubkey,
    pub repaid: u64,
    pub from_buffer: u64,
    pub from_wallet: u64,
    pub usdc_out: u64,
    pub stock_out: u64,
}

#[event]
pub struct AmplifyOpened {
    pub owner: Pubkey,
    pub market: Pubkey,
    pub stock_in: u64,
    pub stock_bought: u64,
    pub debt: u64,
    pub leverage_bps: u16,
}

#[event]
pub struct AmplifyClosed {
    pub owner: Pubkey,
    pub market: Pubkey,
    pub repaid: u64,
    pub stock_sold: u64,
    pub stock_out: u64,
}

#[event]
pub struct AgentActed {
    pub agent: Pubkey,
    pub position: Pubkey,
    pub op: u8,
    pub amount: u64,
}

#[event]
pub struct Liquidated {
    pub liquidator: Pubkey,
    pub position: Pubkey,
    pub repaid: u64,
    pub seized: u64,
}
