// Code generated — DO NOT EDIT.
import { addSolanaContractMock, type SolanaContractMock, type SolanaMock } from '@chainlink/cre-sdk/test'

import { AGAMA_SOLANA_PROGRAM_ID } from './AgamaSolana'

export type AgamaSolanaMock = SolanaContractMock

/**
 * Registers a AgamaSolana program mock on a SolanaMock instance.
 * The Solana CRE capability is write-only, so the mock routes writeReport
 * calls targeting this program's ID; set the returned mock's writeReport
 * property to define the reply.
 */
export function newAgamaSolanaMock(
  solanaMock: SolanaMock,
  programId: string | Uint8Array = AGAMA_SOLANA_PROGRAM_ID,
): AgamaSolanaMock {
  return addSolanaContractMock(solanaMock, { programId })
}
