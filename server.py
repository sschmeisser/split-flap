#!/usr/bin/env python3
"""
Solari Split-Flap Board Server
Serves live transit & flight arrivals/departures for:
- San Jose Regional Hub:
  - BART: Berryessa station
  - Caltrain: San Jose Diridon station
  - Amtrak: San Jose Diridon station
  - ACE: Altamont Corridor Express (Diridon)
  - VTA: Branham station & Bus 64B (Meridian)
  - SJC: All airport arrivals & departures
- Nürnberg Hauptbahnhof (Nuremberg Central Station):
  - Deutsche Bahn ICE, IC, RE, RB, and S-Bahn Nürnberg
"""

import hashlib
import http.server
import json
import logging
import os
import requests
import socket
import socketserver
import threading
import time
from datetime import datetime, timedelta
from urllib.parse import parse_qs, urlparse

from providers.ace_feed import fetch_ace_departures
from providers.amtrak_feed import fetch_amtrak_departures
from providers.bart_feed import fetch_bart_departures
from providers.caltrain_feed import fetch_caltrain_departures
from providers.nuernberg_feed import fetch_nuernberg_departures
from providers.sjc_flights_feed import fetch_sjc_flights
from providers.vta_feed import fetch_vta_departures
from providers.geo_telematics import enrich_geo_telematics

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("SolariServer")

PORT = int(os.environ.get("PORT", 8080))
STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public")
AUDIO_CACHE_DIR = os.path.join(STATIC_DIR, "audio", "cache")
os.makedirs(AUDIO_CACHE_DIR, exist_ok=True)

def load_env():
    env_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if os.path.exists(env_file):
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip())

load_env()
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
if OPENROUTER_API_KEY:
    logger.info("OpenRouter API key loaded for Carolyn Hopkins neural airport voice.")

def synthesize_speech(text, model="minimax/speech-2.8-hd", voice="English_CalmWoman"):
    """
    Synthesize speech using OpenRouter's /api/v1/audio/speech endpoint.
    Caches the generated MP3 in public/audio/cache/ using an MD5 hash.
    Falls back to deepgram/aura-2 if primary model encounters an issue.
    """
    if not OPENROUTER_API_KEY or not text:
        return None

    # Deterministic cache key based on text, model, and voice
    cache_key = hashlib.md5(f"{model}_{voice}_{text}".encode("utf-8")).hexdigest()
    cache_file = os.path.join(AUDIO_CACHE_DIR, f"{cache_key}.mp3")
    rel_url = f"/audio/cache/{cache_key}.mp3"

    if os.path.exists(cache_file) and os.path.getsize(cache_file) > 1000:
        return rel_url

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }

    # Primary: MiniMax Speech 2.8 HD (Warm, calm, maternal Carolyn Hopkins archetype)
    payload = {
        "model": model,
        "input": text,
        "voice": voice,
        "response_format": "mp3",
    }

    try:
        req = requests.post(
            "https://openrouter.ai/api/v1/audio/speech",
            headers=headers,
            json=payload,
            timeout=12,
        )
        if req.status_code == 200 and len(req.content) > 1000:
            with open(cache_file, "wb") as f:
                f.write(req.content)
            logger.info(f"Synthesized announcement via {model} ({voice}) -> {cache_key}.mp3")
            return rel_url
        else:
            logger.warning(f"OpenRouter speech primary failed (status {req.status_code}): {req.text[:200]}")
    except Exception as e:
        logger.warning(f"OpenRouter speech request error: {e}")

    # Fallback: Deepgram Aura-2 (aura-2-thalia-en)
    try:
        fallback_payload = {
            "model": "deepgram/aura-2",
            "input": text,
            "voice": "aura-2-thalia-en",
            "response_format": "mp3",
        }
        req2 = requests.post(
            "https://openrouter.ai/api/v1/audio/speech",
            headers=headers,
            json=fallback_payload,
            timeout=10,
        )
        if req2.status_code == 200 and len(req2.content) > 1000:
            with open(cache_file, "wb") as f:
                f.write(req2.content)
            logger.info(f"Synthesized announcement via fallback deepgram/aura-2 -> {cache_key}.mp3")
            return rel_url
    except Exception as e:
        logger.error(f"Fallback speech synthesis error: {e}")

    return None

