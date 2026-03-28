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

    async def create_embedded_wallet(self, auth0_user_id: str) -> dict:
        """
        Create a server-side Solana wallet for a user.
        Returns { wallet_id, address }
        """
        _check_configured()
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{PRIVY_BASE_URL}/wallets",
                headers=_auth_headers(),
                json={
                    "chain_type": "solana",
                    "owner": {
                        "type": "user",
                        "did": f"did:privy:{auth0_user_id}",
                    },
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return {
                "wallet_id": data["id"],
                "address": data["address"],
            }

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
