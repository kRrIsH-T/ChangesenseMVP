import sys
import os

# Add repo root to path so `backend.app.main` is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.main import app as fastapi_app
from starlette.types import ASGIApp, Receive, Scope, Send


class StripPrefixMiddleware:
    """Strip /api prefix from incoming paths before FastAPI routing."""

    def __init__(self, app: ASGIApp, prefix: str = "/api") -> None:
        self.app = app
        self.prefix = prefix

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] in ("http", "websocket"):
            path: str = scope.get("path", "")
            if path.startswith(self.prefix):
                scope = dict(scope)
                scope["path"] = path[len(self.prefix):] or "/"
                scope["root_path"] = scope.get("root_path", "") + self.prefix
        await self.app(scope, receive, send)


app = StripPrefixMiddleware(fastapi_app)
