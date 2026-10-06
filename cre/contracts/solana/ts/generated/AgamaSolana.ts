// Code generated — DO NOT EDIT.
import {
  getArrayCodec,
  getBooleanCodec,
  getI64Codec,
  getStructCodec,
  getU128Codec,
  getU16Codec,
  getU32Codec,
  getU64Codec,
  getU8Codec,
} from '@solana/codecs'
import { getAddressCodec, type Address } from '@solana/addresses'
import {
  adaptTrigger,
  anchorCPILogTriggerConfig,
  bytesToBase64,
  bytesToHex,
  calculateAccountsHash,
  encodeBorshVecU32,
  encodeForwarderReport,
  prepareSolanaReportRequest,
  prepareSubkeyValue,
  type Runtime,
  type SolanaAccountMeta,
  SolanaClient,
  solanaAccountMetasToJson,
  solanaAddressToBytes,
  type SolanaComputeConfig,
  type SolanaDecodedLog,
  type SolanaFilterLogTriggerRequestJson,
  type SolanaLog,
  type SolanaLogTriggerOptions,
  type SolanaSubkeyConfigJson,
  type SolanaValueComparatorJson,
  type Trigger,
} from '@chainlink/cre-sdk'

export const AGAMA_SOLANA_PROGRAM_ID = '6YdZN72p68ynpGH1SwZ86EseFokch6zPAQPAq9NxPY7D'

export const AGAMA_SOLANA_IDL = {"address":"6YdZN72p68ynpGH1SwZ86EseFokch6zPAQPAq9NxPY7D","metadata":{"name":"agama_solana","version":"0.1.0","spec":"0.1.0","description":"Agama on Solana: deposit a tokenized stock, get more of it back"},"instructions":[{"name":"add_market","discriminator":[41,137,185,126,69,139,254,55],"accounts":[{"name":"admin","writable":true,"signer":true,"relations":["protocol"]},{"name":"protocol","writable":true,"pda":{"seeds":[{"kind":"const","value":[112,114,111,116,111,99,111,108,46,118,50]}]}},{"name":"stock_mint","writable":true,"pda":{"seeds":[{"kind":"const","value":[115,116,111,99,107,46,118,50]},{"kind":"arg","path":"symbol"}]}},{"name":"market","writable":true,"pda":{"seeds":[{"kind":"const","value":[109,97,114,107,101,116,46,118,50]},{"kind":"account","path":"stock_mint"}]}},{"name":"custody","writable":true,"pda":{"seeds":[{"kind":"const","value":[99,117,115,116,111,100,121,46,118,50]},{"kind":"account","path":"market"}]}},{"name":"token_program","address":"TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"},{"name":"system_program","address":"11111111111111111111111111111111"}],"args":[{"name":"symbol","type":{"array":["u8",8]}},{"name":"params","type":{"defined":{"name":"MarketParams"}}}]},{"name":"amplify_close","docs":["Sell just enough stock to repay, hand the rest back."],"discriminator":[97,158,238,226,209,243,96,81],"accounts":[{"name":"user","writable":true,"signer":true},{"name":"protocol","writable":true,"pda":{"seeds":[{"kind":"const","value":[112,114,111,116,111,99,111,108,46,118,50]}]}},{"name":"market","writable":true,"pda":{"seeds":[{"kind":"const","value":[109,97,114,107,101,116,46,118,50]},{"kind":"account","path":"market.stock_mint","account":"Market"}]}},{"name":"position","writable":true,"pda":{"seeds":[{"kind":"const","value":[112,111,115,105,116,105,111,110,46,118,50]},{"kind":"account","path":"user"},{"kind":"account","path":"market"},{"kind":"const","value":[97,109,112,108,105,102,121]}]}},{"name":"usdc_mint","writable":true},{"name":"stock_mint","writable":true},{"name":"pool_usdc","writable":true},{"name":"vault_usdc","writable":true},{"name":"custody","writable":true},{"name":"user_stock","writable":true,"pda":{"seeds":[{"kind":"account","path":"user"},{"kind":"account","path":"token_program"},{"kind":"account","path":"stock_mint"}],"program":{"kind":"const","value":[140,151,37,143,78,36,137,241,187,61,16,41,20,142,13,131,11,90,19,153,218,255,16,132,4,142,123,216,219,233,248,89]}}},{"name":"token_program","address":"TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"},{"name":"associated_token_program","address":"ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"},{"name":"system_program","address":"11111111111111111111111111111111"}],"args":[]},{"name":"amplify_open","docs":["Deposit stock, loop it to `leverage_bps` (10_000 = 1x) in one go: the","borrow buys more of the same stock, pledged with the rest."],"discriminator":[74,30,220,219,140,132,74,253],"accounts":[{"name":"user","writable":true,"signer":true},{"name":"protocol","writable":true,"pda":{"seeds":[{"kind":"const","value":[112,114,111,116,111,99,111,108,46,118,50]}]}},{"name":"market","writable":true,"pda":{"seeds":[{"kind":"const","value":[109,97,114,107,101,116,46,118,50]},{"kind":"account","path":"market.stock_mint","account":"Market"}]}},{"name":"position","writable":true,"pda":{"seeds":[{"kind":"const","value":[112,111,115,105,116,105,111,110,46,118,50]},{"kind":"account","path":"user"},{"kind":"account","path":"market"},{"kind":"const","value":[97,109,112,108,105,102,121]}]}},{"name":"usdc_mint","writable":true},{"name":"stock_mint","writable":true},{"name":"pool_usdc","writable":true},{"name":"vault_usdc","writable":true},{"name":"custody","writable":true},{"name":"user_stock","writable":true,"pda":{"seeds":[{"kind":"account","path":"user"},{"kind":"account","path":"token_program"},{"kind":"account","path":"stock_mint"}],"program":{"kind":"const","value":[140,151,37,143,78,36,137,241,187,61,16,41,20,142,13,131,11,90,19,153,218,255,16,132,4,142,123,216,219,233,248,89]}}},{"name":"token_program","address":"TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"},{"name":"system_program","address":"11111111111111111111111111111111"}],"args":[{"name":"amount","type":"u64"},{"name":"leverage_bps","type":"u16"}]},{"name":"compound","docs":["Turn the vault yield above the debt into more of the stock. The swap is","priced off the same oracle the market uses, so the caller has nothing","to choose and nothing to skim."],"discriminator":[165,208,251,78,242,160,141,47],"accounts":[{"name":"caller","signer":true},{"name":"protocol","writable":true,"pda":{"seeds":[{"kind":"const","value":[112,114,111,116,111,99,111,108,46,118,50]}]}},{"name":"market","writable":true,"pda":{"seeds":[{"kind":"const","value":[109,97,114,107,101,116,46,118,50]},{"kind":"account","path":"market.stock_mint","account":"Market"}]},"relations":["position"]},{"name":"position","writable":true,"pda":{"seeds":[{"kind":"const","value":[112,111,115,105,116,105,111,110,46,118,50]},{"kind":"account","path":"position.owner","account":"Position"},{"kind":"account","path":"market"},{"kind":"account","path":"position"}]}},{"name":"usdc_mint","writable":true},{"name":"stock_mint","writable":true},{"name":"pool_usdc","writable":true},{"name":"vault_usdc","writable":true},{"name":"custody","writable":true},{"name":"token_program","address":"TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"}],"args":[]},{"name":"earn_close","docs":["Repay out of the vault shares first, then the wallet for any shortfall,","hand the stock back and the leftover yield as USDC."],"discriminator":[18,43,238,163,229,166,162,208],"accounts":[{"name":"user","writable":true,"signer":true},{"name":"protocol","writable":true,"pda":{"seeds":[{"kind":"const","value":[112,114,111,116,111,99,111,108,46,118,50]}]}},{"name":"market","writable":true,"pda":{"seeds":[{"kind":"const","value":[109,97,114,107,101,116,46,118,50]},{"kind":"account","path":"market.stock_mint","account":"Market"}]}},{"name":"position","writable":true,"pda":{"seeds":[{"kind":"const","value":[112,111,115,105,116,105,111,110,46,118,50]},{"kind":"account","path":"user"},{"kind":"account","path":"market"},{"kind":"const","value":[101,97,114,110]}]}},{"name":"usdc_mint","writable":true},{"name":"stock_mint","writable":true},{"name":"pool_usdc","writable":true},{"name":"vault_usdc","writable":true},{"name":"custody","writable":true},{"name":"user_usdc","writable":true,"pda":{"seeds":[{"kind":"account","path":"user"},{"kind":"account","path":"token_program"},{"kind":"account","path":"usdc_mint"}],"program":{"kind":"const","value":[140,151,37,143,78,36,137,241,187,61,16,41,20,142,13,131,11,90,19,153,218,255,16,132,4,142,123,216,219,233,248,89]}}},{"name":"user_stock","writable":true,"pda":{"seeds":[{"kind":"account","path":"user"},{"kind":"account","path":"token_program"},{"kind":"account","path":"stock_mint"}],"program":{"kind":"const","value":[140,151,37,143,78,36,137,241,187,61,16,41,20,142,13,131,11,90,19,153,218,255,16,132,4,142,123,216,219,233,248,89]}}},{"name":"token_program","address":"TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"},{"name":"associated_token_program","address":"ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"},{"name":"system_program","address":"11111111111111111111111111111111"}],"args":[]},{"name":"earn_deposit","docs":["Deposit stock (open or top up) and set the level. Borrows up to it at","once; from then on the agents keep it there."],"discriminator":[81,98,113,207,82,192,187,234],"accounts":[{"name":"user","writable":true,"signer":true},{"name":"protocol","writable":true,"pda":{"seeds":[{"kind":"const","value":[112,114,111,116,111,99,111,108,46,118,50]}]}},{"name":"market","writable":true,"pda":{"seeds":[{"kind":"const","value":[109,97,114,107,101,116,46,118,50]},{"kind":"account","path":"market.stock_mint","account":"Market"}]}},{"name":"position","writable":true,"pda":{"seeds":[{"kind":"const","value":[112,111,115,105,116,105,111,110,46,118,50]},{"kind":"account","path":"user"},{"kind":"account","path":"market"},{"kind":"const","value":[101,97,114,110]}]}},{"name":"usdc_mint","writable":true},{"name":"stock_mint","writable":true},{"name":"pool_usdc","writable":true},{"name":"vault_usdc","writable":true},{"name":"custody","writable":true},{"name":"user_stock","writable":true,"pda":{"seeds":[{"kind":"account","path":"user"},{"kind":"account","path":"token_program"},{"kind":"account","path":"stock_mint"}],"program":{"kind":"const","value":[140,151,37,143,78,36,137,241,187,61,16,41,20,142,13,131,11,90,19,153,218,255,16,132,4,142,123,216,219,233,248,89]}}},{"name":"token_program","address":"TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"},{"name":"system_program","address":"11111111111111111111111111111111"}],"args":[{"name":"amount","type":"u64"},{"name":"target_ltv_bps","type":"u16"}]},{"name":"earn_set_target","docs":["Move the slider. The position goes there now, both ways."],"discriminator":[187,54,78,3,37,159,205,215],"accounts":[{"name":"user","signer":true},{"name":"protocol","writable":true,"pda":{"seeds":[{"kind":"const","value":[112,114,111,116,111,99,111,108,46,118,50]}]}},{"name":"market","writable":true,"pda":{"seeds":[{"kind":"const","value":[109,97,114,107,101,116,46,118,50]},{"kind":"account","path":"market.stock_mint","account":"Market"}]}},{"name":"position","writable":true,"pda":{"seeds":[{"kind":"const","value":[112,111,115,105,116,105,111,110,46,118,50]},{"kind":"account","path":"user"},{"kind":"account","path":"market"},{"kind":"const","value":[101,97,114,110]}]}},{"name":"usdc_mint","writable":true},{"name":"stock_mint","writable":true},{"name":"pool_usdc","writable":true},{"name":"vault_usdc","writable":true},{"name":"custody","writable":true},{"name":"token_program","address":"TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"}],"args":[{"name":"target_ltv_bps","type":"u16"}]},{"name":"faucet_stock","discriminator":[236,240,88,216,8,250,109,153],"accounts":[{"name":"user","writable":true,"signer":true},{"name":"protocol","pda":{"seeds":[{"kind":"const","value":[112,114,111,116,111,99,111,108,46,118,50]}]}},{"name":"market","pda":{"seeds":[{"kind":"const","value":[109,97,114,107,101,116,46,118,50]},{"kind":"account","path":"market.stock_mint","account":"Market"}]}},{"name":"stock_mint","writable":true},{"name":"user_stock","writable":true,"pda":{"seeds":[{"kind":"account","path":"user"},{"kind":"account","path":"token_program"},{"kind":"account","path":"stock_mint"}],"program":{"kind":"const","value":[140,151,37,143,78,36,137,241,187,61,16,41,20,142,13,131,11,90,19,153,218,255,16,132,4,142,123,216,219,233,248,89]}}},{"name":"token_program","address":"TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"},{"name":"associated_token_program","address":"ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"},{"name":"system_program","address":"11111111111111111111111111111111"}],"args":[]},{"name":"faucet_usdc","discriminator":[190,45,226,28,94,130,98,127],"accounts":[{"name":"user","writable":true,"signer":true},{"name":"protocol","pda":{"seeds":[{"kind":"const","value":[112,114,111,116,111,99,111,108,46,118,50]}]}},{"name":"usdc_mint","writable":true},{"name":"user_usdc","writable":true,"pda":{"seeds":[{"kind":"account","path":"user"},{"kind":"account","path":"token_program"},{"kind":"account","path":"usdc_mint"}],"program":{"kind":"const","value":[140,151,37,143,78,36,137,241,187,61,16,41,20,142,13,131,11,90,19,153,218,255,16,132,4,142,123,216,219,233,248,89]}}},{"name":"token_program","address":"TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"},{"name":"associated_token_program","address":"ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"},{"name":"system_program","address":"11111111111111111111111111111111"}],"args":[]},{"name":"initialize","discriminator":[175,175,109,31,13,152,155,237],"accounts":[{"name":"admin","writable":true,"signer":true},{"name":"protocol","writable":true,"pda":{"seeds":[{"kind":"const","value":[112,114,111,116,111,99,111,108,46,118,50]}]}},{"name":"usdc_mint","writable":true,"pda":{"seeds":[{"kind":"const","value":[117,115,100,99,46,118,50]}]}},{"name":"lp_mint","writable":true,"pda":{"seeds":[{"kind":"const","value":[108,112,46,118,50]}]}},{"name":"pool_usdc","writable":true,"pda":{"seeds":[{"kind":"const","value":[112,111,111,108,95,117,115,100,99,46,118,50]}]}},{"name":"vault_usdc","writable":true,"pda":{"seeds":[{"kind":"const","value":[118,97,117,108,116,95,117,115,100,99,46,118,50]}]}},{"name":"token_program","address":"TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"},{"name":"system_program","address":"11111111111111111111111111111111"}],"args":[{"name":"params","type":{"defined":{"name":"ProtocolParams"}}}]},{"name":"liquidate","docs":["Backstop. The yield buffer goes first; only if that is not enough does","the liquidator repay and take stock at the bonus."],"discriminator":[223,179,226,125,48,46,39,74],"accounts":[{"name":"liquidator","writable":true,"signer":true},{"name":"protocol","writable":true,"pda":{"seeds":[{"kind":"const","value":[112,114,111,116,111,99,111,108,46,118,50]}]}},{"name":"market","writable":true,"pda":{"seeds":[{"kind":"const","value":[109,97,114,107,101,116,46,118,50]},{"kind":"account","path":"market.stock_mint","account":"Market"}]},"relations":["position"]},{"name":"position","writable":true,"pda":{"seeds":[{"kind":"const","value":[112,111,115,105,116,105,111,110,46,118,50]},{"kind":"account","path":"position.owner","account":"Position"},{"kind":"account","path":"market"},{"kind":"account","path":"position"}]}},{"name":"usdc_mint","writable":true},{"name":"stock_mint","writable":true},{"name":"pool_usdc","writable":true},{"name":"vault_usdc","writable":true},{"name":"custody","writable":true},{"name":"liquidator_usdc","writable":true,"pda":{"seeds":[{"kind":"account","path":"liquidator"},{"kind":"account","path":"token_program"},{"kind":"account","path":"usdc_mint"}],"program":{"kind":"const","value":[140,151,37,143,78,36,137,241,187,61,16,41,20,142,13,131,11,90,19,153,218,255,16,132,4,142,123,216,219,233,248,89]}}},{"name":"liquidator_stock","writable":true,"pda":{"seeds":[{"kind":"account","path":"liquidator"},{"kind":"account","path":"token_program"},{"kind":"account","path":"stock_mint"}],"program":{"kind":"const","value":[140,151,37,143,78,36,137,241,187,61,16,41,20,142,13,131,11,90,19,153,218,255,16,132,4,142,123,216,219,233,248,89]}}},{"name":"token_program","address":"TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"},{"name":"associated_token_program","address":"ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"},{"name":"system_program","address":"11111111111111111111111111111111"}],"args":[{"name":"max_repay","type":"u64"}]},{"name":"on_report","docs":["The Chainlink CRE receiver. The Keystone Forwarder calls this after","verifying the DON's signatures; the markets to price follow `cre` in the","accounts. Same bounds as the keeper: CRE replaces who brings the price,","not what a price is allowed to do."],"discriminator":[214,173,18,221,173,148,151,208],"accounts":[{"name":"state"},{"name":"forwarder_authority","signer":true},{"name":"cre","writable":true,"pda":{"seeds":[{"kind":"const","value":[99,114,101,46,118,50]}]}}],"args":[{"name":"metadata","type":"bytes"},{"name":"report","type":"bytes"}]},{"name":"poke","docs":["Accrue interest and vault yield. Anyone, any time."],"discriminator":[46,24,16,107,212,9,17,5],"accounts":[{"name":"protocol","writable":true,"pda":{"seeds":[{"kind":"const","value":[112,114,111,116,111,99,111,108,46,118,50]}]}}],"args":[]},{"name":"push_price","docs":["The keeper relays Pyth: the equity feed while the session trades, the","xStock token's own 24/7 feed outside it. Bounded per push, and the","publish time only moves forward."],"discriminator":[113,238,232,235,60,71,127,203],"accounts":[{"name":"keeper","signer":true,"relations":["protocol"]},{"name":"protocol","pda":{"seeds":[{"kind":"const","value":[112,114,111,116,111,99,111,108,46,118,50]}]}},{"name":"market","writable":true,"pda":{"seeds":[{"kind":"const","value":[109,97,114,107,101,116,46,118,50]},{"kind":"account","path":"market.stock_mint","account":"Market"}]}}],"args":[{"name":"price_e8","type":"u64"},{"name":"publish_time","type":"i64"},{"name":"session_open","type":"bool"}]},{"name":"rebalance","docs":["Hold the level the owner picked, both ways, with a 1% band."],"discriminator":[108,158,77,9,210,52,88,62],"accounts":[{"name":"caller","signer":true},{"name":"protocol","writable":true,"pda":{"seeds":[{"kind":"const","value":[112,114,111,116,111,99,111,108,46,118,50]}]}},{"name":"market","writable":true,"pda":{"seeds":[{"kind":"const","value":[109,97,114,107,101,116,46,118,50]},{"kind":"account","path":"market.stock_mint","account":"Market"}]},"relations":["position"]},{"name":"position","writable":true,"pda":{"seeds":[{"kind":"const","value":[112,111,115,105,116,105,111,110,46,118,50]},{"kind":"account","path":"position.owner","account":"Position"},{"kind":"account","path":"market"},{"kind":"account","path":"position"}]}},{"name":"usdc_mint","writable":true},{"name":"stock_mint","writable":true},{"name":"pool_usdc","writable":true},{"name":"vault_usdc","writable":true},{"name":"custody","writable":true},{"name":"token_program","address":"TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"}],"args":[]},{"name":"set_cre","docs":["Point the receiver at a forwarder deployment and, optionally, pin the","workflow owner."],"discriminator":[223,241,141,205,154,11,101,18],"accounts":[{"name":"admin","writable":true,"signer":true,"relations":["protocol"]},{"name":"protocol","pda":{"seeds":[{"kind":"const","value":[112,114,111,116,111,99,111,108,46,118,50]}]}},{"name":"cre","writable":true,"pda":{"seeds":[{"kind":"const","value":[99,114,101,46,118,50]}]}},{"name":"system_program","address":"11111111111111111111111111111111"}],"args":[{"name":"forwarder_program","type":"pubkey"},{"name":"forwarder_state","type":"pubkey"},{"name":"workflow_owner","type":{"array":["u8",20]}},{"name":"simulation","type":"bool"}]},{"name":"set_market","discriminator":[24,133,119,187,28,115,163,81],"accounts":[{"name":"admin","signer":true,"relations":["protocol"]},{"name":"protocol","pda":{"seeds":[{"kind":"const","value":[112,114,111,116,111,99,111,108,46,118,50]}]}},{"name":"market","writable":true,"pda":{"seeds":[{"kind":"const","value":[109,97,114,107,101,116,46,118,50]},{"kind":"account","path":"market.stock_mint","account":"Market"}]}}],"args":[{"name":"params","type":{"defined":{"name":"MarketParams"}}}]},{"name":"set_params","discriminator":[27,234,178,52,147,2,187,141],"accounts":[{"name":"admin","signer":true,"relations":["protocol"]},{"name":"protocol","writable":true,"pda":{"seeds":[{"kind":"const","value":[112,114,111,116,111,99,111,108,46,118,50]}]}}],"args":[{"name":"params","type":{"defined":{"name":"ProtocolParams"}}}]},{"name":"supply","discriminator":[81,67,116,61,250,209,5,198],"accounts":[{"name":"user","writable":true,"signer":true},{"name":"protocol","writable":true,"pda":{"seeds":[{"kind":"const","value":[112,114,111,116,111,99,111,108,46,118,50]}]}},{"name":"usdc_mint"},{"name":"lp_mint","writable":true},{"name":"pool_usdc","writable":true},{"name":"user_usdc","writable":true,"pda":{"seeds":[{"kind":"account","path":"user"},{"kind":"account","path":"token_program"},{"kind":"account","path":"usdc_mint"}],"program":{"kind":"const","value":[140,151,37,143,78,36,137,241,187,61,16,41,20,142,13,131,11,90,19,153,218,255,16,132,4,142,123,216,219,233,248,89]}}},{"name":"user_lp","writable":true,"pda":{"seeds":[{"kind":"account","path":"user"},{"kind":"account","path":"token_program"},{"kind":"account","path":"lp_mint"}],"program":{"kind":"const","value":[140,151,37,143,78,36,137,241,187,61,16,41,20,142,13,131,11,90,19,153,218,255,16,132,4,142,123,216,219,233,248,89]}}},{"name":"token_program","address":"TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"},{"name":"associated_token_program","address":"ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"},{"name":"system_program","address":"11111111111111111111111111111111"}],"args":[{"name":"amount","type":"u64"}]},{"name":"withdraw","discriminator":[183,18,70,156,148,109,161,34],"accounts":[{"name":"user","writable":true,"signer":true},{"name":"protocol","writable":true,"pda":{"seeds":[{"kind":"const","value":[112,114,111,116,111,99,111,108,46,118,50]}]}},{"name":"usdc_mint"},{"name":"lp_mint","writable":true},{"name":"pool_usdc","writable":true},{"name":"user_usdc","writable":true,"pda":{"seeds":[{"kind":"account","path":"user"},{"kind":"account","path":"token_program"},{"kind":"account","path":"usdc_mint"}],"program":{"kind":"const","value":[140,151,37,143,78,36,137,241,187,61,16,41,20,142,13,131,11,90,19,153,218,255,16,132,4,142,123,216,219,233,248,89]}}},{"name":"user_lp","writable":true,"pda":{"seeds":[{"kind":"account","path":"user"},{"kind":"account","path":"token_program"},{"kind":"account","path":"lp_mint"}],"program":{"kind":"const","value":[140,151,37,143,78,36,137,241,187,61,16,41,20,142,13,131,11,90,19,153,218,255,16,132,4,142,123,216,219,233,248,89]}}},{"name":"token_program","address":"TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"},{"name":"associated_token_program","address":"ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"},{"name":"system_program","address":"11111111111111111111111111111111"}],"args":[{"name":"lp","type":"u64"}]}],"accounts":[{"name":"CreConfig","discriminator":[223,155,135,163,37,82,124,78]},{"name":"Market","discriminator":[219,190,213,55,0,227,198,154]},{"name":"Position","discriminator":[170,188,143,228,122,64,247,208]},{"name":"Protocol","discriminator":[45,39,101,43,115,72,131,40]}],"events":[{"name":"AgentActed","discriminator":[137,17,53,163,179,198,16,173]},{"name":"AmplifyClosed","discriminator":[108,45,188,8,194,226,87,230]},{"name":"AmplifyOpened","discriminator":[239,198,185,17,106,45,76,13]},{"name":"CreReportReceived","discriminator":[47,189,143,54,90,97,15,198]},{"name":"EarnClosed","discriminator":[53,151,79,197,240,1,228,217]},{"name":"EarnDeposited","discriminator":[161,5,190,137,154,196,18,11]},{"name":"Liquidated","discriminator":[231,57,55,75,0,170,246,68]},{"name":"PricePushed","discriminator":[82,163,38,13,83,94,115,118]},{"name":"Supplied","discriminator":[137,114,239,72,162,75,133,39]},{"name":"Withdrawn","discriminator":[20,89,223,198,194,124,219,13]}],"errors":[{"code":6000,"name":"MathOverflow","msg":"Math overflow"},{"code":6001,"name":"ZeroAmount","msg":"Amount must be above zero"},{"code":6002,"name":"NotAdmin","msg":"Only the admin"},{"code":6003,"name":"NotKeeper","msg":"Only the keeper"},{"code":6004,"name":"NotOwner","msg":"Only the position owner"},{"code":6005,"name":"BadParams","msg":"Market parameters out of range"},{"code":6006,"name":"NoPrice","msg":"No price pushed yet"},{"code":6007,"name":"StalePrice","msg":"Price is stale: borrowing waits for a fresh one"},{"code":6008,"name":"PriceJumpTooLarge","msg":"Price moved more than the per-push bound"},{"code":6009,"name":"BadPublishTime","msg":"Publish time goes backwards or into the future"},{"code":6010,"name":"TargetTooHigh","msg":"Target LTV above what the market allows right now"},{"code":6011,"name":"LeverageOutOfRange","msg":"Leverage out of range for this market"},{"code":6012,"name":"PoolIlliquid","msg":"Not enough USDC in the pool"},{"code":6013,"name":"LtvExceeded","msg":"This would take the position above the market's LTV"},{"code":6014,"name":"AlreadyOnTarget","msg":"Already within the band around the target"},{"code":6015,"name":"NothingToDeleverage","msg":"No yield buffer left to repay from: the stock is never sold to rebalance"},{"code":6016,"name":"NothingToCompound","msg":"No yield above the debt to compound yet"},{"code":6017,"name":"Healthy","msg":"Position is healthy"},{"code":6018,"name":"Underwater","msg":"Collateral does not cover the debt"},{"code":6019,"name":"WrongKind","msg":"Wrong position kind for this instruction"},{"code":6020,"name":"WithdrawTooLarge","msg":"Too many LP shares for the pool's free cash"},{"code":6021,"name":"InvalidForwarder","msg":"Report did not come through the configured Chainlink forwarder"},{"code":6022,"name":"InvalidForwarderAuthority","msg":"forwarder_authority is not the forwarder's PDA for this state and program"},{"code":6023,"name":"InvalidWorkflowOwner","msg":"Report comes from another workflow owner"},{"code":6024,"name":"InvalidReport","msg":"Report metadata or payload could not be decoded"},{"code":6025,"name":"MarketNotInReport","msg":"No market in the accounts for a symbol in the report"}],"types":[{"name":"AgentActed","type":{"kind":"struct","fields":[{"name":"agent","type":"pubkey"},{"name":"position","type":"pubkey"},{"name":"op","type":"u8"},{"name":"amount","type":"u64"}]}},{"name":"AmplifyClosed","type":{"kind":"struct","fields":[{"name":"owner","type":"pubkey"},{"name":"market","type":"pubkey"},{"name":"repaid","type":"u64"},{"name":"stock_sold","type":"u64"},{"name":"stock_out","type":"u64"}]}},{"name":"AmplifyOpened","type":{"kind":"struct","fields":[{"name":"owner","type":"pubkey"},{"name":"market","type":"pubkey"},{"name":"stock_in","type":"u64"},{"name":"stock_bought","type":"u64"},{"name":"debt","type":"u64"},{"name":"leverage_bps","type":"u16"}]}},{"name":"CreConfig","docs":["Where Chainlink CRE reports may come from. The Keystone Forwarder verifies","the DON's signatures, then CPIs `on_report` signed by a PDA of","`[\"forwarder\", forwarder_state, this program]`; the receiver checks that PDA","and the workflow owner in the metadata."],"type":{"kind":"struct","fields":[{"name":"forwarder_program","type":"pubkey"},{"name":"forwarder_state","type":"pubkey"},{"name":"workflow_owner","docs":["EVM-style address of the workflow owner, as CRE puts it in the","metadata. All zero accepts any owner."],"type":{"array":["u8",20]}},{"name":"simulation","docs":["True while the forwarder is the CLI's mock: it relays without checking","signatures, so reports are only as trusted as the per-push bounds."],"type":"bool"},{"name":"bump","type":"u8"},{"name":"reports","type":"u64"},{"name":"last_report_at","type":"i64"}]}},{"name":"CreReportReceived","type":{"kind":"struct","fields":[{"name":"workflow_owner","type":{"array":["u8",20]}},{"name":"simulation","type":"bool"},{"name":"report","type":{"defined":{"name":"PriceReport"}}}]}},{"name":"EarnClosed","type":{"kind":"struct","fields":[{"name":"owner","type":"pubkey"},{"name":"market","type":"pubkey"},{"name":"repaid","type":"u64"},{"name":"from_buffer","type":"u64"},{"name":"from_wallet","type":"u64"},{"name":"usdc_out","type":"u64"},{"name":"stock_out","type":"u64"}]}},{"name":"EarnDeposited","type":{"kind":"struct","fields":[{"name":"owner","type":"pubkey"},{"name":"market","type":"pubkey"},{"name":"stock","type":"u64"},{"name":"borrowed","type":"u64"},{"name":"target_ltv_bps","type":"u16"}]}},{"name":"Liquidated","type":{"kind":"struct","fields":[{"name":"liquidator","type":"pubkey"},{"name":"position","type":"pubkey"},{"name":"repaid","type":"u64"},{"name":"seized","type":"u64"}]}},{"name":"Market","type":{"kind":"struct","fields":[{"name":"stock_mint","type":"pubkey"},{"name":"custody","type":"pubkey"},{"name":"symbol","type":{"array":["u8",8]}},{"name":"bump","type":"u8"},{"name":"ltv_bps","type":"u16"},{"name":"lt_bps","type":"u16"},{"name":"liq_bonus_bps","type":"u16"},{"name":"offhours_buffer_bps","docs":["Taken off both LTV and threshold while the share does not trade."],"type":"u16"},{"name":"price_e8","type":"u64"},{"name":"price_time","docs":["Publish time of the source the price came from."],"type":"i64"},{"name":"session_open","type":"bool"},{"name":"max_age","type":"u32"},{"name":"max_jump_bps","type":"u16"},{"name":"total_collateral","type":"u64"},{"name":"total_scaled_debt","type":"u128"}]}},{"name":"MarketParams","type":{"kind":"struct","fields":[{"name":"ltv_bps","type":"u16"},{"name":"lt_bps","type":"u16"},{"name":"liq_bonus_bps","type":"u16"},{"name":"offhours_buffer_bps","type":"u16"},{"name":"max_age","type":"u32"},{"name":"max_jump_bps","type":"u16"}]}},{"name":"Position","type":{"kind":"struct","fields":[{"name":"owner","type":"pubkey"},{"name":"market","type":"pubkey"},{"name":"kind","type":"u8"},{"name":"bump","type":"u8"},{"name":"collateral","docs":["Stock pledged, in the stock's base units (8 decimals)."],"type":"u64"},{"name":"scaled_debt","type":"u128"},{"name":"shares","docs":["Earn only: vault shares bought with the borrowed USDC. A free buffer,","not pledged: it repays the debt before the stock is ever sold."],"type":"u64"},{"name":"target_ltv_bps","docs":["The level the owner picked. The agents hold the position there."],"type":"u16"},{"name":"leverage_bps","docs":["Amplify only: the loop multiple, 10_000 = 1x."],"type":"u16"},{"name":"deposited","type":"u64"},{"name":"stock_from_yield","type":"u64"},{"name":"opened_at","type":"i64"},{"name":"last_agent_at","type":"i64"},{"name":"last_agent","type":"pubkey"},{"name":"last_agent_op","type":"u8"},{"name":"last_agent_amount","type":"u64"}]}},{"name":"PricePushed","type":{"kind":"struct","fields":[{"name":"market","type":"pubkey"},{"name":"price_e8","type":"u64"},{"name":"publish_time","type":"i64"},{"name":"session_open","type":"bool"}]}},{"name":"PriceReport","docs":["The Borsh payload a CRE workflow writes: a few markets per report, since a","Solana transaction leaves the forwarder ~265 bytes once accounts are paid."],"type":{"kind":"struct","fields":[{"name":"updates","type":{"vec":{"defined":{"name":"PriceUpdate"}}}}]}},{"name":"PriceUpdate","docs":["One price in a CRE report."],"type":{"kind":"struct","fields":[{"name":"symbol","type":{"array":["u8",8]}},{"name":"price_e8","type":"u64"},{"name":"publish_time","type":"i64"},{"name":"session_open","type":"bool"}]}},{"name":"Protocol","docs":["The lending pool, the private credit vault and every mint the program","controls hang off this one PDA. It signs for all of them."],"type":{"kind":"struct","fields":[{"name":"admin","type":"pubkey"},{"name":"keeper","docs":["Pushes prices. Bounded on chain, so a bad keeper can drift a price by","at most `max_jump_bps` per push, never set it."],"type":"pubkey"},{"name":"usdc_mint","type":"pubkey"},{"name":"lp_mint","type":"pubkey"},{"name":"pool_usdc","type":"pubkey"},{"name":"vault_usdc","type":"pubkey"},{"name":"bump","type":"u8"},{"name":"cash","docs":["USDC the pool holds and can lend."],"type":"u64"},{"name":"total_scaled_debt","type":"u128"},{"name":"borrow_index","docs":["Grows with the borrow rate. Debt = scaled * index / WAD."],"type":"u128"},{"name":"last_accrual","type":"i64"},{"name":"base_rate_bps","type":"u32"},{"name":"slope1_bps","type":"u32"},{"name":"slope2_bps","type":"u32"},{"name":"kink_bps","type":"u32"},{"name":"min_borrow","type":"u64"},{"name":"vault_shares","type":"u64"},{"name":"nav_wad","docs":["USDC per share, WAD. Accrues at `vault_apr_bps`."],"type":"u128"},{"name":"vault_apr_bps","type":"u32"},{"name":"vault_cash","docs":["USDC actually sitting in the vault account."],"type":"u64"},{"name":"coupons_paid","docs":["Coupons the credit book paid into the vault (devnet stand-in: minted)."],"type":"u64"},{"name":"min_compound","type":"u64"},{"name":"dex_fee_bps","type":"u32"},{"name":"market_count","type":"u8"}]}},{"name":"ProtocolParams","type":{"kind":"struct","fields":[{"name":"keeper","type":"pubkey"},{"name":"base_rate_bps","type":"u32"},{"name":"slope1_bps","type":"u32"},{"name":"slope2_bps","type":"u32"},{"name":"kink_bps","type":"u32"},{"name":"vault_apr_bps","type":"u32"},{"name":"min_borrow","type":"u64"},{"name":"min_compound","type":"u64"},{"name":"dex_fee_bps","type":"u32"}]}},{"name":"Supplied","type":{"kind":"struct","fields":[{"name":"user","type":"pubkey"},{"name":"usdc","type":"u64"},{"name":"lp","type":"u64"}]}},{"name":"Withdrawn","type":{"kind":"struct","fields":[{"name":"user","type":"pubkey"},{"name":"usdc","type":"u64"},{"name":"lp","type":"u64"}]}}]} as const

