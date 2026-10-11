//! Chainlink Data Streams, verified on chain.
//!
//! A report is fetched off chain (anyone can), passed to `push_report`, and
//! verified by CPI into Chainlink's Verifier program, which checks the Data
//! Streams DON's signatures and returns the report's data. This module decodes
//! that data and turns it into a market price: which feed it is, whether its
//! session may price the market, how fresh it is.
//!
//! The report data is ABI encoded, one 32-byte word per field:
//!   v11 (RWA Advanced, the shares): feed id, valid from, observed at, native
//!       fee, link fee, expires at, mid, last seen (ns), bid, bid volume, ask,
//!       ask volume, last traded, market status
//!   v3 (crypto, gold): feed id, valid from, observed at, native fee, link fee,
//!       expires at, benchmark price, bid, ask
//! Prices have 18 decimals.

use anchor_lang::prelude::*;

use crate::errors::AgamaError;

/// `Feeds::kind`: a share, one v11 feed per session (regular, extended, overnight).
pub const KIND_SESSIONS: u8 = 0;
/// `Feeds::kind`: a cross rate, feed 0 (v3) times feed 1 (v3): gold is XAU/USDT x USDT/USD.
pub const KIND_CROSS: u8 = 1;

/// v11 market status.
pub const STATUS_PRE: u64 = 1;
pub const STATUS_REGULAR: u64 = 2;
pub const STATUS_POST: u64 = 3;
pub const STATUS_OVERNIGHT: u64 = 4;
pub const STATUS_CLOSED: u64 = 5;

/// A report older than this (by its observation time) is refused, seconds.
pub const MAX_REPORT_AGE: i64 = 300;

/// The Verifier's `verify` discriminator and its config PDA seed.
pub const VERIFY_DISCRIMINATOR: [u8; 8] = [133, 161, 141, 48, 120, 198, 88, 150];
pub const VERIFIER_SEED: &[u8] = b"verifier";

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Report {
    pub feed_id: [u8; 32],
    pub observed_at: i64,
    pub expires_at: i64,
    /// Price, 18 decimals.
    pub price: u128,
    /// v11 only; 0 for v3.
    pub market_status: u64,
}

fn word(data: &[u8], i: usize) -> Result<&[u8]> {
    data.get(i * 32..i * 32 + 32)
        .ok_or(error!(AgamaError::InvalidReport))
}

/// An unsigned field that must fit in 8 bytes (timestamps, status).
fn uint(data: &[u8], i: usize) -> Result<u64> {
    let w = word(data, i)?;
    require!(w[..24].iter().all(|b| *b == 0), AgamaError::InvalidReport);
    Ok(u64::from_be_bytes(w[24..].try_into().unwrap()))
}

/// A signed int192 price that must be positive and fit in 16 bytes.
fn price(data: &[u8], i: usize) -> Result<u128> {
    let w = word(data, i)?;
    require!(w[..16].iter().all(|b| *b == 0), AgamaError::InvalidReport);
    let p = u128::from_be_bytes(w[16..].try_into().unwrap());
    require!(p > 0 && p < (1u128 << 127), AgamaError::InvalidReport);
    Ok(p)
}

/// Decode a verified report's data, v11 or v3, by the schema in its feed id.
pub fn decode(data: &[u8]) -> Result<Report> {
    let feed_id: [u8; 32] = word(data, 0)?.try_into().unwrap();
    let schema = u16::from_be_bytes([feed_id[0], feed_id[1]]);
    let (len, status) = match schema {
        11 => (14, Some(13)),
        3 => (9, None),
        _ => return err!(AgamaError::InvalidReport),
    };
    require!(data.len() >= len * 32, AgamaError::InvalidReport);
    Ok(Report {
        feed_id,
        observed_at: uint(data, 2)? as i64,
        expires_at: uint(data, 5)? as i64,
        price: price(data, 6)?,
        market_status: match status {
            Some(i) => uint(data, i)?,
            None => 0,
        },
    })
}

