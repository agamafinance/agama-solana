//! The money movements every instruction is built from. Accounting and token
//! transfers live side by side here so one cannot move without the other.

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self as token, Burn, MintTo, TransferChecked};

use crate::errors::AgamaError;
use crate::math::*;
use crate::state::*;

/// The token accounts the protocol PDA signs for, in one place.
pub struct Pipes<'info> {
    pub token_program: Pubkey,
    pub authority: AccountInfo<'info>,
    pub bump: u8,
    pub usdc_mint: AccountInfo<'info>,
    pub stock_mint: AccountInfo<'info>,
    pub pool_usdc: AccountInfo<'info>,
    pub vault_usdc: AccountInfo<'info>,
    pub custody: AccountInfo<'info>,
}

impl<'info> Pipes<'info> {
    pub fn send(
        &self,
        from: &AccountInfo<'info>,
        to: &AccountInfo<'info>,
        mint: &AccountInfo<'info>,
        decimals: u8,
        amount: u64,
    ) -> Result<()> {
        if amount == 0 {
            return Ok(());
        }
        let bump = [self.bump];
        let seeds: &[&[u8]] = &[PROTOCOL_SEED, &bump];
        token::transfer_checked(
            CpiContext::new_with_signer(
                self.token_program,
                TransferChecked {
                    from: from.clone(),
                    mint: mint.clone(),
                    to: to.clone(),
                    authority: self.authority.clone(),
                },
                &[seeds],
            ),
            amount,
            decimals,
        )
    }

    pub fn send_usdc(
        &self,
        from: &AccountInfo<'info>,
        to: &AccountInfo<'info>,
        amount: u64,
    ) -> Result<()> {
        self.send(from, to, &self.usdc_mint, USDC_DECIMALS, amount)
    }

    pub fn send_stock(
        &self,
        from: &AccountInfo<'info>,
        to: &AccountInfo<'info>,
        amount: u64,
    ) -> Result<()> {
        self.send(from, to, &self.stock_mint, STOCK_DECIMALS, amount)
    }

    pub fn mint(
        &self,
        mint: &AccountInfo<'info>,
        to: &AccountInfo<'info>,
        amount: u64,
    ) -> Result<()> {
        if amount == 0 {
            return Ok(());
        }
        let bump = [self.bump];
        let seeds: &[&[u8]] = &[PROTOCOL_SEED, &bump];
        token::mint_to(
            CpiContext::new_with_signer(
                self.token_program,
                MintTo {
                    mint: mint.clone(),
                    to: to.clone(),
                    authority: self.authority.clone(),
                },
                &[seeds],
            ),
            amount,
        )
    }

    pub fn burn(
        &self,
        mint: &AccountInfo<'info>,
        from: &AccountInfo<'info>,
        amount: u64,
    ) -> Result<()> {
        if amount == 0 {
            return Ok(());
        }
        let bump = [self.bump];
        let seeds: &[&[u8]] = &[PROTOCOL_SEED, &bump];
        token::burn(
            CpiContext::new_with_signer(
                self.token_program,
                Burn {
                    mint: mint.clone(),
                    from: from.clone(),
                    authority: self.authority.clone(),
                },
                &[seeds],
            ),
            amount,
        )
    }
}

// ---------------------------------------------------------------------------
// Pool
// ---------------------------------------------------------------------------

/// Book `amount` of new debt. The USDC stays in `pool_usdc`; the caller says
/// where it goes.
pub fn borrow(p: &mut Protocol, m: &mut Market, pos: &mut Position, amount: u64) -> Result<()> {
    require!(amount > 0, AgamaError::ZeroAmount);
    require!(p.cash >= amount, AgamaError::PoolIlliquid);
    let scaled = mul_div_up(amount as u128, WAD, p.borrow_index)?;
    pos.scaled_debt += scaled;
    m.total_scaled_debt += scaled;
    p.total_scaled_debt += scaled;
    p.cash -= amount;
    Ok(())
}

/// Book a repayment of up to `amount` (already in `pool_usdc`). Returns what
/// was applied.
pub fn repay(p: &mut Protocol, m: &mut Market, pos: &mut Position, amount: u64) -> Result<u64> {
    let debt = pos.debt(p)?;
    let applied = amount.min(debt);
    if applied == 0 {
        return Ok(0);
    }
    let scaled = if applied == debt {
        pos.scaled_debt
    } else {
        mul_div(applied as u128, WAD, p.borrow_index)?.min(pos.scaled_debt)
    };
    pos.scaled_debt -= scaled;
    m.total_scaled_debt = m.total_scaled_debt.saturating_sub(scaled);
    p.total_scaled_debt = p.total_scaled_debt.saturating_sub(scaled);
    p.cash += applied;
    Ok(applied)
}