// Base64 of the compact IDL JSON, passed to log triggers as contractIdlJson.
const AGAMA_SOLANA_IDL_BASE64 = 'eyJhZGRyZXNzIjoiNllkWk43MnA2OHlucEdIMVN3Wjg2RXNlRm9rY2g2elBBUVBBcTlOeFBZN0QiLCJtZXRhZGF0YSI6eyJuYW1lIjoiYWdhbWFfc29sYW5hIiwidmVyc2lvbiI6IjAuMS4wIiwic3BlYyI6IjAuMS4wIiwiZGVzY3JpcHRpb24iOiJBZ2FtYSBvbiBTb2xhbmE6IGRlcG9zaXQgYSB0b2tlbml6ZWQgc3RvY2ssIGdldCBtb3JlIG9mIGl0IGJhY2sifSwiaW5zdHJ1Y3Rpb25zIjpbeyJuYW1lIjoiYWRkX21hcmtldCIsImRpc2NyaW1pbmF0b3IiOls0MSwxMzcsMTg1LDEyNiw2OSwxMzksMjU0LDU1XSwiYWNjb3VudHMiOlt7Im5hbWUiOiJhZG1pbiIsIndyaXRhYmxlIjp0cnVlLCJzaWduZXIiOnRydWUsInJlbGF0aW9ucyI6WyJwcm90b2NvbCJdfSx7Im5hbWUiOiJwcm90b2NvbCIsIndyaXRhYmxlIjp0cnVlLCJwZGEiOnsic2VlZHMiOlt7ImtpbmQiOiJjb25zdCIsInZhbHVlIjpbMTEyLDExNCwxMTEsMTE2LDExMSw5OSwxMTEsMTA4LDQ2LDExOCw1MF19XX19LHsibmFtZSI6InN0b2NrX21pbnQiLCJ3cml0YWJsZSI6dHJ1ZSwicGRhIjp7InNlZWRzIjpbeyJraW5kIjoiY29uc3QiLCJ2YWx1ZSI6WzExNSwxMTYsMTExLDk5LDEwNyw0NiwxMTgsNTBdfSx7ImtpbmQiOiJhcmciLCJwYXRoIjoic3ltYm9sIn1dfX0seyJuYW1lIjoibWFya2V0Iiwid3JpdGFibGUiOnRydWUsInBkYSI6eyJzZWVkcyI6W3sia2luZCI6ImNvbnN0IiwidmFsdWUiOlsxMDksOTcsMTE0LDEwNywxMDEsMTE2LDQ2LDExOCw1MF19LHsia2luZCI6ImFjY291bnQiLCJwYXRoIjoic3RvY2tfbWludCJ9XX19LHsibmFtZSI6ImN1c3RvZHkiLCJ3cml0YWJsZSI6dHJ1ZSwicGRhIjp7InNlZWRzIjpbeyJraW5kIjoiY29uc3QiLCJ2YWx1ZSI6Wzk5LDExNywxMTUsMTE2LDExMSwxMDAsMTIxLDQ2LDExOCw1MF19LHsia2luZCI6ImFjY291bnQiLCJwYXRoIjoibWFya2V0In1dfX0seyJuYW1lIjoidG9rZW5fcHJvZ3JhbSIsImFkZHJlc3MiOiJUb2tlbnpRZEJOYkxxUDVWRWhka0FTNkVQRkxDMVBIbkJxQ1hFcFB4dUViIn0seyJuYW1lIjoic3lzdGVtX3Byb2dyYW0iLCJhZGRyZXNzIjoiMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTEifV0sImFyZ3MiOlt7Im5hbWUiOiJzeW1ib2wiLCJ0eXBlIjp7ImFycmF5IjpbInU4Iiw4XX19LHsibmFtZSI6InBhcmFtcyIsInR5cGUiOnsiZGVmaW5lZCI6eyJuYW1lIjoiTWFya2V0UGFyYW1zIn19fV19LHsibmFtZSI6ImFtcGxpZnlfY2xvc2UiLCJkb2NzIjpbIlNlbGwganVzdCBlbm91Z2ggc3RvY2sgdG8gcmVwYXksIGhhbmQgdGhlIHJlc3QgYmFjay4iXSwiZGlzY3JpbWluYXRvciI6Wzk3LDE1OCwyMzgsMjI2LDIwOSwyNDMsOTYsODFdLCJhY2NvdW50cyI6W3sibmFtZSI6InVzZXIiLCJ3cml0YWJsZSI6dHJ1ZSwic2lnbmVyIjp0cnVlfSx7Im5hbWUiOiJwcm90b2NvbCIsIndyaXRhYmxlIjp0cnVlLCJwZGEiOnsic2VlZHMiOlt7ImtpbmQiOiJjb25zdCIsInZhbHVlIjpbMTEyLDExNCwxMTEsMTE2LDExMSw5OSwxMTEsMTA4LDQ2LDExOCw1MF19XX19LHsibmFtZSI6Im1hcmtldCIsIndyaXRhYmxlIjp0cnVlLCJwZGEiOnsic2VlZHMiOlt7ImtpbmQiOiJjb25zdCIsInZhbHVlIjpbMTA5LDk3LDExNCwxMDcsMTAxLDExNiw0NiwxMTgsNTBdfSx7ImtpbmQiOiJhY2NvdW50IiwicGF0aCI6Im1hcmtldC5zdG9ja19taW50IiwiYWNjb3VudCI6Ik1hcmtldCJ9XX19LHsibmFtZSI6InBvc2l0aW9uIiwid3JpdGFibGUiOnRydWUsInBkYSI6eyJzZWVkcyI6W3sia2luZCI6ImNvbnN0IiwidmFsdWUiOlsxMTIsMTExLDExNSwxMDUsMTE2LDEwNSwxMTEsMTEwLDQ2LDExOCw1MF19LHsia2luZCI6ImFjY291bnQiLCJwYXRoIjoidXNlciJ9LHsia2luZCI6ImFjY291bnQiLCJwYXRoIjoibWFya2V0In0seyJraW5kIjoiY29uc3QiLCJ2YWx1ZSI6Wzk3LDEwOSwxMTIsMTA4LDEwNSwxMDIsMTIxXX1dfX0seyJuYW1lIjoidXNkY19taW50Iiwid3JpdGFibGUiOnRydWV9LHsibmFtZSI6InN0b2NrX21pbnQiLCJ3cml0YWJsZSI6dHJ1ZX0seyJuYW1lIjoicG9vbF91c2RjIiwid3JpdGFibGUiOnRydWV9LHsibmFtZSI6InZhdWx0X3VzZGMiLCJ3cml0YWJsZSI6dHJ1ZX0seyJuYW1lIjoiY3VzdG9keSIsIndyaXRhYmxlIjp0cnVlfSx7Im5hbWUiOiJ1c2VyX3N0b2NrIiwid3JpdGFibGUiOnRydWUsInBkYSI6eyJzZWVkcyI6W3sia2luZCI6ImFjY291bnQiLCJwYXRoIjoidXNlciJ9LHsia2luZCI6ImFjY291bnQiLCJwYXRoIjoidG9rZW5fcHJvZ3JhbSJ9LHsia2luZCI6ImFjY291bnQiLCJwYXRoIjoic3RvY2tfbWludCJ9XSwicHJvZ3JhbSI6eyJraW5kIjoiY29uc3QiLCJ2YWx1ZSI6WzE0MCwxNTEsMzcsMTQzLDc4LDM2LDEzNywyNDEsMTg3LDYxLDE2LDQxLDIwLDE0MiwxMywxMzEsMTEsOTAsMTksMTUzLDIxOCwyNTUsMTYsMTMyLDQsMTQyLDEyMywyMTYsMjE5LDIzMywyNDgsODldfX19LHsibmFtZSI6InRva2VuX3Byb2dyYW0iLCJhZGRyZXNzIjoiVG9rZW56UWRCTmJMcVA1VkVoZGtBUzZFUEZMQzFQSG5CcUNYRXBQeHVFYiJ9LHsibmFtZSI6ImFzc29jaWF0ZWRfdG9rZW5fcHJvZ3JhbSIsImFkZHJlc3MiOiJBVG9rZW5HUHZiZEdWeHIxYjJodlpic2lxVzV4V0gyNWVmVE5zTEpBOGtuTCJ9LHsibmFtZSI6InN5c3RlbV9wcm9ncmFtIiwiYWRkcmVzcyI6IjExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExIn1dLCJhcmdzIjpbXX0seyJuYW1lIjoiYW1wbGlmeV9vcGVuIiwiZG9jcyI6WyJEZXBvc2l0IHN0b2NrLCBsb29wIGl0IHRvIGBsZXZlcmFnZV9icHNgICgxMF8wMDAgPSAxeCkgaW4gb25lIGdvOiB0aGUiLCJib3Jyb3cgYnV5cyBtb3JlIG9mIHRoZSBzYW1lIHN0b2NrLCBwbGVkZ2VkIHdpdGggdGhlIHJlc3QuIl0sImRpc2NyaW1pbmF0b3IiOls3NCwzMCwyMjAsMjE5LDE0MCwxMzIsNzQsMjUzXSwiYWNjb3VudHMiOlt7Im5hbWUiOiJ1c2VyIiwid3JpdGFibGUiOnRydWUsInNpZ25lciI6dHJ1ZX0seyJuYW1lIjoicHJvdG9jb2wiLCJ3cml0YWJsZSI6dHJ1ZSwicGRhIjp7InNlZWRzIjpbeyJraW5kIjoiY29uc3QiLCJ2YWx1ZSI6WzExMiwxMTQsMTExLDExNiwxMTEsOTksMTExLDEwOCw0NiwxMTgsNTBdfV19fSx7Im5hbWUiOiJtYXJrZXQiLCJ3cml0YWJsZSI6dHJ1ZSwicGRhIjp7InNlZWRzIjpbeyJraW5kIjoiY29uc3QiLCJ2YWx1ZSI6WzEwOSw5NywxMTQsMTA3LDEwMSwxMTYsNDYsMTE4LDUwXX0seyJraW5kIjoiYWNjb3VudCIsInBhdGgiOiJtYXJrZXQuc3RvY2tfbWludCIsImFjY291bnQiOiJNYXJrZXQifV19fSx7Im5hbWUiOiJwb3NpdGlvbiIsIndyaXRhYmxlIjp0cnVlLCJwZGEiOnsic2VlZHMiOlt7ImtpbmQiOiJjb25zdCIsInZhbHVlIjpbMTEyLDExMSwxMTUsMTA1LDExNiwxMDUsMTExLDExMCw0NiwxMTgsNTBdfSx7ImtpbmQiOiJhY2NvdW50IiwicGF0aCI6InVzZXIifSx7ImtpbmQiOiJhY2NvdW50IiwicGF0aCI6Im1hcmtldCJ9LHsia2luZCI6ImNvbnN0IiwidmFsdWUiOls5NywxMDksMTEyLDEwOCwxMDUsMTAyLDEyMV19XX19LHsibmFtZSI6InVzZGNfbWludCIsIndyaXRhYmxlIjp0cnVlfSx7Im5hbWUiOiJzdG9ja19taW50Iiwid3JpdGFibGUiOnRydWV9LHsibmFtZSI6InBvb2xfdXNkYyIsIndyaXRhYmxlIjp0cnVlfSx7Im5hbWUiOiJ2YXVsdF91c2RjIiwid3JpdGFibGUiOnRydWV9LHsibmFtZSI6ImN1c3RvZHkiLCJ3cml0YWJsZSI6dHJ1ZX0seyJuYW1lIjoidXNlcl9zdG9jayIsIndyaXRhYmxlIjp0cnVlLCJwZGEiOnsic2VlZHMiOlt7ImtpbmQiOiJhY2NvdW50IiwicGF0aCI6InVzZXIifSx7ImtpbmQiOiJhY2NvdW50IiwicGF0aCI6InRva2VuX3Byb2dyYW0ifSx7ImtpbmQiOiJhY2NvdW50IiwicGF0aCI6InN0b2NrX21pbnQifV0sInByb2dyYW0iOnsia2luZCI6ImNvbnN0IiwidmFsdWUiOlsxNDAsMTUxLDM3LDE0Myw3OCwzNiwxMzcsMjQxLDE4Nyw2MSwxNiw0MSwyMCwxNDIsMTMsMTMxLDExLDkwLDE5LDE1MywyMTgsMjU1LDE2LDEzMiw0LDE0MiwxMjMsMjE2LDIxOSwyMzMsMjQ4LDg5XX19fSx7Im5hbWUiOiJ0b2tlbl9wcm9ncmFtIiwiYWRkcmVzcyI6IlRva2VuelFkQk5iTHFQNVZFaGRrQVM2RVBGTEMxUEhuQnFDWEVwUHh1RWIifSx7Im5hbWUiOiJzeXN0ZW1fcHJvZ3JhbSIsImFkZHJlc3MiOiIxMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMSJ9XSwiYXJncyI6W3sibmFtZSI6ImFtb3VudCIsInR5cGUiOiJ1NjQifSx7Im5hbWUiOiJsZXZlcmFnZV9icHMiLCJ0eXBlIjoidTE2In1dfSx7Im5hbWUiOiJjb21wb3VuZCIsImRvY3MiOlsiVHVybiB0aGUgdmF1bHQgeWllbGQgYWJvdmUgdGhlIGRlYnQgaW50byBtb3JlIG9mIHRoZSBzdG9jay4gVGhlIHN3YXAgaXMiLCJwcmljZWQgb2ZmIHRoZSBzYW1lIG9yYWNsZSB0aGUgbWFya2V0IHVzZXMsIHNvIHRoZSBjYWxsZXIgaGFzIG5vdGhpbmciLCJ0byBjaG9vc2UgYW5kIG5vdGhpbmcgdG8gc2tpbS4iXSwiZGlzY3JpbWluYXRvciI6WzE2NSwyMDgsMjUxLDc4LDI0MiwxNjAsMTQxLDQ3XSwiYWNjb3VudHMiOlt7Im5hbWUiOiJjYWxsZXIiLCJzaWduZXIiOnRydWV9LHsibmFtZSI6InByb3RvY29sIiwid3JpdGFibGUiOnRydWUsInBkYSI6eyJzZWVkcyI6W3sia2luZCI6ImNvbnN0IiwidmFsdWUiOlsxMTIsMTE0LDExMSwxMTYsMTExLDk5LDExMSwxMDgsNDYsMTE4LDUwXX1dfX0seyJuYW1lIjoibWFya2V0Iiwid3JpdGFibGUiOnRydWUsInBkYSI6eyJzZWVkcyI6W3sia2luZCI6ImNvbnN0IiwidmFsdWUiOlsxMDksOTcsMTE0LDEwNywxMDEsMTE2LDQ2LDExOCw1MF19LHsia2luZCI6ImFjY291bnQiLCJwYXRoIjoibWFya2V0LnN0b2NrX21pbnQiLCJhY2NvdW50IjoiTWFya2V0In1dfSwicmVsYXRpb25zIjpbInBvc2l0aW9uIl19LHsibmFtZSI6InBvc2l0aW9uIiwid3JpdGFibGUiOnRydWUsInBkYSI6eyJzZWVkcyI6W3sia2luZCI6ImNvbnN0IiwidmFsdWUiOlsxMTIsMTExLDExNSwxMDUsMTE2LDEwNSwxMTEsMTEwLDQ2LDExOCw1MF19LHsia2luZCI6ImFjY291bnQiLCJwYXRoIjoicG9zaXRpb24ub3duZXIiLCJhY2NvdW50IjoiUG9zaXRpb24ifSx7ImtpbmQiOiJhY2NvdW50IiwicGF0aCI6Im1hcmtldCJ9LHsia2luZCI6ImFjY291bnQiLCJwYXRoIjoicG9zaXRpb24ifV19fSx7Im5hbWUiOiJ1c2RjX21pbnQiLCJ3cml0YWJsZSI6dHJ1ZX0seyJuYW1lIjoic3RvY2tfbWludCIsIndyaXRhYmxlIjp0cnVlfSx7Im5hbWUiOiJwb29sX3VzZGMiLCJ3cml0YWJsZSI6dHJ1ZX0seyJuYW1lIjoidmF1bHRfdXNkYyIsIndyaXRhYmxlIjp0cnVlfSx7Im5hbWUiOiJjdXN0b2R5Iiwid3JpdGFibGUiOnRydWV9LHsibmFtZSI6InRva2VuX3Byb2dyYW0iLCJhZGRyZXNzIjoiVG9rZW56UWRCTmJMcVA1VkVoZGtBUzZFUEZMQzFQSG5CcUNYRXBQeHVFYiJ9XSwiYXJncyI6W119LHsibmFtZSI6ImVhcm5fY2xvc2UiLCJkb2NzIjpbIlJlcGF5IG91dCBvZiB0aGUgdmF1bHQgc2hhcmVzIGZpcnN0LCB0aGVuIHRoZSB3YWxsZXQgZm9yIGFueSBzaG9ydGZhbGwsIiwiaGFuZCB0aGUgc3RvY2sgYmFjayBhbmQgdGhlIGxlZnRvdmVyIHlpZWxkIGFzIFVTREMuIl0sImRpc2NyaW1pbmF0b3IiOlsxOCw0MywyMzgsMTYzLDIyOSwxNjYsMTYyLDIwOF0sImFjY291bnRzIjpbeyJuYW1lIjoidXNlciIsIndyaXRhYmxlIjp0cnVlLCJzaWduZXIiOnRydWV9LHsibmFtZSI6InByb3RvY29sIiwid3JpdGFibGUiOnRydWUsInBkYSI6eyJzZWVkcyI6W3sia2luZCI6ImNvbnN0IiwidmFsdWUiOlsxMTIsMTE0LDExMSwxMTYsMTExLDk5LDExMSwxMDgsNDYsMTE4LDUwXX1dfX0seyJuYW1lIjoibWFya2V0Iiwid3JpdGFibGUiOnRydWUsInBkYSI6eyJzZWVkcyI6W3sia2luZCI6ImNvbnN0IiwidmFsdWUiOlsxMDksOTcsMTE0LDEwNywxMDEsMTE2LDQ2LDExOCw1MF19LHsia2luZCI6ImFjY291bnQiLCJwYXRoIjoibWFya2V0LnN0b2NrX21pbnQiLCJhY2NvdW50IjoiTWFya2V0In1dfX0seyJuYW1lIjoicG9zaXRpb24iLCJ3cml0YWJsZSI6dHJ1ZSwicGRhIjp7InNlZWRzIjpbeyJraW5kIjoiY29uc3QiLCJ2YWx1ZSI6WzExMiwxMTEsMTE1LDEwNSwxMTYsMTA1LDExMSwxMTAsNDYsMTE4LDUwXX0seyJraW5kIjoiYWNjb3VudCIsInBhdGgiOiJ1c2VyIn0seyJraW5kIjoiYWNjb3VudCIsInBhdGgiOiJtYXJrZXQifSx7ImtpbmQiOiJjb25zdCIsInZhbHVlIjpbMTAxLDk3LDExNCwxMTBdfV19fSx7Im5hbWUiOiJ1c2RjX21pbnQiLCJ3cml0YWJsZSI6dHJ1ZX0seyJuYW1lIjoic3RvY2tfbWludCIsIndyaXRhYmxlIjp0cnVlfSx7Im5hbWUiOiJwb29sX3VzZGMiLCJ3cml0YWJsZSI6dHJ1ZX0seyJuYW1lIjoidmF1bHRfdXNkYyIsIndyaXRhYmxlIjp0cnVlfSx7Im5hbWUiOiJjdXN0b2R5Iiwid3JpdGFibGUiOnRydWV9LHsibmFtZSI6InVzZXJfdXNkYyIsIndyaXRhYmxlIjp0cnVlLCJwZGEiOnsic2VlZHMiOlt7ImtpbmQiOiJhY2NvdW50IiwicGF0aCI6InVzZXIifSx7ImtpbmQiOiJhY2NvdW50IiwicGF0aCI6InRva2VuX3Byb2dyYW0ifSx7ImtpbmQiOiJhY2NvdW50IiwicGF0aCI6InVzZGNfbWludCJ9XSwicHJvZ3JhbSI6eyJraW5kIjoiY29uc3QiLCJ2YWx1ZSI6WzE0MCwxNTEsMzcsMTQzLDc4LDM2LDEzNywyNDEsMTg3LDYxLDE2LDQxLDIwLDE0MiwxMywxMzEsMTEsOTAsMTksMTUzLDIxOCwyNTUsMTYsMTMyLDQsMTQyLDEyMywyMTYsMjE5LDIzMywyNDgsODldfX19LHsibmFtZSI6InVzZXJfc3RvY2siLCJ3cml0YWJsZSI6dHJ1ZSwicGRhIjp7InNlZWRzIjpbeyJraW5kIjoiYWNjb3VudCIsInBhdGgiOiJ1c2VyIn0seyJraW5kIjoiYWNjb3VudCIsInBhdGgiOiJ0b2tlbl9wcm9ncmFtIn0seyJraW5kIjoiYWNjb3VudCIsInBhdGgiOiJzdG9ja19taW50In1dLCJwcm9ncmFtIjp7ImtpbmQiOiJjb25zdCIsInZhbHVlIjpbMTQwLDE1MSwzNywxNDMsNzgsMzYsMTM3LDI0MSwxODcsNjEsMTYsNDEsMjAsMTQyLDEzLDEzMSwxMSw5MCwxOSwxNTMsMjE4LDI1NSwxNiwxMzIsNCwxNDIsMTIzLDIxNiwyMTksMjMzLDI0OCw4OV19fX0seyJuYW1lIjoidG9rZW5fcHJvZ3JhbSIsImFkZHJlc3MiOiJUb2tlbnpRZEJOYkxxUDVWRWhka0FTNkVQRkxDMVBIbkJxQ1hFcFB4dUViIn0seyJuYW1lIjoiYXNzb2NpYXRlZF90b2tlbl9wcm9ncmFtIiwiYWRkcmVzcyI6IkFUb2tlbkdQdmJkR1Z4cjFiMmh2WmJzaXFXNXhXSDI1ZWZUTnNMSkE4a25MIn0seyJuYW1lIjoic3lzdGVtX3Byb2dyYW0iLCJhZGRyZXNzIjoiMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTEifV0sImFyZ3MiOltdfSx7Im5hbWUiOiJlYXJuX2RlcG9zaXQiLCJkb2NzIjpbIkRlcG9zaXQgc3RvY2sgKG9wZW4gb3IgdG9wIHVwKSBhbmQgc2V0IHRoZSBsZXZlbC4gQm9ycm93cyB1cCB0byBpdCBhdCIsIm9uY2U7IGZyb20gdGhlbiBvbiB0aGUgYWdlbnRzIGtlZXAgaXQgdGhlcmUuIl0sImRpc2NyaW1pbmF0b3IiOls4MSw5OCwxMTMsMjA3LDgyLDE5MiwxODcsMjM0XSwiYWNjb3VudHMiOlt7Im5hbWUiOiJ1c2VyIiwid3JpdGFibGUiOnRydWUsInNpZ25lciI6dHJ1ZX0seyJuYW1lIjoicHJvdG9jb2wiLCJ3cml0YWJsZSI6dHJ1ZSwicGRhIjp7InNlZWRzIjpbeyJraW5kIjoiY29uc3QiLCJ2YWx1ZSI6WzExMiwxMTQsMTExLDExNiwxMTEsOTksMTExLDEwOCw0NiwxMTgsNTBdfV19fSx7Im5hbWUiOiJtYXJrZXQiLCJ3cml0YWJsZSI6dHJ1ZSwicGRhIjp7InNlZWRzIjpbeyJraW5kIjoiY29uc3QiLCJ2YWx1ZSI6WzEwOSw5NywxMTQsMTA3LDEwMSwxMTYsNDYsMTE4LDUwXX0seyJraW5kIjoiYWNjb3VudCIsInBhdGgiOiJtYXJrZXQuc3RvY2tfbWludCIsImFjY291bnQiOiJNYXJrZXQifV19fSx7Im5hbWUiOiJwb3NpdGlvbiIsIndyaXRhYmxlIjp0cnVlLCJwZGEiOnsic2VlZHMiOlt7ImtpbmQiOiJjb25zdCIsInZhbHVlIjpbMTEyLDExMSwxMTUsMTA1LDExNiwxMDUsMTExLDExMCw0NiwxMTgsNTBdfSx7ImtpbmQiOiJhY2NvdW50IiwicGF0aCI6InVzZXIifSx7ImtpbmQiOiJhY2NvdW50IiwicGF0aCI6Im1hcmtldCJ9LHsia2luZCI6ImNvbnN0IiwidmFsdWUiOlsxMDEsOTcsMTE0LDExMF19XX19LHsibmFtZSI6InVzZGNfbWludCIsIndyaXRhYmxlIjp0cnVlfSx7Im5hbWUiOiJzdG9ja19taW50Iiwid3JpdGFibGUiOnRydWV9LHsibmFtZSI6InBvb2xfdXNkYyIsIndyaXRhYmxlIjp0cnVlfSx7Im5hbWUiOiJ2YXVsdF91c2RjIiwid3JpdGFibGUiOnRydWV9LHsibmFtZSI6ImN1c3RvZHkiLCJ3cml0YWJsZSI6dHJ1ZX0seyJuYW1lIjoidXNlcl9zdG9jayIsIndyaXRhYmxlIjp0cnVlLCJwZGEiOnsic2VlZHMiOlt7ImtpbmQiOiJhY2NvdW50IiwicGF0aCI6InVzZXIifSx7ImtpbmQiOiJhY2NvdW50IiwicGF0aCI6InRva2VuX3Byb2dyYW0ifSx7ImtpbmQiOiJhY2NvdW50IiwicGF0aCI6InN0b2NrX21pbnQifV0sInByb2dyYW0iOnsia2luZCI6ImNvbnN0IiwidmFsdWUiOlsxNDAsMTUxLDM3LDE0Myw3OCwzNiwxMzcsMjQxLDE4Nyw2MSwxNiw0MSwyMCwxNDIsMTMsMTMxLDExLDkwLDE5LDE1MywyMTgsMjU1LDE2LDEzMiw0LDE0MiwxMjMsMjE2LDIxOSwyMzMsMjQ4LDg5XX19fSx7Im5hbWUiOiJ0b2tlbl9wcm9ncmFtIiwiYWRkcmVzcyI6IlRva2VuelFkQk5iTHFQNVZFaGRrQVM2RVBGTEMxUEhuQnFDWEVwUHh1RWIifSx7Im5hbWUiOiJzeXN0ZW1fcHJvZ3JhbSIsImFkZHJlc3MiOiIxMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMSJ9XSwiYXJncyI6W3sibmFtZSI6ImFtb3VudCIsInR5cGUiOiJ1NjQifSx7Im5hbWUiOiJ0YXJnZXRfbHR2X2JwcyIsInR5cGUiOiJ1MTYifV19LHsibmFtZSI6ImVhcm5fc2V0X3RhcmdldCIsImRvY3MiOlsiTW92ZSB0aGUgc2xpZGVyLiBUaGUgcG9zaXRpb24gZ29lcyB0aGVyZSBub3csIGJvdGggd2F5cy4iXSwiZGlzY3JpbWluYXRvciI6WzE4Nyw1NCw3OCwzLDM3LDE1OSwyMDUsMjE1XSwiYWNjb3VudHMiOlt7Im5hbWUiOiJ1c2VyIiwic2lnbmVyIjp0cnVlfSx7Im5hbWUiOiJwcm90b2NvbCIsIndyaXRhYmxlIjp0cnVlLCJwZGEiOnsic2VlZHMiOlt7ImtpbmQiOiJjb25zdCIsInZhbHVlIjpbMTEyLDExNCwxMTEsMTE2LDExMSw5OSwxMTEsMTA4LDQ2LDExOCw1MF19XX19LHsibmFtZSI6Im1hcmtldCIsIndyaXRhYmxlIjp0cnVlLCJwZGEiOnsic2VlZHMiOlt7ImtpbmQiOiJjb25zdCIsInZhbHVlIjpbMTA5LDk3LDExNCwxMDcsMTAxLDExNiw0NiwxMTgsNTBdfSx7ImtpbmQiOiJhY2NvdW50IiwicGF0aCI6Im1hcmtldC5zdG9ja19taW50IiwiYWNjb3VudCI6Ik1hcmtldCJ9XX19LHsibmFtZSI6InBvc2l0aW9uIiwid3JpdGFibGUiOnRydWUsInBkYSI6eyJzZWVkcyI6W3sia2luZCI6ImNvbnN0IiwidmFsdWUiOlsxMTIsMTExLDExNSwxMDUsMTE2LDEwNSwxMTEsMTEwLDQ2LDExOCw1MF19LHsia2luZCI6ImFjY291bnQiLCJwYXRoIjoidXNlciJ9LHsia2luZCI6ImFjY291bnQiLCJwYXRoIjoibWFya2V0In0seyJraW5kIjoiY29uc3QiLCJ2YWx1ZSI6WzEwMSw5NywxMTQsMTEwXX1dfX0seyJuYW1lIjoidXNkY19taW50Iiwid3JpdGFibGUiOnRydWV9LHsibmFtZSI6InN0b2NrX21pbnQiLCJ3cml0YWJsZSI6dHJ1ZX0seyJuYW1lIjoicG9vbF91c2RjIiwid3JpdGFibGUiOnRydWV9LHsibmFtZSI6InZhdWx0X3VzZGMiLCJ3cml0YWJsZSI6dHJ1ZX0seyJuYW1lIjoiY3VzdG9keSIsIndyaXRhYmxlIjp0cnVlfSx7Im5hbWUiOiJ0b2tlbl9wcm9ncmFtIiwiYWRkcmVzcyI6IlRva2VuelFkQk5iTHFQNVZFaGRrQVM2RVBGTEMxUEhuQnFDWEVwUHh1RWIifV0sImFyZ3MiOlt7Im5hbWUiOiJ0YXJnZXRfbHR2X2JwcyIsInR5cGUiOiJ1MTYifV19LHsibmFtZSI6ImZhdWNldF9zdG9jayIsImRpc2NyaW1pbmF0b3IiOlsyMzYsMjQwLDg4LDIxNiw4LDI1MCwxMDksMTUzXSwiYWNjb3VudHMiOlt7Im5hbWUiOiJ1c2VyIiwid3JpdGFibGUiOnRydWUsInNpZ25lciI6dHJ1ZX0seyJuYW1lIjoicHJvdG9jb2wiLCJwZGEiOnsic2VlZHMiOlt7ImtpbmQiOiJjb25zdCIsInZhbHVlIjpbMTEyLDExNCwxMTEsMTE2LDExMSw5OSwxMTEsMTA4LDQ2LDExOCw1MF19XX19LHsibmFtZSI6Im1hcmtldCIsInBkYSI6eyJzZWVkcyI6W3sia2luZCI6ImNvbnN0IiwidmFsdWUiOlsxMDksOTcsMTE0LDEwNywxMDEsMTE2LDQ2LDExOCw1MF19LHsia2luZCI6ImFjY291bnQiLCJwYXRoIjoibWFya2V0LnN0b2NrX21pbnQiLCJhY2NvdW50IjoiTWFya2V0In1dfX0seyJuYW1lIjoic3RvY2tfbWludCIsIndyaXRhYmxlIjp0cnVlfSx7Im5hbWUiOiJ1c2VyX3N0b2NrIiwid3JpdGFibGUiOnRydWUsInBkYSI6eyJzZWVkcyI6W3sia2luZCI6ImFjY291bnQiLCJwYXRoIjoidXNlciJ9LHsia2luZCI6ImFjY291bnQiLCJwYXRoIjoidG9rZW5fcHJvZ3JhbSJ9LHsia2luZCI6ImFjY291bnQiLCJwYXRoIjoic3RvY2tfbWludCJ9XSwicHJvZ3JhbSI6eyJraW5kIjoiY29uc3QiLCJ2YWx1ZSI6WzE0MCwxNTEsMzcsMTQzLDc4LDM2LDEzNywyNDEsMTg3LDYxLDE2LDQxLDIwLDE0MiwxMywxMzEsMTEsOTAsMTksMTUzLDIxOCwyNTUsMTYsMTMyLDQsMTQyLDEyMywyMTYsMjE5LDIzMywyNDgsODldfX19LHsibmFtZSI6InRva2VuX3Byb2dyYW0iLCJhZGRyZXNzIjoiVG9rZW56UWRCTmJMcVA1VkVoZGtBUzZFUEZMQzFQSG5CcUNYRXBQeHVFYiJ9LHsibmFtZSI6ImFzc29jaWF0ZWRfdG9rZW5fcHJvZ3JhbSIsImFkZHJlc3MiOiJBVG9rZW5HUHZiZEdWeHIxYjJodlpic2lxVzV4V0gyNWVmVE5zTEpBOGtuTCJ9LHsibmFtZSI6InN5c3RlbV9wcm9ncmFtIiwiYWRkcmVzcyI6IjExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExIn1dLCJhcmdzIjpbXX0seyJuYW1lIjoiZmF1Y2V0X3VzZGMiLCJkaXNjcmltaW5hdG9yIjpbMTkwLDQ1LDIyNiwyOCw5NCwxMzAsOTgsMTI3XSwiYWNjb3VudHMiOlt7Im5hbWUiOiJ1c2VyIiwid3JpdGFibGUiOnRydWUsInNpZ25lciI6dHJ1ZX0seyJuYW1lIjoicHJvdG9jb2wiLCJwZGEiOnsic2VlZHMiOlt7ImtpbmQiOiJjb25zdCIsInZhbHVlIjpbMTEyLDExNCwxMTEsMTE2LDExMSw5OSwxMTEsMTA4LDQ2LDExOCw1MF19XX19LHsibmFtZSI6InVzZGNfbWludCIsIndyaXRhYmxlIjp0cnVlfSx7Im5hbWUiOiJ1c2VyX3VzZGMiLCJ3cml0YWJsZSI6dHJ1ZSwicGRhIjp7InNlZWRzIjpbeyJraW5kIjoiYWNjb3VudCIsInBhdGgiOiJ1c2VyIn0seyJraW5kIjoiYWNjb3VudCIsInBhdGgiOiJ0b2tlbl9wcm9ncmFtIn0seyJraW5kIjoiYWNjb3VudCIsInBhdGgiOiJ1c2RjX21pbnQifV0sInByb2dyYW0iOnsia2luZCI6ImNvbnN0IiwidmFsdWUiOlsxNDAsMTUxLDM3LDE0Myw3OCwzNiwxMzcsMjQxLDE4Nyw2MSwxNiw0MSwyMCwxNDIsMTMsMTMxLDExLDkwLDE5LDE1MywyMTgsMjU1LDE2LDEzMiw0LDE0MiwxMjMsMjE2LDIxOSwyMzMsMjQ4LDg5XX19fSx7Im5hbWUiOiJ0b2tlbl9wcm9ncmFtIiwiYWRkcmVzcyI6IlRva2VuelFkQk5iTHFQNVZFaGRrQVM2RVBGTEMxUEhuQnFDWEVwUHh1RWIifSx7Im5hbWUiOiJhc3NvY2lhdGVkX3Rva2VuX3Byb2dyYW0iLCJhZGRyZXNzIjoiQVRva2VuR1B2YmRHVnhyMWIyaHZaYnNpcVc1eFdIMjVlZlROc0xKQThrbkwifSx7Im5hbWUiOiJzeXN0ZW1fcHJvZ3JhbSIsImFkZHJlc3MiOiIxMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMSJ9XSwiYXJncyI6W119LHsibmFtZSI6ImluaXRpYWxpemUiLCJkaXNjcmltaW5hdG9yIjpbMTc1LDE3NSwxMDksMzEsMTMsMTUyLDE1NSwyMzddLCJhY2NvdW50cyI6W3sibmFtZSI6ImFkbWluIiwid3JpdGFibGUiOnRydWUsInNpZ25lciI6dHJ1ZX0seyJuYW1lIjoicHJvdG9jb2wiLCJ3cml0YWJsZSI6dHJ1ZSwicGRhIjp7InNlZWRzIjpbeyJraW5kIjoiY29uc3QiLCJ2YWx1ZSI6WzExMiwxMTQsMTExLDExNiwxMTEsOTksMTExLDEwOCw0NiwxMTgsNTBdfV19fSx7Im5hbWUiOiJ1c2RjX21pbnQiLCJ3cml0YWJsZSI6dHJ1ZSwicGRhIjp7InNlZWRzIjpbeyJraW5kIjoiY29uc3QiLCJ2YWx1ZSI6WzExNywxMTUsMTAwLDk5LDQ2LDExOCw1MF19XX19LHsibmFtZSI6ImxwX21pbnQiLCJ3cml0YWJsZSI6dHJ1ZSwicGRhIjp7InNlZWRzIjpbeyJraW5kIjoiY29uc3QiLCJ2YWx1ZSI6WzEwOCwxMTIsNDYsMTE4LDUwXX1dfX0seyJuYW1lIjoicG9vbF91c2RjIiwid3JpdGFibGUiOnRydWUsInBkYSI6eyJzZWVkcyI6W3sia2luZCI6ImNvbnN0IiwidmFsdWUiOlsxMTIsMTExLDExMSwxMDgsOTUsMTE3LDExNSwxMDAsOTksNDYsMTE4LDUwXX1dfX0seyJuYW1lIjoidmF1bHRfdXNkYyIsIndyaXRhYmxlIjp0cnVlLCJwZGEiOnsic2VlZHMiOlt7ImtpbmQiOiJjb25zdCIsInZhbHVlIjpbMTE4LDk3LDExNywxMDgsMTE2LDk1LDExNywxMTUsMTAwLDk5LDQ2LDExOCw1MF19XX19LHsibmFtZSI6InRva2VuX3Byb2dyYW0iLCJhZGRyZXNzIjoiVG9rZW56UWRCTmJMcVA1VkVoZGtBUzZFUEZMQzFQSG5CcUNYRXBQeHVFYiJ9LHsibmFtZSI6InN5c3RlbV9wcm9ncmFtIiwiYWRkcmVzcyI6IjExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExIn1dLCJhcmdzIjpbeyJuYW1lIjoicGFyYW1zIiwidHlwZSI6eyJkZWZpbmVkIjp7Im5hbWUiOiJQcm90b2NvbFBhcmFtcyJ9fX1dfSx7Im5hbWUiOiJsaXF1aWRhdGUiLCJkb2NzIjpbIkJhY2tzdG9wLiBUaGUgeWllbGQgYnVmZmVyIGdvZXMgZmlyc3Q7IG9ubHkgaWYgdGhhdCBpcyBub3QgZW5vdWdoIGRvZXMiLCJ0aGUgbGlxdWlkYXRvciByZXBheSBhbmQgdGFrZSBzdG9jayBhdCB0aGUgYm9udXMuIl0sImRpc2NyaW1pbmF0b3IiOlsyMjMsMTc5LDIyNiwxMjUsNDgsNDYsMzksNzRdLCJhY2NvdW50cyI6W3sibmFtZSI6ImxpcXVpZGF0b3IiLCJ3cml0YWJsZSI6dHJ1ZSwic2lnbmVyIjp0cnVlfSx7Im5hbWUiOiJwcm90b2NvbCIsIndyaXRhYmxlIjp0cnVlLCJwZGEiOnsic2VlZHMiOlt7ImtpbmQiOiJjb25zdCIsInZhbHVlIjpbMTEyLDExNCwxMTEsMTE2LDExMSw5OSwxMTEsMTA4LDQ2LDExOCw1MF19XX19LHsibmFtZSI6Im1hcmtldCIsIndyaXRhYmxlIjp0cnVlLCJwZGEiOnsic2VlZHMiOlt7ImtpbmQiOiJjb25zdCIsInZhbHVlIjpbMTA5LDk3LDExNCwxMDcsMTAxLDExNiw0NiwxMTgsNTBdfSx7ImtpbmQiOiJhY2NvdW50IiwicGF0aCI6Im1hcmtldC5zdG9ja19taW50IiwiYWNjb3VudCI6Ik1hcmtldCJ9XX0sInJlbGF0aW9ucyI6WyJwb3NpdGlvbiJdfSx7Im5hbWUiOiJwb3NpdGlvbiIsIndyaXRhYmxlIjp0cnVlLCJwZGEiOnsic2VlZHMiOlt7ImtpbmQiOiJjb25zdCIsInZhbHVlIjpbMTEyLDExMSwxMTUsMTA1LDExNiwxMDUsMTExLDExMCw0NiwxMTgsNTBdfSx7ImtpbmQiOiJhY2NvdW50IiwicGF0aCI6InBvc2l0aW9uLm93bmVyIiwiYWNjb3VudCI6IlBvc2l0aW9uIn0seyJraW5kIjoiYWNjb3VudCIsInBhdGgiOiJtYXJrZXQifSx7ImtpbmQiOiJhY2NvdW50IiwicGF0aCI6InBvc2l0aW9uIn1dfX0seyJuYW1lIjoidXNkY19taW50Iiwid3JpdGFibGUiOnRydWV9LHsibmFtZSI6InN0b2NrX21pbnQiLCJ3cml0YWJsZSI6dHJ1ZX0seyJuYW1lIjoicG9vbF91c2RjIiwid3JpdGFibGUiOnRydWV9LHsibmFtZSI6InZhdWx0X3VzZGMiLCJ3cml0YWJsZSI6dHJ1ZX0seyJuYW1lIjoiY3VzdG9keSIsIndyaXRhYmxlIjp0cnVlfSx7Im5hbWUiOiJsaXF1aWRhdG9yX3VzZGMiLCJ3cml0YWJsZSI6dHJ1ZSwicGRhIjp7InNlZWRzIjpbeyJraW5kIjoiYWNjb3VudCIsInBhdGgiOiJsaXF1aWRhdG9yIn0seyJraW5kIjoiYWNjb3VudCIsInBhdGgiOiJ0b2tlbl9wcm9ncmFtIn0seyJraW5kIjoiYWNjb3VudCIsInBhdGgiOiJ1c2RjX21pbnQifV0sInByb2dyYW0iOnsia2luZCI6ImNvbnN0IiwidmFsdWUiOlsxNDAsMTUxLDM3LDE0Myw3OCwzNiwxMzcsMjQxLDE4Nyw2MSwxNiw0MSwyMCwxNDIsMTMsMTMxLDExLDkwLDE5LDE1MywyMTgsMjU1LDE2LDEzMiw0LDE0MiwxMjMsMjE2LDIxOSwyMzMsMjQ4LDg5XX19fSx7Im5hbWUiOiJsaXF1aWRhdG9yX3N0b2NrIiwid3JpdGFibGUiOnRydWUsInBkYSI6eyJzZWVkcyI6W3sia2luZCI6ImFjY291bnQiLCJwYXRoIjoibGlxdWlkYXRvciJ9LHsia2luZCI6ImFjY291bnQiLCJwYXRoIjoidG9rZW5fcHJvZ3JhbSJ9LHsia2luZCI6ImFjY291bnQiLCJwYXRoIjoic3RvY2tfbWludCJ9XSwicHJvZ3JhbSI6eyJraW5kIjoiY29uc3QiLCJ2YWx1ZSI6WzE0MCwxNTEsMzcsMTQzLDc4LDM2LDEzNywyNDEsMTg3LDYxLDE2LDQxLDIwLDE0MiwxMywxMzEsMTEsOTAsMTksMTUzLDIxOCwyNTUsMTYsMTMyLDQsMTQyLDEyMywyMTYsMjE5LDIzMywyNDgsODldfX19LHsibmFtZSI6InRva2VuX3Byb2dyYW0iLCJhZGRyZXNzIjoiVG9rZW56UWRCTmJMcVA1VkVoZGtBUzZFUEZMQzFQSG5CcUNYRXBQeHVFYiJ9LHsibmFtZSI6ImFzc29jaWF0ZWRfdG9rZW5fcHJvZ3JhbSIsImFkZHJlc3MiOiJBVG9rZW5HUHZiZEdWeHIxYjJodlpic2lxVzV4V0gyNWVmVE5zTEpBOGtuTCJ9LHsibmFtZSI6InN5c3RlbV9wcm9ncmFtIiwiYWRkcmVzcyI6IjExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExIn1dLCJhcmdzIjpbeyJuYW1lIjoibWF4X3JlcGF5IiwidHlwZSI6InU2NCJ9XX0seyJuYW1lIjoib25fcmVwb3J0IiwiZG9jcyI6WyJUaGUgQ2hhaW5saW5rIENSRSByZWNlaXZlci4gVGhlIEtleXN0b25lIEZvcndhcmRlciBjYWxscyB0aGlzIGFmdGVyIiwidmVyaWZ5aW5nIHRoZSBET04ncyBzaWduYXR1cmVzOyB0aGUgbWFya2V0cyB0byBwcmljZSBmb2xsb3cgYGNyZWAgaW4gdGhlIiwiYWNjb3VudHMuIFNhbWUgYm91bmRzIGFzIHRoZSBrZWVwZXI6IENSRSByZXBsYWNlcyB3aG8gYnJpbmdzIHRoZSBwcmljZSwiLCJub3Qgd2hhdCBhIHByaWNlIGlzIGFsbG93ZWQgdG8gZG8uIl0sImRpc2NyaW1pbmF0b3IiOlsyMTQsMTczLDE4LDIyMSwxNzMsMTQ4LDE1MSwyMDhdLCJhY2NvdW50cyI6W3sibmFtZSI6InN0YXRlIn0seyJuYW1lIjoiZm9yd2FyZGVyX2F1dGhvcml0eSIsInNpZ25lciI6dHJ1ZX0seyJuYW1lIjoiY3JlIiwid3JpdGFibGUiOnRydWUsInBkYSI6eyJzZWVkcyI6W3sia2luZCI6ImNvbnN0IiwidmFsdWUiOls5OSwxMTQsMTAxLDQ2LDExOCw1MF19XX19XSwiYXJncyI6W3sibmFtZSI6Im1ldGFkYXRhIiwidHlwZSI6ImJ5dGVzIn0seyJuYW1lIjoicmVwb3J0IiwidHlwZSI6ImJ5dGVzIn1dfSx7Im5hbWUiOiJwb2tlIiwiZG9jcyI6WyJBY2NydWUgaW50ZXJlc3QgYW5kIHZhdWx0IHlpZWxkLiBBbnlvbmUsIGFueSB0aW1lLiJdLCJkaXNjcmltaW5hdG9yIjpbNDYsMjQsMTYsMTA3LDIxMiw5LDE3LDVdLCJhY2NvdW50cyI6W3sibmFtZSI6InByb3RvY29sIiwid3JpdGFibGUiOnRydWUsInBkYSI6eyJzZWVkcyI6W3sia2luZCI6ImNvbnN0IiwidmFsdWUiOlsxMTIsMTE0LDExMSwxMTYsMTExLDk5LDExMSwxMDgsNDYsMTE4LDUwXX1dfX1dLCJhcmdzIjpbXX0seyJuYW1lIjoicHVzaF9wcmljZSIsImRvY3MiOlsiVGhlIGtlZXBlciByZWxheXMgUHl0aDogdGhlIGVxdWl0eSBmZWVkIHdoaWxlIHRoZSBzZXNzaW9uIHRyYWRlcywgdGhlIiwieFN0b2NrIHRva2VuJ3Mgb3duIDI0LzcgZmVlZCBvdXRzaWRlIGl0LiBCb3VuZGVkIHBlciBwdXNoLCBhbmQgdGhlIiwicHVibGlzaCB0aW1lIG9ubHkgbW92ZXMgZm9yd2FyZC4iXSwiZGlzY3JpbWluYXRvciI6WzExMywyMzgsMjMyLDIzNSw2MCw3MSwxMjcsMjAzXSwiYWNjb3VudHMiOlt7Im5hbWUiOiJrZWVwZXIiLCJzaWduZXIiOnRydWUsInJlbGF0aW9ucyI6WyJwcm90b2NvbCJdfSx7Im5hbWUiOiJwcm90b2NvbCIsInBkYSI6eyJzZWVkcyI6W3sia2luZCI6ImNvbnN0IiwidmFsdWUiOlsxMTIsMTE0LDExMSwxMTYsMTExLDk5LDExMSwxMDgsNDYsMTE4LDUwXX1dfX0seyJuYW1lIjoibWFya2V0Iiwid3JpdGFibGUiOnRydWUsInBkYSI6eyJzZWVkcyI6W3sia2luZCI6ImNvbnN0IiwidmFsdWUiOlsxMDksOTcsMTE0LDEwNywxMDEsMTE2LDQ2LDExOCw1MF19LHsia2luZCI6ImFjY291bnQiLCJwYXRoIjoibWFya2V0LnN0b2NrX21pbnQiLCJhY2NvdW50IjoiTWFya2V0In1dfX1dLCJhcmdzIjpbeyJuYW1lIjoicHJpY2VfZTgiLCJ0eXBlIjoidTY0In0seyJuYW1lIjoicHVibGlzaF90aW1lIiwidHlwZSI6Imk2NCJ9LHsibmFtZSI6InNlc3Npb25fb3BlbiIsInR5cGUiOiJib29sIn1dfSx7Im5hbWUiOiJyZWJhbGFuY2UiLCJkb2NzIjpbIkhvbGQgdGhlIGxldmVsIHRoZSBvd25lciBwaWNrZWQsIGJvdGggd2F5cywgd2l0aCBhIDElIGJhbmQuIl0sImRpc2NyaW1pbmF0b3IiOlsxMDgsMTU4LDc3LDksMjEwLDUyLDg4LDYyXSwiYWNjb3VudHMiOlt7Im5hbWUiOiJjYWxsZXIiLCJzaWduZXIiOnRydWV9LHsibmFtZSI6InByb3RvY29sIiwid3JpdGFibGUiOnRydWUsInBkYSI6eyJzZWVkcyI6W3sia2luZCI6ImNvbnN0IiwidmFsdWUiOlsxMTIsMTE0LDExMSwxMTYsMTExLDk5LDExMSwxMDgsNDYsMTE4LDUwXX1dfX0seyJuYW1lIjoibWFya2V0Iiwid3JpdGFibGUiOnRydWUsInBkYSI6eyJzZWVkcyI6W3sia2luZCI6ImNvbnN0IiwidmFsdWUiOlsxMDksOTcsMTE0LDEwNywxMDEsMTE2LDQ2LDExOCw1MF19LHsia2luZCI6ImFjY291bnQiLCJwYXRoIjoibWFya2V0LnN0b2NrX21pbnQiLCJhY2NvdW50IjoiTWFya2V0In1dfSwicmVsYXRpb25zIjpbInBvc2l0aW9uIl19LHsibmFtZSI6InBvc2l0aW9uIiwid3JpdGFibGUiOnRydWUsInBkYSI6eyJzZWVkcyI6W3sia2luZCI6ImNvbnN0IiwidmFsdWUiOlsxMTIsMTExLDExNSwxMDUsMTE2LDEwNSwxMTEsMTEwLDQ2LDExOCw1MF19LHsia2luZCI6ImFjY291bnQiLCJwYXRoIjoicG9zaXRpb24ub3duZXIiLCJhY2NvdW50IjoiUG9zaXRpb24ifSx7ImtpbmQiOiJhY2NvdW50IiwicGF0aCI6Im1hcmtldCJ9LHsia2luZCI6ImFjY291bnQiLCJwYXRoIjoicG9zaXRpb24ifV19fSx7Im5hbWUiOiJ1c2RjX21pbnQiLCJ3cml0YWJsZSI6dHJ1ZX0seyJuYW1lIjoic3RvY2tfbWludCIsIndyaXRhYmxlIjp0cnVlfSx7Im5hbWUiOiJwb29sX3VzZGMiLCJ3cml0YWJsZSI6dHJ1ZX0seyJuYW1lIjoidmF1bHRfdXNkYyIsIndyaXRhYmxlIjp0cnVlfSx7Im5hbWUiOiJjdXN0b2R5Iiwid3JpdGFibGUiOnRydWV9LHsibmFtZSI6InRva2VuX3Byb2dyYW0iLCJhZGRyZXNzIjoiVG9rZW56UWRCTmJMcVA1VkVoZGtBUzZFUEZMQzFQSG5CcUNYRXBQeHVFYiJ9XSwiYXJncyI6W119LHsibmFtZSI6InNldF9jcmUiLCJkb2NzIjpbIlBvaW50IHRoZSByZWNlaXZlciBhdCBhIGZvcndhcmRlciBkZXBsb3ltZW50IGFuZCwgb3B0aW9uYWxseSwgcGluIHRoZSIsIndvcmtmbG93IG93bmVyLiJdLCJkaXNjcmltaW5hdG9yIjpbMjIzLDI0MSwxNDEsMjA1LDE1NCwxMSwxMDEsMThdLCJhY2NvdW50cyI6W3sibmFtZSI6ImFkbWluIiwid3JpdGFibGUiOnRydWUsInNpZ25lciI6dHJ1ZSwicmVsYXRpb25zIjpbInByb3RvY29sIl19LHsibmFtZSI6InByb3RvY29sIiwicGRhIjp7InNlZWRzIjpbeyJraW5kIjoiY29uc3QiLCJ2YWx1ZSI6WzExMiwxMTQsMTExLDExNiwxMTEsOTksMTExLDEwOCw0NiwxMTgsNTBdfV19fSx7Im5hbWUiOiJjcmUiLCJ3cml0YWJsZSI6dHJ1ZSwicGRhIjp7InNlZWRzIjpbeyJraW5kIjoiY29uc3QiLCJ2YWx1ZSI6Wzk5LDExNCwxMDEsNDYsMTE4LDUwXX1dfX0seyJuYW1lIjoic3lzdGVtX3Byb2dyYW0iLCJhZGRyZXNzIjoiMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTEifV0sImFyZ3MiOlt7Im5hbWUiOiJmb3J3YXJkZXJfcHJvZ3JhbSIsInR5cGUiOiJwdWJrZXkifSx7Im5hbWUiOiJmb3J3YXJkZXJfc3RhdGUiLCJ0eXBlIjoicHVia2V5In0seyJuYW1lIjoid29ya2Zsb3dfb3duZXIiLCJ0eXBlIjp7ImFycmF5IjpbInU4IiwyMF19fSx7Im5hbWUiOiJzaW11bGF0aW9uIiwidHlwZSI6ImJvb2wifV19LHsibmFtZSI6InNldF9tYXJrZXQiLCJkaXNjcmltaW5hdG9yIjpbMjQsMTMzLDExOSwxODcsMjgsMTE1LDE2Myw4MV0sImFjY291bnRzIjpbeyJuYW1lIjoiYWRtaW4iLCJzaWduZXIiOnRydWUsInJlbGF0aW9ucyI6WyJwcm90b2NvbCJdfSx7Im5hbWUiOiJwcm90b2NvbCIsInBkYSI6eyJzZWVkcyI6W3sia2luZCI6ImNvbnN0IiwidmFsdWUiOlsxMTIsMTE0LDExMSwxMTYsMTExLDk5LDExMSwxMDgsNDYsMTE4LDUwXX1dfX0seyJuYW1lIjoibWFya2V0Iiwid3JpdGFibGUiOnRydWUsInBkYSI6eyJzZWVkcyI6W3sia2luZCI6ImNvbnN0IiwidmFsdWUiOlsxMDksOTcsMTE0LDEwNywxMDEsMTE2LDQ2LDExOCw1MF19LHsia2luZCI6ImFjY291bnQiLCJwYXRoIjoibWFya2V0LnN0b2NrX21pbnQiLCJhY2NvdW50IjoiTWFya2V0In1dfX1dLCJhcmdzIjpbeyJuYW1lIjoicGFyYW1zIiwidHlwZSI6eyJkZWZpbmVkIjp7Im5hbWUiOiJNYXJrZXRQYXJhbXMifX19XX0seyJuYW1lIjoic2V0X3BhcmFtcyIsImRpc2NyaW1pbmF0b3IiOlsyNywyMzQsMTc4LDUyLDE0NywyLDE4NywxNDFdLCJhY2NvdW50cyI6W3sibmFtZSI6ImFkbWluIiwic2lnbmVyIjp0cnVlLCJyZWxhdGlvbnMiOlsicHJvdG9jb2wiXX0seyJuYW1lIjoicHJvdG9jb2wiLCJ3cml0YWJsZSI6dHJ1ZSwicGRhIjp7InNlZWRzIjpbeyJraW5kIjoiY29uc3QiLCJ2YWx1ZSI6WzExMiwxMTQsMTExLDExNiwxMTEsOTksMTExLDEwOCw0NiwxMTgsNTBdfV19fV0sImFyZ3MiOlt7Im5hbWUiOiJwYXJhbXMiLCJ0eXBlIjp7ImRlZmluZWQiOnsibmFtZSI6IlByb3RvY29sUGFyYW1zIn19fV19LHsibmFtZSI6InN1cHBseSIsImRpc2NyaW1pbmF0b3IiOls4MSw2NywxMTYsNjEsMjUwLDIwOSw1LDE5OF0sImFjY291bnRzIjpbeyJuYW1lIjoidXNlciIsIndyaXRhYmxlIjp0cnVlLCJzaWduZXIiOnRydWV9LHsibmFtZSI6InByb3RvY29sIiwid3JpdGFibGUiOnRydWUsInBkYSI6eyJzZWVkcyI6W3sia2luZCI6ImNvbnN0IiwidmFsdWUiOlsxMTIsMTE0LDExMSwxMTYsMTExLDk5LDExMSwxMDgsNDYsMTE4LDUwXX1dfX0seyJuYW1lIjoidXNkY19taW50In0seyJuYW1lIjoibHBfbWludCIsIndyaXRhYmxlIjp0cnVlfSx7Im5hbWUiOiJwb29sX3VzZGMiLCJ3cml0YWJsZSI6dHJ1ZX0seyJuYW1lIjoidXNlcl91c2RjIiwid3JpdGFibGUiOnRydWUsInBkYSI6eyJzZWVkcyI6W3sia2luZCI6ImFjY291bnQiLCJwYXRoIjoidXNlciJ9LHsia2luZCI6ImFjY291bnQiLCJwYXRoIjoidG9rZW5fcHJvZ3JhbSJ9LHsia2luZCI6ImFjY291bnQiLCJwYXRoIjoidXNkY19taW50In1dLCJwcm9ncmFtIjp7ImtpbmQiOiJjb25zdCIsInZhbHVlIjpbMTQwLDE1MSwzNywxNDMsNzgsMzYsMTM3LDI0MSwxODcsNjEsMTYsNDEsMjAsMTQyLDEzLDEzMSwxMSw5MCwxOSwxNTMsMjE4LDI1NSwxNiwxMzIsNCwxNDIsMTIzLDIxNiwyMTksMjMzLDI0OCw4OV19fX0seyJuYW1lIjoidXNlcl9scCIsIndyaXRhYmxlIjp0cnVlLCJwZGEiOnsic2VlZHMiOlt7ImtpbmQiOiJhY2NvdW50IiwicGF0aCI6InVzZXIifSx7ImtpbmQiOiJhY2NvdW50IiwicGF0aCI6InRva2VuX3Byb2dyYW0ifSx7ImtpbmQiOiJhY2NvdW50IiwicGF0aCI6ImxwX21pbnQifV0sInByb2dyYW0iOnsia2luZCI6ImNvbnN0IiwidmFsdWUiOlsxNDAsMTUxLDM3LDE0Myw3OCwzNiwxMzcsMjQxLDE4Nyw2MSwxNiw0MSwyMCwxNDIsMTMsMTMxLDExLDkwLDE5LDE1MywyMTgsMjU1LDE2LDEzMiw0LDE0MiwxMjMsMjE2LDIxOSwyMzMsMjQ4LDg5XX19fSx7Im5hbWUiOiJ0b2tlbl9wcm9ncmFtIiwiYWRkcmVzcyI6IlRva2VuelFkQk5iTHFQNVZFaGRrQVM2RVBGTEMxUEhuQnFDWEVwUHh1RWIifSx7Im5hbWUiOiJhc3NvY2lhdGVkX3Rva2VuX3Byb2dyYW0iLCJhZGRyZXNzIjoiQVRva2VuR1B2YmRHVnhyMWIyaHZaYnNpcVc1eFdIMjVlZlROc0xKQThrbkwifSx7Im5hbWUiOiJzeXN0ZW1fcHJvZ3JhbSIsImFkZHJlc3MiOiIxMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMSJ9XSwiYXJncyI6W3sibmFtZSI6ImFtb3VudCIsInR5cGUiOiJ1NjQifV19LHsibmFtZSI6IndpdGhkcmF3IiwiZGlzY3JpbWluYXRvciI6WzE4MywxOCw3MCwxNTYsMTQ4LDEwOSwxNjEsMzRdLCJhY2NvdW50cyI6W3sibmFtZSI6InVzZXIiLCJ3cml0YWJsZSI6dHJ1ZSwic2lnbmVyIjp0cnVlfSx7Im5hbWUiOiJwcm90b2NvbCIsIndyaXRhYmxlIjp0cnVlLCJwZGEiOnsic2VlZHMiOlt7ImtpbmQiOiJjb25zdCIsInZhbHVlIjpbMTEyLDExNCwxMTEsMTE2LDExMSw5OSwxMTEsMTA4LDQ2LDExOCw1MF19XX19LHsibmFtZSI6InVzZGNfbWludCJ9LHsibmFtZSI6ImxwX21pbnQiLCJ3cml0YWJsZSI6dHJ1ZX0seyJuYW1lIjoicG9vbF91c2RjIiwid3JpdGFibGUiOnRydWV9LHsibmFtZSI6InVzZXJfdXNkYyIsIndyaXRhYmxlIjp0cnVlLCJwZGEiOnsic2VlZHMiOlt7ImtpbmQiOiJhY2NvdW50IiwicGF0aCI6InVzZXIifSx7ImtpbmQiOiJhY2NvdW50IiwicGF0aCI6InRva2VuX3Byb2dyYW0ifSx7ImtpbmQiOiJhY2NvdW50IiwicGF0aCI6InVzZGNfbWludCJ9XSwicHJvZ3JhbSI6eyJraW5kIjoiY29uc3QiLCJ2YWx1ZSI6WzE0MCwxNTEsMzcsMTQzLDc4LDM2LDEzNywyNDEsMTg3LDYxLDE2LDQxLDIwLDE0MiwxMywxMzEsMTEsOTAsMTksMTUzLDIxOCwyNTUsMTYsMTMyLDQsMTQyLDEyMywyMTYsMjE5LDIzMywyNDgsODldfX19LHsibmFtZSI6InVzZXJfbHAiLCJ3cml0YWJsZSI6dHJ1ZSwicGRhIjp7InNlZWRzIjpbeyJraW5kIjoiYWNjb3VudCIsInBhdGgiOiJ1c2VyIn0seyJraW5kIjoiYWNjb3VudCIsInBhdGgiOiJ0b2tlbl9wcm9ncmFtIn0seyJraW5kIjoiYWNjb3VudCIsInBhdGgiOiJscF9taW50In1dLCJwcm9ncmFtIjp7ImtpbmQiOiJjb25zdCIsInZhbHVlIjpbMTQwLDE1MSwzNywxNDMsNzgsMzYsMTM3LDI0MSwxODcsNjEsMTYsNDEsMjAsMTQyLDEzLDEzMSwxMSw5MCwxOSwxNTMsMjE4LDI1NSwxNiwxMzIsNCwxNDIsMTIzLDIxNiwyMTksMjMzLDI0OCw4OV19fX0seyJuYW1lIjoidG9rZW5fcHJvZ3JhbSIsImFkZHJlc3MiOiJUb2tlbnpRZEJOYkxxUDVWRWhka0FTNkVQRkxDMVBIbkJxQ1hFcFB4dUViIn0seyJuYW1lIjoiYXNzb2NpYXRlZF90b2tlbl9wcm9ncmFtIiwiYWRkcmVzcyI6IkFUb2tlbkdQdmJkR1Z4cjFiMmh2WmJzaXFXNXhXSDI1ZWZUTnNMSkE4a25MIn0seyJuYW1lIjoic3lzdGVtX3Byb2dyYW0iLCJhZGRyZXNzIjoiMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTEifV0sImFyZ3MiOlt7Im5hbWUiOiJscCIsInR5cGUiOiJ1NjQifV19XSwiYWNjb3VudHMiOlt7Im5hbWUiOiJDcmVDb25maWciLCJkaXNjcmltaW5hdG9yIjpbMjIzLDE1NSwxMzUsMTYzLDM3LDgyLDEyNCw3OF19LHsibmFtZSI6Ik1hcmtldCIsImRpc2NyaW1pbmF0b3IiOlsyMTksMTkwLDIxMyw1NSwwLDIyNywxOTgsMTU0XX0seyJuYW1lIjoiUG9zaXRpb24iLCJkaXNjcmltaW5hdG9yIjpbMTcwLDE4OCwxNDMsMjI4LDEyMiw2NCwyNDcsMjA4XX0seyJuYW1lIjoiUHJvdG9jb2wiLCJkaXNjcmltaW5hdG9yIjpbNDUsMzksMTAxLDQzLDExNSw3MiwxMzEsNDBdfV0sImV2ZW50cyI6W3sibmFtZSI6IkFnZW50QWN0ZWQiLCJkaXNjcmltaW5hdG9yIjpbMTM3LDE3LDUzLDE2MywxNzksMTk4LDE2LDE3M119LHsibmFtZSI6IkFtcGxpZnlDbG9zZWQiLCJkaXNjcmltaW5hdG9yIjpbMTA4LDQ1LDE4OCw4LDE5NCwyMjYsODcsMjMwXX0seyJuYW1lIjoiQW1wbGlmeU9wZW5lZCIsImRpc2NyaW1pbmF0b3IiOlsyMzksMTk4LDE4NSwxNywxMDYsNDUsNzYsMTNdfSx7Im5hbWUiOiJDcmVSZXBvcnRSZWNlaXZlZCIsImRpc2NyaW1pbmF0b3IiOls0NywxODksMTQzLDU0LDkwLDk3LDE1LDE5OF19LHsibmFtZSI6IkVhcm5DbG9zZWQiLCJkaXNjcmltaW5hdG9yIjpbNTMsMTUxLDc5LDE5NywyNDAsMSwyMjgsMjE3XX0seyJuYW1lIjoiRWFybkRlcG9zaXRlZCIsImRpc2NyaW1pbmF0b3IiOlsxNjEsNSwxOTAsMTM3LDE1NCwxOTYsMTgsMTFdfSx7Im5hbWUiOiJMaXF1aWRhdGVkIiwiZGlzY3JpbWluYXRvciI6WzIzMSw1Nyw1NSw3NSwwLDE3MCwyNDYsNjhdfSx7Im5hbWUiOiJQcmljZVB1c2hlZCIsImRpc2NyaW1pbmF0b3IiOls4MiwxNjMsMzgsMTMsODMsOTQsMTE1LDExOF19LHsibmFtZSI6IlN1cHBsaWVkIiwiZGlzY3JpbWluYXRvciI6WzEzNywxMTQsMjM5LDcyLDE2Miw3NSwxMzMsMzldfSx7Im5hbWUiOiJXaXRoZHJhd24iLCJkaXNjcmltaW5hdG9yIjpbMjAsODksMjIzLDE5OCwxOTQsMTI0LDIxOSwxM119XSwiZXJyb3JzIjpbeyJjb2RlIjo2MDAwLCJuYW1lIjoiTWF0aE92ZXJmbG93IiwibXNnIjoiTWF0aCBvdmVyZmxvdyJ9LHsiY29kZSI6NjAwMSwibmFtZSI6Ilplcm9BbW91bnQiLCJtc2ciOiJBbW91bnQgbXVzdCBiZSBhYm92ZSB6ZXJvIn0seyJjb2RlIjo2MDAyLCJuYW1lIjoiTm90QWRtaW4iLCJtc2ciOiJPbmx5IHRoZSBhZG1pbiJ9LHsiY29kZSI6NjAwMywibmFtZSI6Ik5vdEtlZXBlciIsIm1zZyI6Ik9ubHkgdGhlIGtlZXBlciJ9LHsiY29kZSI6NjAwNCwibmFtZSI6Ik5vdE93bmVyIiwibXNnIjoiT25seSB0aGUgcG9zaXRpb24gb3duZXIifSx7ImNvZGUiOjYwMDUsIm5hbWUiOiJCYWRQYXJhbXMiLCJtc2ciOiJNYXJrZXQgcGFyYW1ldGVycyBvdXQgb2YgcmFuZ2UifSx7ImNvZGUiOjYwMDYsIm5hbWUiOiJOb1ByaWNlIiwibXNnIjoiTm8gcHJpY2UgcHVzaGVkIHlldCJ9LHsiY29kZSI6NjAwNywibmFtZSI6IlN0YWxlUHJpY2UiLCJtc2ciOiJQcmljZSBpcyBzdGFsZTogYm9ycm93aW5nIHdhaXRzIGZvciBhIGZyZXNoIG9uZSJ9LHsiY29kZSI6NjAwOCwibmFtZSI6IlByaWNlSnVtcFRvb0xhcmdlIiwibXNnIjoiUHJpY2UgbW92ZWQgbW9yZSB0aGFuIHRoZSBwZXItcHVzaCBib3VuZCJ9LHsiY29kZSI6NjAwOSwibmFtZSI6IkJhZFB1Ymxpc2hUaW1lIiwibXNnIjoiUHVibGlzaCB0aW1lIGdvZXMgYmFja3dhcmRzIG9yIGludG8gdGhlIGZ1dHVyZSJ9LHsiY29kZSI6NjAxMCwibmFtZSI6IlRhcmdldFRvb0hpZ2giLCJtc2ciOiJUYXJnZXQgTFRWIGFib3ZlIHdoYXQgdGhlIG1hcmtldCBhbGxvd3MgcmlnaHQgbm93In0seyJjb2RlIjo2MDExLCJuYW1lIjoiTGV2ZXJhZ2VPdXRPZlJhbmdlIiwibXNnIjoiTGV2ZXJhZ2Ugb3V0IG9mIHJhbmdlIGZvciB0aGlzIG1hcmtldCJ9LHsiY29kZSI6NjAxMiwibmFtZSI6IlBvb2xJbGxpcXVpZCIsIm1zZyI6Ik5vdCBlbm91Z2ggVVNEQyBpbiB0aGUgcG9vbCJ9LHsiY29kZSI6NjAxMywibmFtZSI6Ikx0dkV4Y2VlZGVkIiwibXNnIjoiVGhpcyB3b3VsZCB0YWtlIHRoZSBwb3NpdGlvbiBhYm92ZSB0aGUgbWFya2V0J3MgTFRWIn0seyJjb2RlIjo2MDE0LCJuYW1lIjoiQWxyZWFkeU9uVGFyZ2V0IiwibXNnIjoiQWxyZWFkeSB3aXRoaW4gdGhlIGJhbmQgYXJvdW5kIHRoZSB0YXJnZXQifSx7ImNvZGUiOjYwMTUsIm5hbWUiOiJOb3RoaW5nVG9EZWxldmVyYWdlIiwibXNnIjoiTm8geWllbGQgYnVmZmVyIGxlZnQgdG8gcmVwYXkgZnJvbTogdGhlIHN0b2NrIGlzIG5ldmVyIHNvbGQgdG8gcmViYWxhbmNlIn0seyJjb2RlIjo2MDE2LCJuYW1lIjoiTm90aGluZ1RvQ29tcG91bmQiLCJtc2ciOiJObyB5aWVsZCBhYm92ZSB0aGUgZGVidCB0byBjb21wb3VuZCB5ZXQifSx7ImNvZGUiOjYwMTcsIm5hbWUiOiJIZWFsdGh5IiwibXNnIjoiUG9zaXRpb24gaXMgaGVhbHRoeSJ9LHsiY29kZSI6NjAxOCwibmFtZSI6IlVuZGVyd2F0ZXIiLCJtc2ciOiJDb2xsYXRlcmFsIGRvZXMgbm90IGNvdmVyIHRoZSBkZWJ0In0seyJjb2RlIjo2MDE5LCJuYW1lIjoiV3JvbmdLaW5kIiwibXNnIjoiV3JvbmcgcG9zaXRpb24ga2luZCBmb3IgdGhpcyBpbnN0cnVjdGlvbiJ9LHsiY29kZSI6NjAyMCwibmFtZSI6IldpdGhkcmF3VG9vTGFyZ2UiLCJtc2ciOiJUb28gbWFueSBMUCBzaGFyZXMgZm9yIHRoZSBwb29sJ3MgZnJlZSBjYXNoIn0seyJjb2RlIjo2MDIxLCJuYW1lIjoiSW52YWxpZEZvcndhcmRlciIsIm1zZyI6IlJlcG9ydCBkaWQgbm90IGNvbWUgdGhyb3VnaCB0aGUgY29uZmlndXJlZCBDaGFpbmxpbmsgZm9yd2FyZGVyIn0seyJjb2RlIjo2MDIyLCJuYW1lIjoiSW52YWxpZEZvcndhcmRlckF1dGhvcml0eSIsIm1zZyI6ImZvcndhcmRlcl9hdXRob3JpdHkgaXMgbm90IHRoZSBmb3J3YXJkZXIncyBQREEgZm9yIHRoaXMgc3RhdGUgYW5kIHByb2dyYW0ifSx7ImNvZGUiOjYwMjMsIm5hbWUiOiJJbnZhbGlkV29ya2Zsb3dPd25lciIsIm1zZyI6IlJlcG9ydCBjb21lcyBmcm9tIGFub3RoZXIgd29ya2Zsb3cgb3duZXIifSx7ImNvZGUiOjYwMjQsIm5hbWUiOiJJbnZhbGlkUmVwb3J0IiwibXNnIjoiUmVwb3J0IG1ldGFkYXRhIG9yIHBheWxvYWQgY291bGQgbm90IGJlIGRlY29kZWQifSx7ImNvZGUiOjYwMjUsIm5hbWUiOiJNYXJrZXROb3RJblJlcG9ydCIsIm1zZyI6Ik5vIG1hcmtldCBpbiB0aGUgYWNjb3VudHMgZm9yIGEgc3ltYm9sIGluIHRoZSByZXBvcnQifV0sInR5cGVzIjpbeyJuYW1lIjoiQWdlbnRBY3RlZCIsInR5cGUiOnsia2luZCI6InN0cnVjdCIsImZpZWxkcyI6W3sibmFtZSI6ImFnZW50IiwidHlwZSI6InB1YmtleSJ9LHsibmFtZSI6InBvc2l0aW9uIiwidHlwZSI6InB1YmtleSJ9LHsibmFtZSI6Im9wIiwidHlwZSI6InU4In0seyJuYW1lIjoiYW1vdW50IiwidHlwZSI6InU2NCJ9XX19LHsibmFtZSI6IkFtcGxpZnlDbG9zZWQiLCJ0eXBlIjp7ImtpbmQiOiJzdHJ1Y3QiLCJmaWVsZHMiOlt7Im5hbWUiOiJvd25lciIsInR5cGUiOiJwdWJrZXkifSx7Im5hbWUiOiJtYXJrZXQiLCJ0eXBlIjoicHVia2V5In0seyJuYW1lIjoicmVwYWlkIiwidHlwZSI6InU2NCJ9LHsibmFtZSI6InN0b2NrX3NvbGQiLCJ0eXBlIjoidTY0In0seyJuYW1lIjoic3RvY2tfb3V0IiwidHlwZSI6InU2NCJ9XX19LHsibmFtZSI6IkFtcGxpZnlPcGVuZWQiLCJ0eXBlIjp7ImtpbmQiOiJzdHJ1Y3QiLCJmaWVsZHMiOlt7Im5hbWUiOiJvd25lciIsInR5cGUiOiJwdWJrZXkifSx7Im5hbWUiOiJtYXJrZXQiLCJ0eXBlIjoicHVia2V5In0seyJuYW1lIjoic3RvY2tfaW4iLCJ0eXBlIjoidTY0In0seyJuYW1lIjoic3RvY2tfYm91Z2h0IiwidHlwZSI6InU2NCJ9LHsibmFtZSI6ImRlYnQiLCJ0eXBlIjoidTY0In0seyJuYW1lIjoibGV2ZXJhZ2VfYnBzIiwidHlwZSI6InUxNiJ9XX19LHsibmFtZSI6IkNyZUNvbmZpZyIsImRvY3MiOlsiV2hlcmUgQ2hhaW5saW5rIENSRSByZXBvcnRzIG1heSBjb21lIGZyb20uIFRoZSBLZXlzdG9uZSBGb3J3YXJkZXIgdmVyaWZpZXMiLCJ0aGUgRE9OJ3Mgc2lnbmF0dXJlcywgdGhlbiBDUElzIGBvbl9yZXBvcnRgIHNpZ25lZCBieSBhIFBEQSBvZiIsImBbXCJmb3J3YXJkZXJcIiwgZm9yd2FyZGVyX3N0YXRlLCB0aGlzIHByb2dyYW1dYDsgdGhlIHJlY2VpdmVyIGNoZWNrcyB0aGF0IFBEQSIsImFuZCB0aGUgd29ya2Zsb3cgb3duZXIgaW4gdGhlIG1ldGFkYXRhLiJdLCJ0eXBlIjp7ImtpbmQiOiJzdHJ1Y3QiLCJmaWVsZHMiOlt7Im5hbWUiOiJmb3J3YXJkZXJfcHJvZ3JhbSIsInR5cGUiOiJwdWJrZXkifSx7Im5hbWUiOiJmb3J3YXJkZXJfc3RhdGUiLCJ0eXBlIjoicHVia2V5In0seyJuYW1lIjoid29ya2Zsb3dfb3duZXIiLCJkb2NzIjpbIkVWTS1zdHlsZSBhZGRyZXNzIG9mIHRoZSB3b3JrZmxvdyBvd25lciwgYXMgQ1JFIHB1dHMgaXQgaW4gdGhlIiwibWV0YWRhdGEuIEFsbCB6ZXJvIGFjY2VwdHMgYW55IG93bmVyLiJdLCJ0eXBlIjp7ImFycmF5IjpbInU4IiwyMF19fSx7Im5hbWUiOiJzaW11bGF0aW9uIiwiZG9jcyI6WyJUcnVlIHdoaWxlIHRoZSBmb3J3YXJkZXIgaXMgdGhlIENMSSdzIG1vY2s6IGl0IHJlbGF5cyB3aXRob3V0IGNoZWNraW5nIiwic2lnbmF0dXJlcywgc28gcmVwb3J0cyBhcmUgb25seSBhcyB0cnVzdGVkIGFzIHRoZSBwZXItcHVzaCBib3VuZHMuIl0sInR5cGUiOiJib29sIn0seyJuYW1lIjoiYnVtcCIsInR5cGUiOiJ1OCJ9LHsibmFtZSI6InJlcG9ydHMiLCJ0eXBlIjoidTY0In0seyJuYW1lIjoibGFzdF9yZXBvcnRfYXQiLCJ0eXBlIjoiaTY0In1dfX0seyJuYW1lIjoiQ3JlUmVwb3J0UmVjZWl2ZWQiLCJ0eXBlIjp7ImtpbmQiOiJzdHJ1Y3QiLCJmaWVsZHMiOlt7Im5hbWUiOiJ3b3JrZmxvd19vd25lciIsInR5cGUiOnsiYXJyYXkiOlsidTgiLDIwXX19LHsibmFtZSI6InNpbXVsYXRpb24iLCJ0eXBlIjoiYm9vbCJ9LHsibmFtZSI6InJlcG9ydCIsInR5cGUiOnsiZGVmaW5lZCI6eyJuYW1lIjoiUHJpY2VSZXBvcnQifX19XX19LHsibmFtZSI6IkVhcm5DbG9zZWQiLCJ0eXBlIjp7ImtpbmQiOiJzdHJ1Y3QiLCJmaWVsZHMiOlt7Im5hbWUiOiJvd25lciIsInR5cGUiOiJwdWJrZXkifSx7Im5hbWUiOiJtYXJrZXQiLCJ0eXBlIjoicHVia2V5In0seyJuYW1lIjoicmVwYWlkIiwidHlwZSI6InU2NCJ9LHsibmFtZSI6ImZyb21fYnVmZmVyIiwidHlwZSI6InU2NCJ9LHsibmFtZSI6ImZyb21fd2FsbGV0IiwidHlwZSI6InU2NCJ9LHsibmFtZSI6InVzZGNfb3V0IiwidHlwZSI6InU2NCJ9LHsibmFtZSI6InN0b2NrX291dCIsInR5cGUiOiJ1NjQifV19fSx7Im5hbWUiOiJFYXJuRGVwb3NpdGVkIiwidHlwZSI6eyJraW5kIjoic3RydWN0IiwiZmllbGRzIjpbeyJuYW1lIjoib3duZXIiLCJ0eXBlIjoicHVia2V5In0seyJuYW1lIjoibWFya2V0IiwidHlwZSI6InB1YmtleSJ9LHsibmFtZSI6InN0b2NrIiwidHlwZSI6InU2NCJ9LHsibmFtZSI6ImJvcnJvd2VkIiwidHlwZSI6InU2NCJ9LHsibmFtZSI6InRhcmdldF9sdHZfYnBzIiwidHlwZSI6InUxNiJ9XX19LHsibmFtZSI6IkxpcXVpZGF0ZWQiLCJ0eXBlIjp7ImtpbmQiOiJzdHJ1Y3QiLCJmaWVsZHMiOlt7Im5hbWUiOiJsaXF1aWRhdG9yIiwidHlwZSI6InB1YmtleSJ9LHsibmFtZSI6InBvc2l0aW9uIiwidHlwZSI6InB1YmtleSJ9LHsibmFtZSI6InJlcGFpZCIsInR5cGUiOiJ1NjQifSx7Im5hbWUiOiJzZWl6ZWQiLCJ0eXBlIjoidTY0In1dfX0seyJuYW1lIjoiTWFya2V0IiwidHlwZSI6eyJraW5kIjoic3RydWN0IiwiZmllbGRzIjpbeyJuYW1lIjoic3RvY2tfbWludCIsInR5cGUiOiJwdWJrZXkifSx7Im5hbWUiOiJjdXN0b2R5IiwidHlwZSI6InB1YmtleSJ9LHsibmFtZSI6InN5bWJvbCIsInR5cGUiOnsiYXJyYXkiOlsidTgiLDhdfX0seyJuYW1lIjoiYnVtcCIsInR5cGUiOiJ1OCJ9LHsibmFtZSI6Imx0dl9icHMiLCJ0eXBlIjoidTE2In0seyJuYW1lIjoibHRfYnBzIiwidHlwZSI6InUxNiJ9LHsibmFtZSI6ImxpcV9ib251c19icHMiLCJ0eXBlIjoidTE2In0seyJuYW1lIjoib2ZmaG91cnNfYnVmZmVyX2JwcyIsImRvY3MiOlsiVGFrZW4gb2ZmIGJvdGggTFRWIGFuZCB0aHJlc2hvbGQgd2hpbGUgdGhlIHNoYXJlIGRvZXMgbm90IHRyYWRlLiJdLCJ0eXBlIjoidTE2In0seyJuYW1lIjoicHJpY2VfZTgiLCJ0eXBlIjoidTY0In0seyJuYW1lIjoicHJpY2VfdGltZSIsImRvY3MiOlsiUHVibGlzaCB0aW1lIG9mIHRoZSBzb3VyY2UgdGhlIHByaWNlIGNhbWUgZnJvbS4iXSwidHlwZSI6Imk2NCJ9LHsibmFtZSI6InNlc3Npb25fb3BlbiIsInR5cGUiOiJib29sIn0seyJuYW1lIjoibWF4X2FnZSIsInR5cGUiOiJ1MzIifSx7Im5hbWUiOiJtYXhfanVtcF9icHMiLCJ0eXBlIjoidTE2In0seyJuYW1lIjoidG90YWxfY29sbGF0ZXJhbCIsInR5cGUiOiJ1NjQifSx7Im5hbWUiOiJ0b3RhbF9zY2FsZWRfZGVidCIsInR5cGUiOiJ1MTI4In1dfX0seyJuYW1lIjoiTWFya2V0UGFyYW1zIiwidHlwZSI6eyJraW5kIjoic3RydWN0IiwiZmllbGRzIjpbeyJuYW1lIjoibHR2X2JwcyIsInR5cGUiOiJ1MTYifSx7Im5hbWUiOiJsdF9icHMiLCJ0eXBlIjoidTE2In0seyJuYW1lIjoibGlxX2JvbnVzX2JwcyIsInR5cGUiOiJ1MTYifSx7Im5hbWUiOiJvZmZob3Vyc19idWZmZXJfYnBzIiwidHlwZSI6InUxNiJ9LHsibmFtZSI6Im1heF9hZ2UiLCJ0eXBlIjoidTMyIn0seyJuYW1lIjoibWF4X2p1bXBfYnBzIiwidHlwZSI6InUxNiJ9XX19LHsibmFtZSI6IlBvc2l0aW9uIiwidHlwZSI6eyJraW5kIjoic3RydWN0IiwiZmllbGRzIjpbeyJuYW1lIjoib3duZXIiLCJ0eXBlIjoicHVia2V5In0seyJuYW1lIjoibWFya2V0IiwidHlwZSI6InB1YmtleSJ9LHsibmFtZSI6ImtpbmQiLCJ0eXBlIjoidTgifSx7Im5hbWUiOiJidW1wIiwidHlwZSI6InU4In0seyJuYW1lIjoiY29sbGF0ZXJhbCIsImRvY3MiOlsiU3RvY2sgcGxlZGdlZCwgaW4gdGhlIHN0b2NrJ3MgYmFzZSB1bml0cyAoOCBkZWNpbWFscykuIl0sInR5cGUiOiJ1NjQifSx7Im5hbWUiOiJzY2FsZWRfZGVidCIsInR5cGUiOiJ1MTI4In0seyJuYW1lIjoic2hhcmVzIiwiZG9jcyI6WyJFYXJuIG9ubHk6IHZhdWx0IHNoYXJlcyBib3VnaHQgd2l0aCB0aGUgYm9ycm93ZWQgVVNEQy4gQSBmcmVlIGJ1ZmZlciwiLCJub3QgcGxlZGdlZDogaXQgcmVwYXlzIHRoZSBkZWJ0IGJlZm9yZSB0aGUgc3RvY2sgaXMgZXZlciBzb2xkLiJdLCJ0eXBlIjoidTY0In0seyJuYW1lIjoidGFyZ2V0X2x0dl9icHMiLCJkb2NzIjpbIlRoZSBsZXZlbCB0aGUgb3duZXIgcGlja2VkLiBUaGUgYWdlbnRzIGhvbGQgdGhlIHBvc2l0aW9uIHRoZXJlLiJdLCJ0eXBlIjoidTE2In0seyJuYW1lIjoibGV2ZXJhZ2VfYnBzIiwiZG9jcyI6WyJBbXBsaWZ5IG9ubHk6IHRoZSBsb29wIG11bHRpcGxlLCAxMF8wMDAgPSAxeC4iXSwidHlwZSI6InUxNiJ9LHsibmFtZSI6ImRlcG9zaXRlZCIsInR5cGUiOiJ1NjQifSx7Im5hbWUiOiJzdG9ja19mcm9tX3lpZWxkIiwidHlwZSI6InU2NCJ9LHsibmFtZSI6Im9wZW5lZF9hdCIsInR5cGUiOiJpNjQifSx7Im5hbWUiOiJsYXN0X2FnZW50X2F0IiwidHlwZSI6Imk2NCJ9LHsibmFtZSI6Imxhc3RfYWdlbnQiLCJ0eXBlIjoicHVia2V5In0seyJuYW1lIjoibGFzdF9hZ2VudF9vcCIsInR5cGUiOiJ1OCJ9LHsibmFtZSI6Imxhc3RfYWdlbnRfYW1vdW50IiwidHlwZSI6InU2NCJ9XX19LHsibmFtZSI6IlByaWNlUHVzaGVkIiwidHlwZSI6eyJraW5kIjoic3RydWN0IiwiZmllbGRzIjpbeyJuYW1lIjoibWFya2V0IiwidHlwZSI6InB1YmtleSJ9LHsibmFtZSI6InByaWNlX2U4IiwidHlwZSI6InU2NCJ9LHsibmFtZSI6InB1Ymxpc2hfdGltZSIsInR5cGUiOiJpNjQifSx7Im5hbWUiOiJzZXNzaW9uX29wZW4iLCJ0eXBlIjoiYm9vbCJ9XX19LHsibmFtZSI6IlByaWNlUmVwb3J0IiwiZG9jcyI6WyJUaGUgQm9yc2ggcGF5bG9hZCBhIENSRSB3b3JrZmxvdyB3cml0ZXM6IGEgZmV3IG1hcmtldHMgcGVyIHJlcG9ydCwgc2luY2UgYSIsIlNvbGFuYSB0cmFuc2FjdGlvbiBsZWF2ZXMgdGhlIGZvcndhcmRlciB+MjY1IGJ5dGVzIG9uY2UgYWNjb3VudHMgYXJlIHBhaWQuIl0sInR5cGUiOnsia2luZCI6InN0cnVjdCIsImZpZWxkcyI6W3sibmFtZSI6InVwZGF0ZXMiLCJ0eXBlIjp7InZlYyI6eyJkZWZpbmVkIjp7Im5hbWUiOiJQcmljZVVwZGF0ZSJ9fX19XX19LHsibmFtZSI6IlByaWNlVXBkYXRlIiwiZG9jcyI6WyJPbmUgcHJpY2UgaW4gYSBDUkUgcmVwb3J0LiJdLCJ0eXBlIjp7ImtpbmQiOiJzdHJ1Y3QiLCJmaWVsZHMiOlt7Im5hbWUiOiJzeW1ib2wiLCJ0eXBlIjp7ImFycmF5IjpbInU4Iiw4XX19LHsibmFtZSI6InByaWNlX2U4IiwidHlwZSI6InU2NCJ9LHsibmFtZSI6InB1Ymxpc2hfdGltZSIsInR5cGUiOiJpNjQifSx7Im5hbWUiOiJzZXNzaW9uX29wZW4iLCJ0eXBlIjoiYm9vbCJ9XX19LHsibmFtZSI6IlByb3RvY29sIiwiZG9jcyI6WyJUaGUgbGVuZGluZyBwb29sLCB0aGUgcHJpdmF0ZSBjcmVkaXQgdmF1bHQgYW5kIGV2ZXJ5IG1pbnQgdGhlIHByb2dyYW0iLCJjb250cm9scyBoYW5nIG9mZiB0aGlzIG9uZSBQREEuIEl0IHNpZ25zIGZvciBhbGwgb2YgdGhlbS4iXSwidHlwZSI6eyJraW5kIjoic3RydWN0IiwiZmllbGRzIjpbeyJuYW1lIjoiYWRtaW4iLCJ0eXBlIjoicHVia2V5In0seyJuYW1lIjoia2VlcGVyIiwiZG9jcyI6WyJQdXNoZXMgcHJpY2VzLiBCb3VuZGVkIG9uIGNoYWluLCBzbyBhIGJhZCBrZWVwZXIgY2FuIGRyaWZ0IGEgcHJpY2UgYnkiLCJhdCBtb3N0IGBtYXhfanVtcF9icHNgIHBlciBwdXNoLCBuZXZlciBzZXQgaXQuIl0sInR5cGUiOiJwdWJrZXkifSx7Im5hbWUiOiJ1c2RjX21pbnQiLCJ0eXBlIjoicHVia2V5In0seyJuYW1lIjoibHBfbWludCIsInR5cGUiOiJwdWJrZXkifSx7Im5hbWUiOiJwb29sX3VzZGMiLCJ0eXBlIjoicHVia2V5In0seyJuYW1lIjoidmF1bHRfdXNkYyIsInR5cGUiOiJwdWJrZXkifSx7Im5hbWUiOiJidW1wIiwidHlwZSI6InU4In0seyJuYW1lIjoiY2FzaCIsImRvY3MiOlsiVVNEQyB0aGUgcG9vbCBob2xkcyBhbmQgY2FuIGxlbmQuIl0sInR5cGUiOiJ1NjQifSx7Im5hbWUiOiJ0b3RhbF9zY2FsZWRfZGVidCIsInR5cGUiOiJ1MTI4In0seyJuYW1lIjoiYm9ycm93X2luZGV4IiwiZG9jcyI6WyJHcm93cyB3aXRoIHRoZSBib3Jyb3cgcmF0ZS4gRGVidCA9IHNjYWxlZCAqIGluZGV4IC8gV0FELiJdLCJ0eXBlIjoidTEyOCJ9LHsibmFtZSI6Imxhc3RfYWNjcnVhbCIsInR5cGUiOiJpNjQifSx7Im5hbWUiOiJiYXNlX3JhdGVfYnBzIiwidHlwZSI6InUzMiJ9LHsibmFtZSI6InNsb3BlMV9icHMiLCJ0eXBlIjoidTMyIn0seyJuYW1lIjoic2xvcGUyX2JwcyIsInR5cGUiOiJ1MzIifSx7Im5hbWUiOiJraW5rX2JwcyIsInR5cGUiOiJ1MzIifSx7Im5hbWUiOiJtaW5fYm9ycm93IiwidHlwZSI6InU2NCJ9LHsibmFtZSI6InZhdWx0X3NoYXJlcyIsInR5cGUiOiJ1NjQifSx7Im5hbWUiOiJuYXZfd2FkIiwiZG9jcyI6WyJVU0RDIHBlciBzaGFyZSwgV0FELiBBY2NydWVzIGF0IGB2YXVsdF9hcHJfYnBzYC4iXSwidHlwZSI6InUxMjgifSx7Im5hbWUiOiJ2YXVsdF9hcHJfYnBzIiwidHlwZSI6InUzMiJ9LHsibmFtZSI6InZhdWx0X2Nhc2giLCJkb2NzIjpbIlVTREMgYWN0dWFsbHkgc2l0dGluZyBpbiB0aGUgdmF1bHQgYWNjb3VudC4iXSwidHlwZSI6InU2NCJ9LHsibmFtZSI6ImNvdXBvbnNfcGFpZCIsImRvY3MiOlsiQ291cG9ucyB0aGUgY3JlZGl0IGJvb2sgcGFpZCBpbnRvIHRoZSB2YXVsdCAoZGV2bmV0IHN0YW5kLWluOiBtaW50ZWQpLiJdLCJ0eXBlIjoidTY0In0seyJuYW1lIjoibWluX2NvbXBvdW5kIiwidHlwZSI6InU2NCJ9LHsibmFtZSI6ImRleF9mZWVfYnBzIiwidHlwZSI6InUzMiJ9LHsibmFtZSI6Im1hcmtldF9jb3VudCIsInR5cGUiOiJ1OCJ9XX19LHsibmFtZSI6IlByb3RvY29sUGFyYW1zIiwidHlwZSI6eyJraW5kIjoic3RydWN0IiwiZmllbGRzIjpbeyJuYW1lIjoia2VlcGVyIiwidHlwZSI6InB1YmtleSJ9LHsibmFtZSI6ImJhc2VfcmF0ZV9icHMiLCJ0eXBlIjoidTMyIn0seyJuYW1lIjoic2xvcGUxX2JwcyIsInR5cGUiOiJ1MzIifSx7Im5hbWUiOiJzbG9wZTJfYnBzIiwidHlwZSI6InUzMiJ9LHsibmFtZSI6ImtpbmtfYnBzIiwidHlwZSI6InUzMiJ9LHsibmFtZSI6InZhdWx0X2Fwcl9icHMiLCJ0eXBlIjoidTMyIn0seyJuYW1lIjoibWluX2JvcnJvdyIsInR5cGUiOiJ1NjQifSx7Im5hbWUiOiJtaW5fY29tcG91bmQiLCJ0eXBlIjoidTY0In0seyJuYW1lIjoiZGV4X2ZlZV9icHMiLCJ0eXBlIjoidTMyIn1dfX0seyJuYW1lIjoiU3VwcGxpZWQiLCJ0eXBlIjp7ImtpbmQiOiJzdHJ1Y3QiLCJmaWVsZHMiOlt7Im5hbWUiOiJ1c2VyIiwidHlwZSI6InB1YmtleSJ9LHsibmFtZSI6InVzZGMiLCJ0eXBlIjoidTY0In0seyJuYW1lIjoibHAiLCJ0eXBlIjoidTY0In1dfX0seyJuYW1lIjoiV2l0aGRyYXduIiwidHlwZSI6eyJraW5kIjoic3RydWN0IiwiZmllbGRzIjpbeyJuYW1lIjoidXNlciIsInR5cGUiOiJwdWJrZXkifSx7Im5hbWUiOiJ1c2RjIiwidHlwZSI6InU2NCJ9LHsibmFtZSI6ImxwIiwidHlwZSI6InU2NCJ9XX19XX0='

