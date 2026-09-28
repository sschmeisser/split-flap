import logging
from datetime import datetime
import requests

logger = logging.getLogger(__name__)

def fetch_amtrak_departures(station_code="SJC", limit=10):
    """
    Fetch live Amtrak arrivals and departures for San Jose Diridon (SJC) exclusively.
    """
    url = f"https://api-v3.amtraker.com/v3/stations/{station_code}"
    records = []
    
    try:
        resp = requests.get(url, timeout=4)
        if resp.status_code != 200:
            return records
            
        data = resp.json()
        station_info = data.get(station_code, {})
        train_ids = station_info.get("trains", [])
        seen_trains = set()
        
        for tid in train_ids:
            t_num = tid.split("-")[0]
            if t_num in seen_trains:
                continue
            seen_trains.add(t_num)
            
            try:
                t_resp = requests.get(f"https://api-v3.amtraker.com/v3/trains/{t_num}", timeout=3)
                if t_resp.status_code != 200:
                    continue
                t_data = t_resp.json()
                t_list = t_data.get(t_num, [])
                if not t_list:
                    continue
                
                t_info = t_list[0]
                stops = t_info.get("stations", [])
                sjc_stop = next((s for s in stops if s.get("code") == station_code), None)
                if not sjc_stop:
                    continue
                
                orig_code = t_info.get("origCode", "")
                dest_code = t_info.get("destCode", "")
                dest_name = t_info.get("destName", "").upper()
                orig_name = t_info.get("origName", "").upper()
                
                # Check whether Diridon is destination, origin, or intermediate
                is_origin = (orig_code == station_code)
                is_final_dest = (dest_code == station_code)
                
                # Arrival or departure time
                if is_final_dest:
                    m_type = "ARR"
                    time_raw = sjc_stop.get("arr") or sjc_stop.get("schArr")
                    display_target = f"FROM {orig_name}"
                elif is_origin:
                    m_type = "DEP"
                    time_raw = sjc_stop.get("dep") or sjc_stop.get("schDep")
                    display_target = dest_name
                else:
                    # Intermediate stop like Coast Starlight
                    m_type = "DEP"
                    time_raw = sjc_stop.get("dep") or sjc_stop.get("schDep") or sjc_stop.get("arr")
                    display_target = dest_name

                if not time_raw:
                    continue
                    
                stop_status = sjc_stop.get("status", "Scheduled")
                platform = sjc_stop.get("platform", "") or "TRK 2"
                if not platform.upper().startswith("TRK"):
                    platform = f"TRK {platform}" if platform else "TRK 2"
                
                try:
                    dt = datetime.fromisoformat(time_raw)
                    time_str = dt.strftime("%H:%M")
                except Exception:
                    time_str = time_raw[11:16] if len(time_raw) >= 16 else "--:--"
                
                if stop_status == "Departed":
                    status_str = "DEPARTED"
                elif stop_status == "Station":
                    status_str = "BOARDING" if m_type == "DEP" else "ARRIVED"
                elif stop_status == "Enroute":
                    status_str = "EN ROUTE"
                else:
                    status_str = "ON TIME"
                    
                records.append({
                    "type": m_type,
                    "time": time_str,
                    "service": f"AMTK {t_num}"[:10],
                    "destination": display_target[:16],
                    "track": platform[:5],
                    "status": status_str[:8],
                    "agency": "Amtrak"
                })
            except Exception:
                continue
                
        records.sort(key=lambda x: x["time"])
        return records[:limit]
        
    except Exception as e:
        logger.warning(f"Error fetching Amtrak Diridon: {e}")
        return []
