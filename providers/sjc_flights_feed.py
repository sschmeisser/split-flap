import logging
import time
from datetime import datetime
import requests

logger = logging.getLogger(__name__)

# Human-recognizable airline brand abbreviations instead of obscure 2-letter IATA codes
AIRLINE_BRAND_MAP = {
    "SOUTHWEST": ("SW", "Southwest Airlines"),
    "ALASKA": ("ALASKA", "Alaska Airlines"),
    "AMERICAN": ("AMER", "American Airlines"),
    "DELTA": ("DELTA", "Delta Air Lines"),
    "UNITED": ("UNITED", "United Airlines"),
    "FRONTIER": ("FRONT", "Frontier Airlines"),
    "HAWAIIAN": ("HAWAII", "Hawaiian Airlines"),
    "SKYWEST": ("SKYWEST", "SkyWest Airlines"),
    "SPIRIT": ("SPIRIT", "Spirit Airlines"),
    "VOLARIS": ("VOLARIS", "Volaris"),
    "ANA": ("ANA", "All Nippon Airways"),
    "ZIPAIR": ("ZIPAIR", "ZIPAIR Tokyo"),
}

# Cache last successful fetch in case of temporary network hiccups
_LAST_SJC_RECORDS = []
_LAST_FETCH_TIME = 0


def format_flight_service(brand_code, flight_num):
    """Format airline and flight number to fit cleanly in 10-char Solari display."""
    s = f"{brand_code} {flight_num}".strip()
    if len(s) > 10:
        if brand_code == "UNITED":
            return f"UAL {flight_num}"[:10]
        elif brand_code == "ALASKA":
            return f"AS {flight_num}"[:10]
        elif brand_code == "SKYWEST":
            return f"SKW {flight_num}"[:10]
        elif brand_code == "HAWAII":
            return f"HAL {flight_num}"[:10]
        elif brand_code == "VOLARIS":
            return f"VOI {flight_num}"[:10]
        return s[:10]
    return s


def format_dest(dest_raw, code):
    """Format destination cleanly to fit 15-char Solari display."""
    city = (dest_raw or "").split(",")[0].strip()
    if "/" in city:
        city = city.split("/")[0].strip()
    city = city.upper()
    if code:
        cand = f"{city} ({code})"
        if len(cand) <= 15:
            return cand
    return city[:15]


def format_origin(origin_raw, code):
    """Format arrival origin cleanly to fit 15-char Solari display."""
    city = (origin_raw or "").split(",")[0].strip()
    if "/" in city:
        city = city.split("/")[0].strip()
    city = city.upper()
    cand = f"FROM {city}"
    if len(cand) <= 15:
        return cand
    if code:
        code_cand = f"FROM {code}"
        if len(code_cand) <= 15:
            return code_cand
    return cand[:15]