const DISCRIMINATOR_SIZE = 8

const expectDiscriminator = (label: string, expected: Uint8Array, data: Uint8Array): Uint8Array => {
  if (data.length < DISCRIMINATOR_SIZE) {
    throw new Error(`${label}: data too short for discriminator (${data.length} bytes)`)
  }
  for (let i = 0; i < DISCRIMINATOR_SIZE; i++) {
    if (data[i] !== expected[i]) {
      throw new Error(`${label}: discriminator mismatch`)
    }
  }
  return data.subarray(DISCRIMINATOR_SIZE)
}

export type AgentActed = {
  agent: Address
  position: Address
  op: number
  amount: bigint
}

export const agentActedCodec = getStructCodec([
  ['agent', getAddressCodec()],
  ['position', getAddressCodec()],
  ['op', getU8Codec()],
  ['amount', getU64Codec()],
])

export type AmplifyClosed = {
  owner: Address
  market: Address
  repaid: bigint
  stockSold: bigint
  stockOut: bigint
}

export const amplifyClosedCodec = getStructCodec([
  ['owner', getAddressCodec()],
  ['market', getAddressCodec()],
  ['repaid', getU64Codec()],
  ['stockSold', getU64Codec()],
  ['stockOut', getU64Codec()],
])

export type AmplifyOpened = {
  owner: Address
  market: Address
  stockIn: bigint
  stockBought: bigint
  debt: bigint
  leverageBps: number
}