/// Drop what is left of `pos`'s debt without cash coming in. Only for
/// rounding dust: the lenders carry it.
pub fn write_off(p: &mut Protocol, m: &mut Market, pos: &mut Position) {
    let scaled = pos.scaled_debt;
    pos.scaled_debt = 0;
    m.total_scaled_debt = m.total_scaled_debt.saturating_sub(scaled);
    p.total_scaled_debt = p.total_scaled_debt.saturating_sub(scaled);
}

// ---------------------------------------------------------------------------
// Vault
// ---------------------------------------------------------------------------

/// Book `usdc` (already in `vault_usdc`) as new vault shares for `pos`.
pub fn vault_in(p: &mut Protocol, pos: &mut Position, usdc: u64) -> Result<u64> {
    let shares = p.shares_for_deposit(usdc)?;
    pos.shares += shares;
    p.vault_shares += shares;
    p.vault_cash += usdc;
    Ok(shares)
}

/// Burn the shares worth `usdc` and make sure the vault holds the USDC. The
/// tokens stay in `vault_usdc` for the caller to move.
///
/// On mainnet the credit book's coupons land in the vault. On devnet there is
/// no book, so the coupon is minted: it is the only place the program creates
/// dollars, and it is counted in `coupons_paid`.
pub fn vault_take(p: &mut Protocol, pos: &mut Position, pipes: &Pipes, usdc: u64) -> Result<()> {
    if usdc == 0 {
        return Ok(());
    }
    let shares = p.shares_for_withdraw(usdc)?.min(pos.shares);
    pos.shares -= shares;
    p.vault_shares = p.vault_shares.saturating_sub(shares);
    if p.vault_cash < usdc {
        let coupon = usdc - p.vault_cash;
        pipes.mint(&pipes.usdc_mint, &pipes.vault_usdc, coupon)?;
        p.vault_cash += coupon;
        p.coupons_paid += coupon;
    }
    p.vault_cash -= usdc;
    Ok(())
}

pub fn borrow_to_vault(
    p: &mut Protocol,
    m: &mut Market,
    pos: &mut Position,
    pipes: &Pipes,
    amount: u64,
) -> Result<()> {
    borrow(p, m, pos, amount)?;
    pipes.send_usdc(&pipes.pool_usdc, &pipes.vault_usdc, amount)?;
    vault_in(p, pos, amount)?;
    Ok(())
}

/// Repay `usdc` of debt out of the position's vault shares.
pub fn repay_from_buffer(
    p: &mut Protocol,
    m: &mut Market,
    pos: &mut Position,
    pipes: &Pipes,
    usdc: u64,
) -> Result<u64> {
    let usdc = usdc.min(p.shares_value(pos.shares)?).min(pos.debt(p)?);
    if usdc == 0 {
        return Ok(0);
    }
    vault_take(p, pos, pipes, usdc)?;
    pipes.send_usdc(&pipes.vault_usdc, &pipes.pool_usdc, usdc)?;
    repay(p, m, pos, usdc)
}

// ---------------------------------------------------------------------------
// Swaps
// ---------------------------------------------------------------------------
//
// Devnet has no xStock liquidity, so swaps settle against the oracle price
// minus `dex_fee_bps`, the way the X Layer testnet build used a price-oracle
// router in place of the OKX aggregator. On mainnet this is a Jupiter route.

/// Spend `usdc` held in `from` (pool or vault account) on stock for `pos`.
pub fn buy_stock<'info>(
    p: &Protocol,
    m: &mut Market,
    pos: &mut Position,
    pipes: &Pipes<'info>,
    from: &AccountInfo<'info>,
    usdc: u64,
) -> Result<u64> {
    let stock = stock_for_usdc(usdc, m.price_e8, p.dex_fee_bps)?;
    pipes.burn(&pipes.usdc_mint, from, usdc)?;
    pipes.mint(&pipes.stock_mint, &pipes.custody, stock)?;
    pos.collateral += stock;
    m.total_collateral += stock;
    Ok(stock)
}