def fetch_sjc_flights(limit=12):
    """
    Fetch live Mineta San José International Airport (SJC) arrivals and departures
    directly from the official airport FIDS JSON API (https://www.flysanjose.com/api/flightstatus).
    Provides 100% genuine real-world flight operations (real flight numbers, real gates,
    real scheduled times, destinations, and live statuses).
    """
    global _LAST_SJC_RECORDS, _LAST_FETCH_TIME
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    }

    records = []
    now = datetime.now()

    try:
        deps_resp = requests.get(
            "https://www.flysanjose.com/api/flightstatus/departures",
            headers=headers,
            timeout=6,
        )
        arrs_resp = requests.get(
            "https://www.flysanjose.com/api/flightstatus/arrivals",
            headers=headers,
            timeout=6,
        )

        if deps_resp.status_code == 200 and arrs_resp.status_code == 200:
            deps_data = deps_resp.json()
            arrs_data = arrs_resp.json()

            # Process live departures
            for d in deps_data:
                try:
                    date_str = d.get("date")
                    time_str = d.get("time")
                    if not date_str or not time_str:
                        continue
                    dt = datetime.strptime(
                        f"{now.year} {date_str} {time_str}", "%Y %b %d %I:%M %p"
                    )
                    mins = int((dt - now).total_seconds() / 60)

                    airline_raw = (d.get("airline") or "").strip().upper()
                    brand, full_airline = AIRLINE_BRAND_MAP.get(
                        airline_raw,
                        (airline_raw[:6] if airline_raw else "FLT", d.get("airline") or "Flight"),
                    )
                    f_num = (d.get("flight_number") or "").strip()
                    gate = (d.get("gate") or "").strip()
                    track = f"GT {gate}"[:5] if gate else "GT --"
                    dest = format_dest(d.get("destination", ""), d.get("destination_code", ""))

                    raw_status = (d.get("status") or "").strip().lower()
                    if "departed" in raw_status:
                        status = "DEPARTED"
                    elif "cancel" in raw_status:
                        status = "CANCELLED"
                    elif "delayed" in raw_status:
                        status = "DELAYED"
                    elif 0 <= mins <= 25:
                        status = "BOARDING"
                    else:
                        status = "ON TIME"

                    records.append({
                        "type": "DEP",
                        "time": dt.strftime("%H:%M"),
                        "service": format_flight_service(brand, f_num),
                        "airline": full_airline,
                        "destination": dest,
                        "track": track,
                        "status": status,
                        "minutes_away": mins,
                        "agency": "SJC",
                    })
                except Exception as e:
                    logger.debug(f"Error parsing SJC departure row: {e}")

            # Process live arrivals
            for a in arrs_data:
                try:
                    date_str = a.get("date")
                    time_str = a.get("time")
                    if not date_str or not time_str:
                        continue
                    dt = datetime.strptime(
                        f"{now.year} {date_str} {time_str}", "%Y %b %d %I:%M %p"
                    )
                    mins = int((dt - now).total_seconds() / 60)

                    airline_raw = (a.get("airline") or "").strip().upper()
                    brand, full_airline = AIRLINE_BRAND_MAP.get(
                        airline_raw,
                        (airline_raw[:6] if airline_raw else "FLT", a.get("airline") or "Flight"),
                    )
                    f_num = (a.get("flight_number") or "").strip()
                    gate = (a.get("gate") or "").strip()
                    track = f"GT {gate}"[:5] if gate else "GT --"
                    target = format_origin(a.get("origin", ""), a.get("origin_code", ""))

                    raw_status = (a.get("status") or "").strip().lower()
                    if "arrived" in raw_status:
                        status = "ARRIVED"
                    elif "cancel" in raw_status:
                        status = "CANCELLED"
                    elif "delayed" in raw_status:
                        status = "DELAYED"
                    elif 0 <= mins <= 10:
                        status = "APPROACH"
                    else:
                        status = "ON TIME"

                    records.append({
                        "type": "ARR",
                        "time": dt.strftime("%H:%M"),
                        "service": format_flight_service(brand, f_num),
                        "airline": full_airline,
                        "destination": target,
                        "track": track,
                        "status": status,
                        "minutes_away": mins,
                        "agency": "SJC",
                    })
                except Exception as e:
                    logger.debug(f"Error parsing SJC arrival row: {e}")

            if records:
                # Keep active window: recently arrived/departed (-15m) up to +240m upcoming
                active_window = [r for r in records if -15 <= r["minutes_away"] <= 240]
                # Chronological sort by minutes from now (next immediate events first)
                active_window.sort(key=lambda x: (x["minutes_away"] < -5, x["minutes_away"]))
                _LAST_SJC_RECORDS = active_window
                _LAST_FETCH_TIME = time.time()
                return _LAST_SJC_RECORDS[:limit]

    except Exception as e:
        logger.warning(f"Error connecting to flysanjose.com API: {e}")

    # If recent cache exists, return it
    if _LAST_SJC_RECORDS:
        return _LAST_SJC_RECORDS[:limit]

    return []