export const amplifyOpenedCodec = getStructCodec([
  ['owner', getAddressCodec()],
  ['market', getAddressCodec()],
  ['stockIn', getU64Codec()],
  ['stockBought', getU64Codec()],
  ['debt', getU64Codec()],
  ['leverageBps', getU16Codec()],
])

export type CreConfig = {
  forwarderProgram: Address
  forwarderState: Address
  workflowOwner: number[]
  simulation: boolean
  bump: number
  reports: bigint
  lastReportAt: bigint
}

export const creConfigCodec = getStructCodec([
  ['forwarderProgram', getAddressCodec()],
  ['forwarderState', getAddressCodec()],
  ['workflowOwner', getArrayCodec(getU8Codec(), { size: 20 })],
  ['simulation', getBooleanCodec()],
  ['bump', getU8Codec()],
  ['reports', getU64Codec()],
  ['lastReportAt', getI64Codec()],
])

export type PriceUpdate = {
  symbol: number[]
  priceE8: bigint
  publishTime: bigint
  sessionOpen: boolean
}

export const priceUpdateCodec = getStructCodec([
  ['symbol', getArrayCodec(getU8Codec(), { size: 8 })],
  ['priceE8', getU64Codec()],
  ['publishTime', getI64Codec()],
  ['sessionOpen', getBooleanCodec()],
])

