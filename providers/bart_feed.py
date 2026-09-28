import logging
from datetime import datetime, timedelta
import requests

logger = logging.getLogger(__name__)

BART_STATIONS = [
    ("BERY", "Berryessa/N San Jose"),
    ("MLPT", "Milpitas"),
    ("WARM", "Warm Springs"),
    ("MLBR", "Millbrae"),
]

COLOR_ABBR = {
    "RED": "RED",
    "ORANGE": "ORG",
    "YELLOW": "YLW",
    "GREEN": "GRN",
    "BLUE": "BLU",
}

def fetch_bart_departures(orig="BERY", limit=10):
    """
    Fetch live BART departures from official BART API.
    Uses open demo key MW9S-E7SL-26DU-VV8V.
    """
    url = f"https://api.bart.gov/api/etd.aspx?cmd=etd&orig={orig}&key=MW9S-E7SL-26DU-VV8V&json=y"
    departures = []
    
    try:
        resp = requests.get(url, timeout=5)
        if resp.status_code != 200:
            logger.warning(f"BART API returned status {resp.status_code}")
            return departures
            
        data = resp.json()
        stations = data.get("root", {}).get("station", [])
        if not stations:
            return departures
            
        now = datetime.now()
        station_data = stations[0]
        etd_list = station_data.get("etd", [])
        
        for item in etd_list:
            dest = item.get("destination", "").upper()
            dest_abbr = item.get("abbreviation", "")
            estimates = item.get("estimate", [])
            
            for est in estimates:
                mins_str = est.get("minutes", "0")
                color = est.get("color", "")
                platform = est.get("platform", "1")
                delay_sec = int(est.get("delay", "0") or "0")
                
                try:
                    mins = int(mins_str) if mins_str != "Leaving" else 0
                except ValueError:
                    mins = 0
                    
                dep_time = now + timedelta(minutes=mins)
                time_str = dep_time.strftime("%H:%M")
                
                color_code = COLOR_ABBR.get(color.upper(), color[:3].upper())
                service_str = f"BART {color_code}"
                
                if mins_str == "Leaving" or mins == 0:
                    status_str = "BOARDING"
                elif delay_sec > 60:
                    delay_min = round(delay_sec / 60)
                    status_str = f"DLY {delay_min}M"
                elif mins <= 3:
                    status_str = "ARRIVING"
                else:
                    status_str = f"{mins} MIN"
                    
                departures.append({
                    "time": time_str,
                    "service": service_str,
                    "destination": dest[:18],
                    "track": f"PLT {platform}",
                    "status": status_str,
                    "minutes_away": mins,
                    "agency": "BART",
                    "badge": color.lower()
                })
                
        # Sort by minutes away
        departures.sort(key=lambda x: x["minutes_away"])
        return departures[:limit]
        
    except Exception as e:
        logger.error(f"Error fetching BART data: {e}")
        return []
