use anchor_lang::prelude::*;

use crate::errors::AgamaError;

pub const WAD: u128 = 1_000_000_000_000_000_000;
pub const BPS: u128 = 10_000;
pub const YEAR: u128 = 365 * 24 * 3600;

pub const USDC_DECIMALS: u8 = 6;
pub const STOCK_DECIMALS: u8 = 8;
/// stock (1e8) * price (1e8) / 1e10 = USDC (1e6)
pub const VALUE_SCALE: u128 = 10_000_000_000;

pub fn mul_div(a: u128, b: u128, c: u128) -> Result<u128> {
    require!(c > 0, AgamaError::MathOverflow);
    Ok(a.checked_mul(b).ok_or(AgamaError::MathOverflow)? / c)
}

pub fn mul_div_up(a: u128, b: u128, c: u128) -> Result<u128> {
    require!(c > 0, AgamaError::MathOverflow);
    let n = a.checked_mul(b).ok_or(AgamaError::MathOverflow)?;
    Ok(n.div_ceil(c))
}

pub fn to_u64(x: u128) -> Result<u64> {
    u64::try_from(x).map_err(|_| error!(AgamaError::MathOverflow))
}

/// USDC value of `stock` at `price_e8`, rounded down.
pub fn stock_value(stock: u64, price_e8: u64) -> Result<u64> {
    to_u64(mul_div(stock as u128, price_e8 as u128, VALUE_SCALE)?)
}

/// Stock received for `usdc` at the oracle price, net of the fee. Rounded down.
pub fn stock_for_usdc(usdc: u64, price_e8: u64, fee_bps: u32) -> Result<u64> {
    let gross = mul_div(usdc as u128, VALUE_SCALE, price_e8 as u128)?;
    to_u64(mul_div(gross, BPS - fee_bps as u128, BPS)?)
}

/// Stock to sell so the proceeds net of the fee are at least `usdc`. Rounded up.
pub fn stock_to_raise(usdc: u64, price_e8: u64, fee_bps: u32) -> Result<u64> {
    let net = mul_div_up(usdc as u128, VALUE_SCALE, price_e8 as u128)?;
    to_u64(mul_div_up(net, BPS, BPS - fee_bps as u128)?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn value_round_trip() {
        // 10 TSLA at 430.12 = 4301.20 USDC
        assert_eq!(
            stock_value(10_0000_0000, 430_1200_0000).unwrap(),
            4_301_200_000
        );
        let s = stock_to_raise(1_000_000_000, 430_1200_0000, 5).unwrap();
        let back = stock_value(s, 430_1200_0000).unwrap() as u128 * (BPS - 5) / BPS;
        assert!(back >= 1_000_000_000 - 1);
        let bought = stock_for_usdc(1_000_000_000, 430_1200_0000, 5).unwrap();
        assert!(stock_value(bought, 430_1200_0000).unwrap() <= 1_000_000_000);
    }
}
