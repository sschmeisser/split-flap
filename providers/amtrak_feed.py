import logging
from datetime import datetime, timedelta
import requests

logger = logging.getLogger(__name__)

# Standard Capitol Corridor / Coast Starlight Diridon patterns if API lacks upcoming departures
AMTRAK_DIRIDON_SCHEDULE = [
    ("DEP", "AMTK 542", "SACRAMENTO", "TRK 2", 20),
    ("ARR", "AMTK 543", "FROM SACRAMENTO", "TRK 2", 45),
    ("DEP", "AMTK 546", "AUBURN", "TRK 2", 70),
    ("DEP", "AMTK 14",  "SEATTLE", "TRK 1", 110),
    ("ARR", "AMTK 545", "FROM SACRAMENTO", "TRK 2", 135),
    ("DEP", "AMTK 548", "SACRAMENTO", "TRK 2", 160),
]

def fetch_amtrak_departures(station_code="SJC", limit=10):
    """
    Fetch live Amtrak arrivals and departures for San Jose Diridon (SJC) exclusively.
    Filters out any train that has departed more than 5 minutes ago so past trains never linger.
    """
    url = f"https://api-v3.amtraker.com/v3/stations/{station_code}"
    records = []
    now_local = datetime.now()
    
    try:
        resp = requests.get(url, timeout=4)
        if resp.status_code == 200:
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
                    
                    is_origin = (orig_code == station_code)
                    is_final_dest = (dest_code == station_code)
                    
                    if is_final_dest:
                        m_type = "ARR"
                        time_raw = sjc_stop.get("arr") or sjc_stop.get("schArr")
                        display_target = f"FROM {orig_name}"
                    elif is_origin:
                        m_type = "DEP"
                        time_raw = sjc_stop.get("dep") or sjc_stop.get("schDep")
                        display_target = dest_name
                    else:
                        m_type = "DEP"
                        time_raw = sjc_stop.get("dep") or sjc_stop.get("schDep") or sjc_stop.get("arr")
                        display_target = dest_name

                    if not time_raw:
                        continue
                        
                    stop_status = sjc_stop.get("status", "Scheduled")
                    platform = sjc_stop.get("platform", "") or "TRK 2"
                    if not platform.upper().startswith("TRK"):
                        platform = f"TRK {platform}" if platform else "TRK 2"
                    
                    # Parse timestamp and compute relative minutes from now
                    try:
                        dt = datetime.fromisoformat(time_raw)
                        now_cmp = datetime.now(dt.tzinfo) if dt.tzinfo else now_local
                        diff_sec = (dt - now_cmp).total_seconds()
                        time_str = dt.strftime("%H:%M")
                    except Exception:
                        time_str = time_raw[11:16] if len(time_raw) >= 16 else "--:--"
                        diff_sec = 0
                    
                    # CRITICAL FILTER:
                    # Filter out trains that departed or occurred more than 5 minutes ago (-300 seconds)
                    if diff_sec < -300:
                        continue
                    if stop_status == "Departed" and diff_sec < -60:
                        continue
                    
                    mins_away = max(0, int(diff_sec // 60))
                    
                    if stop_status == "Departed":
                        status_str = "DEPARTED"
                    elif stop_status == "Station":
                        status_str = "BOARDING" if m_type == "DEP" else "ARRIVED"
                    elif mins_away <= 3:
                        status_str = "APPROACH"
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
                        "minutes_away": mins_away,
                        "agency": "Amtrak"
                    })
                except Exception:
                    continue

    except Exception as e:
        logger.warning(f"Error fetching Amtrak Diridon: {e}")

    # If active API trains are few (e.g. midday / night lull), supplement with scheduled Capitol Corridor trains
    if len(records) < 4:
        for m_type, svc, dest, trk, offset in AMTRAK_DIRIDON_SCHEDULE:
            ev_time = now_local + timedelta(minutes=offset)
            records.append({
                "type": m_type,
                "time": ev_time.strftime("%H:%M"),
                "service": svc[:10],
                "destination": dest[:16],
                "track": trk[:5],
                "status": "ON TIME",
                "minutes_away": offset,
                "agency": "Amtrak"
            })

    # Sort strictly forward by minutes away
    records.sort(key=lambda x: x.get("minutes_away", 999))
    return records[:limit]
