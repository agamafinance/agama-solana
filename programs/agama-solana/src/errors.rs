use anchor_lang::prelude::*;

#[error_code]
pub enum AgamaError {
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Amount must be above zero")]
    ZeroAmount,
    #[msg("Only the admin")]
    NotAdmin,
    #[msg("Only the keeper")]
    NotKeeper,
    #[msg("Only the position owner")]
    NotOwner,
    #[msg("Market parameters out of range")]
    BadParams,
    #[msg("No price pushed yet")]
    NoPrice,
    #[msg("Price is stale: borrowing waits for a fresh one")]
    StalePrice,
    #[msg("Price moved more than the per-push bound")]
    PriceJumpTooLarge,
    #[msg("Publish time goes backwards or into the future")]
    BadPublishTime,
    #[msg("Target LTV above what the market allows right now")]
    TargetTooHigh,
    #[msg("Leverage out of range for this market")]
    LeverageOutOfRange,
    #[msg("Not enough USDC in the pool")]
    PoolIlliquid,
    #[msg("This would take the position above the market's LTV")]
    LtvExceeded,
    #[msg("Already within the band around the target")]
    AlreadyOnTarget,
    #[msg("No yield buffer left to repay from: the stock is never sold to rebalance")]
    NothingToDeleverage,
    #[msg("No yield above the debt to compound yet")]
    NothingToCompound,
    #[msg("Position is healthy")]
    Healthy,
    #[msg("Collateral does not cover the debt")]
    Underwater,
    #[msg("Wrong position kind for this instruction")]
    WrongKind,
    #[msg("Too many LP shares for the pool's free cash")]
    WithdrawTooLarge,
    #[msg("Report did not come through the configured Chainlink forwarder")]
    InvalidForwarder,
    #[msg("forwarder_authority is not the forwarder's PDA for this state and program")]
    InvalidForwarderAuthority,
    #[msg("Report comes from another workflow owner")]
    InvalidWorkflowOwner,
    #[msg("Report metadata or payload could not be decoded")]
    InvalidReport,
    #[msg("No market in the accounts for a symbol in the report")]
    MarketNotInReport,
}
