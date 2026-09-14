"""Bounded process metrics; no tokens, query strings or user payloads."""
from collections import defaultdict, deque
from datetime import datetime, timezone
from threading import Lock
from time import monotonic


class ServiceMetrics:
    def __init__(self):
        self.started = monotonic()
        self.started_at = datetime.now(timezone.utc).isoformat()
        self.lock = Lock()
        self.requests = self.errors = 0
        self.latency_total = 0.0
        self.latencies = deque(maxlen=1000)
        self.routes = defaultdict(lambda: {"requests": 0, "server_errors": 0})

    def record(self, method, route, status, elapsed_ms):
        with self.lock:
            self.requests += 1
            self.errors += status >= 500
            self.latency_total += elapsed_ms
            self.latencies.append(elapsed_ms)
            item = self.routes[f"{method} {route}"]
            item["requests"] += 1
            item["server_errors"] += status >= 500

    def snapshot(self):
        with self.lock:
            samples = sorted(self.latencies)
            return {
                "scope": "current_process", "started_at": self.started_at,
                "uptime_seconds": round(monotonic() - self.started),
                "requests": self.requests, "server_errors": self.errors,
                "average_latency_ms": round(self.latency_total / max(self.requests, 1), 1),
                "p95_latency_ms": round(samples[min(len(samples) - 1, int(len(samples) * .95))], 1) if samples else 0,
                "latency_sample_count": len(samples),
                "routes": [{"route": name, **value} for name, value in sorted(self.routes.items(), key=lambda item: item[1]["requests"], reverse=True)[:20]],
            }


metrics = ServiceMetrics()


class MetricsMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        start, status = monotonic(), 500

        async def send_status(message):
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
            await send(message)

        try:
            await self.app(scope, receive, send_status)
        except BaseException:
            status = 500
            raise
        finally:
            route = getattr(scope.get("route"), "path", "unmatched")
            method = scope.get("method", "OTHER")
            if method not in {"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"}:
                method = "OTHER"
            metrics.record(method, route, status, (monotonic() - start) * 1000)
