import { Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js'
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'

const NETWORK = (import.meta.env.VITE_SOLANA_NETWORK as string | undefined) ?? 'devnet'
const RPC_URL =
  (import.meta.env.VITE_SOLANA_RPC_URL as string | undefined) ??
  `https://api.${NETWORK}.solana.com`

const LAMPORTS_PER_SOL = 1_000_000_000

interface SolanaTransferResult {
  signature: string
  walletAddress: string
  explorerUrl: string
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
  if (NETWORK === 'localnet') {
    const ngrokUrl = import.meta.env.VITE_SOLANA_RPC_URL as string | undefined
    return `https://explorer.solana.com/tx/${signature}?cluster=custom&customUrl=${encodeURIComponent(ngrokUrl ?? RPC_URL)}`
  }
  return `https://explorer.solana.com/tx/${signature}?cluster=${NETWORK}`
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
    SystemProgram.transfer({ fromPubkey, toPubkey, lamports }),
  )
  return tx
}

export async function transferSolToVault(
  campaignVaultAddress: string,
  amountSol: number,
): Promise<SolanaTransferResult> {
  const connection = new Connection(RPC_URL, 'confirmed')

  if (window.solflare?.isConnected || window.solflare) {
    const adapter = new SolflareWalletAdapter({ network: networkForAdapter() })
    await adapter.connect()
    if (!adapter.publicKey) throw new Error('Solflare wallet did not connect')
    const walletAddress = adapter.publicKey.toBase58()
    const tx = await buildTransferTx(connection, walletAddress, campaignVaultAddress, amountSol)
    const signature = await adapter.sendTransaction(tx, connection, {
      preflightCommitment: 'confirmed',
      maxRetries: 3,
    })
    return { signature, walletAddress, explorerUrl: explorerUrl(signature) }
  }

  throw new Error('No supported wallet found. Install Solflare to donate directly.')
}
