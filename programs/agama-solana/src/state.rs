use anchor_lang::prelude::*;

use crate::errors::AgamaError;
use crate::math::*;

/// `.v2`: the Token-2022 deployment. The v1 accounts (classic SPL mints) are
/// left where they are on devnet.
pub const PROTOCOL_SEED: &[u8] = b"protocol.v2";
pub const USDC_SEED: &[u8] = b"usdc.v2";
pub const LP_SEED: &[u8] = b"lp.v2";
pub const POOL_USDC_SEED: &[u8] = b"pool_usdc.v2";
pub const VAULT_USDC_SEED: &[u8] = b"vault_usdc.v2";
pub const STOCK_SEED: &[u8] = b"stock.v2";
pub const MARKET_SEED: &[u8] = b"market.v2";
pub const CUSTODY_SEED: &[u8] = b"custody.v2";
pub const POSITION_SEED: &[u8] = b"position.v2";
pub const CRE_SEED: &[u8] = b"cre.v2";
pub const EARN_SEED: &[u8] = b"earn";
pub const AMPLIFY_SEED: &[u8] = b"amplify";

pub const KIND_EARN: u8 = 0;
pub const KIND_AMPLIFY: u8 = 1;

/// What an agent last did to a position, so the card can say it.
pub const OP_NONE: u8 = 0;
pub const OP_BORROWED_MORE: u8 = 1;
pub const OP_REPAID_FROM_YIELD: u8 = 2;
pub const OP_COMPOUNDED: u8 = 3;
pub const OP_DELEVERAGED: u8 = 4;
pub const OP_LIQUIDATED: u8 = 5;
pub const OP_BOUGHT_MORE: u8 = 6;
pub const OP_SOLD_TO_REPAY: u8 = 7;

/// The lending pool, the private credit vault and every mint the program
/// controls hang off this one PDA. It signs for all of them.
#[account]
#[derive(InitSpace)]
pub struct Protocol {
    pub admin: Pubkey,
    /// Pushes prices. Bounded on chain, so a bad keeper can drift a price by
    /// at most `max_jump_bps` per push, never set it.
    pub keeper: Pubkey,
    pub usdc_mint: Pubkey,
    pub lp_mint: Pubkey,
    pub pool_usdc: Pubkey,
    pub vault_usdc: Pubkey,
    pub bump: u8,

    // ---- lending pool (USDC) ----
    /// USDC the pool holds and can lend.
    pub cash: u64,
    pub total_scaled_debt: u128,
    /// Grows with the borrow rate. Debt = scaled * index / WAD.
    pub borrow_index: u128,
    pub last_accrual: i64,
    pub base_rate_bps: u32,
    pub slope1_bps: u32,
    pub slope2_bps: u32,
    pub kink_bps: u32,
    pub min_borrow: u64,

    // ---- Agama private credit vault ----
    pub vault_shares: u64,
    /// USDC per share, WAD. Accrues at `vault_apr_bps`.
    pub nav_wad: u128,
    pub vault_apr_bps: u32,
    /// USDC actually sitting in the vault account.
    pub vault_cash: u64,
    /// Coupons the credit book paid into the vault (devnet stand-in: minted).
    pub coupons_paid: u64,

    pub min_compound: u64,
    pub dex_fee_bps: u32,
    pub market_count: u8,
}

impl Protocol {
    pub fn signer_seeds(&self) -> [&[u8]; 2] {
        [PROTOCOL_SEED, std::slice::from_ref(&self.bump)]
    }

    pub fn total_debt(&self) -> Result<u64> {
        to_u64(mul_div_up(self.total_scaled_debt, self.borrow_index, WAD)?)
    }

    /// Annual borrow rate, kinked on utilisation.
    pub fn borrow_rate_bps(&self) -> Result<u64> {
        let debt = self.total_debt()? as u128;
        let total = debt + self.cash as u128;
        let base = self.base_rate_bps as u128;
        if total == 0 {
            return Ok(base as u64);
        }
        let util = debt * BPS / total;
        let kink = self.kink_bps as u128;
        let rate = if util <= kink {
            base + self.slope1_bps as u128 * util / kink
        } else {
            base + self.slope1_bps as u128 + self.slope2_bps as u128 * (util - kink) / (BPS - kink)
        };
        Ok(rate as u64)
    }

    /// Lenders own the cash plus everything borrowers owe.
    pub fn total_assets(&self) -> Result<u64> {
        Ok(self
            .cash
            .checked_add(self.total_debt()?)
            .ok_or(AgamaError::MathOverflow)?)
    }

    pub fn accrue(&mut self, now: i64) -> Result<()> {
        let dt = now.saturating_sub(self.last_accrual);
        if dt <= 0 {
            return Ok(());
        }
        let dt = dt as u128;
        let rate = self.borrow_rate_bps()? as u128;
        let growth = mul_div(self.borrow_index, rate * dt, BPS * YEAR)?;
        self.borrow_index = self
            .borrow_index
            .checked_add(growth)
            .ok_or(AgamaError::MathOverflow)?;
        let nav_growth = mul_div(self.nav_wad, self.vault_apr_bps as u128 * dt, BPS * YEAR)?;
        self.nav_wad = self
            .nav_wad
            .checked_add(nav_growth)
            .ok_or(AgamaError::MathOverflow)?;
        self.last_accrual = now;
        Ok(())
    }

    pub fn shares_value(&self, shares: u64) -> Result<u64> {
        to_u64(mul_div(shares as u128, self.nav_wad, WAD)?)
    }

    pub fn shares_for_deposit(&self, usdc: u64) -> Result<u64> {
        to_u64(mul_div(usdc as u128, WAD, self.nav_wad)?)
    }

