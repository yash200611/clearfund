"""
ClearFund WebSocket Broker
In-memory connection manager — handles per-milestone and global subscriptions.
"""

import json
from collections import defaultdict
from datetime import datetime, timezone
from typing import DefaultDict, List, Optional

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        # milestone_id → list of connected WebSockets
        self._milestone: DefaultDict[str, List[WebSocket]] = defaultdict(list)
        # All connections (for global broadcasts)
        self._global: List[WebSocket] = []

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    async def connect(self, websocket: WebSocket, milestone_id: Optional[str] = None) -> None:
        await websocket.accept()
        self._global.append(websocket)
        if milestone_id:
            self._milestone[milestone_id].append(websocket)

    def disconnect(self, websocket: WebSocket, milestone_id: Optional[str] = None) -> None:
        if websocket in self._global:
            self._global.remove(websocket)
        if milestone_id and websocket in self._milestone[milestone_id]:
            self._milestone[milestone_id].remove(websocket)
            if not self._milestone[milestone_id]:
                del self._milestone[milestone_id]

    # ── Broadcast helpers ─────────────────────────────────────────────────────

    @staticmethod
    def _build_envelope(
        event_type: str,
        milestone_id: str,
        payload: dict,
    ) -> str:
        return json.dumps({
            "event_type":   event_type,
            "milestone_id": milestone_id,
            "timestamp":    datetime.now(timezone.utc).isoformat(),
            "payload":      payload,
        })

    async def broadcast(self, milestone_id: str, event_type: str, payload: dict) -> None:
        """Send to all clients subscribed to a specific milestone."""
        message = self._build_envelope(event_type, milestone_id, payload)
        dead = []
        for ws in self._milestone.get(milestone_id, []):
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws, milestone_id)

    async def broadcast_global(
        self,
        event_type: str,
        milestone_id: str,
        payload: dict,
    ) -> None:
        """Send to ALL connected clients (Agent Dashboard feed)."""
        message = self._build_envelope(event_type, milestone_id, payload)
        dead = []
        for ws in list(self._global):
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

    # ── Typed event emitters ──────────────────────────────────────────────────

    async def emit(
        self,
        milestone_id: str,
        event_type: str,
        payload: dict,
    ) -> None:
        """Emit to both the milestone channel and the global channel."""
        await self.broadcast(milestone_id, event_type, payload)
        await self.broadcast_global(event_type, milestone_id, payload)


# Singleton shared across the app
manager = ConnectionManager()
