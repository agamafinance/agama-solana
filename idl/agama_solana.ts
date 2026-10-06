/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/agama_solana.json`.
 */
export type AgamaSolana = {
  "address": "6YdZN72p68ynpGH1SwZ86EseFokch6zPAQPAq9NxPY7D",
  "metadata": {
    "name": "agamaSolana",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Agama on Solana: deposit a tokenized stock, get more of it back"
  },
  "instructions": [
    {
      "name": "addMarket",
      "discriminator": [
        41,
        137,
        185,
        126,
        69,
        139,
        254,
        55
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "relations": [
            "protocol"
          ]
        },
        {
          "name": "protocol",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  46,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "stockMint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  111,
                  99,
                  107,
                  46,
                  118,
                  50
                ]
              },
              {
                "kind": "arg",
                "path": "symbol"
              }
            ]
          }
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116,
                  46,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "stockMint"
              }
            ]
          }
        },
        {
          "name": "custody",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  117,
                  115,
                  116,
                  111,
                  100,
                  121,
                  46,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "symbol",
          "type": {
            "array": [
              "u8",
              8
            ]
          }
        },
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "marketParams"
            }
          }
        }
      ]
    },
    {
      "name": "amplifyClose",
      "docs": [
        "Sell just enough stock to repay, hand the rest back."
      ],
      "discriminator": [
        97,
        158,
        238,
        226,
        209,
        243,
        96,
        81
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "protocol",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  46,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116,
                  46,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market.stock_mint",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "position",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110,
                  46,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "const",
                "value": [
                  97,
                  109,
                  112,
                  108,
                  105,
                  102,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "usdcMint",
          "writable": true
        },
        {
          "name": "stockMint",
          "writable": true
        },
        {
          "name": "poolUsdc",
          "writable": true
        },
        {
          "name": "vaultUsdc",
          "writable": true
        },
        {
          "name": "custody",
          "writable": true
        },
        {
          "name": "userStock",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "stockMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "amplifyOpen",
      "docs": [
        "Deposit stock, loop it to `leverage_bps` (10_000 = 1x) in one go: the",
        "borrow buys more of the same stock, pledged with the rest."
      ],
      "discriminator": [
        74,
        30,
        220,
        219,
        140,
        132,
        74,
        253
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "protocol",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  46,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116,
                  46,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market.stock_mint",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "position",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110,
                  46,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "const",
                "value": [
                  97,
                  109,
                  112,
                  108,
                  105,
                  102,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "usdcMint",
          "writable": true
        },
        {
          "name": "stockMint",
          "writable": true
        },
        {
          "name": "poolUsdc",
          "writable": true
        },
        {
          "name": "vaultUsdc",
          "writable": true
        },
        {
          "name": "custody",
          "writable": true
        },
        {
          "name": "userStock",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "stockMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "leverageBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "compound",
      "docs": [
        "Turn the vault yield above the debt into more of the stock. The swap is",
        "priced off the same oracle the market uses, so the caller has nothing",
        "to choose and nothing to skim."
      ],
      "discriminator": [
        165,
        208,
        251,
        78,
        242,
        160,
        141,
        47
      ],
      "accounts": [
        {
          "name": "caller",
          "signer": true
        },
        {
          "name": "protocol",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  46,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116,
                  46,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market.stock_mint",
                "account": "market"
              }
            ]
          },
          "relations": [
            "position"
          ]
        },
        {
          "name": "position",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110,
                  46,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "position.owner",
                "account": "position"
              },
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "position"
              }
            ]
          }
        },
        {
          "name": "usdcMint",
          "writable": true
        },
        {
          "name": "stockMint",
          "writable": true
        },
        {
          "name": "poolUsdc",
          "writable": true
        },
        {
          "name": "vaultUsdc",
          "writable": true
        },
        {
          "name": "custody",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        }
      ],
      "args": []
    },
    {
      "name": "earnClose",
      "docs": [
        "Repay out of the vault shares first, then the wallet for any shortfall,",
        "hand the stock back and the leftover yield as USDC."
      ],
      "discriminator": [
        18,
        43,
        238,
        163,
        229,
        166,
        162,
        208
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "protocol",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  46,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116,
                  46,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market.stock_mint",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "position",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110,
                  46,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "const",
                "value": [
                  101,
                  97,
                  114,
                  110
                ]
              }
            ]
          }
        },
        {
          "name": "usdcMint",
          "writable": true
        },
        {
          "name": "stockMint",
          "writable": true
        },
        {
          "name": "poolUsdc",
          "writable": true
        },
        {
          "name": "vaultUsdc",
          "writable": true
        },
        {
          "name": "custody",
          "writable": true
        },
        {
          "name": "userUsdc",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "userStock",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "stockMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "earnDeposit",
      "docs": [
        "Deposit stock (open or top up) and set the level. Borrows up to it at",
        "once; from then on the agents keep it there."
      ],
      "discriminator": [
        81,
        98,
        113,
        207,
        82,
        192,
        187,
        234
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "protocol",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  46,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116,
                  46,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market.stock_mint",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "position",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110,
                  46,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "const",
                "value": [
                  101,
                  97,
                  114,
                  110
                ]
              }
            ]
          }
        },
        {
          "name": "usdcMint",
          "writable": true
        },
        {
          "name": "stockMint",
          "writable": true
        },
        {
          "name": "poolUsdc",
          "writable": true
        },
        {
          "name": "vaultUsdc",
          "writable": true
        },
        {
          "name": "custody",
          "writable": true
        },
        {
          "name": "userStock",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "stockMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "targetLtvBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "earnSetTarget",
      "docs": [
        "Move the slider. The position goes there now, both ways."
      ],
      "discriminator": [
        187,
        54,
        78,
        3,
        37,
        159,
        205,
        215
      ],
      "accounts": [
        {
          "name": "user",
          "signer": true
        },
        {
          "name": "protocol",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  46,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116,
                  46,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market.stock_mint",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "position",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110,
                  46,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "const",
                "value": [
                  101,
                  97,
                  114,
                  110
                ]
              }
            ]
          }
        },
        {
          "name": "usdcMint",
          "writable": true
        },
        {
          "name": "stockMint",
          "writable": true
        },
        {
          "name": "poolUsdc",
          "writable": true
        },
        {
          "name": "vaultUsdc",
          "writable": true
        },
        {
          "name": "custody",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        }
      ],
      "args": [
        {
          "name": "targetLtvBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "faucetStock",
      "discriminator": [
        236,
        240,
        88,
        216,
        8,
        250,
        109,
        153
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "protocol",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  46,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "market",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116,
                  46,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market.stock_mint",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "stockMint",
          "writable": true
        },
        {
          "name": "userStock",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "stockMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "faucetUsdc",
      "discriminator": [
        190,
        45,
        226,
        28,
        94,
        130,
        98,
        127
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "protocol",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  46,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "usdcMint",
          "writable": true
        },
        {
          "name": "userUsdc",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initialize",
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "protocol",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  46,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "usdcMint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  100,
                  99,
                  46,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "lpMint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  112,
                  46,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "poolUsdc",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108,
                  95,
                  117,
                  115,
                  100,
                  99,
                  46,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "vaultUsdc",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  117,
                  115,
                  100,
                  99,
                  46,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "protocolParams"
            }
          }
        }
      ]
    },
    {
      "name": "liquidate",
      "docs": [
        "Backstop. The yield buffer goes first; only if that is not enough does",
        "the liquidator repay and take stock at the bonus."
      ],
      "discriminator": [
        223,
        179,
        226,
        125,
        48,
        46,
        39,
        74
      ],
      "accounts": [
        {
          "name": "liquidator",
          "writable": true,
          "signer": true
        },
        {
          "name": "protocol",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  46,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116,
                  46,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market.stock_mint",
                "account": "market"
              }
            ]
          },
          "relations": [
            "position"
          ]
        },
        {
          "name": "position",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110,
                  46,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "position.owner",
                "account": "position"
              },
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "position"
              }
            ]
          }
        },
        {
          "name": "usdcMint",
          "writable": true
        },
        {
          "name": "stockMint",
          "writable": true
        },
        {
          "name": "poolUsdc",
          "writable": true
        },
        {
          "name": "vaultUsdc",
          "writable": true
        },
        {
          "name": "custody",
          "writable": true
        },
        {
          "name": "liquidatorUsdc",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "liquidator"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "liquidatorStock",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "liquidator"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "stockMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "maxRepay",
          "type": "u64"
        }
      ]
    },
    {
      "name": "onReport",
      "docs": [
        "The Chainlink CRE receiver. The Keystone Forwarder calls this after",
        "verifying the DON's signatures; the markets to price follow `cre` in the",
        "accounts. Same bounds as the keeper: CRE replaces who brings the price,",
        "not what a price is allowed to do."
      ],
      "discriminator": [
        214,
        173,
        18,
        221,
        173,
        148,
        151,
        208
      ],
      "accounts": [
        {
          "name": "state"
        },
        {
          "name": "forwarderAuthority",
          "signer": true
        },
        {
          "name": "cre",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  114,
                  101,
                  46,
                  118,
                  50
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "metadata",
          "type": "bytes"
        },
        {
          "name": "report",
          "type": "bytes"
        }
      ]
    },
    {
      "name": "poke",
      "docs": [
        "Accrue interest and vault yield. Anyone, any time."
      ],
      "discriminator": [
        46,
        24,
        16,
        107,
        212,
        9,
        17,
        5
      ],
      "accounts": [
        {
          "name": "protocol",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  46,
                  118,
                  50
                ]
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "pushPrice",
      "docs": [
        "The keeper relays Pyth: the equity feed while the session trades, the",
        "xStock token's own 24/7 feed outside it. Bounded per push, and the",
        "publish time only moves forward."
      ],
      "discriminator": [
        113,
        238,
        232,
        235,
        60,
        71,
        127,
        203
      ],
      "accounts": [
        {
          "name": "keeper",
          "signer": true,
          "relations": [
            "protocol"
          ]
        },
        {
          "name": "protocol",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  46,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116,
                  46,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market.stock_mint",
                "account": "market"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "priceE8",
          "type": "u64"
        },
        {
          "name": "publishTime",
          "type": "i64"
        },
        {
          "name": "sessionOpen",
          "type": "bool"
        }
      ]
    },
    {
      "name": "rebalance",
      "docs": [
        "Hold the level the owner picked, both ways, with a 1% band."
      ],
      "discriminator": [
        108,
        158,
        77,
        9,
        210,
        52,
        88,
        62
      ],
      "accounts": [
        {
          "name": "caller",
          "signer": true
        },
        {
          "name": "protocol",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  46,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116,
                  46,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market.stock_mint",
                "account": "market"
              }
            ]
          },
          "relations": [
            "position"
          ]
        },
        {
          "name": "position",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110,
                  46,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "position.owner",
                "account": "position"
              },
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "position"
              }
            ]
          }
        },
        {
          "name": "usdcMint",
          "writable": true
        },
        {
          "name": "stockMint",
          "writable": true
        },
        {
          "name": "poolUsdc",
          "writable": true
        },
        {
          "name": "vaultUsdc",
          "writable": true
        },
        {
          "name": "custody",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        }
      ],
      "args": []
    },
    {
      "name": "setCre",
      "docs": [
        "Point the receiver at a forwarder deployment and, optionally, pin the",
        "workflow owner."
      ],
      "discriminator": [
        223,
        241,
        141,
        205,
        154,
        11,
        101,
        18
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "relations": [
            "protocol"
          ]
        },
        {
          "name": "protocol",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  46,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "cre",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  114,
                  101,
                  46,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "forwarderProgram",
          "type": "pubkey"
        },
        {
          "name": "forwarderState",
          "type": "pubkey"
        },
        {
          "name": "workflowOwner",
          "type": {
            "array": [
              "u8",
              20
            ]
          }
        },
        {
          "name": "simulation",
          "type": "bool"
        }
      ]
    },
    {
      "name": "setMarket",
      "discriminator": [
        24,
        133,
        119,
        187,
        28,
        115,
        163,
        81
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "protocol"
          ]
        },
        {
          "name": "protocol",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  46,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116,
                  46,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market.stock_mint",
                "account": "market"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "marketParams"
            }
          }
        }
      ]
    },
    {
      "name": "setParams",
      "discriminator": [
        27,
        234,
        178,
        52,
        147,
        2,
        187,
        141
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "protocol"
          ]
        },
        {
          "name": "protocol",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  46,
                  118,
                  50
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "protocolParams"
            }
          }
        }
      ]
    },
    {
      "name": "supply",
      "discriminator": [
        81,
        67,
        116,
        61,
        250,
        209,
        5,
        198
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "protocol",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  46,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "lpMint",
          "writable": true
        },
        {
          "name": "poolUsdc",
          "writable": true
        },
        {
          "name": "userUsdc",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "userLp",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "lpMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdraw",
      "discriminator": [
        183,
        18,
        70,
        156,
        148,
        109,
        161,
        34
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "protocol",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108,
                  46,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "lpMint",
          "writable": true
        },
        {
          "name": "poolUsdc",
          "writable": true
        },
        {
          "name": "userUsdc",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "userLp",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "lpMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "lp",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "creConfig",
      "discriminator": [
        223,
        155,
        135,
        163,
        37,
        82,
        124,
        78
      ]
    },
    {
      "name": "market",
      "discriminator": [
        219,
        190,
        213,
        55,
        0,
        227,
        198,
        154
      ]
    },
    {
      "name": "position",
      "discriminator": [
        170,
        188,
        143,
        228,
        122,
        64,
        247,
        208
      ]
    },
    {
      "name": "protocol",
      "discriminator": [
        45,
        39,
        101,
        43,
        115,
        72,
        131,
        40
      ]
    }
  ],
  "events": [
    {
      "name": "agentActed",
      "discriminator": [
        137,
        17,
        53,
        163,
        179,
        198,
        16,
        173
      ]
    },
    {
      "name": "amplifyClosed",
      "discriminator": [
        108,
        45,
        188,
        8,
        194,
        226,
        87,
        230
      ]
    },
    {
      "name": "amplifyOpened",
      "discriminator": [
        239,
        198,
        185,
        17,
        106,
        45,
        76,
        13
      ]
    },
    {
      "name": "creReportReceived",
      "discriminator": [
        47,
        189,
        143,
        54,
        90,
        97,
        15,
        198
      ]
    },
    {
      "name": "earnClosed",
      "discriminator": [
        53,
        151,
        79,
        197,
        240,
        1,
        228,
        217
      ]
    },
    {
      "name": "earnDeposited",
      "discriminator": [
        161,
        5,
        190,
        137,
        154,
        196,
        18,
        11
      ]
    },
    {
      "name": "liquidated",
      "discriminator": [
        231,
        57,
        55,
        75,
        0,
        170,
        246,
        68
      ]
    },
    {
      "name": "pricePushed",
      "discriminator": [
        82,
        163,
        38,
        13,
        83,
        94,
        115,
        118
      ]
    },
    {
      "name": "priceSkipped",
      "discriminator": [
        75,
        158,
        73,
        63,
        232,
        197,
        199,
        244
      ]
    },
    {
      "name": "supplied",
      "discriminator": [
        137,
        114,
        239,
        72,
        162,
        75,
        133,
        39
      ]
    },
    {
      "name": "withdrawn",
      "discriminator": [
        20,
        89,
        223,
        198,
        194,
        124,
        219,
        13
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "mathOverflow",
      "msg": "Math overflow"
    },
    {
      "code": 6001,
      "name": "zeroAmount",
      "msg": "Amount must be above zero"
    },
    {
      "code": 6002,
      "name": "notAdmin",
      "msg": "Only the admin"
    },
    {
      "code": 6003,
      "name": "notKeeper",
      "msg": "Only the keeper"
    },
    {
      "code": 6004,
      "name": "notOwner",
      "msg": "Only the position owner"
    },
    {
      "code": 6005,
      "name": "badParams",
      "msg": "Market parameters out of range"
    },
    {
      "code": 6006,
      "name": "noPrice",
      "msg": "No price pushed yet"
    },
    {
      "code": 6007,
      "name": "stalePrice",
      "msg": "Price is stale: borrowing waits for a fresh one"
    },
    {
      "code": 6008,
      "name": "priceJumpTooLarge",
      "msg": "Price moved more than the per-push bound"
    },
    {
      "code": 6009,
      "name": "badPublishTime",
      "msg": "Publish time goes backwards or into the future"
    },
    {
      "code": 6010,
      "name": "targetTooHigh",
      "msg": "Target LTV above what the market allows right now"
    },
    {
      "code": 6011,
      "name": "leverageOutOfRange",
      "msg": "Leverage out of range for this market"
    },
    {
      "code": 6012,
      "name": "poolIlliquid",
      "msg": "Not enough USDC in the pool"
    },
    {
      "code": 6013,
      "name": "ltvExceeded",
      "msg": "This would take the position above the market's LTV"
    },
    {
      "code": 6014,
      "name": "alreadyOnTarget",
      "msg": "Already within the band around the target"
    },
    {
      "code": 6015,
      "name": "nothingToDeleverage",
      "msg": "No yield buffer left to repay from: the stock is never sold to rebalance"
    },
    {
      "code": 6016,
      "name": "nothingToCompound",
      "msg": "No yield above the debt to compound yet"
    },
    {
      "code": 6017,
      "name": "healthy",
      "msg": "Position is healthy"
    },
    {
      "code": 6018,
      "name": "underwater",
      "msg": "Collateral does not cover the debt"
    },
    {
      "code": 6019,
      "name": "wrongKind",
      "msg": "Wrong position kind for this instruction"
    },
    {
      "code": 6020,
      "name": "withdrawTooLarge",
      "msg": "Too many LP shares for the pool's free cash"
    },
    {
      "code": 6021,
      "name": "invalidForwarder",
      "msg": "Report did not come through the configured Chainlink forwarder"
    },
    {
      "code": 6022,
      "name": "invalidForwarderAuthority",
      "msg": "forwarder_authority is not the forwarder's PDA for this state and program"
    },
    {
      "code": 6023,
      "name": "invalidWorkflowOwner",
      "msg": "Report comes from another workflow owner"
    },
    {
      "code": 6024,
      "name": "invalidReport",
      "msg": "Report metadata or payload could not be decoded"
    },
    {
      "code": 6025,
      "name": "marketNotInReport",
      "msg": "No market in the accounts for a symbol in the report"
    }
  ],
  "types": [
    {
      "name": "agentActed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agent",
            "type": "pubkey"
          },
          {
            "name": "position",
            "type": "pubkey"
          },
          {
            "name": "op",
            "type": "u8"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "amplifyClosed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "repaid",
            "type": "u64"
          },
          {
            "name": "stockSold",
            "type": "u64"
          },
          {
            "name": "stockOut",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "amplifyOpened",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "stockIn",
            "type": "u64"
          },
          {
            "name": "stockBought",
            "type": "u64"
          },
          {
            "name": "debt",
            "type": "u64"
          },
          {
            "name": "leverageBps",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "creConfig",
      "docs": [
        "Where Chainlink CRE reports may come from. The Keystone Forwarder verifies",
        "the DON's signatures, then CPIs `on_report` signed by a PDA of",
        "`[\"forwarder\", forwarder_state, this program]`; the receiver checks that PDA",
        "and the workflow owner in the metadata."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "forwarderProgram",
            "type": "pubkey"
          },
          {
            "name": "forwarderState",
            "type": "pubkey"
          },
          {
            "name": "workflowOwner",
            "docs": [
              "EVM-style address of the workflow owner, as CRE puts it in the",
              "metadata. All zero accepts any owner."
            ],
            "type": {
              "array": [
                "u8",
                20
              ]
            }
          },
          {
            "name": "simulation",
            "docs": [
              "True while the forwarder is the CLI's mock: it relays without checking",
              "signatures, so reports are only as trusted as the per-push bounds."
            ],
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "reports",
            "type": "u64"
          },
          {
            "name": "lastReportAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "creReportReceived",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "workflowOwner",
            "type": {
              "array": [
                "u8",
                20
              ]
            }
          },
          {
            "name": "simulation",
            "type": "bool"
          },
          {
            "name": "report",
            "type": {
              "defined": {
                "name": "priceReport"
              }
            }
          }
        ]
      }
    },
    {
      "name": "earnClosed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "repaid",
            "type": "u64"
          },
          {
            "name": "fromBuffer",
            "type": "u64"
          },
          {
            "name": "fromWallet",
            "type": "u64"
          },
          {
            "name": "usdcOut",
            "type": "u64"
          },
          {
            "name": "stockOut",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "earnDeposited",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "stock",
            "type": "u64"
          },
          {
            "name": "borrowed",
            "type": "u64"
          },
          {
            "name": "targetLtvBps",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "liquidated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "liquidator",
            "type": "pubkey"
          },
          {
            "name": "position",
            "type": "pubkey"
          },
          {
            "name": "repaid",
            "type": "u64"
          },
          {
            "name": "seized",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "market",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "stockMint",
            "type": "pubkey"
          },
          {
            "name": "custody",
            "type": "pubkey"
          },
          {
            "name": "symbol",
            "type": {
              "array": [
                "u8",
                8
              ]
            }
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "ltvBps",
            "type": "u16"
          },
          {
            "name": "ltBps",
            "type": "u16"
          },
          {
            "name": "liqBonusBps",
            "type": "u16"
          },
          {
            "name": "offhoursBufferBps",
            "docs": [
              "Taken off both LTV and threshold while the share does not trade."
            ],
            "type": "u16"
          },
          {
            "name": "priceE8",
            "type": "u64"
          },
          {
            "name": "priceTime",
            "docs": [
              "Publish time of the source the price came from."
            ],
            "type": "i64"
          },
          {
            "name": "sessionOpen",
            "type": "bool"
          },
          {
            "name": "maxAge",
            "type": "u32"
          },
          {
            "name": "maxJumpBps",
            "type": "u16"
          },
          {
            "name": "totalCollateral",
            "type": "u64"
          },
          {
            "name": "totalScaledDebt",
            "type": "u128"
          }
        ]
      }
    },
    {
      "name": "marketParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "ltvBps",
            "type": "u16"
          },
          {
            "name": "ltBps",
            "type": "u16"
          },
          {
            "name": "liqBonusBps",
            "type": "u16"
          },
          {
            "name": "offhoursBufferBps",
            "type": "u16"
          },
          {
            "name": "maxAge",
            "type": "u32"
          },
          {
            "name": "maxJumpBps",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "position",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "kind",
            "type": "u8"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "collateral",
            "docs": [
              "Stock pledged, in the stock's base units (8 decimals)."
            ],
            "type": "u64"
          },
          {
            "name": "scaledDebt",
            "type": "u128"
          },
          {
            "name": "shares",
            "docs": [
              "Earn only: vault shares bought with the borrowed USDC. A free buffer,",
              "not pledged: it repays the debt before the stock is ever sold."
            ],
            "type": "u64"
          },
          {
            "name": "targetLtvBps",
            "docs": [
              "The level the owner picked. The agents hold the position there."
            ],
            "type": "u16"
          },
          {
            "name": "leverageBps",
            "docs": [
              "Amplify only: the loop multiple, 10_000 = 1x."
            ],
            "type": "u16"
          },
          {
            "name": "deposited",
            "type": "u64"
          },
          {
            "name": "stockFromYield",
            "type": "u64"
          },
          {
            "name": "openedAt",
            "type": "i64"
          },
          {
            "name": "lastAgentAt",
            "type": "i64"
          },
          {
            "name": "lastAgent",
            "type": "pubkey"
          },
          {
            "name": "lastAgentOp",
            "type": "u8"
          },
          {
            "name": "lastAgentAmount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "pricePushed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "priceE8",
            "type": "u64"
          },
          {
            "name": "publishTime",
            "type": "i64"
          },
          {
            "name": "sessionOpen",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "priceReport",
      "docs": [
        "The Borsh payload a CRE workflow writes: a few markets per report, since a",
        "Solana transaction leaves the forwarder ~265 bytes once accounts are paid."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "updates",
            "type": {
              "vec": {
                "defined": {
                  "name": "priceUpdate"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "priceSkipped",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "priceE8",
            "type": "u64"
          },
          {
            "name": "publishTime",
            "type": "i64"
          },
          {
            "name": "currentPriceE8",
            "type": "u64"
          },
          {
            "name": "currentPublishTime",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "priceUpdate",
      "docs": [
        "One price in a CRE report."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "symbol",
            "type": {
              "array": [
                "u8",
                8
              ]
            }
          },
          {
            "name": "priceE8",
            "type": "u64"
          },
          {
            "name": "publishTime",
            "type": "i64"
          },
          {
            "name": "sessionOpen",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "protocol",
      "docs": [
        "The lending pool, the private credit vault and every mint the program",
        "controls hang off this one PDA. It signs for all of them."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "keeper",
            "docs": [
              "Pushes prices. Bounded on chain, so a bad keeper can drift a price by",
              "at most `max_jump_bps` per push, never set it."
            ],
            "type": "pubkey"
          },
          {
            "name": "usdcMint",
            "type": "pubkey"
          },
          {
            "name": "lpMint",
            "type": "pubkey"
          },
          {
            "name": "poolUsdc",
            "type": "pubkey"
          },
          {
            "name": "vaultUsdc",
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "cash",
            "docs": [
              "USDC the pool holds and can lend."
            ],
            "type": "u64"
          },
          {
            "name": "totalScaledDebt",
            "type": "u128"
          },
          {
            "name": "borrowIndex",
            "docs": [
              "Grows with the borrow rate. Debt = scaled * index / WAD."
            ],
            "type": "u128"
          },
          {
            "name": "lastAccrual",
            "type": "i64"
          },
          {
            "name": "baseRateBps",
            "type": "u32"
          },
          {
            "name": "slope1Bps",
            "type": "u32"
          },
          {
            "name": "slope2Bps",
            "type": "u32"
          },
          {
            "name": "kinkBps",
            "type": "u32"
          },
          {
            "name": "minBorrow",
            "type": "u64"
          },
          {
            "name": "vaultShares",
            "type": "u64"
          },
          {
            "name": "navWad",
            "docs": [
              "USDC per share, WAD. Accrues at `vault_apr_bps`."
            ],
            "type": "u128"
          },
          {
            "name": "vaultAprBps",
            "type": "u32"
          },
          {
            "name": "vaultCash",
            "docs": [
              "USDC actually sitting in the vault account."
            ],
            "type": "u64"
          },
          {
            "name": "couponsPaid",
            "docs": [
              "Coupons the credit book paid into the vault (devnet stand-in: minted)."
            ],
            "type": "u64"
          },
          {
            "name": "minCompound",
            "type": "u64"
          },
          {
            "name": "dexFeeBps",
            "type": "u32"
          },
          {
            "name": "marketCount",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "protocolParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "keeper",
            "type": "pubkey"
          },
          {
            "name": "baseRateBps",
            "type": "u32"
          },
          {
            "name": "slope1Bps",
            "type": "u32"
          },
          {
            "name": "slope2Bps",
            "type": "u32"
          },
          {
            "name": "kinkBps",
            "type": "u32"
          },
          {
            "name": "vaultAprBps",
            "type": "u32"
          },
          {
            "name": "minBorrow",
            "type": "u64"
          },
          {
            "name": "minCompound",
            "type": "u64"
          },
          {
            "name": "dexFeeBps",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "supplied",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "usdc",
            "type": "u64"
          },
          {
            "name": "lp",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "withdrawn",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "usdc",
            "type": "u64"
          },
          {
            "name": "lp",
            "type": "u64"
          }
        ]
      }
    }
  ]
};