    /// Shares to burn to take exactly `usdc` out. Rounds against the holder.
    pub fn shares_for_withdraw(&self, usdc: u64) -> Result<u64> {
        to_u64(mul_div_up(usdc as u128, WAD, self.nav_wad)?)
    }
}

#[account]
#[derive(InitSpace)]
pub struct Market {
    pub stock_mint: Pubkey,
    pub custody: Pubkey,
    pub symbol: [u8; 8],
    pub bump: u8,
    pub ltv_bps: u16,
    pub lt_bps: u16,
    pub liq_bonus_bps: u16,
    /// Taken off both LTV and threshold while the share does not trade.
    pub offhours_buffer_bps: u16,
    pub price_e8: u64,
    /// Publish time of the source the price came from.
    pub price_time: i64,
    pub session_open: bool,
    pub max_age: u32,
    pub max_jump_bps: u16,
    pub total_collateral: u64,
    pub total_scaled_debt: u128,
}

impl Market {
    pub fn ltv(&self) -> u64 {
        if self.session_open {
            self.ltv_bps as u64
        } else {
            (self.ltv_bps as u64).saturating_sub(self.offhours_buffer_bps as u64)
        }
    }

    pub fn threshold(&self) -> u64 {
        if self.session_open {
            self.lt_bps as u64
        } else {
            (self.lt_bps as u64).saturating_sub(self.offhours_buffer_bps as u64)
        }
    }

    pub fn require_fresh(&self, now: i64) -> Result<()> {
        require!(self.price_e8 > 0, AgamaError::NoPrice);
        require!(
            now - self.price_time <= self.max_age as i64,
            AgamaError::StalePrice
        );
        Ok(())
    }

    pub fn value(&self, stock: u64) -> Result<u64> {
        stock_value(stock, self.price_e8)
    }
}

#[account]
#[derive(InitSpace)]
pub struct Position {
    pub owner: Pubkey,
    pub market: Pubkey,
    pub kind: u8,
    pub bump: u8,
    /// Stock pledged, in the stock's base units (8 decimals).
    pub collateral: u64,
    pub scaled_debt: u128,
    /// Earn only: vault shares bought with the borrowed USDC. A free buffer,
    /// not pledged: it repays the debt before the stock is ever sold.
    pub shares: u64,
    /// The level the owner picked. The agents hold the position there.
    pub target_ltv_bps: u16,
    /// Amplify only: the loop multiple, 10_000 = 1x.
    pub leverage_bps: u16,
    pub deposited: u64,
    pub stock_from_yield: u64,
    pub opened_at: i64,
    pub last_agent_at: i64,
    pub last_agent: Pubkey,
    pub last_agent_op: u8,
    pub last_agent_amount: u64,
}

impl Position {
    pub fn kind_seed(&self) -> &'static [u8] {
        if self.kind == KIND_EARN {
            EARN_SEED
        } else {
            AMPLIFY_SEED
        }
    }

    pub fn debt(&self, p: &Protocol) -> Result<u64> {
        to_u64(mul_div_up(self.scaled_debt, p.borrow_index, WAD)?)
    }

    pub fn record(&mut self, agent: Pubkey, now: i64, op: u8, amount: u64) {
        self.last_agent = agent;
        self.last_agent_at = now;
        self.last_agent_op = op;
        self.last_agent_amount = amount;
    }
}

/// Where Chainlink CRE reports may come from. The Keystone Forwarder verifies
/// the DON's signatures, then CPIs `on_report` signed by a PDA of
/// `["forwarder", forwarder_state, this program]`; the receiver checks that PDA
/// and the workflow owner in the metadata.
#[account]
#[derive(InitSpace)]
pub struct CreConfig {
    pub forwarder_program: Pubkey,
    pub forwarder_state: Pubkey,
    /// EVM-style address of the workflow owner, as CRE puts it in the
    /// metadata. All zero accepts any owner.
    pub workflow_owner: [u8; 20],
    /// True while the forwarder is the CLI's mock: it relays without checking
    /// signatures, so reports are only as trusted as the per-push bounds.
    pub simulation: bool,
    pub bump: u8,
    pub reports: u64,
    pub last_report_at: i64,
}

/// One price in a CRE report.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, InitSpace)]
pub struct PriceUpdate {
    pub symbol: [u8; 8],
    pub price_e8: u64,
    pub publish_time: i64,
    pub session_open: bool,
}

/// The Borsh payload a CRE workflow writes: a few markets per report, since a
/// Solana transaction leaves the forwarder ~265 bytes once accounts are paid.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct PriceReport {
    pub updates: Vec<PriceUpdate>,
}

impl Market {
    /// The one place a price is written, whoever brings it (keeper or CRE):
    /// positive, publish time forward and not from the future, and at most
    /// `max_jump_bps` away from the last one.
    pub fn apply_price(
        &mut self,
        price_e8: u64,
        publish_time: i64,
        session_open: bool,
        now: i64,
    ) -> Result<()> {
        require!(price_e8 > 0, AgamaError::ZeroAmount);
        require!(
            publish_time <= now + crate::MAX_FUTURE_SKEW && publish_time >= self.price_time,
            AgamaError::BadPublishTime
        );
        if self.price_e8 > 0 {
            let old = self.price_e8 as u128;
            let diff = (price_e8 as u128).abs_diff(old);
            require!(
                diff * BPS <= old * self.max_jump_bps as u128,
                AgamaError::PriceJumpTooLarge
            );
        }
        self.price_e8 = price_e8;
        self.price_time = publish_time;
        self.session_open = session_open;
        Ok(())
    }
}