/// Sell just enough of `pos`'s stock to land `usdc` in the pool account.
pub fn sell_stock_for(
    p: &Protocol,
    m: &mut Market,
    pos: &mut Position,
    pipes: &Pipes,
    usdc: u64,
) -> Result<u64> {
    let stock = stock_to_raise(usdc, m.price_e8, p.dex_fee_bps)?;
    require!(stock <= pos.collateral, AgamaError::Underwater);
    pipes.burn(&pipes.stock_mint, &pipes.custody, stock)?;
    pipes.mint(&pipes.usdc_mint, &pipes.pool_usdc, usdc)?;
    pos.collateral -= stock;
    m.total_collateral -= stock;
    Ok(stock)
}

// ---------------------------------------------------------------------------
// Holding the level
// ---------------------------------------------------------------------------

/// Bring an Earn position back to its target. Up: borrow the difference into
/// the vault. Down: repay out of the vault shares, never by selling stock.
/// `None` when already inside the band.
pub fn earn_move(
    p: &mut Protocol,
    m: &mut Market,
    pos: &mut Position,
    pipes: &Pipes,
    band_bps: u64,
) -> Result<Option<(u8, u64)>> {
    let value = m.value(pos.collateral)? as u128;
    let debt = pos.debt(p)? as u128;
    // The target can sit above what the market allows out of session: cap it.
    let target = (pos.target_ltv_bps as u64).min(m.ltv()) as u128;
    let wanted = value * target / BPS;
    let band = value * band_bps as u128 / BPS;
    if wanted > debt + band {
        let extra = to_u64(wanted - debt)?.min(p.cash);
        if extra < p.min_borrow.max(1) {
            return Ok(None);
        }
        borrow_to_vault(p, m, pos, pipes, extra)?;
        Ok(Some((OP_BORROWED_MORE, extra)))
    } else if debt > wanted + band {
        let want = to_u64(debt - wanted)?;
        let paid = repay_from_buffer(p, m, pos, pipes, want)?;
        require!(paid > 0, AgamaError::NothingToDeleverage);
        Ok(Some((OP_REPAID_FROM_YIELD, paid)))
    } else {
        Ok(None)
    }
}

/// Bring an Amplify loop back to its target. Up: borrow, buy more of the same
/// stock. Down: sell just enough stock to repay. Solved in one step: buying
/// moves the collateral too, so the borrow is not simply `wanted - debt`.
pub fn amplify_move(
    p: &mut Protocol,
    m: &mut Market,
    pos: &mut Position,
    pipes: &Pipes,
    band_bps: u64,
) -> Result<Option<(u8, u64)>> {
    let value = m.value(pos.collateral)? as u128;
    let debt = pos.debt(p)? as u128;
    let fee = p.dex_fee_bps as u128;
    let target = pos.target_ltv_bps as u128;
    let band = value * band_bps as u128 / BPS;
    let wanted = value * target / BPS;
    if wanted > debt + band {
        let up_target = target.min(m.ltv() as u128);
        let wanted_up = value * up_target / BPS;
        if wanted_up <= debt {
            return Ok(None);
        }
        // debt + x = t * (value + x * (1 - fee))
        let denom = BPS - up_target * (BPS - fee) / BPS;
        let x = to_u64((wanted_up - debt) * BPS / denom)?.min(p.cash);
        if x < p.min_borrow.max(1) {
            return Ok(None);
        }
        borrow(p, m, pos, x)?;
        let pool = pipes.pool_usdc.clone();
        buy_stock(p, m, pos, pipes, &pool, x)?;
        Ok(Some((OP_BOUGHT_MORE, x)))
    } else if debt > wanted + band {
        // debt - y = t * (value - y / (1 - fee))
        let denom = BPS - target * BPS / (BPS - fee);
        let y = to_u64(((debt - wanted) * BPS / denom).min(debt))?;
        if y == 0 {
            return Ok(None);
        }
        sell_stock_for(p, m, pos, pipes, y)?;
        repay(p, m, pos, y)?;
        Ok(Some((OP_SOLD_TO_REPAY, y)))
    } else {
        Ok(None)
    }
}

pub fn is_liquidatable(p: &Protocol, m: &Market, pos: &Position) -> Result<bool> {
    let value = m.value(pos.collateral)? as u128;
    let debt = pos.debt(p)? as u128;
    Ok(debt * BPS > value * m.threshold() as u128)
}
