"""
ClearFund Escrow Executor
Only called when OracleVerdict == APPROVED.
Builds and submits Solana transactions via Privy.
"""

import base64
import os
from datetime import datetime, timezone
from typing import Optional

from solana.rpc.api import Client as SolanaClient
from solders.pubkey import Pubkey
from solders.system_program import transfer, TransferParams
from solders.transaction import Transaction
from solders.keypair import Keypair
from solders.message import Message
from solders.hash import Hash

from oracle.decision_oracle import OracleResult, OracleVerdict
from wallet.privy_client import PrivyClient

SOLANA_NETWORK       = os.getenv("SOLANA_NETWORK", "devnet")
SOLANA_RPC_URL       = f"https://api.{SOLANA_NETWORK}.solana.com"
PRIVY_AUTHORITY_ID   = os.getenv("PRIVY_AUTHORITY_WALLET_ID", "")
LAMPORTS_PER_SOL     = 1_000_000_000
EXPLORER_BASE        = "https://explorer.solana.com/tx"


class EscrowExecutor:

    def __init__(self):
        self.privy = PrivyClient()
        self.solana = SolanaClient(SOLANA_RPC_URL)

    def _build_transfer_tx(
        self,
        from_address: str,
        to_address: str,
        amount_sol: float,
    ) -> str:
        """Build a Solana transfer transaction and return it as base64."""
        from_pubkey = Pubkey.from_string(from_address)
        to_pubkey   = Pubkey.from_string(to_address)
        lamports    = int(amount_sol * LAMPORTS_PER_SOL)

        # Fetch a recent blockhash
        blockhash_resp  = self.solana.get_latest_blockhash()
        recent_blockhash = blockhash_resp.value.blockhash

        ix = transfer(
            TransferParams(
                from_pubkey=from_pubkey,
                to_pubkey=to_pubkey,
                lamports=lamports,
            )
        )

        msg = Message.new_with_blockhash(
            instructions=[ix],
            payer=from_pubkey,
            blockhash=recent_blockhash,
        )

        tx = Transaction.new_unsigned(msg)
        tx_bytes = bytes(tx)
        return base64.b64encode(tx_bytes).decode()

    @staticmethod
    def _vault_signer_wallet_id(campaign: dict) -> str:
        """
        Preferred signer is the campaign-specific Privy vault wallet.
        Fallback to legacy global authority for backward compatibility.
        """
        return campaign.get("privy_vault_wallet_id", "") or PRIVY_AUTHORITY_ID

    async def release_milestone(
        self,
        campaign: dict,
        milestone: dict,
        oracle_result: OracleResult,
        donations: list[dict],
    ) -> dict:
        """
        Release milestone funds from vault to NGO wallet.
        Only callable when oracle_result.verdict == APPROVED.
        """
        if oracle_result.verdict != OracleVerdict.APPROVED:
            raise ValueError(
                f"release_milestone called with non-APPROVED verdict: {oracle_result.verdict}"
            )

        vault_address  = campaign.get("vault_address", "")
        ngo_wallet     = campaign.get("ngo_wallet", "")
        amount_sol     = float(milestone.get("amount_sol", 0))

        if not vault_address or not ngo_wallet:
            raise ValueError("Campaign missing vault_address or ngo_wallet")

        signer_wallet_id = self._vault_signer_wallet_id(campaign)
        if not signer_wallet_id:
            raise RuntimeError("Campaign missing Privy vault signer wallet ID")

        # Build and send transaction
        tx_b64    = self._build_transfer_tx(vault_address, ngo_wallet, amount_sol)
        signature = await self.privy.sign_and_send_transaction(signer_wallet_id, tx_b64)

        released_at   = datetime.now(timezone.utc)
        explorer_url  = f"{EXPLORER_BASE}/{signature}?cluster={SOLANA_NETWORK}"

        # Calculate proportional release per donor
        total_donated = sum(float(d.get("amount_sol", 0)) for d in donations) or 1.0
        per_donor_released = [
            {
                "donor_id":   d.get("donor_id") or d.get("_id"),
                "amount_sol": round(
                    amount_sol * (float(d.get("amount_sol", 0)) / total_donated), 9
                ),
            }
            for d in donations
        ]

        return {
            "signature":          signature,
            "explorer_url":       explorer_url,
            "released_at":        released_at.isoformat(),
            "per_donor_released": per_donor_released,
        }

    async def refund_donors(
        self,
        campaign: dict,
        donations: list[dict],
    ) -> list[dict]:
        """
        Refund all donors with remaining locked_sol back to their wallets.
        Called when campaign failure_count >= 3.
        """
        vault_address = campaign.get("vault_address", "")
        if not vault_address:
            raise ValueError("Campaign missing vault_address")

        signer_wallet_id = self._vault_signer_wallet_id(campaign)
        if not signer_wallet_id:
            raise RuntimeError("Campaign missing Privy vault signer wallet ID")

        results = []
        for donation in donations:
            locked = float(donation.get("locked_sol", 0))
            if locked <= 0:
                continue

            donor_wallet = donation.get("wallet_address", "")
            if not donor_wallet:
                continue

            tx_b64    = self._build_transfer_tx(vault_address, donor_wallet, locked)
            signature = await self.privy.sign_and_send_transaction(signer_wallet_id, tx_b64)

            results.append({
                "donor_id":   donation.get("donor_id") or donation.get("_id"),
                "signature":  signature,
                "amount_sol": locked,
            })

        return results
