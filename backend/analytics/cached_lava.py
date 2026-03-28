"""
ClearFund Analytics Cache
MongoDB-backed TTL cache for Lava RPC responses.
Avoids hammering the RPC on every page load.
"""

from datetime import datetime, timezone
from typing import List

from .lava_client import LavaClient


async def get_cached_vault_transactions(
    vault_address: str,
    lava: LavaClient,
    db,
    ttl_seconds: int = 60,
) -> List[dict]:
    """
    Check MongoDB analytics_cache collection first.
    Cache key: vault_txs_{vault_address}
    If cached and age < ttl_seconds: return cached result.
    Otherwise fetch from Lava, upsert cache, return fresh result.
    """
    cache_key = f"vault_txs_{vault_address}"
    now = datetime.now(timezone.utc)

    cached = await db.analytics_cache.find_one({"_id": cache_key})
    if cached:
        age = (now - cached["updated_at"].replace(tzinfo=timezone.utc)).total_seconds()
        if age < ttl_seconds:
            return cached["data"]

    fresh = await lava.get_vault_transactions(vault_address)

    await db.analytics_cache.update_one(
        {"_id": cache_key},
        {"$set": {"data": fresh, "updated_at": now}},
        upsert=True,
    )
    return fresh


async def get_cached_vault_stats(
    vault_address: str,
    lava: LavaClient,
    db,
    ttl_seconds: int = 120,
) -> dict:
    """
    Same pattern as get_cached_vault_transactions, 2-minute TTL for stats.
    """
    cache_key = f"vault_stats_{vault_address}"
    now = datetime.now(timezone.utc)

    cached = await db.analytics_cache.find_one({"_id": cache_key})
    if cached:
        age = (now - cached["updated_at"].replace(tzinfo=timezone.utc)).total_seconds()
        if age < ttl_seconds:
            return cached["data"]

    fresh = await lava.get_vault_stats(vault_address)

    await db.analytics_cache.update_one(
        {"_id": cache_key},
        {"$set": {"data": fresh, "updated_at": now}},
        upsert=True,
    )
    return fresh
