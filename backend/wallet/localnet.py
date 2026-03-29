"""
ClearFund Local Wallet Management
Generates, stores, and signs with Solana keypairs for localnet testing.
Replaces Privy for all wallet operations when SOLANA_NETWORK=localnet.
"""

import json
import logging
import os
from typing import Optional

from solana.rpc.api import Client as SolanaClient
from solders.keypair import Keypair
from solders.message import Message as SoldersMessage
from solders.pubkey import Pubkey
from solders.system_program import transfer as sol_transfer, TransferParams
from solders.transaction import Transaction as SoldersTransaction

logger = logging.getLogger("clearfund.localnet")

LAMPORTS_PER_SOL = 1_000_000_000


def _rpc_url() -> str:
    return os.getenv("SOLANA_RPC_URL", "http://127.0.0.1:8899")


def generate_keypair() -> dict:
    """Generate a new random Solana keypair.
    Returns {"address": str, "keypair_json": str} where keypair_json is
    the 64-byte secret key serialised as a JSON int-array (same format as
    Solana CLI id.json files).
    """
    kp = Keypair()
    return {
        "address": str(kp.pubkey()),
        "keypair_json": json.dumps(list(bytes(kp))),
    }


def keypair_from_json(keypair_json: str) -> Keypair:
    """Reconstruct a Keypair from a stored JSON byte-array string."""
    return Keypair.from_bytes(bytes(json.loads(keypair_json)))


def sign_and_send(
    keypair_json: str,
    to_address: str,
    amount_sol: float,
    rpc_url: Optional[str] = None,
) -> str:
    """Build, sign and broadcast a SOL transfer using the given keypair."""
    kp = keypair_from_json(keypair_json)
    client = SolanaClient(rpc_url or _rpc_url())

    blockhash_resp = client.get_latest_blockhash()
    recent_blockhash = blockhash_resp.value.blockhash

    from_pubkey = kp.pubkey()
    to_pubkey = Pubkey.from_string(to_address)
    lamports = int(amount_sol * LAMPORTS_PER_SOL)

    ix = sol_transfer(TransferParams(
        from_pubkey=from_pubkey,
        to_pubkey=to_pubkey,
        lamports=lamports,
    ))
    msg = SoldersMessage.new_with_blockhash(
        instructions=[ix],
        payer=from_pubkey,
        blockhash=recent_blockhash,
    )
    tx = SoldersTransaction([kp], msg, recent_blockhash)
    result = client.send_transaction(tx)
    sig = str(result.value)
    logger.info(
        "localnet transfer %s -> %s  %.4f SOL  sig=%s",
        str(from_pubkey), to_address, amount_sol, sig,
    )
    return sig


def get_balance(address: str, rpc_url: Optional[str] = None) -> float:
    """Return the SOL balance of an address (not lamports)."""
    client = SolanaClient(rpc_url or _rpc_url())
    pubkey = Pubkey.from_string(address)
    resp = client.get_balance(pubkey)
    return resp.value / LAMPORTS_PER_SOL


def airdrop(address: str, sol: float = 10.0, rpc_url: Optional[str] = None) -> str:
    """Request an airdrop on localnet and wait for confirmation. Returns tx signature."""
    import time
    client = SolanaClient(rpc_url or _rpc_url())
    pubkey = Pubkey.from_string(address)
    lamports = int(sol * LAMPORTS_PER_SOL)
    resp = client.request_airdrop(pubkey, lamports)
    sig = resp.value
    # Wait for confirmation (localnet is fast, ~500ms per slot)
    for _ in range(20):
        status = client.confirm_transaction(sig)
        if status.value and len(status.value) > 0 and status.value[0] is not None:
            break
        time.sleep(0.3)
    sig_str = str(sig)
    logger.info("localnet airdrop %s  %.1f SOL  sig=%s", address, sol, sig_str)
    return sig_str
