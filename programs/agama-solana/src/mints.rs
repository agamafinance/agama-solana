//! Every mint the program controls is a Token-2022 mint with the confidential
//! transfer extension: holders can move USDC, the stocks and the LP token into
//! an encrypted balance and send them to each other without showing amounts.
//!
//! Anchor's `init` cannot create such a mint (the extension has to be set up
//! between the account's creation and `InitializeMint2`), so mints and the
//! program's own token accounts are created here by hand.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke;
use anchor_lang::system_program::{create_account, CreateAccount};
use anchor_spl::token_2022::{
    initialize_account3, initialize_mint2, InitializeAccount3, InitializeMint2,
};
use spl_token_2022_interface::extension::{confidential_transfer, ExtensionType};
use spl_token_2022_interface::state::{Account as SplAccount, Mint as SplMint};

/// Create a PDA mint at `seeds`, confidential, decimals as given, minted by
/// `authority`. Accounts are approved for confidential use as they configure
/// (`auto_approve`), there is no auditor and no one can change that later.
#[allow(clippy::too_many_arguments)]
pub fn create_confidential_mint<'info>(
    payer: &AccountInfo<'info>,
    mint: &AccountInfo<'info>,
    seeds: &[&[u8]],
    decimals: u8,
    authority: &Pubkey,
    token_program: &AccountInfo<'info>,
    system_program: &AccountInfo<'info>,
) -> Result<()> {
    let space = ExtensionType::try_calculate_account_len::<SplMint>(&[
        ExtensionType::ConfidentialTransferMint,
    ])?;
    create_pda(payer, mint, seeds, space, token_program.key, system_program)?;
    let ix = confidential_transfer::instruction::initialize_mint(
        token_program.key,
        mint.key,
        None,
        true,
        None,
    )?;
    invoke(&ix, &[mint.clone()])?;
    initialize_mint2(
        CpiContext::new(token_program.key(), InitializeMint2 { mint: mint.clone() }),
        decimals,
        authority,
        None,
    )
}

/// Create a plain (public-balance) Token-2022 account at `seeds` for `mint`,
/// owned by `owner`. The program's pool, vault and custodies are these: the
/// program has to read its own balances.
#[allow(clippy::too_many_arguments)]
pub fn create_token_account<'info>(
    payer: &AccountInfo<'info>,
    account: &AccountInfo<'info>,
    seeds: &[&[u8]],
    mint: &AccountInfo<'info>,
    owner: &AccountInfo<'info>,
    token_program: &AccountInfo<'info>,
    system_program: &AccountInfo<'info>,
) -> Result<()> {
    let space = ExtensionType::try_calculate_account_len::<SplAccount>(&[])?;
    create_pda(
        payer,
        account,
        seeds,
        space,
        token_program.key,
        system_program,
    )?;
    initialize_account3(CpiContext::new(
        token_program.key(),
        InitializeAccount3 {
            account: account.clone(),
            mint: mint.clone(),
            authority: owner.clone(),
        },
    ))
}

fn create_pda<'info>(
    payer: &AccountInfo<'info>,
    new: &AccountInfo<'info>,
    seeds: &[&[u8]],
    space: usize,
    owner: &Pubkey,
    system_program: &AccountInfo<'info>,
) -> Result<()> {
    let lamports = Rent::get()?.minimum_balance(space);
    create_account(
        CpiContext::new_with_signer(
            system_program.key(),
            CreateAccount {
                from: payer.clone(),
                to: new.clone(),
            },
            &[seeds],
        ),
        lamports,
        space as u64,
        owner,
    )
}
