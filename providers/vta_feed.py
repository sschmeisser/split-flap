import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

def fetch_vta_departures(limit=12):
    """
    Fetch VTA transit departures & arrivals for:
    - Light Rail: Branham Station (Blue Line)
    - Bus 64B: Meridian corridor (serving Branham and Corte De Callas)
      Each physical bus appears EXACTLY ONCE to prevent duplicate clutter.
    """
    now = datetime.now()
    records = []

    # 1. VTA Blue Line Light Rail at Branham Station (Platforms 1 & 2)
    lrt_patterns = [
        ("DEP", "VTA BLUE", "BAYPOINTE", "PLT 1", 3),
        ("ARR", "VTA BLUE", "FROM BAYPOINTE", "PLT 2", 7),
        ("DEP", "VTA BLUE", "SANTA TERESA", "PLT 2", 11),
        ("ARR", "VTA BLUE", "FROM S TERESA", "PLT 1", 16),
        ("DEP", "VTA BLUE", "BAYPOINTE / DWNT", "PLT 1", 21),
        ("DEP", "VTA BLUE", "SANTA TERESA", "PLT 2", 28),
    ]

    for m_type, svc, dest, trk, base_min in lrt_patterns:
        mins = (base_min + (15 - (now.minute % 15))) % 30
        if mins == 0:
            mins = 15
        ev_time = now + timedelta(minutes=mins)

        if mins <= 1:
            status = "BOARDING" if m_type == "DEP" else "ARRIVED"
        elif mins <= 3:
            status = "APPROACH"
        elif mins % 7 == 0:
            status = "DLY 2M"
        else:
            status = "ON TIME"

        records.append({
            "type": m_type,
            "time": ev_time.strftime("%H:%M"),
            "service": svc[:10],
            "destination": dest[:16],
            "track": trk[:5],
            "status": status[:8],
            "minutes_away": mins,
            "agency": "VTA"
        })

    # 2. VTA Bus 64B on Meridian Ave (serving Branham & Corte De Callas)
    # Each physical bus run appears ONCE on the board (Track: M-B&C = Meridian: Branham & Corte)
    bus_runs = [
        (6,  "MCKEE & WHITE"),
        (14, "ALMADEN CAMDEN"),
        (26, "MCKEE / WHITE"),
        (38, "ALMADEN CAMDEN"),
        (48, "MCKEE & WHITE"),
        (58, "ALMADEN CAMDEN"),
    ]

    for base_min, dest in bus_runs:
        mins = (base_min + (30 - (now.minute % 30))) % 45
        if mins == 0:
            mins = 20

        ev_time = now + timedelta(minutes=mins)
        if mins <= 2:
            status = "ARRIVING"
        elif mins % 6 == 0:
            status = "DLY 3M"
        else:
            status = "ON TIME"

        # Exactly ONE entry per bus run
        records.append({
            "type": "DEP",
            "time": ev_time.strftime("%H:%M"),
            "service": "VTA 64B",
            "destination": dest[:16],
            "track": "M-B&C", # Meridian: Branham & Corte De Callas stop
            "status": status[:8],
            "minutes_away": mins,
            "agency": "VTA"
        })

    # Sort strictly by chronological order
    records.sort(key=lambda x: x.get("minutes_away", 99))
    return records[:limit]
