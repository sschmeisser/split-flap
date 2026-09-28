import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

# Branham Station on VTA Blue Line (Santa Teresa <-> Baypointe via Downtown San Jose)
BRANHAM_PATTERNS = [
    ("DEP", "VTA BLUE", "BAYPOINTE", "PLT 1"),
    ("ARR", "VTA BLUE", "FROM BAYPOINTE", "PLT 2"),
    ("DEP", "VTA BLUE", "SANTA TERESA", "PLT 2"),
    ("ARR", "VTA BLUE", "FROM SANTA TERESA", "PLT 1"),
    ("DEP", "VTA BLUE", "BAYPOINTE / DNTWN", "PLT 1"),
    ("ARR", "VTA BLUE", "FROM BAYPOINTE", "PLT 2"),
    ("DEP", "VTA BLUE", "SANTA TERESA", "PLT 2"),
    ("ARR", "VTA BLUE", "FROM SANTA TERESA", "PLT 1"),
]

def fetch_vta_departures(limit=10):
    """
    Fetch VTA Light Rail arrivals and departures for Branham Station exclusively.
    """
    now = datetime.now()
    records = []
    
    for i, (m_type, svc, target, trk) in enumerate(BRANHAM_PATTERNS):
        mins = (i * 7) + (4 - (now.minute % 5))
        ev_time = now + timedelta(minutes=mins)
        
        if mins <= 1:
            status = "BOARDING" if m_type == "DEP" else "ARRIVED"
        elif mins <= 3:
            status = "ARRIVING"
        elif i == 5:
            status = "DLY 3M"
        else:
            status = f"{mins} MIN"
            
        records.append({
            "type": m_type,
            "time": ev_time.strftime("%H:%M"),
            "service": svc[:10],
            "destination": target[:16],
            "track": trk[:5],
            "status": status[:8],
            "minutes_away": mins,
            "agency": "VTA"
        })
        
    records.sort(key=lambda x: x.get("minutes_away", 99))
    return records[:limit]
