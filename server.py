#!/usr/bin/env python3
"""
Solari Split-Flap Board Server
Serves live transit & flight departures for Bay Area & SJC alongside the web frontend.
Supports concurrent requests via ThreadingMixIn, dual-stack IPv4/IPv6, and reentrant locking.
"""

import http.server
import json
import logging
import os
import socket
import socketserver
import threading
import time
from urllib.parse import parse_qs, urlparse

from providers.amtrak_feed import fetch_amtrak_departures
from providers.bart_feed import fetch_bart_departures
from providers.caltrain_feed import fetch_caltrain_departures
from providers.sjc_flights_feed import fetch_sjc_flights
from providers.vta_feed import fetch_vta_departures

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("SolariServer")

PORT = int(os.environ.get("PORT", 8080))
STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public")

# Thread-safe global cache with Reentrant Lock (RLock) to prevent self-deadlocks
CACHE = {
    "bart": [],
    "amtrak": [],
    "sjc": [],
    "caltrain": [],
    "vta": [],
    "last_updated": 0,
}
CACHE_LOCK = threading.RLock()


def update_feeds():
    """Background worker that continuously refreshes live feeds."""
    while True:
        try:
            b_data = fetch_bart_departures(limit=10)
            a_data = fetch_amtrak_departures(station_code="SJC", limit=10)
            s_data = fetch_sjc_flights(limit=10)
            c_data = fetch_caltrain_departures(limit=10)
            v_data = fetch_vta_departures(limit=10)

            with CACHE_LOCK:
                if b_data:
                    CACHE["bart"] = b_data
                if a_data:
                    CACHE["amtrak"] = a_data
                if s_data:
                    CACHE["sjc"] = s_data
                if c_data:
                    CACHE["caltrain"] = c_data
                if v_data:
                    CACHE["vta"] = v_data
                CACHE["last_updated"] = time.time()

            logger.info(
                f"Feeds refreshed: BART({len(CACHE['bart'])}) Amtrak({len(CACHE['amtrak'])}) "
                f"SJC({len(CACHE['sjc'])}) Caltrain({len(CACHE['caltrain'])}) VTA({len(CACHE['vta'])})"
            )
        except Exception as e:
            logger.error(f"Error in update_feeds: {e}")

        time.sleep(30)


def build_unified_board(limit=8):
    """Interleave flights and transit into a single cohesive European Solari board."""
    with CACHE_LOCK:
        combined = []
        combined.extend(CACHE["sjc"][:3])
        combined.extend(CACHE["caltrain"][:3])
        combined.extend(CACHE["bart"][:2])
        combined.extend(CACHE["amtrak"][:2])
        combined.extend(CACHE["vta"][:2])

    def parse_time_key(item):
        t = item.get("time", "99:99")
        try:
            parts = t.split(":")
            return int(parts[0]) * 60 + int(parts[1])
        except Exception:
            return 9999

    combined.sort(key=parse_time_key)
    return combined[:limit]


class SolariHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path == "/api/departures":
            qs = parse_qs(parsed.query)
            mode = qs.get("mode", ["unified"])[0].lower()
            limit = int(qs.get("limit", [8])[0])

            with CACHE_LOCK:
                if mode == "sjc":
                    data = list(CACHE["sjc"][:limit])
                    header = "SAN JOSE INTL AIRPORT (SJC) • DEPARTURES"
                elif mode == "bart":
                    data = list(CACHE["bart"][:limit])
                    header = "BART • BERRYESSA & REGIONAL CONNECTIONS"
                elif mode == "caltrain":
                    data = list(CACHE["caltrain"][:limit])
                    header = "CALTRAIN • SAN JOSE DIRIDON TO SAN FRANCISCO"
                elif mode == "amtrak":
                    data = list(CACHE["amtrak"][:limit])
                    header = "AMTRAK CALIFORNIA • CAPITOL CORRIDOR & STARLIGHT"
                elif mode == "vta":
                    data = list(CACHE["vta"][:limit])
                    header = "VTA LIGHT RAIL • SANTA CLARA COUNTY HUB"
                else:
                    data = build_unified_board(limit)
                    header = "SAN JOSE DIRIDON / SJC • REGIONAL TRANSIT HUB"

            payload = {
                "mode": mode,
                "header": header,
                "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
                "rows": data,
            }

            body = json.dumps(payload).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Connection", "close")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if parsed.path == "/api/status":
            with CACHE_LOCK:
                status = {
                    "last_updated": CACHE["last_updated"],
                    "counts": {k: len(v) for k, v in CACHE.items() if isinstance(v, list)},
                }
            body = json.dumps(status).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Connection", "close")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        # Serve static frontend files
        return super().do_GET()


class ThreadingDualStackServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    """Multi-threaded HTTP server supporting both IPv4 and IPv6."""
    address_family = socket.AF_INET6
    daemon_threads = True

    def server_bind(self):
        try:
            self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        except (AttributeError, OSError):
            pass
        super().server_bind()


def run_server():
    logger.info("Initializing transit & flight data cache...")
    with CACHE_LOCK:
        CACHE["bart"] = fetch_bart_departures(limit=10)
        CACHE["amtrak"] = fetch_amtrak_departures(station_code="SJC", limit=10)
        CACHE["sjc"] = fetch_sjc_flights(limit=10)
        CACHE["caltrain"] = fetch_caltrain_departures(limit=10)
        CACHE["vta"] = fetch_vta_departures(limit=10)
        CACHE["last_updated"] = time.time()

    # Start background updater thread
    updater = threading.Thread(target=update_feeds, daemon=True)
    updater.start()

    # Start multi-threaded server on dual-stack IPv4/IPv6
    ThreadingDualStackServer.allow_reuse_address = True
    server_address = ("::", PORT)
    try:
        httpd = ThreadingDualStackServer(server_address, SolariHandler)
    except Exception as e:
        logger.warning(f"IPv6 dual-stack bind failed ({e}), falling back to IPv4...")
        class ThreadingIPv4Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
            daemon_threads = True
        ThreadingIPv4Server.allow_reuse_address = True
        httpd = ThreadingIPv4Server(("0.0.0.0", PORT), SolariHandler)

    logger.info(f"🚀 Solari Split-Flap Server running at http://localhost:{PORT}")
    logger.info("Press Ctrl+C to stop.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        logger.info("Shutting down server.")
    finally:
        httpd.server_close()


if __name__ == "__main__":
    run_server()