CACHE = {
    "bart": [],
    "amtrak": [],
    "sjc": [],
    "caltrain": [],
    "ace": [],
    "vta": [],
    "nuernberg": [],
    "last_updated": 0,
}
CACHE_LOCK = threading.RLock()


def update_feeds():
    """Background worker that continuously refreshes live feeds."""
    while True:
        try:
            b_data = fetch_bart_departures(limit=12)
            a_data = fetch_amtrak_departures(station_code="SJC", limit=12)
            s_data = fetch_sjc_flights(limit=12)
            c_data = fetch_caltrain_departures(limit=12)
            ace_data = fetch_ace_departures(limit=12)
            v_data = fetch_vta_departures(limit=12)
            nbg_data = fetch_nuernberg_departures(limit=16)

            with CACHE_LOCK:
                if b_data:
                    CACHE["bart"] = b_data
                if a_data:
                    CACHE["amtrak"] = a_data
                if s_data:
                    CACHE["sjc"] = s_data
                if c_data:
                    CACHE["caltrain"] = c_data
                if ace_data:
                    CACHE["ace"] = ace_data
                if v_data:
                    CACHE["vta"] = v_data
                if nbg_data:
                    CACHE["nuernberg"] = nbg_data
                CACHE["last_updated"] = time.time()

            logger.info(
                f"Feeds refreshed: BART({len(CACHE['bart'])}) Amtrak({len(CACHE['amtrak'])}) "
                f"SJC({len(CACHE['sjc'])}) Caltrain({len(CACHE['caltrain'])}) "
                f"ACE({len(CACHE['ace'])}) VTA({len(CACHE['vta'])}) NBG({len(CACHE['nuernberg'])})"
            )
        except Exception as e:
            logger.error(f"Error in update_feeds: {e}")

        time.sleep(30)


def build_unified_board(limit=12):
    """Unify all San Jose streams and strictly sort forward in time."""
    with CACHE_LOCK:
        combined = []
        combined.extend(CACHE["sjc"][:3])
        combined.extend(CACHE["caltrain"][:3])
        combined.extend(CACHE["bart"][:2])
        combined.extend(CACHE["amtrak"][:2])
        combined.extend(CACHE["ace"][:2])
        combined.extend(CACHE["vta"][:3])

    now = datetime.now()
    now_mins = now.hour * 60 + now.minute

    def parse_time_key(item):
        if "minutes_away" in item:
            return item["minutes_away"]
        t = item.get("time", "99:99")
        try:
            parts = t.split(":")
            item_mins = int(parts[0]) * 60 + int(parts[1])
            diff = item_mins - now_mins
            if diff < -10:
                diff += 1440
            return diff
        except Exception:
            return 9999

    # Strict sort forward by time
    combined.sort(key=parse_time_key)
    return combined[:limit]


class SolariHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = http.server.SimpleHTTPRequestHandler.extensions_map.copy()
    extensions_map.update({
        ".js": "text/javascript; charset=utf-8",
        ".mjs": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".html": "text/html; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
    })

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path == "/api/departures":
            qs = parse_qs(parsed.query)
            hub = qs.get("hub", ["sanjose"])[0].lower()
            mode = qs.get("mode", ["unified"])[0].lower()
            limit = int(qs.get("limit", [12])[0])

            # 1. NÜRNBERG HAUPTBAHNHOF (Germany Hub)
            if hub == "nuernberg" or mode.startswith("nuernberg"):
                with CACHE_LOCK:
                    cat = "all"
                    if "fern" in mode:
                        cat = "fern"
                    elif "regio" in mode:
                        cat = "regio"
                    elif "sbahn" in mode:
                        cat = "sbahn"

                    # Fetch categorized departures
                    data = fetch_nuernberg_departures(limit=limit, category=cat)
                    header = "NÜRNBERG HAUPTBAHNHOF • ABFAHRT / DEPARTURES"

                # German CET/CEST time
                german_time = (datetime.utcnow() + timedelta(hours=2)).strftime("%H:%M:%S")

                payload = {
                    "hub": "nuernberg",
                    "mode": mode,
                    "header": header,
                    "timestamp": german_time,
                    "rows": [enrich_geo_telematics(dict(r)) for r in data],
                }

            # 2. SAN JOSE REGIONAL HUB (USA Hub)
            else:
                with CACHE_LOCK:
                    if mode == "sjc":
                        data = list(CACHE["sjc"][:limit])
                        header = "SAN JOSE INTL AIRPORT (SJC) • ARRIVALS & DEPARTURES"
                    elif mode == "bart":
                        data = list(CACHE["bart"][:limit])
                        header = "BART • BERRYESSA / N SAN JOSE • ARRIVALS & DEPARTURES"
                    elif mode == "caltrain":
                        data = list(CACHE["caltrain"][:limit])
                        header = "CALTRAIN • SAN JOSE DIRIDON • ARRIVALS & DEPARTURES"
                    elif mode == "amtrak":
                        data = list(CACHE["amtrak"][:limit])
                        header = "AMTRAK CALIFORNIA • DIRIDON • ARRIVALS & DEPARTURES"
                    elif mode == "ace":
                        data = list(CACHE["ace"][:limit])
                        header = "ACE TRAIN • SAN JOSE DIRIDON • ARRIVALS & DEPARTURES"
                    elif mode == "vta":
                        data = list(CACHE["vta"][:limit])
                        header = "VTA TRANSIT • BRANHAM LRT & 64B MERIDIAN • DEPARTURES"
                    else:
                        data = build_unified_board(limit)
                        header = "SAN JOSE REGIONAL HUB • ALL SERVICES BY TIME"

                payload = {
                    "hub": "sanjose",
                    "mode": mode,
                    "header": header,
                    "timestamp": time.strftime("%H:%M:%S"),
                    "rows": [enrich_geo_telematics(dict(r)) for r in data],
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

        if parsed.path == "/api/speech":
            qs = parse_qs(parsed.query)
            text = qs.get("text", [""])[0]
            audio_url = synthesize_speech(text)
            body = json.dumps({"audio_url": audio_url, "enabled": bool(OPENROUTER_API_KEY)}).encode("utf-8")
            self.send_response(200 if audio_url else 404)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Connection", "close")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path in ("/api/speech", "/api/announce-speech"):
            content_length = int(self.headers.get("Content-Length", 0))
            raw_body = self.rfile.read(content_length) if content_length > 0 else b"{}"
            try:
                data = json.loads(raw_body.decode("utf-8"))
            except Exception:
                data = {}
            text = data.get("text", "")
            audio_url = synthesize_speech(text)
            body = json.dumps({
                "audio_url": audio_url,
                "enabled": bool(OPENROUTER_API_KEY),
                "voice": "Carolyn Hopkins Archetype (MiniMax HD)" if audio_url else "Web Speech Fallback"
            }).encode("utf-8")
            self.send_response(200 if audio_url else 500)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Connection", "close")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        self.send_response(404)
        self.end_headers()


class ThreadingDualStackServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    """
    Dual-stack IPv4/IPv6 multi-threaded server.
    Ensures macOS Chrome/Safari connections never block on keep-alive sockets.
    """
    daemon_threads = True
    allow_reuse_address = True

    def server_bind(self):
        try:
            self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        except (AttributeError, OSError):
            pass
        super().server_bind()


def run():
    feed_thread = threading.Thread(target=update_feeds, daemon=True)
    feed_thread.start()

    # Pre-populate initial cache synchronously so the first page load has data immediately
    logger.info("Initializing transit feeds...")
    try:
        CACHE["bart"] = fetch_bart_departures(limit=12)
        CACHE["amtrak"] = fetch_amtrak_departures(station_code="SJC", limit=12)
        CACHE["sjc"] = fetch_sjc_flights(limit=12)
        CACHE["caltrain"] = fetch_caltrain_departures(limit=12)
        CACHE["ace"] = fetch_ace_departures(limit=12)
        CACHE["vta"] = fetch_vta_departures(limit=12)
        CACHE["nuernberg"] = fetch_nuernberg_departures(limit=16)
        CACHE["last_updated"] = time.time()
        logger.info("Initial feeds populated successfully.")
    except Exception as e:
        logger.warning(f"Initial feed warmup note: {e}")

    try:
        server = ThreadingDualStackServer(("::", PORT), SolariHandler)
    except Exception:
        server = ThreadingDualStackServer(("0.0.0.0", PORT), SolariHandler)

    logger.info(f"Solari Split-Flap Board running at http://localhost:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("Server shutting down.")
        server.server_close()


if __name__ == "__main__":
    run()
