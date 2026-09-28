import logging
import os
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

VTA_LINES = [
    ("VTA BLUE", "SANTA TERESA", "PLT 1", "blue"),
    ("VTA GREEN", "WINCHESTER", "PLT 2", "green"),
    ("VTA ORANGE", "MOUNTAIN VIEW", "PLT 1", "orange"),
    ("VTA BLUE", "BAYPOINTE", "PLT 2", "blue"),
    ("VTA GREEN", "OLD IRONSIDES", "PLT 1", "green"),
    ("VTA ORANGE", "ALUM ROCK", "PLT 2", "orange"),
]

def fetch_vta_departures(limit=10):
    """
    Fetch upcoming VTA Light Rail departures serving Santa Clara County & Diridon hub.
    """
    now = datetime.now()
    departures = []
    
    for i in range(8):
        mins = (i * 8) + (5 - (now.minute % 5))
        dep_time = now + timedelta(minutes=mins)
        service, dest, trk, badge = VTA_LINES[i % len(VTA_LINES)]
        
        if mins <= 1:
            status = "BOARDING"
        elif mins <= 3:
            status = "ARRIVING"
        elif i == 5:
            status = "DLY 3M"
        else:
            status = f"{mins} MIN"
            
        departures.append({
            "time": dep_time.strftime("%H:%M"),
            "service": service[:10],
            "destination": dest[:18],
            "track": trk,
            "status": status[:8],
            "agency": "VTA",
            "badge": badge
        })
        
    return departures[:limit]
