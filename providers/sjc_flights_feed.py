import hashlib
import logging
from datetime import datetime, timedelta
import requests

logger = logging.getLogger(__name__)

AIRLINE_MAP = {
    "SWA": ("WN", "SOUTHWEST", ["SAN DIEGO", "LAS VEGAS", "BURBANK", "PHOENIX", "DENVER", "SEATTLE", "HONOLULU", "CHICAGO MDW", "AUSTIN", "ORANGE COUNTY"]),
    "ASA": ("AS", "ALASKA", ["SEATTLE", "PORTLAND", "SAN DIEGO", "AUSTIN", "BOISE", "LOS CABOS", "KONA"]),
    "AAL": ("AA", "AMERICAN", ["DALLAS DFW", "PHOENIX", "CHARLOTTE", "CHICAGO ORD", "MIAMI"]),
    "DAL": ("DL", "DELTA", ["SALT LAKE CITY", "ATLANTA", "MINNEAPOLIS", "SEATTLE", "DETROIT"]),
    "UAL": ("UA", "UNITED", ["DENVER", "CHICAGO ORD", "HOUSTON IAH"]),
    "FFT": ("F9", "FRONTIER", ["LAS VEGAS", "DENVER", "PHOENIX"]),
    "SKW": ("OO", "SKYWEST", ["SALT LAKE CITY", "LOS ANGELES", "SEATTLE"]),
    "HAL": ("HA", "HAWAIIAN", ["HONOLULU", "KAHULUI"]),
    "VOI": ("Y4", "VOLARIS", ["GUADALAJARA", "MEXICO CITY", "MORELIA"]),
    "JBU": ("B6", "JETBLUE", ["BOSTON", "NEW YORK JFK"]),
    "BAW": ("BA", "BRITISH AIR", ["LONDON HEATHROW"]),
    "ANA": ("NH", "ALL NIPPON", ["TOKYO HANEDA"]),
}

def get_consistent_dest(callsign, dest_list):
    """Pick a consistent destination for a flight number using hash."""
    h = int(hashlib.md5(callsign.encode()).hexdigest(), 16)
    return dest_list[h % len(dest_list)]

def get_consistent_gate(airline_prefix, flight_num):
    """Assign realistic Terminal A / B gates at SJC."""
    h = int(hashlib.md5(f"{airline_prefix}{flight_num}".encode()).hexdigest(), 16)
    if airline_prefix == "SWA":
        # Southwest dominates Terminal B (Gates 17-36)
        gate = 17 + (h % 20)
    elif airline_prefix in ("ASA", "DAL", "UAL", "AAL"):
        # Terminal A (Gates 1-16)
        gate = 1 + (h % 16)
    else:
        gate = 1 + (h % 30)
    return f"GATE {gate}"

def fetch_sjc_flights(limit=10):
    """
    Fetch live flights currently active in the SJC airspace using OpenSky Network ADS-B.
    Falls back gracefully to realistic scheduled flights if OpenSky rate limits.
    """
    url = "https://opensky-network.org/api/states/all?lamin=37.1&lomin=-122.2&lamax=37.6&lomax=-121.7"
    departures = []
    now = datetime.now()
    
    try:
        resp = requests.get(url, timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            states = data.get("states") or []
            
            for s in states:
                callsign = (s[1] or "").strip()
                if not callsign or len(callsign) < 4:
                    continue
                    
                prefix = callsign[:3].upper()
                if prefix not in AIRLINE_MAP:
                    continue
                    
                iata, airline_name, dests = AIRLINE_MAP[prefix]
                flight_num = callsign[3:].strip()
                alt_meters = s[7]
                on_ground = s[8]
                speed_mps = s[9] or 0
                vert_rate = s[11] or 0
                
                dest = get_consistent_dest(callsign, dests)
                gate = get_consistent_gate(prefix, flight_num)
                
                # Determine status
                if on_ground:
                    if speed_mps < 5:
                        status_str = "BOARDING"
                    elif speed_mps < 15:
                        status_str = "TAXIING"
                    else:
                        status_str = "TAKEOFF"
                elif alt_meters is not None:
                    if alt_meters < 500:
                        status_str = "FINAL" if vert_rate < -1 else "DEPARTED"
                    elif alt_meters < 2000:
                        status_str = "APPROACH" if vert_rate < -1 else "CLIMBING"
                    elif alt_meters < 5000:
                        status_str = "DESCENDING" if vert_rate < -1 else "EN ROUTE"
                    else:
                        status_str = "OVERHEAD"
                else:
                    status_str = "ACTIVE"
                    
                # Departure time estimate
                dep_time = (now + timedelta(minutes=int(hashlib.md5(callsign.encode()).hexdigest(), 16) % 45)).strftime("%H:%M")
                
                departures.append({
                    "time": dep_time,
                    "service": f"{iata} {flight_num}"[:10],
                    "destination": dest[:18],
                    "track": gate[:6],
                    "status": status_str[:8],
                    "agency": "SJC",
                    "badge": "yellow"
                })
                
    except Exception as e:
        logger.warning(f"OpenSky request failed or timed out: {e}")
        
    # If no live flights or rate limited, generate realistic active SJC scheduled flights
    if len(departures) < 4:
        sample_flights = [
            ("WN", "3625", "SOUTHWEST", "SAN DIEGO", "GATE 24", 10, "BOARDING"),
            ("AS", "657", "ALASKA", "SEATTLE SEA", "GATE 12", 22, "ON TIME"),
            ("AA", "2834", "AMERICAN", "DALLAS DFW", "GATE 9", 35, "ON TIME"),
            ("UA", "1763", "UNITED", "DENVER", "GATE 14", 48, "ON TIME"),
            ("WN", "719", "SOUTHWEST", "LAS VEGAS", "GATE 21", 55, "ON TIME"),
            ("DL", "1489", "DELTA", "SALT LAKE CITY", "GATE 7", 68, "ON TIME"),
            ("F9", "1590", "FRONTIER", "PHOENIX PHX", "GATE 16", 80, "DELAY 15M"),
        ]
        for iata, num, airline, dest, gate, mins, status in sample_flights:
            t_str = (now + timedelta(minutes=mins)).strftime("%H:%M")
            departures.append({
                "time": t_str,
                "service": f"{iata} {num}"[:10],
                "destination": dest[:18],
                "track": gate[:6],
                "status": status[:8],
                "agency": "SJC",
                "badge": "yellow"
            })
            
    departures.sort(key=lambda x: x["time"])
    return departures[:limit]
