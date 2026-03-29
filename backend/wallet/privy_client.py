"""
ClearFund Privy Client
Manages server-side Solana wallets via Privy's API.
"""

import base64
import json
import os
from typing import Optional

import httpx
from dotenv import load_dotenv

load_dotenv()

PRIVY_APP_ID     = os.getenv("PRIVY_APP_ID", "")
PRIVY_APP_SECRET = os.getenv("PRIVY_APP_SECRET", "")
SOLANA_RPC_URL   = f"https://api.{os.getenv('SOLANA_NETWORK', 'devnet')}.solana.com"
PRIVY_BASE_URL   = "https://auth.privy.io/api/v1"

LAMPORTS_PER_SOL = 1_000_000_000


def _check_configured() -> None:
    if not PRIVY_APP_ID or not PRIVY_APP_SECRET:
        raise RuntimeError(
            "Privy not configured — set PRIVY_APP_ID and PRIVY_APP_SECRET in your .env"
        )


def _auth_headers() -> dict:
    credentials = base64.b64encode(
        f"{PRIVY_APP_ID}:{PRIVY_APP_SECRET}".encode()
    ).decode()
    return {
        "Authorization": f"Basic {credentials}",
        "privy-app-id": PRIVY_APP_ID,
        "Content-Type": "application/json",
    }


class PrivyClient:

    async def create_embedded_wallet(self, owner_id: str) -> dict:
        """
        Create a server-side Solana wallet.
        Returns { wallet_id, address }
        """
        _check_configured()
        owner_id = (owner_id or "").strip()
        if not owner_id:
            raise ValueError("owner_id is required to create a wallet")
        timeout = httpx.Timeout(connect=6.0, read=10.0, write=10.0, pool=10.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(
                f"{PRIVY_BASE_URL}/wallets",
                headers=_auth_headers(),
                json={
                    "chain_type": "solana",
                    "owner": {
                        "type": "user",
                        "did": f"did:privy:{owner_id}",
                    },
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return {
                "wallet_id": data["id"],
                "address": data["address"],
            }

    async def create_campaign_vault_wallet(self, campaign_id: str) -> dict:
        """
        Create a dedicated server-side Solana vault wallet for a campaign.
        Returns { wallet_id, address }
        """
        owner_ref = f"campaign-vault:{campaign_id}"
        return await self.create_embedded_wallet(owner_ref)

    async def sign_and_send_transaction(self, wallet_id: str, tx_base64: str) -> str:
        """
        Sign and broadcast a base64-encoded Solana transaction via Privy.
        Returns the transaction signature string.
        """
        _check_configured()
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{PRIVY_BASE_URL}/wallets/{wallet_id}/rpc",
                headers=_auth_headers(),
                json={
                    "method": "signAndSendTransaction",
                    "params": {
                        "transaction": tx_base64,
                        "encoding": "base64",
                    },
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data["result"]["signature"]

    async def get_wallet_balance(self, address: str) -> float:
        """
        Fetch SOL balance from Solana RPC.
        Returns balance in SOL (not lamports).
        """
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                SOLANA_RPC_URL,
                json={
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "getBalance",
                    "params": [address],
                },
            )
            resp.raise_for_status()
            data = resp.json()
            lamports = data["result"]["value"]
            return lamports / LAMPORTS_PER_SOL

    async def request_airdrop(self, address: str, sol: float = 5.0) -> str:
        """
        Request a devnet SOL airdrop for an address.
        Only works on devnet/testnet. Returns transaction signature.
        """
        lamports = int(sol * LAMPORTS_PER_SOL)
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                SOLANA_RPC_URL,
                json={
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "requestAirdrop",
                    "params": [address, lamports],
                },
            )
            resp.raise_for_status()
            data = resp.json()
            if "error" in data:
                raise Exception(f"Airdrop failed: {data['error']}")
            return data["result"]  # transaction signature
