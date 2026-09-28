import logging
from datetime import datetime, timedelta
import requests

logger = logging.getLogger(__name__)

COLOR_ABBR = {
    "RED": "RED",
    "ORANGE": "ORG",
    "YELLOW": "YLW",
    "GREEN": "GRN",
    "BLUE": "BLU",
}

def fetch_bart_departures(limit=10):
    """
    Fetch Berryessa / North San Jose BART arrivals and departures exclusively.
    - Departures from Berryessa towards Richmond and Daly City.
    - Arrivals into Berryessa from Richmond and Daly City.
    """
    now = datetime.now()
    records = []
    
    # 1. Berryessa Departures
    try:
        url_dep = "https://api.bart.gov/api/etd.aspx?cmd=etd&orig=BERY&key=MW9S-E7SL-26DU-VV8V&json=y"
        resp = requests.get(url_dep, timeout=4)
        if resp.status_code == 200:
            data = resp.json()
            stations = data.get("root", {}).get("station", [])
            if stations:
                for item in stations[0].get("etd", []):
                    dest = item.get("destination", "").upper()
                    for est in item.get("estimate", []):
                        mins_str = est.get("minutes", "0")
                        color = est.get("color", "")
                        platform = est.get("platform", "1")
                        delay_sec = int(est.get("delay", "0") or "0")
                        mins = int(mins_str) if mins_str != "Leaving" else 0
                        
                        dep_time = (now + timedelta(minutes=mins)).strftime("%H:%M")
                        color_code = COLOR_ABBR.get(color.upper(), color[:3].upper())
                        
                        if mins_str == "Leaving" or mins == 0:
                            status = "BOARDING"
                        elif delay_sec > 60:
                            status = f"DLY {round(delay_sec/60)}M"
                        elif mins <= 2:
                            status = "CLOSING"
                        else:
                            status = f"{mins} MIN"
                            
                        records.append({
                            "type": "DEP",
                            "time": dep_time,
                            "service": f"BART {color_code}"[:10],
                            "destination": dest[:16],
                            "track": f"PLT {platform}"[:5],
                            "status": status[:8],
                            "minutes_away": mins,
                            "agency": "BART"
                        })
    except Exception as e:
        logger.warning(f"Error fetching BART Berryessa departures: {e}")

    # 2. Berryessa Arrivals (trains approaching Berryessa from Milpitas)
    try:
        url_arr = "https://api.bart.gov/api/etd.aspx?cmd=etd&orig=MLPT&key=MW9S-E7SL-26DU-VV8V&json=y"
        resp = requests.get(url_arr, timeout=4)
        if resp.status_code == 200:
            data = resp.json()
            stations = data.get("root", {}).get("station", [])
            if stations:
                for item in stations[0].get("etd", []):
                    if "BERY" in item.get("abbreviation", "") or "BERRYESSA" in item.get("destination", "").upper():
                        for est in item.get("estimate", []):
                            mins_str = est.get("minutes", "0")
                            color = est.get("color", "")
                            platform = est.get("platform", "1")
                            mins = (int(mins_str) if mins_str != "Leaving" else 0) + 4
                            arr_time = (now + timedelta(minutes=mins)).strftime("%H:%M")
                            color_code = COLOR_ABBR.get(color.upper(), color[:3].upper())
                            
                            origin = "RICHMOND" if color_code == "ORG" else "DALY CITY"
                            
                            if mins <= 2:
                                status = "ARRIVING"
                            elif mins <= 5:
                                status = "APPROACH"
                            else:
                                status = f"{mins} MIN"
                                
                            records.append({
                                "type": "ARR",
                                "time": arr_time,
                                "service": f"BART {color_code}"[:10],
                                "destination": f"FROM {origin}"[:16],
                                "track": f"PLT {platform}"[:5],
                                "status": status[:8],
                                "minutes_away": mins,
                                "agency": "BART"
                            })
    except Exception as e:
        logger.warning(f"Error fetching BART Berryessa arrivals: {e}")

    records.sort(key=lambda x: x.get("minutes_away", 99))
    return records[:limit]
