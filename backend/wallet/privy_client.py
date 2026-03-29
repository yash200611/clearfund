"""
ClearFund Privy Client
Manages server-side Solana wallets via Privy's API.
"""

import base64
import logging
import os
from typing import Optional

import httpx
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

PRIVY_APP_ID     = os.getenv("PRIVY_APP_ID", "")
PRIVY_APP_SECRET = os.getenv("PRIVY_APP_SECRET", "")
SOLANA_RPC_URL   = f"https://api.{os.getenv('SOLANA_NETWORK', 'devnet')}.solana.com"

# auth.privy.io  → user auth endpoints
# api.privy.io   → server wallet endpoints
PRIVY_AUTH_URL   = "https://auth.privy.io/api/v1"
PRIVY_API_URL    = "https://api.privy.io/v1"

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
        Create a server-side Solana wallet via Privy's server wallet API.
        Returns { wallet_id, address }
        """
        _check_configured()
        logger.info("[Privy] creating server wallet | app_id=%s", PRIVY_APP_ID)

        request_body = {"chain_type": "solana"}
        url = f"{PRIVY_API_URL}/wallets"

        logger.info("[Privy] POST %s | body=%s", url, request_body)

        timeout = httpx.Timeout(connect=6.0, read=10.0, write=10.0, pool=10.0)
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.post(
                    url,
                    headers=_auth_headers(),
                    json=request_body,
                )
                logger.info(
                    "[Privy] response status=%s | body=%s",
                    resp.status_code,
                    resp.text,
                )
                resp.raise_for_status()
                data = resp.json()
                wallet_id = data.get("id")
                address   = data.get("address")
                logger.info(
                    "[Privy] wallet created | wallet_id=%s address=%s",
                    wallet_id,
                    address,
                )
                return {
                    "wallet_id": wallet_id,
                    "address":   address,
                }
        except httpx.HTTPStatusError as e:
            logger.error(
                "[Privy] HTTP error | status=%s | response=%s",
                e.response.status_code,
                e.response.text,
            )
            raise
        except httpx.TimeoutException as e:
            logger.error("[Privy] request timed out: %s", str(e))
            raise
        except Exception as e:
            logger.exception("[Privy] unexpected error: %s", str(e))
            raise

    async def create_campaign_vault_wallet(self, campaign_id: str) -> dict:
        """
        Create a dedicated server-side Solana vault wallet for a campaign.
        Returns { wallet_id, address }
        """
        logger.info("[Privy] provisioning vault for campaign_id=%s", campaign_id)
        return await self.create_embedded_wallet(campaign_id)

    async def sign_and_send_transaction(self, wallet_id: str, tx_base64: str) -> str:
        """
        Sign and broadcast a base64-encoded Solana transaction via Privy.
        Returns the transaction signature string.
        """
        _check_configured()
        url = f"{PRIVY_API_URL}/wallets/{wallet_id}/rpc"
        logger.info("[Privy] signing tx | wallet_id=%s url=%s", wallet_id, url)
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                url,
                headers=_auth_headers(),
                json={
                    "method": "signAndSendTransaction",
                    "params": {
                        "transaction": tx_base64,
                        "encoding": "base64",
                    },
                },
            )
            logger.info(
                "[Privy] sign response status=%s | body=%s",
                resp.status_code,
                resp.text,
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