export type PriceReport = {
  updates: PriceUpdate[]
}

export const priceReportCodec = getStructCodec([
  ['updates', getArrayCodec(priceUpdateCodec, { size: getU32Codec() })],
])

export type CreReportReceived = {
  workflowOwner: number[]
  simulation: boolean
  report: PriceReport
}

export const creReportReceivedCodec = getStructCodec([
  ['workflowOwner', getArrayCodec(getU8Codec(), { size: 20 })],
  ['simulation', getBooleanCodec()],
  ['report', priceReportCodec],
])

export type EarnClosed = {
  owner: Address
  market: Address
  repaid: bigint
  fromBuffer: bigint
  fromWallet: bigint
  usdcOut: bigint
  stockOut: bigint
}

export const earnClosedCodec = getStructCodec([
  ['owner', getAddressCodec()],
  ['market', getAddressCodec()],
  ['repaid', getU64Codec()],
  ['fromBuffer', getU64Codec()],
  ['fromWallet', getU64Codec()],
  ['usdcOut', getU64Codec()],
  ['stockOut', getU64Codec()],
])

export type EarnDeposited = {
  owner: Address
  market: Address
  stock: bigint
  borrowed: bigint
  targetLtvBps: number
}

export const earnDepositedCodec = getStructCodec([
  ['owner', getAddressCodec()],
  ['market', getAddressCodec()],
  ['stock', getU64Codec()],
  ['borrowed', getU64Codec()],
  ['targetLtvBps', getU16Codec()],
])