/// 18 decimals to the market's 8.
pub fn to_e8(p: u128) -> Result<u64> {
    crate::math::to_u64(p / 10_000_000_000)
}

/// Whether a share's report may price the market, and if the session is the
/// regular one. Every session feed reports the same market status; only the
/// feed of the live session carries a live price. Closed (nights between
/// sessions, weekends, holidays): the regular feed, holding the last close.
pub fn session_price(slot: usize, status: u64) -> Result<bool> {
    let ok = match slot {
        0 => status == STATUS_REGULAR || status == STATUS_CLOSED,
        1 => status == STATUS_PRE || status == STATUS_POST,
        2 => status == STATUS_OVERNIGHT,
        _ => false,
    };
    require!(ok, AgamaError::WrongSession);
    Ok(status == STATUS_REGULAR)
}

/// Gold trades Sunday 22:00 to Friday 21:00 UTC (17:00 to 17:00 New York in
/// summer). Taken an hour wider on Sunday so winter time is covered too.
pub fn gold_open(t: i64) -> bool {
    let day = (t.div_euclid(86_400) + 4).rem_euclid(7); // 0 = Sunday
    let hour = t.rem_euclid(86_400) / 3_600;
    match day {
        6 => false,
        0 => hour >= 23,
        5 => hour < 21,
        _ => true,
    }
}

/// A report must be live: not expired, and observed recently.
pub fn check_fresh(r: &Report, now: i64) -> Result<()> {
    require!(r.expires_at >= now, AgamaError::StaleReport);
    require!(
        r.observed_at >= now - MAX_REPORT_AGE,
        AgamaError::StaleReport
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn blob(schema: u8, words: &[(usize, u128)], n: usize) -> Vec<u8> {
        let mut d = vec![0u8; n * 32];
        d[1] = schema;
        for (i, v) in words {
            d[i * 32 + 16..i * 32 + 32].copy_from_slice(&v.to_be_bytes());
        }
        d
    }

    #[test]
    fn decodes_v11_and_v3() {
        let r = decode(&blob(
            11,
            &[
                (2, 100),
                (5, 200),
                (6, 382_790_000_000_000_000_000),
                (13, 2),
            ],
            14,
        ))
        .unwrap();
        assert_eq!(
            (r.observed_at, r.expires_at, r.market_status),
            (100, 200, 2)
        );
        assert_eq!(to_e8(r.price).unwrap(), 38_279_000_000);
        let g = decode(&blob(
            3,
            &[(2, 7), (5, 9), (6, 4_199_090_000_000_000_000_000)],
            9,
        ))
        .unwrap();
        assert_eq!(
            (g.market_status, to_e8(g.price).unwrap()),
            (0, 419_909_000_000)
        );
        assert!(decode(&blob(8, &[], 14)).is_err());
        assert!(decode(&blob(11, &[(6, 1)], 13)).is_err());
        assert!(decode(&blob(3, &[], 9)).is_err()); // price 0
    }

    #[test]
    fn sessions() {
        assert_eq!(session_price(0, STATUS_REGULAR).unwrap(), true);
        assert_eq!(session_price(0, STATUS_CLOSED).unwrap(), false);
        assert!(session_price(0, STATUS_OVERNIGHT).is_err());
        assert_eq!(session_price(1, STATUS_POST).unwrap(), false);
        assert!(session_price(1, STATUS_REGULAR).is_err());
        assert_eq!(session_price(2, STATUS_OVERNIGHT).unwrap(), false);
        assert!(session_price(2, 0).is_err());
    }

    #[test]
    fn gold_hours() {
        // 2026-10-11 is a Sunday.
        let sun = 1_791_676_800;
        assert!(!gold_open(sun + 12 * 3600));
        assert!(gold_open(sun + 23 * 3600));
        assert!(gold_open(sun + 86_400 * 3));
        assert!(gold_open(sun + 86_400 * 5 + 20 * 3600));
        assert!(!gold_open(sun + 86_400 * 5 + 21 * 3600));
        assert!(!gold_open(sun + 86_400 * 6 + 12 * 3600));
    }
}
