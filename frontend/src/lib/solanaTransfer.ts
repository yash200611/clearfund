import { Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js'
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'

const NETWORK = (import.meta.env.VITE_SOLANA_NETWORK as string | undefined) ?? 'devnet'
const RPC_URL =
  (import.meta.env.VITE_SOLANA_RPC_URL as string | undefined) ??
  `https://api.${NETWORK}.solana.com`

const LAMPORTS_PER_SOL = 1_000_000_000

type WalletProvider = 'privy' | 'solflare'

interface SolanaTransferResult {
  signature: string
  walletAddress: string
  provider: WalletProvider
  explorerUrl: string
}

interface PrivySolanaProvider {
  address?: string
  getAddress?: () => Promise<string>
  sendTransaction?: (arg: unknown) => Promise<unknown>
}

declare global {
  interface Window {
    privy?: {
      solana?: PrivySolanaProvider
    }
    solflare?: unknown
    solana?: {
      isSolflare?: boolean
    }
  }
}

function networkForAdapter(): WalletAdapterNetwork {
  if (NETWORK === 'mainnet' || NETWORK === 'mainnet-beta') return WalletAdapterNetwork.Mainnet
  if (NETWORK === 'testnet') return WalletAdapterNetwork.Testnet
  return WalletAdapterNetwork.Devnet
}

function lamportsFromSol(amountSol: number): number {
  return Math.round(amountSol * LAMPORTS_PER_SOL)
}

function explorerUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=${NETWORK}`
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function normalizeSignature(result: unknown): string | null {
  if (typeof result === 'string') return result
  if (result && typeof result === 'object') {
    const maybeSig = (result as { signature?: unknown }).signature
    if (typeof maybeSig === 'string') return maybeSig
    const maybeHash = (result as { hash?: unknown }).hash
    if (typeof maybeHash === 'string') return maybeHash
  }
  return null
}

async function buildTransferTx(connection: Connection, from: string, to: string, amountSol: number) {
  const lamports = lamportsFromSol(amountSol)
  if (!Number.isFinite(lamports) || lamports <= 0) {
    throw new Error('Amount must be greater than 0 SOL')
  }

  const fromPubkey = new PublicKey(from)
  const toPubkey = new PublicKey(to)
  const { blockhash } = await connection.getLatestBlockhash('finalized')

  const tx = new Transaction({
    feePayer: fromPubkey,
    recentBlockhash: blockhash,
  }).add(
    SystemProgram.transfer({
      fromPubkey,
      toPubkey,
      lamports,
    }),
  )

  return tx
}

async function sendWithPrivy(
  connection: Connection,
  campaignVaultAddress: string,
  amountSol: number,
): Promise<SolanaTransferResult> {
  const provider = window.privy?.solana
  if (!provider?.sendTransaction) throw new Error('Privy Solana provider is not available in this session')

  const walletAddress = provider.address ?? (provider.getAddress ? await provider.getAddress() : '')
  if (!walletAddress) throw new Error('Privy wallet address is unavailable')

  const tx = await buildTransferTx(connection, walletAddress, campaignVaultAddress, amountSol)
  const unsignedTxB64 = bytesToBase64(tx.serialize({ verifySignatures: false, requireAllSignatures: false }))

  // Different Privy wrappers accept either serialized tx payload or raw transaction object.
  let sendResult: unknown
  try {
    sendResult = await provider.sendTransaction({
      transaction: unsignedTxB64,
      encoding: 'base64',
      chain: 'solana',
    })
  } catch {
    sendResult = await provider.sendTransaction(tx)
  }

  const signature = normalizeSignature(sendResult)
  if (!signature) {
    throw new Error('Privy transaction sent, but no signature was returned')
  }

  return {
    signature,
    walletAddress,
    provider: 'privy',
    explorerUrl: explorerUrl(signature),
  }
}

async function sendWithSolflare(
  connection: Connection,
  campaignVaultAddress: string,
  amountSol: number,
): Promise<SolanaTransferResult> {
  const adapter = new SolflareWalletAdapter({ network: networkForAdapter() })
  await adapter.connect()
  if (!adapter.publicKey) throw new Error('Solflare wallet did not connect')

  const walletAddress = adapter.publicKey.toBase58()
  const tx = await buildTransferTx(connection, walletAddress, campaignVaultAddress, amountSol)
  const signature = await adapter.sendTransaction(tx, connection, {
    preflightCommitment: 'confirmed',
    maxRetries: 3,
  })

  return {
    signature,
    walletAddress,
    provider: 'solflare',
    explorerUrl: explorerUrl(signature),
  }
}

export async function transferSolToVault(
  campaignVaultAddress: string,
  amountSol: number,
): Promise<SolanaTransferResult> {
  const connection = new Connection(RPC_URL, 'confirmed')

  if (window.privy?.solana?.sendTransaction) {
    return sendWithPrivy(connection, campaignVaultAddress, amountSol)
  }

  if (window.solana?.isSolflare || window.solflare) {
    return sendWithSolflare(connection, campaignVaultAddress, amountSol)
  }

  throw new Error('No supported wallet found. Open with Privy wallet or install Solflare.')
}