export type Liquidated = {
  liquidator: Address
  position: Address
  repaid: bigint
  seized: bigint
}

export const liquidatedCodec = getStructCodec([
  ['liquidator', getAddressCodec()],
  ['position', getAddressCodec()],
  ['repaid', getU64Codec()],
  ['seized', getU64Codec()],
])

export type Market = {
  stockMint: Address
  custody: Address
  symbol: number[]
  bump: number
  ltvBps: number
  ltBps: number
  liqBonusBps: number
  offhoursBufferBps: number
  priceE8: bigint
  priceTime: bigint
  sessionOpen: boolean
  maxAge: number
  maxJumpBps: number
  totalCollateral: bigint
  totalScaledDebt: bigint
}

export const marketCodec = getStructCodec([
  ['stockMint', getAddressCodec()],
  ['custody', getAddressCodec()],
  ['symbol', getArrayCodec(getU8Codec(), { size: 8 })],
  ['bump', getU8Codec()],
  ['ltvBps', getU16Codec()],
  ['ltBps', getU16Codec()],
  ['liqBonusBps', getU16Codec()],
  ['offhoursBufferBps', getU16Codec()],
  ['priceE8', getU64Codec()],
  ['priceTime', getI64Codec()],
  ['sessionOpen', getBooleanCodec()],
  ['maxAge', getU32Codec()],
  ['maxJumpBps', getU16Codec()],
  ['totalCollateral', getU64Codec()],
  ['totalScaledDebt', getU128Codec()],
])

export type MarketParams = {
  ltvBps: number
  ltBps: number
  liqBonusBps: number
  offhoursBufferBps: number
  maxAge: number
  maxJumpBps: number
}

export const marketParamsCodec = getStructCodec([
  ['ltvBps', getU16Codec()],
  ['ltBps', getU16Codec()],
  ['liqBonusBps', getU16Codec()],
  ['offhoursBufferBps', getU16Codec()],
  ['maxAge', getU32Codec()],
  ['maxJumpBps', getU16Codec()],
])

export type Position = {
  owner: Address
  market: Address
  kind: number
  bump: number
  collateral: bigint
  scaledDebt: bigint
  shares: bigint
  targetLtvBps: number
  leverageBps: number
  deposited: bigint
  stockFromYield: bigint
  openedAt: bigint
  lastAgentAt: bigint
  lastAgent: Address
  lastAgentOp: number
  lastAgentAmount: bigint
}

export const positionCodec = getStructCodec([
  ['owner', getAddressCodec()],
  ['market', getAddressCodec()],
  ['kind', getU8Codec()],
  ['bump', getU8Codec()],
  ['collateral', getU64Codec()],
  ['scaledDebt', getU128Codec()],
  ['shares', getU64Codec()],
  ['targetLtvBps', getU16Codec()],
  ['leverageBps', getU16Codec()],
  ['deposited', getU64Codec()],
  ['stockFromYield', getU64Codec()],
  ['openedAt', getI64Codec()],
  ['lastAgentAt', getI64Codec()],
  ['lastAgent', getAddressCodec()],
  ['lastAgentOp', getU8Codec()],
  ['lastAgentAmount', getU64Codec()],
])

export type PricePushed = {
  market: Address
  priceE8: bigint
  publishTime: bigint
  sessionOpen: boolean
}

export const pricePushedCodec = getStructCodec([
  ['market', getAddressCodec()],
  ['priceE8', getU64Codec()],
  ['publishTime', getI64Codec()],
  ['sessionOpen', getBooleanCodec()],
])

export type Protocol = {
  admin: Address
  keeper: Address
  usdcMint: Address
  lpMint: Address
  poolUsdc: Address
  vaultUsdc: Address
  bump: number
  cash: bigint
  totalScaledDebt: bigint
  borrowIndex: bigint
  lastAccrual: bigint
  baseRateBps: number
  slope1Bps: number
  slope2Bps: number
  kinkBps: number
  minBorrow: bigint
  vaultShares: bigint
  navWad: bigint
  vaultAprBps: number
  vaultCash: bigint
  couponsPaid: bigint
  minCompound: bigint
  dexFeeBps: number
  marketCount: number
}

export const protocolCodec = getStructCodec([
  ['admin', getAddressCodec()],
  ['keeper', getAddressCodec()],
  ['usdcMint', getAddressCodec()],
  ['lpMint', getAddressCodec()],
  ['poolUsdc', getAddressCodec()],
  ['vaultUsdc', getAddressCodec()],
  ['bump', getU8Codec()],
  ['cash', getU64Codec()],
  ['totalScaledDebt', getU128Codec()],
  ['borrowIndex', getU128Codec()],
  ['lastAccrual', getI64Codec()],
  ['baseRateBps', getU32Codec()],
  ['slope1Bps', getU32Codec()],
  ['slope2Bps', getU32Codec()],
  ['kinkBps', getU32Codec()],
  ['minBorrow', getU64Codec()],
  ['vaultShares', getU64Codec()],
  ['navWad', getU128Codec()],
  ['vaultAprBps', getU32Codec()],
  ['vaultCash', getU64Codec()],
  ['couponsPaid', getU64Codec()],
  ['minCompound', getU64Codec()],
  ['dexFeeBps', getU32Codec()],
  ['marketCount', getU8Codec()],
])

export type ProtocolParams = {
  keeper: Address
  baseRateBps: number
  slope1Bps: number
  slope2Bps: number
  kinkBps: number
  vaultAprBps: number
  minBorrow: bigint
  minCompound: bigint
  dexFeeBps: number
}

export const protocolParamsCodec = getStructCodec([
  ['keeper', getAddressCodec()],
  ['baseRateBps', getU32Codec()],
  ['slope1Bps', getU32Codec()],
  ['slope2Bps', getU32Codec()],
  ['kinkBps', getU32Codec()],
  ['vaultAprBps', getU32Codec()],
  ['minBorrow', getU64Codec()],
  ['minCompound', getU64Codec()],
  ['dexFeeBps', getU32Codec()],
])

export type Supplied = {
  user: Address
  usdc: bigint
  lp: bigint
}

export const suppliedCodec = getStructCodec([
  ['user', getAddressCodec()],
  ['usdc', getU64Codec()],
  ['lp', getU64Codec()],
])

export type Withdrawn = {
  user: Address
  usdc: bigint
  lp: bigint
}

export const withdrawnCodec = getStructCodec([
  ['user', getAddressCodec()],
  ['usdc', getU64Codec()],
  ['lp', getU64Codec()],
])

export const ACCOUNT_CRE_CONFIG_DISCRIMINATOR = new Uint8Array([223, 155, 135, 163, 37, 82, 124, 78])

/**
 * Decodes raw CreConfig account data (with its 8-byte discriminator) into CreConfig.
 * Pure helper — there is no read capability; obtain the account bytes elsewhere.
 */
export const decodeCreConfigAccount = (data: Uint8Array): CreConfig =>
  creConfigCodec.decode(expectDiscriminator('account CreConfig', ACCOUNT_CRE_CONFIG_DISCRIMINATOR, data)) as CreConfig

export const ACCOUNT_MARKET_DISCRIMINATOR = new Uint8Array([219, 190, 213, 55, 0, 227, 198, 154])

/**
 * Decodes raw Market account data (with its 8-byte discriminator) into Market.
 * Pure helper — there is no read capability; obtain the account bytes elsewhere.
 */
export const decodeMarketAccount = (data: Uint8Array): Market =>
  marketCodec.decode(expectDiscriminator('account Market', ACCOUNT_MARKET_DISCRIMINATOR, data)) as Market

export const ACCOUNT_POSITION_DISCRIMINATOR = new Uint8Array([170, 188, 143, 228, 122, 64, 247, 208])

/**
 * Decodes raw Position account data (with its 8-byte discriminator) into Position.
 * Pure helper — there is no read capability; obtain the account bytes elsewhere.
 */
export const decodePositionAccount = (data: Uint8Array): Position =>
  positionCodec.decode(expectDiscriminator('account Position', ACCOUNT_POSITION_DISCRIMINATOR, data)) as Position

export const ACCOUNT_PROTOCOL_DISCRIMINATOR = new Uint8Array([45, 39, 101, 43, 115, 72, 131, 40])

/**
 * Decodes raw Protocol account data (with its 8-byte discriminator) into Protocol.
 * Pure helper — there is no read capability; obtain the account bytes elsewhere.
 */
export const decodeProtocolAccount = (data: Uint8Array): Protocol =>
  protocolCodec.decode(expectDiscriminator('account Protocol', ACCOUNT_PROTOCOL_DISCRIMINATOR, data)) as Protocol

export const EVENT_AGENT_ACTED_DISCRIMINATOR = new Uint8Array([137, 17, 53, 163, 179, 198, 16, 173])

/**
 * Decodes raw AgentActed event data (with its 8-byte discriminator) into AgentActed.
 */
export const decodeAgentActedEvent = (data: Uint8Array): AgentActed =>
  agentActedCodec.decode(expectDiscriminator('event AgentActed', EVENT_AGENT_ACTED_DISCRIMINATOR, data)) as AgentActed

export const EVENT_AMPLIFY_CLOSED_DISCRIMINATOR = new Uint8Array([108, 45, 188, 8, 194, 226, 87, 230])

/**
 * Decodes raw AmplifyClosed event data (with its 8-byte discriminator) into AmplifyClosed.
 */
export const decodeAmplifyClosedEvent = (data: Uint8Array): AmplifyClosed =>
  amplifyClosedCodec.decode(expectDiscriminator('event AmplifyClosed', EVENT_AMPLIFY_CLOSED_DISCRIMINATOR, data)) as AmplifyClosed

export const EVENT_AMPLIFY_OPENED_DISCRIMINATOR = new Uint8Array([239, 198, 185, 17, 106, 45, 76, 13])

/**
 * Decodes raw AmplifyOpened event data (with its 8-byte discriminator) into AmplifyOpened.
 */
export const decodeAmplifyOpenedEvent = (data: Uint8Array): AmplifyOpened =>
  amplifyOpenedCodec.decode(expectDiscriminator('event AmplifyOpened', EVENT_AMPLIFY_OPENED_DISCRIMINATOR, data)) as AmplifyOpened

export const EVENT_CRE_REPORT_RECEIVED_DISCRIMINATOR = new Uint8Array([47, 189, 143, 54, 90, 97, 15, 198])

/**
 * Decodes raw CreReportReceived event data (with its 8-byte discriminator) into CreReportReceived.
 */
export const decodeCreReportReceivedEvent = (data: Uint8Array): CreReportReceived =>
  creReportReceivedCodec.decode(expectDiscriminator('event CreReportReceived', EVENT_CRE_REPORT_RECEIVED_DISCRIMINATOR, data)) as CreReportReceived

export const EVENT_EARN_CLOSED_DISCRIMINATOR = new Uint8Array([53, 151, 79, 197, 240, 1, 228, 217])

/**
 * Decodes raw EarnClosed event data (with its 8-byte discriminator) into EarnClosed.
 */
export const decodeEarnClosedEvent = (data: Uint8Array): EarnClosed =>
  earnClosedCodec.decode(expectDiscriminator('event EarnClosed', EVENT_EARN_CLOSED_DISCRIMINATOR, data)) as EarnClosed

export const EVENT_EARN_DEPOSITED_DISCRIMINATOR = new Uint8Array([161, 5, 190, 137, 154, 196, 18, 11])

/**
 * Decodes raw EarnDeposited event data (with its 8-byte discriminator) into EarnDeposited.
 */
export const decodeEarnDepositedEvent = (data: Uint8Array): EarnDeposited =>
  earnDepositedCodec.decode(expectDiscriminator('event EarnDeposited', EVENT_EARN_DEPOSITED_DISCRIMINATOR, data)) as EarnDeposited

export const EVENT_LIQUIDATED_DISCRIMINATOR = new Uint8Array([231, 57, 55, 75, 0, 170, 246, 68])

/**
 * Decodes raw Liquidated event data (with its 8-byte discriminator) into Liquidated.
 */
export const decodeLiquidatedEvent = (data: Uint8Array): Liquidated =>
  liquidatedCodec.decode(expectDiscriminator('event Liquidated', EVENT_LIQUIDATED_DISCRIMINATOR, data)) as Liquidated

export const EVENT_PRICE_PUSHED_DISCRIMINATOR = new Uint8Array([82, 163, 38, 13, 83, 94, 115, 118])

/**
 * Decodes raw PricePushed event data (with its 8-byte discriminator) into PricePushed.
 */
export const decodePricePushedEvent = (data: Uint8Array): PricePushed =>
  pricePushedCodec.decode(expectDiscriminator('event PricePushed', EVENT_PRICE_PUSHED_DISCRIMINATOR, data)) as PricePushed

export const EVENT_SUPPLIED_DISCRIMINATOR = new Uint8Array([137, 114, 239, 72, 162, 75, 133, 39])

/**
 * Decodes raw Supplied event data (with its 8-byte discriminator) into Supplied.
 */
export const decodeSuppliedEvent = (data: Uint8Array): Supplied =>
  suppliedCodec.decode(expectDiscriminator('event Supplied', EVENT_SUPPLIED_DISCRIMINATOR, data)) as Supplied

export const EVENT_WITHDRAWN_DISCRIMINATOR = new Uint8Array([20, 89, 223, 198, 194, 124, 219, 13])

/**
 * Decodes raw Withdrawn event data (with its 8-byte discriminator) into Withdrawn.
 */
export const decodeWithdrawnEvent = (data: Uint8Array): Withdrawn =>
  withdrawnCodec.decode(expectDiscriminator('event Withdrawn', EVENT_WITHDRAWN_DISCRIMINATOR, data)) as Withdrawn

export const parseAnyAccount = (data: Uint8Array): CreConfig | Market | Position | Protocol => {
  const disc = data.subarray(0, DISCRIMINATOR_SIZE)
  const matches = (expected: Uint8Array) => expected.every((b, i) => disc[i] === b)
  if (matches(ACCOUNT_CRE_CONFIG_DISCRIMINATOR)) return decodeCreConfigAccount(data)
  if (matches(ACCOUNT_MARKET_DISCRIMINATOR)) return decodeMarketAccount(data)
  if (matches(ACCOUNT_POSITION_DISCRIMINATOR)) return decodePositionAccount(data)
  if (matches(ACCOUNT_PROTOCOL_DISCRIMINATOR)) return decodeProtocolAccount(data)
  throw new Error(`unknown account discriminator: [${Array.from(disc).join(', ')}]`)
}

export const parseAnyEvent = (data: Uint8Array): AgentActed | AmplifyClosed | AmplifyOpened | CreReportReceived | EarnClosed | EarnDeposited | Liquidated | PricePushed | Supplied | Withdrawn => {
  const disc = data.subarray(0, DISCRIMINATOR_SIZE)
  const matches = (expected: Uint8Array) => expected.every((b, i) => disc[i] === b)
  if (matches(EVENT_AGENT_ACTED_DISCRIMINATOR)) return decodeAgentActedEvent(data)
  if (matches(EVENT_AMPLIFY_CLOSED_DISCRIMINATOR)) return decodeAmplifyClosedEvent(data)
  if (matches(EVENT_AMPLIFY_OPENED_DISCRIMINATOR)) return decodeAmplifyOpenedEvent(data)
  if (matches(EVENT_CRE_REPORT_RECEIVED_DISCRIMINATOR)) return decodeCreReportReceivedEvent(data)
  if (matches(EVENT_EARN_CLOSED_DISCRIMINATOR)) return decodeEarnClosedEvent(data)
  if (matches(EVENT_EARN_DEPOSITED_DISCRIMINATOR)) return decodeEarnDepositedEvent(data)
  if (matches(EVENT_LIQUIDATED_DISCRIMINATOR)) return decodeLiquidatedEvent(data)
  if (matches(EVENT_PRICE_PUSHED_DISCRIMINATOR)) return decodePricePushedEvent(data)
  if (matches(EVENT_SUPPLIED_DISCRIMINATOR)) return decodeSuppliedEvent(data)
  if (matches(EVENT_WITHDRAWN_DISCRIMINATOR)) return decodeWithdrawnEvent(data)
  throw new Error(`unknown event discriminator: [${Array.from(disc).join(', ')}]`)
}

