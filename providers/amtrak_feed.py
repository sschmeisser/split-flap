import logging
from datetime import datetime
import requests

logger = logging.getLogger(__name__)

def fetch_amtrak_departures(station_code="SJC", limit=10):
    """
    Fetch live Amtrak departures for San Jose Diridon (SJC) or other stations.
    Uses public Amtraker v3 API.
    """
    url = f"https://api-v3.amtraker.com/v3/stations/{station_code}"
    departures = []
    
    try:
        resp = requests.get(url, timeout=5)
        if resp.status_code != 200:
            logger.warning(f"Amtrak station API returned status {resp.status_code}")
            return departures
            
        data = resp.json()
        station_info = data.get(station_code, {})
        train_ids = station_info.get("trains", [])
        
        seen_train_nums = set()
        
        for tid in train_ids:
            train_num = tid.split("-")[0]
            if train_num in seen_train_nums:
                continue
            seen_train_nums.add(train_num)
            
            try:
                t_resp = requests.get(f"https://api-v3.amtraker.com/v3/trains/{train_num}", timeout=4)
                if t_resp.status_code != 200:
                    continue
                t_data = t_resp.json()
                t_list = t_data.get(train_num, [])
                if not t_list:
                    continue
                
                # Take the most relevant active train
                t_info = t_list[0]
                route_name = t_info.get("routeName", "Amtrak")
                dest_name = t_info.get("destName", "").upper()
                
                # Find SJC stop
                stops = t_info.get("stations", [])
                sjc_stop = next((s for s in stops if s.get("code") == station_code), None)
                
                if not sjc_stop:
                    continue
                
                # Check scheduled and actual departure
                dep_raw = sjc_stop.get("dep") or sjc_stop.get("schDep") or sjc_stop.get("arr") or sjc_stop.get("schArr")
                if not dep_raw:
                    continue
                    
                stop_status = sjc_stop.get("status", "Scheduled")
                platform = sjc_stop.get("platform", "") or "TRK 2"
                if not platform.upper().startswith("TRK"):
                    platform = f"TRK {platform}" if platform else "TRK 2"
                
                # Format time HH:MM
                try:
                    dt = datetime.fromisoformat(dep_raw)
                    time_str = dt.strftime("%H:%M")
                except Exception:
                    time_str = dep_raw[11:16] if len(dep_raw) >= 16 else "--:--"
                
                # Format status
                if stop_status == "Departed":
                    status_str = "DEPARTED"
                elif stop_status == "Station":
                    status_str = "BOARDING"
                elif stop_status == "Enroute":
                    status_str = "EN ROUTE"
                else:
                    status_str = "ON TIME"
                
                # Service code
                if "CAPITOL" in route_name.upper():
                    service_str = f"AMTK {train_num}"
                elif "STARLIGHT" in route_name.upper():
                    service_str = f"AMTK {train_num}"
                else:
                    service_str = f"AMTK {train_num}"
                    
                departures.append({
                    "time": time_str,
                    "service": service_str[:10],
                    "destination": dest_name[:18],
                    "track": platform[:6],
                    "status": status_str[:8],
                    "agency": "Amtrak",
                    "badge": "blue"
                })
            except Exception as inner_e:
                logger.debug(f"Error fetching Amtrak train {train_num}: {inner_e}")
                continue
                
        # Sort by departure time
        departures.sort(key=lambda x: x["time"])
        return departures[:limit]
        
    except Exception as e:
        logger.error(f"Error fetching Amtrak data: {e}")
        return []
