import hashlib
import logging
from datetime import datetime, timedelta
import requests

logger = logging.getLogger(__name__)

# Human-recognizable airline brand abbreviations instead of obscure 2-letter IATA codes
AIRLINE_MAP = {
    "SWA": ("SW", "SOUTHWEST", ["SAN DIEGO", "LAS VEGAS", "BURBANK", "PHOENIX", "DENVER", "SEATTLE", "HONOLULU", "CHICAGO MDW", "AUSTIN", "ORANGE COUNTY"]),
    "ASA": ("ALASKA", "ALASKA", ["SEATTLE", "PORTLAND", "SAN DIEGO", "AUSTIN", "BOISE", "LOS CABOS", "KONA"]),
    "AAL": ("AMER", "AMERICAN", ["DALLAS DFW", "PHOENIX", "CHARLOTTE", "CHICAGO ORD", "MIAMI"]),
    "DAL": ("DELTA", "DELTA", ["SALT LAKE CITY", "ATLANTA", "MINNEAPOLIS", "SEATTLE", "DETROIT"]),
    "UAL": ("UNITED", "UNITED", ["DENVER", "CHICAGO ORD", "HOUSTON IAH"]),
    "FFT": ("FRONT", "FRONTIER", ["LAS VEGAS", "DENVER", "PHOENIX"]),
    "SKW": ("SKYWEST", "SKYWEST", ["SALT LAKE CITY", "LOS ANGELES", "SEATTLE"]),
    "HAL": ("HAWAII", "HAWAIIAN", ["HONOLULU", "KAHULUI"]),
    "VOI": ("VOLARIS", "VOLARIS", ["GUADALAJARA", "MEXICO CITY", "MORELIA"]),
}

def format_flight_service(brand_code, flight_num):
    """Format airline and flight number to fit cleanly in 10-char Solari display."""
    s = f"{brand_code} {flight_num}".strip()
    if len(s) > 10:
        if brand_code == "UNITED":
            return f"UAL {flight_num}"[:10]
        elif brand_code == "ALASKA":
            return f"ALK {flight_num}"[:10]
        elif brand_code == "SKYWEST":
            return f"SKW {flight_num}"[:10]
        return s[:10]
    return s

def get_consistent_dest(callsign, dest_list):
    h = int(hashlib.md5(callsign.encode()).hexdigest(), 16)
    return dest_list[h % len(dest_list)]

def get_consistent_gate(prefix, flight_num):
    h = int(hashlib.md5(f"{prefix}{flight_num}".encode()).hexdigest(), 16)
    if prefix == "SWA":
        gate = 17 + (h % 18)
    elif prefix in ("ASA", "DAL", "UAL", "AAL"):
        gate = 1 + (h % 16)
    else:
        gate = 1 + (h % 30)
    return f"GT {gate}"

def fetch_sjc_flights(limit=12):
    """
    Fetch all SJC Airport arrivals and departures.
    Uses recognizable airline abbreviations:
    - SW (Southwest)
    - FRONT (Frontier)
    - ALASKA (Alaska)
    - DELTA (Delta)
    - AMER (American)
    - UNITED / UAL (United)
    """
    url = "https://opensky-network.org/api/states/all?lamin=37.1&lomin=-122.2&lamax=37.6&lomax=-121.7"
    records = []
    now = datetime.now()
    
    try:
        resp = requests.get(url, timeout=4)
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
                    
                brand_code, airline_name, dests = AIRLINE_MAP[prefix]
                flight_num = callsign[3:].strip()
                alt_meters = s[7]
                on_ground = s[8]
                speed_mps = s[9] or 0
                vert_rate = s[11] or 0
                
                dest = get_consistent_dest(callsign, dests)
                gate = get_consistent_gate(prefix, flight_num)
                
                # Distinguish Arrival vs Departure
                if on_ground:
                    m_type = "DEP"
                    status = "BOARDING" if speed_mps < 5 else "TAXIING"
                    target = dest
                elif vert_rate < -0.8:
                    m_type = "ARR"
                    status = "FINAL" if (alt_meters and alt_meters < 800) else "APPROACH"
                    target = f"FROM {dest}"
                else:
                    m_type = "DEP"
                    status = "CLIMBING" if vert_rate > 1 else "EN ROUTE"
                    target = dest
                    
                mins_offset = int(hashlib.md5(callsign.encode()).hexdigest(), 16) % 35
                dep_time = (now + timedelta(minutes=mins_offset)).strftime("%H:%M")
                
                records.append({
                    "type": m_type,
                    "time": dep_time,
                    "service": format_flight_service(brand_code, flight_num),
                    "destination": target[:16],
                    "track": gate[:5],
                    "status": status[:8],
                    "minutes_away": mins_offset,
                    "agency": "SJC"
                })
    except Exception as e:
        logger.debug(f"OpenSky error: {e}")
        
    # Baseline active SJC flight roster using recognizable airline names
    if len(records) < 8:
        sample_flights = [
            ("ARR", "SW",     "2684", "FROM SAN DIEGO", "GT 24", 5, "FINAL"),
            ("DEP", "ALASKA", "657",  "SEATTLE (SEA)",   "GT 12", 12, "BOARDING"),
            ("ARR", "UAL",    "1453", "FROM DENVER",     "GT 14", 18, "APPROACH"),
            ("DEP", "SW",     "3625", "AUSTIN (AUS)",    "GT 22", 24, "ON TIME"),
            ("ARR", "AMER",   "2834", "FROM DALLAS DFW", "GT 9",  30, "ON TIME"),
            ("DEP", "DELTA",  "1489", "SALT LAKE CITY",  "GT 7",  38, "ON TIME"),
            ("ARR", "SW",     "3491", "FROM LAS VEGAS",  "GT 20", 45, "ON TIME"),
            ("DEP", "FRONT",  "1191", "DENVER (DEN)",    "GT 16", 52, "BOARDING"),
            ("ARR", "ALASKA", "1315", "FROM PORTLAND",   "GT 11", 58, "ON TIME"),
            ("DEP", "SW",     "719",  "BURBANK (BUR)",   "GT 25", 65, "ON TIME"),
        ]
        for m_type, brand, num, target, gate, mins, status in sample_flights:
            t_str = (now + timedelta(minutes=mins)).strftime("%H:%M")
            records.append({
                "type": m_type,
                "time": t_str,
                "service": format_flight_service(brand, num),
                "destination": target[:16],
                "track": gate[:5],
                "status": status[:8],
                "minutes_away": mins,
                "agency": "SJC"
            })
            
    records.sort(key=lambda x: x.get("minutes_away", 99))
    return records[:limit]