/**
 * Optional filter values for AgentActed log triggers. Set fields in one row to
 * AND those predicates. Multiple rows are OR alternatives, but current trigger
 * configuration supports only a single row. Leave unset for wildcard. Only top-level
 * scalar fields with supported subkey encodings are auto-filterable — nested
 * structs, vecs, arrays, bool, u128, and i128 need a manual SubkeyConfig.
 */
export type AgentActedFilters = {
  agent?: Address | null
  position?: Address | null
  op?: number | null
  amount?: bigint | null
}

export const encodeAgentActedSubkeys = (filters: AgentActedFilters[]): SolanaSubkeyConfigJson[] => {
  if (filters.length > 1) {
    throw new Error('multiple filter rows are not supported for AgentActed; provide a single filter row')
  }
  const agentComparers: SolanaValueComparatorJson[] = []
  const positionComparers: SolanaValueComparatorJson[] = []
  const opComparers: SolanaValueComparatorJson[] = []
  const amountComparers: SolanaValueComparatorJson[] = []
  for (const f of filters) {
    if (f.agent != null) {
      agentComparers.push({
        operator: 'COMPARISON_OPERATOR_EQ',
        value: bytesToBase64(solanaAddressToBytes(f.agent)),
      })
    }
    if (f.position != null) {
      positionComparers.push({
        operator: 'COMPARISON_OPERATOR_EQ',
        value: bytesToBase64(solanaAddressToBytes(f.position)),
      })
    }
    if (f.op != null) {
      opComparers.push({
        operator: 'COMPARISON_OPERATOR_EQ',
        value: bytesToBase64(prepareSubkeyValue(f.op)),
      })
    }
    if (f.amount != null) {
      amountComparers.push({
        operator: 'COMPARISON_OPERATOR_EQ',
        value: bytesToBase64(prepareSubkeyValue(f.amount)),
      })
    }
  }
  const subkeys: SolanaSubkeyConfigJson[] = []
  if (agentComparers.length > 0) {
    subkeys.push({ path: ['Agent'], comparers: agentComparers })
  }
  if (positionComparers.length > 0) {
    subkeys.push({ path: ['Position'], comparers: positionComparers })
  }
  if (opComparers.length > 0) {
    subkeys.push({ path: ['Op'], comparers: opComparers })
  }
  if (amountComparers.length > 0) {
    subkeys.push({ path: ['Amount'], comparers: amountComparers })
  }
  return subkeys
}

/**
 * Optional filter values for AmplifyClosed log triggers. Set fields in one row to
 * AND those predicates. Multiple rows are OR alternatives, but current trigger
 * configuration supports only a single row. Leave unset for wildcard. Only top-level
 * scalar fields with supported subkey encodings are auto-filterable — nested
 * structs, vecs, arrays, bool, u128, and i128 need a manual SubkeyConfig.
 */
export type AmplifyClosedFilters = {
  owner?: Address | null
  market?: Address | null
  repaid?: bigint | null
  stockSold?: bigint | null
  stockOut?: bigint | null
}

export const encodeAmplifyClosedSubkeys = (filters: AmplifyClosedFilters[]): SolanaSubkeyConfigJson[] => {
  if (filters.length > 1) {
    throw new Error('multiple filter rows are not supported for AmplifyClosed; provide a single filter row')
  }
  const ownerComparers: SolanaValueComparatorJson[] = []
  const marketComparers: SolanaValueComparatorJson[] = []
  const repaidComparers: SolanaValueComparatorJson[] = []
  const stockSoldComparers: SolanaValueComparatorJson[] = []
  const stockOutComparers: SolanaValueComparatorJson[] = []
  for (const f of filters) {
    if (f.owner != null) {
      ownerComparers.push({
        operator: 'COMPARISON_OPERATOR_EQ',
        value: bytesToBase64(solanaAddressToBytes(f.owner)),
      })
    }
    if (f.market != null) {
      marketComparers.push({
        operator: 'COMPARISON_OPERATOR_EQ',
        value: bytesToBase64(solanaAddressToBytes(f.market)),
      })
    }
    if (f.repaid != null) {
      repaidComparers.push({
        operator: 'COMPARISON_OPERATOR_EQ',
        value: bytesToBase64(prepareSubkeyValue(f.repaid)),
      })
    }
    if (f.stockSold != null) {
      stockSoldComparers.push({
        operator: 'COMPARISON_OPERATOR_EQ',
        value: bytesToBase64(prepareSubkeyValue(f.stockSold)),
      })
    }
    if (f.stockOut != null) {
      stockOutComparers.push({
        operator: 'COMPARISON_OPERATOR_EQ',
        value: bytesToBase64(prepareSubkeyValue(f.stockOut)),
      })
    }
  }
  const subkeys: SolanaSubkeyConfigJson[] = []
  if (ownerComparers.length > 0) {
    subkeys.push({ path: ['Owner'], comparers: ownerComparers })
  }
  if (marketComparers.length > 0) {
    subkeys.push({ path: ['Market'], comparers: marketComparers })
  }
  if (repaidComparers.length > 0) {
    subkeys.push({ path: ['Repaid'], comparers: repaidComparers })
  }
  if (stockSoldComparers.length > 0) {
    subkeys.push({ path: ['StockSold'], comparers: stockSoldComparers })
  }
  if (stockOutComparers.length > 0) {
    subkeys.push({ path: ['StockOut'], comparers: stockOutComparers })
  }
  return subkeys
}

/**
 * Optional filter values for AmplifyOpened log triggers. Set fields in one row to
 * AND those predicates. Multiple rows are OR alternatives, but current trigger
 * configuration supports only a single row. Leave unset for wildcard. Only top-level
 * scalar fields with supported subkey encodings are auto-filterable — nested
 * structs, vecs, arrays, bool, u128, and i128 need a manual SubkeyConfig.
 */
export type AmplifyOpenedFilters = {
  owner?: Address | null
  market?: Address | null
  stockIn?: bigint | null
  stockBought?: bigint | null
  debt?: bigint | null
  leverageBps?: number | null
}

export const encodeAmplifyOpenedSubkeys = (filters: AmplifyOpenedFilters[]): SolanaSubkeyConfigJson[] => {
  if (filters.length > 1) {
    throw new Error('multiple filter rows are not supported for AmplifyOpened; provide a single filter row')
  }
  const ownerComparers: SolanaValueComparatorJson[] = []
  const marketComparers: SolanaValueComparatorJson[] = []
  const stockInComparers: SolanaValueComparatorJson[] = []
  const stockBoughtComparers: SolanaValueComparatorJson[] = []
  const debtComparers: SolanaValueComparatorJson[] = []
  const leverageBpsComparers: SolanaValueComparatorJson[] = []
  for (const f of filters) {
    if (f.owner != null) {
      ownerComparers.push({
        operator: 'COMPARISON_OPERATOR_EQ',
        value: bytesToBase64(solanaAddressToBytes(f.owner)),
      })
    }
    if (f.market != null) {
      marketComparers.push({
        operator: 'COMPARISON_OPERATOR_EQ',
        value: bytesToBase64(solanaAddressToBytes(f.market)),
      })
    }
    if (f.stockIn != null) {
      stockInComparers.push({
        operator: 'COMPARISON_OPERATOR_EQ',
        value: bytesToBase64(prepareSubkeyValue(f.stockIn)),
      })
    }
    if (f.stockBought != null) {
      stockBoughtComparers.push({
        operator: 'COMPARISON_OPERATOR_EQ',
        value: bytesToBase64(prepareSubkeyValue(f.stockBought)),
      })
    }
    if (f.debt != null) {
      debtComparers.push({
        operator: 'COMPARISON_OPERATOR_EQ',
        value: bytesToBase64(prepareSubkeyValue(f.debt)),
      })
    }
    if (f.leverageBps != null) {
      leverageBpsComparers.push({
        operator: 'COMPARISON_OPERATOR_EQ',
        value: bytesToBase64(prepareSubkeyValue(f.leverageBps)),
      })
    }
  }
  const subkeys: SolanaSubkeyConfigJson[] = []
  if (ownerComparers.length > 0) {
    subkeys.push({ path: ['Owner'], comparers: ownerComparers })
  }
  if (marketComparers.length > 0) {
    subkeys.push({ path: ['Market'], comparers: marketComparers })
  }
  if (stockInComparers.length > 0) {
    subkeys.push({ path: ['StockIn'], comparers: stockInComparers })
  }
  if (stockBoughtComparers.length > 0) {
    subkeys.push({ path: ['StockBought'], comparers: stockBoughtComparers })
  }
  if (debtComparers.length > 0) {
    subkeys.push({ path: ['Debt'], comparers: debtComparers })
  }
  if (leverageBpsComparers.length > 0) {
    subkeys.push({ path: ['LeverageBps'], comparers: leverageBpsComparers })
  }
  return subkeys
}

/**
 * Optional filter values for CreReportReceived log triggers. Set fields in one row to
 * AND those predicates. Multiple rows are OR alternatives, but current trigger
 * configuration supports only a single row. Leave unset for wildcard. Only top-level
 * scalar fields with supported subkey encodings are auto-filterable — nested
 * structs, vecs, arrays, bool, u128, and i128 need a manual SubkeyConfig.
 */
export type CreReportReceivedFilters = Record<string, never>

export const encodeCreReportReceivedSubkeys = (filters: CreReportReceivedFilters[]): SolanaSubkeyConfigJson[] => {
  if (filters.length > 1) {
    throw new Error('multiple filter rows are not supported for CreReportReceived; provide a single filter row')
  }
  return []
}

/**
 * Optional filter values for EarnClosed log triggers. Set fields in one row to
 * AND those predicates. Multiple rows are OR alternatives, but current trigger
 * configuration supports only a single row. Leave unset for wildcard. Only top-level
 * scalar fields with supported subkey encodings are auto-filterable — nested
 * structs, vecs, arrays, bool, u128, and i128 need a manual SubkeyConfig.
 */
export type EarnClosedFilters = {
  owner?: Address | null
  market?: Address | null
  repaid?: bigint | null
  fromBuffer?: bigint | null
  fromWallet?: bigint | null
  usdcOut?: bigint | null
  stockOut?: bigint | null
}

export const encodeEarnClosedSubkeys = (filters: EarnClosedFilters[]): SolanaSubkeyConfigJson[] => {
  if (filters.length > 1) {
    throw new Error('multiple filter rows are not supported for EarnClosed; provide a single filter row')
  }
  const ownerComparers: SolanaValueComparatorJson[] = []
  const marketComparers: SolanaValueComparatorJson[] = []
  const repaidComparers: SolanaValueComparatorJson[] = []
  const fromBufferComparers: SolanaValueComparatorJson[] = []
  const fromWalletComparers: SolanaValueComparatorJson[] = []
  const usdcOutComparers: SolanaValueComparatorJson[] = []
  const stockOutComparers: SolanaValueComparatorJson[] = []
  for (const f of filters) {
    if (f.owner != null) {
      ownerComparers.push({
        operator: 'COMPARISON_OPERATOR_EQ',
        value: bytesToBase64(solanaAddressToBytes(f.owner)),
      })
    }
    if (f.market != null) {
      marketComparers.push({
        operator: 'COMPARISON_OPERATOR_EQ',
        value: bytesToBase64(solanaAddressToBytes(f.market)),
      })
    }
    if (f.repaid != null) {
      repaidComparers.push({
        operator: 'COMPARISON_OPERATOR_EQ',
        value: bytesToBase64(prepareSubkeyValue(f.repaid)),
      })
    }
    if (f.fromBuffer != null) {
      fromBufferComparers.push({
        operator: 'COMPARISON_OPERATOR_EQ',
        value: bytesToBase64(prepareSubkeyValue(f.fromBuffer)),
      })
    }
    if (f.fromWallet != null) {
      fromWalletComparers.push({
        operator: 'COMPARISON_OPERATOR_EQ',
        value: bytesToBase64(prepareSubkeyValue(f.fromWallet)),
      })
    }
    if (f.usdcOut != null) {
      usdcOutComparers.push({
        operator: 'COMPARISON_OPERATOR_EQ',
        value: bytesToBase64(prepareSubkeyValue(f.usdcOut)),
      })
    }
    if (f.stockOut != null) {
      stockOutComparers.push({
        operator: 'COMPARISON_OPERATOR_EQ',
        value: bytesToBase64(prepareSubkeyValue(f.stockOut)),
      })
    }
  }
  const subkeys: SolanaSubkeyConfigJson[] = []
  if (ownerComparers.length > 0) {
    subkeys.push({ path: ['Owner'], comparers: ownerComparers })
  }
  if (marketComparers.length > 0) {
    subkeys.push({ path: ['Market'], comparers: marketComparers })
  }
  if (repaidComparers.length > 0) {
    subkeys.push({ path: ['Repaid'], comparers: repaidComparers })
  }
  if (fromBufferComparers.length > 0) {
    subkeys.push({ path: ['FromBuffer'], comparers: fromBufferComparers })
  }
  if (fromWalletComparers.length > 0) {
    subkeys.push({ path: ['FromWallet'], comparers: fromWalletComparers })
  }
  if (usdcOutComparers.length > 0) {
    subkeys.push({ path: ['UsdcOut'], comparers: usdcOutComparers })
  }
  if (stockOutComparers.length > 0) {
    subkeys.push({ path: ['StockOut'], comparers: stockOutComparers })
  }
  return subkeys
}

/**
 * Optional filter values for EarnDeposited log triggers. Set fields in one row to
 * AND those predicates. Multiple rows are OR alternatives, but current trigger
 * configuration supports only a single row. Leave unset for wildcard. Only top-level
 * scalar fields with supported subkey encodings are auto-filterable — nested
 * structs, vecs, arrays, bool, u128, and i128 need a manual SubkeyConfig.
 */
export type EarnDepositedFilters = {
  owner?: Address | null
  market?: Address | null
  stock?: bigint | null
  borrowed?: bigint | null
  targetLtvBps?: number | null
}

export const encodeEarnDepositedSubkeys = (filters: EarnDepositedFilters[]): SolanaSubkeyConfigJson[] => {
  if (filters.length > 1) {
    throw new Error('multiple filter rows are not supported for EarnDeposited; provide a single filter row')
  }
  const ownerComparers: SolanaValueComparatorJson[] = []
  const marketComparers: SolanaValueComparatorJson[] = []
  const stockComparers: SolanaValueComparatorJson[] = []
  const borrowedComparers: SolanaValueComparatorJson[] = []
  const targetLtvBpsComparers: SolanaValueComparatorJson[] = []
  for (const f of filters) {
    if (f.owner != null) {
      ownerComparers.push({
        operator: 'COMPARISON_OPERATOR_EQ',
        value: bytesToBase64(solanaAddressToBytes(f.owner)),
      })
    }
    if (f.market != null) {
      marketComparers.push({
        operator: 'COMPARISON_OPERATOR_EQ',
        value: bytesToBase64(solanaAddressToBytes(f.market)),
      })
    }
    if (f.stock != null) {
      stockComparers.push({
        operator: 'COMPARISON_OPERATOR_EQ',
        value: bytesToBase64(prepareSubkeyValue(f.stock)),
      })
    }
    if (f.borrowed != null) {
      borrowedComparers.push({
        operator: 'COMPARISON_OPERATOR_EQ',
        value: bytesToBase64(prepareSubkeyValue(f.borrowed)),
      })
    }
    if (f.targetLtvBps != null) {
      targetLtvBpsComparers.push({
        operator: 'COMPARISON_OPERATOR_EQ',
        value: bytesToBase64(prepareSubkeyValue(f.targetLtvBps)),
      })
    }
  }
  const subkeys: SolanaSubkeyConfigJson[] = []
  if (ownerComparers.length > 0) {
    subkeys.push({ path: ['Owner'], comparers: ownerComparers })
  }
  if (marketComparers.length > 0) {
    subkeys.push({ path: ['Market'], comparers: marketComparers })
  }
  if (stockComparers.length > 0) {
    subkeys.push({ path: ['Stock'], comparers: stockComparers })
  }
  if (borrowedComparers.length > 0) {
    subkeys.push({ path: ['Borrowed'], comparers: borrowedComparers })
  }
  if (targetLtvBpsComparers.length > 0) {
    subkeys.push({ path: ['TargetLtvBps'], comparers: targetLtvBpsComparers })
  }
  return subkeys
}

/**
 * Optional filter values for Liquidated log triggers. Set fields in one row to
 * AND those predicates. Multiple rows are OR alternatives, but current trigger
 * configuration supports only a single row. Leave unset for wildcard. Only top-level
 * scalar fields with supported subkey encodings are auto-filterable — nested
 * structs, vecs, arrays, bool, u128, and i128 need a manual SubkeyConfig.
 */
export type LiquidatedFilters = {
  liquidator?: Address | null
  position?: Address | null
  repaid?: bigint | null
  seized?: bigint | null
}

export const encodeLiquidatedSubkeys = (filters: LiquidatedFilters[]): SolanaSubkeyConfigJson[] => {
  if (filters.length > 1) {
    throw new Error('multiple filter rows are not supported for Liquidated; provide a single filter row')
  }
  const liquidatorComparers: SolanaValueComparatorJson[] = []
  const positionComparers: SolanaValueComparatorJson[] = []
  const repaidComparers: SolanaValueComparatorJson[] = []
  const seizedComparers: SolanaValueComparatorJson[] = []
  for (const f of filters) {
    if (f.liquidator != null) {
      liquidatorComparers.push({
        operator: 'COMPARISON_OPERATOR_EQ',
        value: bytesToBase64(solanaAddressToBytes(f.liquidator)),
      })
    }
    if (f.position != null) {
      positionComparers.push({
        operator: 'COMPARISON_OPERATOR_EQ',
        value: bytesToBase64(solanaAddressToBytes(f.position)),
      })
    }
    if (f.repaid != null) {
      repaidComparers.push({
        operator: 'COMPARISON_OPERATOR_EQ',
        value: bytesToBase64(prepareSubkeyValue(f.repaid)),
      })
    }
    if (f.seized != null) {
      seizedComparers.push({
        operator: 'COMPARISON_OPERATOR_EQ',
        value: bytesToBase64(prepareSubkeyValue(f.seized)),
      })
    }
  }
  const subkeys: SolanaSubkeyConfigJson[] = []
  if (liquidatorComparers.length > 0) {
    subkeys.push({ path: ['Liquidator'], comparers: liquidatorComparers })
  }
  if (positionComparers.length > 0) {
    subkeys.push({ path: ['Position'], comparers: positionComparers })
  }
  if (repaidComparers.length > 0) {
    subkeys.push({ path: ['Repaid'], comparers: repaidComparers })
  }
  if (seizedComparers.length > 0) {
    subkeys.push({ path: ['Seized'], comparers: seizedComparers })
  }
  return subkeys
}

/**
 * Optional filter values for PricePushed log triggers. Set fields in one row to
 * AND those predicates. Multiple rows are OR alternatives, but current trigger
 * configuration supports only a single row. Leave unset for wildcard. Only top-level
 * scalar fields with supported subkey encodings are auto-filterable — nested
 * structs, vecs, arrays, bool, u128, and i128 need a manual SubkeyConfig.
 */
export type PricePushedFilters = {
  market?: Address | null
  priceE8?: bigint | null
  publishTime?: bigint | null
}

export const encodePricePushedSubkeys = (filters: PricePushedFilters[]): SolanaSubkeyConfigJson[] => {
  if (filters.length > 1) {
    throw new Error('multiple filter rows are not supported for PricePushed; provide a single filter row')
  }
  const marketComparers: SolanaValueComparatorJson[] = []
  const priceE8Comparers: SolanaValueComparatorJson[] = []
  const publishTimeComparers: SolanaValueComparatorJson[] = []
  for (const f of filters) {
    if (f.market != null) {
      marketComparers.push({
        operator: 'COMPARISON_OPERATOR_EQ',
        value: bytesToBase64(solanaAddressToBytes(f.market)),
      })
    }
    if (f.priceE8 != null) {
      priceE8Comparers.push({
        operator: 'COMPARISON_OPERATOR_EQ',
        value: bytesToBase64(prepareSubkeyValue(f.priceE8)),
      })
    }
    if (f.publishTime != null) {
      publishTimeComparers.push({
        operator: 'COMPARISON_OPERATOR_EQ',
        value: bytesToBase64(prepareSubkeyValue(f.publishTime)),
      })
    }
  }
  const subkeys: SolanaSubkeyConfigJson[] = []
  if (marketComparers.length > 0) {
    subkeys.push({ path: ['Market'], comparers: marketComparers })
  }
  if (priceE8Comparers.length > 0) {
    subkeys.push({ path: ['PriceE8'], comparers: priceE8Comparers })
  }
  if (publishTimeComparers.length > 0) {
    subkeys.push({ path: ['PublishTime'], comparers: publishTimeComparers })
  }
  return subkeys
}

/**
 * Optional filter values for Supplied log triggers. Set fields in one row to
 * AND those predicates. Multiple rows are OR alternatives, but current trigger
 * configuration supports only a single row. Leave unset for wildcard. Only top-level
 * scalar fields with supported subkey encodings are auto-filterable — nested
 * structs, vecs, arrays, bool, u128, and i128 need a manual SubkeyConfig.
 */
export type SuppliedFilters = {
  user?: Address | null
  usdc?: bigint | null
  lp?: bigint | null
}

export const encodeSuppliedSubkeys = (filters: SuppliedFilters[]): SolanaSubkeyConfigJson[] => {
  if (filters.length > 1) {
    throw new Error('multiple filter rows are not supported for Supplied; provide a single filter row')
  }
  const userComparers: SolanaValueComparatorJson[] = []
  const usdcComparers: SolanaValueComparatorJson[] = []
  const lpComparers: SolanaValueComparatorJson[] = []
  for (const f of filters) {
    if (f.user != null) {
      userComparers.push({
        operator: 'COMPARISON_OPERATOR_EQ',
        value: bytesToBase64(solanaAddressToBytes(f.user)),
      })
    }
    if (f.usdc != null) {
      usdcComparers.push({
        operator: 'COMPARISON_OPERATOR_EQ',
        value: bytesToBase64(prepareSubkeyValue(f.usdc)),
      })
    }
    if (f.lp != null) {
      lpComparers.push({
        operator: 'COMPARISON_OPERATOR_EQ',
        value: bytesToBase64(prepareSubkeyValue(f.lp)),
      })
    }
  }
  const subkeys: SolanaSubkeyConfigJson[] = []
  if (userComparers.length > 0) {
    subkeys.push({ path: ['User'], comparers: userComparers })
  }
  if (usdcComparers.length > 0) {
    subkeys.push({ path: ['Usdc'], comparers: usdcComparers })
  }
  if (lpComparers.length > 0) {
    subkeys.push({ path: ['Lp'], comparers: lpComparers })
  }
  return subkeys
}

/**
 * Optional filter values for Withdrawn log triggers. Set fields in one row to
 * AND those predicates. Multiple rows are OR alternatives, but current trigger
 * configuration supports only a single row. Leave unset for wildcard. Only top-level
 * scalar fields with supported subkey encodings are auto-filterable — nested
 * structs, vecs, arrays, bool, u128, and i128 need a manual SubkeyConfig.
 */
export type WithdrawnFilters = {
  user?: Address | null
  usdc?: bigint | null
  lp?: bigint | null
}

export const encodeWithdrawnSubkeys = (filters: WithdrawnFilters[]): SolanaSubkeyConfigJson[] => {
  if (filters.length > 1) {
    throw new Error('multiple filter rows are not supported for Withdrawn; provide a single filter row')
  }
  const userComparers: SolanaValueComparatorJson[] = []
  const usdcComparers: SolanaValueComparatorJson[] = []
  const lpComparers: SolanaValueComparatorJson[] = []
  for (const f of filters) {
    if (f.user != null) {
      userComparers.push({
        operator: 'COMPARISON_OPERATOR_EQ',
        value: bytesToBase64(solanaAddressToBytes(f.user)),
      })
    }
    if (f.usdc != null) {
      usdcComparers.push({
        operator: 'COMPARISON_OPERATOR_EQ',
        value: bytesToBase64(prepareSubkeyValue(f.usdc)),
      })
    }
    if (f.lp != null) {
      lpComparers.push({
        operator: 'COMPARISON_OPERATOR_EQ',
        value: bytesToBase64(prepareSubkeyValue(f.lp)),
      })
    }
  }
  const subkeys: SolanaSubkeyConfigJson[] = []
  if (userComparers.length > 0) {
    subkeys.push({ path: ['User'], comparers: userComparers })
  }
  if (usdcComparers.length > 0) {
    subkeys.push({ path: ['Usdc'], comparers: usdcComparers })
  }
  if (lpComparers.length > 0) {
    subkeys.push({ path: ['Lp'], comparers: lpComparers })
  }
  return subkeys
}

export class AgamaSolana {
  readonly programId: Uint8Array

  // The program ID is baked into the IDL, so it defaults to the generated
  // const — unlike EVM bindings where the address is a runtime value.
  constructor(
    private readonly client: SolanaClient,
    programId: string | Uint8Array = AGAMA_SOLANA_PROGRAM_ID,
  ) {
    this.programId = typeof programId === 'string' ? solanaAddressToBytes(programId) : programId
  }

