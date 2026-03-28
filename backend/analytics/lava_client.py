"""
ClearFund Lava Client
Decentralized Solana RPC gateway via Lava Network.
All calls are standard Solana JSON-RPC routed through Lava's endpoint.
"""

import os
from datetime import datetime, timezone
from typing import List, Optional

import httpx
from dotenv import load_dotenv

load_dotenv()


class LavaClient:
    def __init__(self) -> None:
        api_key = os.getenv("LAVA_API_KEY", "")
        if not api_key:
            raise RuntimeError(
                "Lava not configured — set LAVA_API_KEY in .env"
            )
        self.endpoint = (
            f"https://g.w.lavanet.xyz:443/gateway/solana/rpc-http/{api_key}"
        )
        self.headers = {"Content-Type": "application/json"}

    # ─── Base caller ─────────────────────────────────────────────────────────

    async def _rpc(self, method: str, params: list) -> dict:
        """Base JSON-RPC caller."""
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(
                self.endpoint,
                headers=self.headers,
                json={
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": method,
                    "params": params,
                },
            )
        data = res.json()
        if "error" in data:
            raise Exception(f"Lava RPC error: {data['error']}")
        return data["result"]

    # ─── Methods ─────────────────────────────────────────────────────────────

    async def get_balance(self, address: str) -> float:
        """Get SOL balance of any address."""
        result = await self._rpc("getBalance", [address])
        return result["value"] / 1e9  # lamports → SOL

    async def get_transaction_signatures(
        self, address: str, limit: int = 50
    ) -> List[dict]:
        """
        Get recent transaction signatures for an address.
        Returns list of: { signature, slot, blockTime, err, memo }
        """
        result = await self._rpc(
            "getSignaturesForAddress",
            [address, {"limit": limit, "commitment": "confirmed"}],
        )
        return result  # already a list of signature objects

    async def get_transaction(self, signature: str) -> Optional[dict]:
        """
        Get full transaction detail by signature.
        Uses jsonParsed encoding — returns parsed instruction data,
        pre/post balances, and account keys.
        """
        result = await self._rpc(
            "getTransaction",
            [
                signature,
                {
                    "encoding": "jsonParsed",
                    "commitment": "confirmed",
                    "maxSupportedTransactionVersion": 0,
                },
            ],
        )
        return result

    async def get_vault_transactions(
        self,
        vault_address: str,
        limit: int = 50,
        ngo_wallet: Optional[str] = None,
    ) -> List[dict]:
        """
        High-level: fetch signatures then enrich each with transaction detail.
        Determines tx_type by comparing pre/post balances of the vault account.
        """
        sigs = await self.get_transaction_signatures(vault_address, limit=limit)
        results = []

        for sig_obj in sigs:
            signature = sig_obj.get("signature", "")
            block_time = sig_obj.get("blockTime")
            err = sig_obj.get("err")

            enriched = {
                "signature": signature,
                "block_time": block_time,
                "block_time_iso": (
                    datetime.fromtimestamp(block_time, tz=timezone.utc).isoformat()
                    if block_time
                    else None
                ),
                "tx_type": "unknown",
                "amount_sol": 0.0,
                "from_address": "",
                "to_address": "",
                "status": "failed" if err else "success",
            }

            try:
                tx = await self.get_transaction(signature)
                if tx and tx.get("meta"):
                    meta = tx["meta"]
                    account_keys = (
                        tx.get("transaction", {})
                        .get("message", {})
                        .get("accountKeys", [])
                    )

                    # Find vault's index in the accounts list
                    vault_idx = None
                    for i, key in enumerate(account_keys):
                        key_str = key if isinstance(key, str) else key.get("pubkey", "")
                        if key_str == vault_address:
                            vault_idx = i
                            break

                    if vault_idx is not None:
                        pre_balances = meta.get("preBalances", [])
                        post_balances = meta.get("postBalances", [])

                        pre_sol = pre_balances[vault_idx] / 1e9 if vault_idx < len(pre_balances) else 0.0
                        post_sol = post_balances[vault_idx] / 1e9 if vault_idx < len(post_balances) else 0.0
                        delta = post_sol - pre_sol

                        if delta > 0:
                            enriched["tx_type"] = "deposit"
                            enriched["amount_sol"] = round(delta, 9)
                            # from_address: first signer that isn't the vault
                            for i, key in enumerate(account_keys):
                                key_str = key if isinstance(key, str) else key.get("pubkey", "")
                                if i != vault_idx:
                                    enriched["from_address"] = key_str
                                    break
                            enriched["to_address"] = vault_address
                        elif delta < 0:
                            enriched["amount_sol"] = round(abs(delta), 9)
                            enriched["from_address"] = vault_address
                            # to_address: whichever non-vault account gained most
                            max_gain = 0.0
                            to_addr = ""
                            for i, key in enumerate(account_keys):
                                if i == vault_idx:
                                    continue
                                pre = pre_balances[i] / 1e9 if i < len(pre_balances) else 0.0
                                post = post_balances[i] / 1e9 if i < len(post_balances) else 0.0
                                gain = post - pre
                                if gain > max_gain:
                                    max_gain = gain
                                    key_str = key if isinstance(key, str) else key.get("pubkey", "")
                                    to_addr = key_str
                            enriched["to_address"] = to_addr
                            # Classify: release vs refund
                            if ngo_wallet and to_addr == ngo_wallet:
                                enriched["tx_type"] = "release"
                            else:
                                enriched["tx_type"] = "release"  # default; UI can refine

            except Exception:
                pass  # keep partial enriched record

            results.append(enriched)

        return results

    async def get_vault_stats(self, vault_address: str) -> dict:
        """
        Compute stats by aggregating vault transactions.
        Returns current_balance_sol, total_deposited_sol, total_released_sol,
        transaction_count, unique_depositors, last_activity.
        """
        current_balance = await self.get_balance(vault_address)
        transactions = await self.get_vault_transactions(vault_address, limit=100)

        total_deposited = 0.0
        total_released = 0.0
        depositor_addresses: set = set()
        last_block_time = None

        for tx in transactions:
            if tx["status"] == "failed":
                continue
            if tx["tx_type"] == "deposit":
                total_deposited += tx["amount_sol"]
                if tx["from_address"]:
                    depositor_addresses.add(tx["from_address"])
            elif tx["tx_type"] in ("release", "refund"):
                total_released += tx["amount_sol"]

            if tx["block_time"] and (
                last_block_time is None or tx["block_time"] > last_block_time
            ):
                last_block_time = tx["block_time"]

        last_activity = (
            datetime.fromtimestamp(last_block_time, tz=timezone.utc).isoformat()
            if last_block_time
            else None
        )

        return {
            "current_balance_sol": round(current_balance, 9),
            "total_deposited_sol": round(total_deposited, 9),
            "total_released_sol": round(total_released, 9),
            "transaction_count": len(transactions),
            "unique_depositors": len(depositor_addresses),
            "last_activity": last_activity,
        }

    async def get_account_info(self, address: str) -> Optional[dict]:
        """
        Returns owner, lamports, executable flag for any account.
        Useful for verifying the vault exists on-chain.
        """
        result = await self._rpc(
            "getAccountInfo",
            [address, {"encoding": "jsonParsed", "commitment": "confirmed"}],
        )
        return result["value"]

    async def health_check(self) -> bool:
        """
        Ping Lava with getHealth RPC method.
        Returns True if node responds 'ok', False otherwise.
        """
        try:
            result = await self._rpc("getHealth", [])
            return result == "ok"
        except Exception:
            return False