  /**
   * Publishes a pre-encoded Borsh payload through the CRE signer to this
   * program's on_report entrypoint via the keystone-forwarder.
   *
   * remainingAccounts must follow the keystone-forwarder account layout:
   *   - Index 0: forwarderState – the forwarder program's state account.
   *   - Index 1: forwarderAuthority – PDA derived from seeds
   *     ["forwarder", forwarderState, receiverProgram] under the forwarder program ID.
   *   - Index 2+: receiver-specific accounts required by the target program.
   *
   * The full account list is hashed (via calculateAccountsHash) into the report.
   * The on-chain forwarder strips indices 0 and 1 before CPI-ing into the
   * receiver, so they must be present and correctly ordered.
   */
  writeReport(
    runtime: Runtime<unknown>,
    payload: Uint8Array,
    remainingAccounts: SolanaAccountMeta[],
    computeConfig?: SolanaComputeConfig,
  ) {
    const report = runtime
      .report(
        prepareSolanaReportRequest(
          encodeForwarderReport({
            accountHash: calculateAccountsHash(remainingAccounts),
            payload,
          }),
        ),
      )
      .result()

    return this.client
      .writeReport(runtime, {
        remainingAccounts: solanaAccountMetasToJson(remainingAccounts),
        receiver: bytesToHex(this.programId),
        computeConfig,
        report,
      })
      .result()
  }

  /**
   * Publishes a Borsh Vec of pre-encoded element payloads (mirrors Go's
   * WriteReportFromBorshEncodedVec). Each element must already be fully
   * serialized for one Vec item on the wire.
   */
  writeReportFromBorshEncodedVec(
    runtime: Runtime<unknown>,
    elementPayloads: Uint8Array[],
    remainingAccounts: SolanaAccountMeta[],
    computeConfig?: SolanaComputeConfig,
  ) {
    return this.writeReport(runtime, encodeBorshVecU32(elementPayloads), remainingAccounts, computeConfig)
  }

  writeReportFromAgentActed(
    runtime: Runtime<unknown>,
    input: AgentActed,
    remainingAccounts: SolanaAccountMeta[],
    computeConfig?: SolanaComputeConfig,
  ) {
    return this.writeReport(runtime, new Uint8Array(agentActedCodec.encode(input)), remainingAccounts, computeConfig)
  }

  writeReportFromAgentActeds(
    runtime: Runtime<unknown>,
    inputs: AgentActed[],
    remainingAccounts: SolanaAccountMeta[],
    computeConfig?: SolanaComputeConfig,
  ) {
    return this.writeReportFromBorshEncodedVec(
      runtime,
      inputs.map((input) => new Uint8Array(agentActedCodec.encode(input))),
      remainingAccounts,
      computeConfig,
    )
  }

  writeReportFromAmplifyClosed(
    runtime: Runtime<unknown>,
    input: AmplifyClosed,
    remainingAccounts: SolanaAccountMeta[],
    computeConfig?: SolanaComputeConfig,
  ) {
    return this.writeReport(runtime, new Uint8Array(amplifyClosedCodec.encode(input)), remainingAccounts, computeConfig)
  }

  writeReportFromAmplifyCloseds(
    runtime: Runtime<unknown>,
    inputs: AmplifyClosed[],
    remainingAccounts: SolanaAccountMeta[],
    computeConfig?: SolanaComputeConfig,
  ) {
    return this.writeReportFromBorshEncodedVec(
      runtime,
      inputs.map((input) => new Uint8Array(amplifyClosedCodec.encode(input))),
      remainingAccounts,
      computeConfig,
    )
  }

  writeReportFromAmplifyOpened(
    runtime: Runtime<unknown>,
    input: AmplifyOpened,
    remainingAccounts: SolanaAccountMeta[],
    computeConfig?: SolanaComputeConfig,
  ) {
    return this.writeReport(runtime, new Uint8Array(amplifyOpenedCodec.encode(input)), remainingAccounts, computeConfig)
  }

  writeReportFromAmplifyOpeneds(
    runtime: Runtime<unknown>,
    inputs: AmplifyOpened[],
    remainingAccounts: SolanaAccountMeta[],
    computeConfig?: SolanaComputeConfig,
  ) {
    return this.writeReportFromBorshEncodedVec(
      runtime,
      inputs.map((input) => new Uint8Array(amplifyOpenedCodec.encode(input))),
      remainingAccounts,
      computeConfig,
    )
  }

  writeReportFromCreConfig(
    runtime: Runtime<unknown>,
    input: CreConfig,
    remainingAccounts: SolanaAccountMeta[],
    computeConfig?: SolanaComputeConfig,
  ) {
    return this.writeReport(runtime, new Uint8Array(creConfigCodec.encode(input)), remainingAccounts, computeConfig)
  }

  writeReportFromCreConfigs(
    runtime: Runtime<unknown>,
    inputs: CreConfig[],
    remainingAccounts: SolanaAccountMeta[],
    computeConfig?: SolanaComputeConfig,
  ) {
    return this.writeReportFromBorshEncodedVec(
      runtime,
      inputs.map((input) => new Uint8Array(creConfigCodec.encode(input))),
      remainingAccounts,
      computeConfig,
    )
  }

  writeReportFromPriceUpdate(
    runtime: Runtime<unknown>,
    input: PriceUpdate,
    remainingAccounts: SolanaAccountMeta[],
    computeConfig?: SolanaComputeConfig,
  ) {
    return this.writeReport(runtime, new Uint8Array(priceUpdateCodec.encode(input)), remainingAccounts, computeConfig)
  }

  writeReportFromPriceUpdates(
    runtime: Runtime<unknown>,
    inputs: PriceUpdate[],
    remainingAccounts: SolanaAccountMeta[],
    computeConfig?: SolanaComputeConfig,
  ) {
    return this.writeReportFromBorshEncodedVec(
      runtime,
      inputs.map((input) => new Uint8Array(priceUpdateCodec.encode(input))),
      remainingAccounts,
      computeConfig,
    )
  }

  writeReportFromPriceReport(
    runtime: Runtime<unknown>,
    input: PriceReport,
    remainingAccounts: SolanaAccountMeta[],
    computeConfig?: SolanaComputeConfig,
  ) {
    return this.writeReport(runtime, new Uint8Array(priceReportCodec.encode(input)), remainingAccounts, computeConfig)
  }

  writeReportFromPriceReports(
    runtime: Runtime<unknown>,
    inputs: PriceReport[],
    remainingAccounts: SolanaAccountMeta[],
    computeConfig?: SolanaComputeConfig,
  ) {
    return this.writeReportFromBorshEncodedVec(
      runtime,
      inputs.map((input) => new Uint8Array(priceReportCodec.encode(input))),
      remainingAccounts,
      computeConfig,
    )
  }

  writeReportFromCreReportReceived(
    runtime: Runtime<unknown>,
    input: CreReportReceived,
    remainingAccounts: SolanaAccountMeta[],
    computeConfig?: SolanaComputeConfig,
  ) {
    return this.writeReport(runtime, new Uint8Array(creReportReceivedCodec.encode(input)), remainingAccounts, computeConfig)
  }

  writeReportFromCreReportReceiveds(
    runtime: Runtime<unknown>,
    inputs: CreReportReceived[],
    remainingAccounts: SolanaAccountMeta[],
    computeConfig?: SolanaComputeConfig,
  ) {
    return this.writeReportFromBorshEncodedVec(
      runtime,
      inputs.map((input) => new Uint8Array(creReportReceivedCodec.encode(input))),
      remainingAccounts,
      computeConfig,
    )
  }

  writeReportFromEarnClosed(
    runtime: Runtime<unknown>,
    input: EarnClosed,
    remainingAccounts: SolanaAccountMeta[],
    computeConfig?: SolanaComputeConfig,
  ) {
    return this.writeReport(runtime, new Uint8Array(earnClosedCodec.encode(input)), remainingAccounts, computeConfig)
  }

  writeReportFromEarnCloseds(
    runtime: Runtime<unknown>,
    inputs: EarnClosed[],
    remainingAccounts: SolanaAccountMeta[],
    computeConfig?: SolanaComputeConfig,
  ) {
    return this.writeReportFromBorshEncodedVec(
      runtime,
      inputs.map((input) => new Uint8Array(earnClosedCodec.encode(input))),
      remainingAccounts,
      computeConfig,
    )
  }

  writeReportFromEarnDeposited(
    runtime: Runtime<unknown>,
    input: EarnDeposited,
    remainingAccounts: SolanaAccountMeta[],
    computeConfig?: SolanaComputeConfig,
  ) {
    return this.writeReport(runtime, new Uint8Array(earnDepositedCodec.encode(input)), remainingAccounts, computeConfig)
  }

  writeReportFromEarnDepositeds(
    runtime: Runtime<unknown>,
    inputs: EarnDeposited[],
    remainingAccounts: SolanaAccountMeta[],
    computeConfig?: SolanaComputeConfig,
  ) {
    return this.writeReportFromBorshEncodedVec(
      runtime,
      inputs.map((input) => new Uint8Array(earnDepositedCodec.encode(input))),
      remainingAccounts,
      computeConfig,
    )
  }

  writeReportFromLiquidated(
    runtime: Runtime<unknown>,
    input: Liquidated,
    remainingAccounts: SolanaAccountMeta[],
    computeConfig?: SolanaComputeConfig,
  ) {
    return this.writeReport(runtime, new Uint8Array(liquidatedCodec.encode(input)), remainingAccounts, computeConfig)
  }

  writeReportFromLiquidateds(
    runtime: Runtime<unknown>,
    inputs: Liquidated[],
    remainingAccounts: SolanaAccountMeta[],
    computeConfig?: SolanaComputeConfig,
  ) {
    return this.writeReportFromBorshEncodedVec(
      runtime,
      inputs.map((input) => new Uint8Array(liquidatedCodec.encode(input))),
      remainingAccounts,
      computeConfig,
    )
  }

  writeReportFromMarket(
    runtime: Runtime<unknown>,
    input: Market,
    remainingAccounts: SolanaAccountMeta[],
    computeConfig?: SolanaComputeConfig,
  ) {
    return this.writeReport(runtime, new Uint8Array(marketCodec.encode(input)), remainingAccounts, computeConfig)
  }

  writeReportFromMarkets(
    runtime: Runtime<unknown>,
    inputs: Market[],
    remainingAccounts: SolanaAccountMeta[],
    computeConfig?: SolanaComputeConfig,
  ) {
    return this.writeReportFromBorshEncodedVec(
      runtime,
      inputs.map((input) => new Uint8Array(marketCodec.encode(input))),
      remainingAccounts,
      computeConfig,
    )
  }

  writeReportFromMarketParams(
    runtime: Runtime<unknown>,
    input: MarketParams,
    remainingAccounts: SolanaAccountMeta[],
    computeConfig?: SolanaComputeConfig,
  ) {
    return this.writeReport(runtime, new Uint8Array(marketParamsCodec.encode(input)), remainingAccounts, computeConfig)
  }

  writeReportFromMarketParamss(
    runtime: Runtime<unknown>,
    inputs: MarketParams[],
    remainingAccounts: SolanaAccountMeta[],
    computeConfig?: SolanaComputeConfig,
  ) {
    return this.writeReportFromBorshEncodedVec(
      runtime,
      inputs.map((input) => new Uint8Array(marketParamsCodec.encode(input))),
      remainingAccounts,
      computeConfig,
    )
  }

  writeReportFromPosition(
    runtime: Runtime<unknown>,
    input: Position,
    remainingAccounts: SolanaAccountMeta[],
    computeConfig?: SolanaComputeConfig,
  ) {
    return this.writeReport(runtime, new Uint8Array(positionCodec.encode(input)), remainingAccounts, computeConfig)
  }

  writeReportFromPositions(
    runtime: Runtime<unknown>,
    inputs: Position[],
    remainingAccounts: SolanaAccountMeta[],
    computeConfig?: SolanaComputeConfig,
  ) {
    return this.writeReportFromBorshEncodedVec(
      runtime,
      inputs.map((input) => new Uint8Array(positionCodec.encode(input))),
      remainingAccounts,
      computeConfig,
    )
  }

  writeReportFromPricePushed(
    runtime: Runtime<unknown>,
    input: PricePushed,
    remainingAccounts: SolanaAccountMeta[],
    computeConfig?: SolanaComputeConfig,
  ) {
    return this.writeReport(runtime, new Uint8Array(pricePushedCodec.encode(input)), remainingAccounts, computeConfig)
  }

  writeReportFromPricePusheds(
    runtime: Runtime<unknown>,
    inputs: PricePushed[],
    remainingAccounts: SolanaAccountMeta[],
    computeConfig?: SolanaComputeConfig,
  ) {
    return this.writeReportFromBorshEncodedVec(
      runtime,
      inputs.map((input) => new Uint8Array(pricePushedCodec.encode(input))),
      remainingAccounts,
      computeConfig,
    )
  }

  writeReportFromProtocol(
    runtime: Runtime<unknown>,
    input: Protocol,
    remainingAccounts: SolanaAccountMeta[],
    computeConfig?: SolanaComputeConfig,
  ) {
    return this.writeReport(runtime, new Uint8Array(protocolCodec.encode(input)), remainingAccounts, computeConfig)
  }

  writeReportFromProtocols(
    runtime: Runtime<unknown>,
    inputs: Protocol[],
    remainingAccounts: SolanaAccountMeta[],
    computeConfig?: SolanaComputeConfig,
  ) {
    return this.writeReportFromBorshEncodedVec(
      runtime,
      inputs.map((input) => new Uint8Array(protocolCodec.encode(input))),
      remainingAccounts,
      computeConfig,
    )
  }

  writeReportFromProtocolParams(
    runtime: Runtime<unknown>,
    input: ProtocolParams,
    remainingAccounts: SolanaAccountMeta[],
    computeConfig?: SolanaComputeConfig,
  ) {
    return this.writeReport(runtime, new Uint8Array(protocolParamsCodec.encode(input)), remainingAccounts, computeConfig)
  }

  writeReportFromProtocolParamss(
    runtime: Runtime<unknown>,
    inputs: ProtocolParams[],
    remainingAccounts: SolanaAccountMeta[],
    computeConfig?: SolanaComputeConfig,
  ) {
    return this.writeReportFromBorshEncodedVec(
      runtime,
      inputs.map((input) => new Uint8Array(protocolParamsCodec.encode(input))),
      remainingAccounts,
      computeConfig,
    )
  }

  writeReportFromSupplied(
    runtime: Runtime<unknown>,
    input: Supplied,
    remainingAccounts: SolanaAccountMeta[],
    computeConfig?: SolanaComputeConfig,
  ) {
    return this.writeReport(runtime, new Uint8Array(suppliedCodec.encode(input)), remainingAccounts, computeConfig)
  }

  writeReportFromSupplieds(
    runtime: Runtime<unknown>,
    inputs: Supplied[],
    remainingAccounts: SolanaAccountMeta[],
    computeConfig?: SolanaComputeConfig,
  ) {
    return this.writeReportFromBorshEncodedVec(
      runtime,
      inputs.map((input) => new Uint8Array(suppliedCodec.encode(input))),
      remainingAccounts,
      computeConfig,
    )
  }

  writeReportFromWithdrawn(
    runtime: Runtime<unknown>,
    input: Withdrawn,
    remainingAccounts: SolanaAccountMeta[],
    computeConfig?: SolanaComputeConfig,
  ) {
    return this.writeReport(runtime, new Uint8Array(withdrawnCodec.encode(input)), remainingAccounts, computeConfig)
  }

  writeReportFromWithdrawns(
    runtime: Runtime<unknown>,
    inputs: Withdrawn[],
    remainingAccounts: SolanaAccountMeta[],
    computeConfig?: SolanaComputeConfig,
  ) {
    return this.writeReportFromBorshEncodedVec(
      runtime,
      inputs.map((input) => new Uint8Array(withdrawnCodec.encode(input))),
      remainingAccounts,
      computeConfig,
    )
  }

  /**
   * Registers a typed log trigger for AgentActed events. The trigger
   * output is adapted to the decoded AgentActed data alongside the raw log.
   * Pass opts.cpi for events emitted via Anchor's emit_cpi!.
   */
  logTriggerAgentActedLog(
    filterName: string,
    filters: AgentActedFilters[] = [],
    opts?: SolanaLogTriggerOptions,
  ): Trigger<SolanaLog, SolanaDecodedLog<AgentActed>> {
    const config: SolanaFilterLogTriggerRequestJson = {
      name: filterName,
      address: bytesToBase64(this.programId),
      eventName: 'AgentActed',
      contractIdlJson: AGAMA_SOLANA_IDL_BASE64,
      subkeys: encodeAgentActedSubkeys(filters),
    }
    if (opts?.cpi) {
      config.cpiFilterConfig = anchorCPILogTriggerConfig(this.programId)
    }
    return adaptTrigger(this.client.logTrigger(config), (log) => ({
      log,
      data: decodeAgentActedEvent(log.data),
    }))
  }

  /**
   * Registers a typed log trigger for AmplifyClosed events. The trigger
   * output is adapted to the decoded AmplifyClosed data alongside the raw log.
   * Pass opts.cpi for events emitted via Anchor's emit_cpi!.
   */
  logTriggerAmplifyClosedLog(
    filterName: string,
    filters: AmplifyClosedFilters[] = [],
    opts?: SolanaLogTriggerOptions,
  ): Trigger<SolanaLog, SolanaDecodedLog<AmplifyClosed>> {
    const config: SolanaFilterLogTriggerRequestJson = {
      name: filterName,
      address: bytesToBase64(this.programId),
      eventName: 'AmplifyClosed',
      contractIdlJson: AGAMA_SOLANA_IDL_BASE64,
      subkeys: encodeAmplifyClosedSubkeys(filters),
    }
    if (opts?.cpi) {
      config.cpiFilterConfig = anchorCPILogTriggerConfig(this.programId)
    }
    return adaptTrigger(this.client.logTrigger(config), (log) => ({
      log,
      data: decodeAmplifyClosedEvent(log.data),
    }))
  }

  /**
   * Registers a typed log trigger for AmplifyOpened events. The trigger
   * output is adapted to the decoded AmplifyOpened data alongside the raw log.
   * Pass opts.cpi for events emitted via Anchor's emit_cpi!.
   */
  logTriggerAmplifyOpenedLog(
    filterName: string,
    filters: AmplifyOpenedFilters[] = [],
    opts?: SolanaLogTriggerOptions,
  ): Trigger<SolanaLog, SolanaDecodedLog<AmplifyOpened>> {
    const config: SolanaFilterLogTriggerRequestJson = {
      name: filterName,
      address: bytesToBase64(this.programId),
      eventName: 'AmplifyOpened',
      contractIdlJson: AGAMA_SOLANA_IDL_BASE64,
      subkeys: encodeAmplifyOpenedSubkeys(filters),
    }
    if (opts?.cpi) {
      config.cpiFilterConfig = anchorCPILogTriggerConfig(this.programId)
    }
    return adaptTrigger(this.client.logTrigger(config), (log) => ({
      log,
      data: decodeAmplifyOpenedEvent(log.data),
    }))
  }

  /**
   * Registers a typed log trigger for CreReportReceived events. The trigger
   * output is adapted to the decoded CreReportReceived data alongside the raw log.
   * Pass opts.cpi for events emitted via Anchor's emit_cpi!.
   */
  logTriggerCreReportReceivedLog(
    filterName: string,
    filters: CreReportReceivedFilters[] = [],
    opts?: SolanaLogTriggerOptions,
  ): Trigger<SolanaLog, SolanaDecodedLog<CreReportReceived>> {
    const config: SolanaFilterLogTriggerRequestJson = {
      name: filterName,
      address: bytesToBase64(this.programId),
      eventName: 'CreReportReceived',
      contractIdlJson: AGAMA_SOLANA_IDL_BASE64,
      subkeys: encodeCreReportReceivedSubkeys(filters),
    }
    if (opts?.cpi) {
      config.cpiFilterConfig = anchorCPILogTriggerConfig(this.programId)
    }
    return adaptTrigger(this.client.logTrigger(config), (log) => ({
      log,
      data: decodeCreReportReceivedEvent(log.data),
    }))
  }

  /**
   * Registers a typed log trigger for EarnClosed events. The trigger
   * output is adapted to the decoded EarnClosed data alongside the raw log.
   * Pass opts.cpi for events emitted via Anchor's emit_cpi!.
   */
  logTriggerEarnClosedLog(
    filterName: string,
    filters: EarnClosedFilters[] = [],
    opts?: SolanaLogTriggerOptions,
  ): Trigger<SolanaLog, SolanaDecodedLog<EarnClosed>> {
    const config: SolanaFilterLogTriggerRequestJson = {
      name: filterName,
      address: bytesToBase64(this.programId),
      eventName: 'EarnClosed',
      contractIdlJson: AGAMA_SOLANA_IDL_BASE64,
      subkeys: encodeEarnClosedSubkeys(filters),
    }
    if (opts?.cpi) {
      config.cpiFilterConfig = anchorCPILogTriggerConfig(this.programId)
    }
    return adaptTrigger(this.client.logTrigger(config), (log) => ({
      log,
      data: decodeEarnClosedEvent(log.data),
    }))
  }

  /**
   * Registers a typed log trigger for EarnDeposited events. The trigger
   * output is adapted to the decoded EarnDeposited data alongside the raw log.
   * Pass opts.cpi for events emitted via Anchor's emit_cpi!.
   */
  logTriggerEarnDepositedLog(
    filterName: string,
    filters: EarnDepositedFilters[] = [],
    opts?: SolanaLogTriggerOptions,
  ): Trigger<SolanaLog, SolanaDecodedLog<EarnDeposited>> {
    const config: SolanaFilterLogTriggerRequestJson = {
      name: filterName,
      address: bytesToBase64(this.programId),
      eventName: 'EarnDeposited',
      contractIdlJson: AGAMA_SOLANA_IDL_BASE64,
      subkeys: encodeEarnDepositedSubkeys(filters),
    }
    if (opts?.cpi) {
      config.cpiFilterConfig = anchorCPILogTriggerConfig(this.programId)
    }
    return adaptTrigger(this.client.logTrigger(config), (log) => ({
      log,
      data: decodeEarnDepositedEvent(log.data),
    }))
  }

  /**
   * Registers a typed log trigger for Liquidated events. The trigger
   * output is adapted to the decoded Liquidated data alongside the raw log.
   * Pass opts.cpi for events emitted via Anchor's emit_cpi!.
   */
  logTriggerLiquidatedLog(
    filterName: string,
    filters: LiquidatedFilters[] = [],
    opts?: SolanaLogTriggerOptions,
  ): Trigger<SolanaLog, SolanaDecodedLog<Liquidated>> {
    const config: SolanaFilterLogTriggerRequestJson = {
      name: filterName,
      address: bytesToBase64(this.programId),
      eventName: 'Liquidated',
      contractIdlJson: AGAMA_SOLANA_IDL_BASE64,
      subkeys: encodeLiquidatedSubkeys(filters),
    }
    if (opts?.cpi) {
      config.cpiFilterConfig = anchorCPILogTriggerConfig(this.programId)
    }
    return adaptTrigger(this.client.logTrigger(config), (log) => ({
      log,
      data: decodeLiquidatedEvent(log.data),
    }))
  }

  /**
   * Registers a typed log trigger for PricePushed events. The trigger
   * output is adapted to the decoded PricePushed data alongside the raw log.
   * Pass opts.cpi for events emitted via Anchor's emit_cpi!.
   */
  logTriggerPricePushedLog(
    filterName: string,
    filters: PricePushedFilters[] = [],
    opts?: SolanaLogTriggerOptions,
  ): Trigger<SolanaLog, SolanaDecodedLog<PricePushed>> {
    const config: SolanaFilterLogTriggerRequestJson = {
      name: filterName,
      address: bytesToBase64(this.programId),
      eventName: 'PricePushed',
      contractIdlJson: AGAMA_SOLANA_IDL_BASE64,
      subkeys: encodePricePushedSubkeys(filters),
    }
    if (opts?.cpi) {
      config.cpiFilterConfig = anchorCPILogTriggerConfig(this.programId)
    }
    return adaptTrigger(this.client.logTrigger(config), (log) => ({
      log,
      data: decodePricePushedEvent(log.data),
    }))
  }

  /**
   * Registers a typed log trigger for Supplied events. The trigger
   * output is adapted to the decoded Supplied data alongside the raw log.
   * Pass opts.cpi for events emitted via Anchor's emit_cpi!.
   */
  logTriggerSuppliedLog(
    filterName: string,
    filters: SuppliedFilters[] = [],
    opts?: SolanaLogTriggerOptions,
  ): Trigger<SolanaLog, SolanaDecodedLog<Supplied>> {
    const config: SolanaFilterLogTriggerRequestJson = {
      name: filterName,
      address: bytesToBase64(this.programId),
      eventName: 'Supplied',
      contractIdlJson: AGAMA_SOLANA_IDL_BASE64,
      subkeys: encodeSuppliedSubkeys(filters),
    }
    if (opts?.cpi) {
      config.cpiFilterConfig = anchorCPILogTriggerConfig(this.programId)
    }
    return adaptTrigger(this.client.logTrigger(config), (log) => ({
      log,
      data: decodeSuppliedEvent(log.data),
    }))
  }

  /**
   * Registers a typed log trigger for Withdrawn events. The trigger
   * output is adapted to the decoded Withdrawn data alongside the raw log.
   * Pass opts.cpi for events emitted via Anchor's emit_cpi!.
   */
  logTriggerWithdrawnLog(
    filterName: string,
    filters: WithdrawnFilters[] = [],
    opts?: SolanaLogTriggerOptions,
  ): Trigger<SolanaLog, SolanaDecodedLog<Withdrawn>> {
    const config: SolanaFilterLogTriggerRequestJson = {
      name: filterName,
      address: bytesToBase64(this.programId),
      eventName: 'Withdrawn',
      contractIdlJson: AGAMA_SOLANA_IDL_BASE64,
      subkeys: encodeWithdrawnSubkeys(filters),
    }
    if (opts?.cpi) {
      config.cpiFilterConfig = anchorCPILogTriggerConfig(this.programId)
    }
    return adaptTrigger(this.client.logTrigger(config), (log) => ({
      log,
      data: decodeWithdrawnEvent(log.data),
    }))
  }
}
