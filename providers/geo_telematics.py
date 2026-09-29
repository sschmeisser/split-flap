"""
Geospatial Telematics Engine
Provides authentic coordinates, transit alignments, and motion trajectories
for all agencies and transit modes (Planes, Trains, Light Rail, Buses, BART, and DB).
"""

def enrich_geo_telematics(item):
    """
    Enriches a departure/arrival row item with precise geospatial path data
    for 5-second animated map tracking.
    """
    if not item or not isinstance(item, dict):
        return item

    agency = (item.get("agency") or "").upper()
    service = (item.get("service") or "").upper()
    track = (item.get("track") or "").upper()
    dest = (item.get("destination") or "").upper()
    m_type = (item.get("type") or "DEP").upper()
    status = (item.get("status") or "").upper()

    # Determine vehicle type
    if agency == "SJC" or "GT" in track or "FLIGHT" in service or any(k in service for k in ["SW ", "ALASKA", "UAL ", "AMER", "DELTA", "FRONT", "SKYWEST", "VOI", "HAWAII"]):
        v_type = "plane"
    elif agency == "BART" or "BART" in service:
        v_type = "bart"
    elif "VTA" in service or "LIGHT RAIL" in service or "BLUE" in service:
        if "64B" in service or "BUS" in service or "M&BRN" in track or "M&CDC" in track:
            v_type = "bus"
        else:
            v_type = "light_rail"
    elif "64B" in service:
        v_type = "bus"
    else:
        v_type = "train"

    # Default fallback
    geo = {
        "type": v_type,
        "mode_type": m_type,
        "zoom": 15,
        "center": [37.3302, -121.9022],
        "path": [[37.3302, -121.9022], [37.3400, -121.9120]],
        "start_heading": 315,
        "end_heading": 315,
        "speed_label": "35 mph",
        "location_name": "San Jose Regional Transit Corridor",
        "track_name": track
    }

    # 1. SJC AIRPORT (Planes)
    if v_type == "plane":
        geo["zoom"] = 15
        geo["center"] = [37.3639, -121.9289]
        geo["location_name"] = f"Mineta San Jose Intl Airport • Runway 30R ({track})"
        if m_type == "ARR":
            # Glides in on final approach from south-east and touches down on Runway 30R
            geo["path"] = [
                [37.3380, -121.8970],
                [37.3480, -121.9100],
                [37.3565, -121.9210],
                [37.3640, -121.9305]
            ]
            geo["start_heading"] = 308
            geo["end_heading"] = 308
            geo["speed_label"] = "132 kts • TOUCHDOWN"
        else:
            # Rolls down Runway 30R, lifts off and climbs out north-west
            geo["path"] = [
                [37.3535, -121.9170],
                [37.3615, -121.9272],
                [37.3715, -121.9398],
                [37.3870, -121.9595]
            ]
            geo["start_heading"] = 308
            geo["end_heading"] = 308
            geo["speed_label"] = "154 kts • CLIMBING"

    # 2. BART BERRYESSA (Subway / Rapid Transit)
    elif v_type == "bart":
        geo["zoom"] = 16
        geo["center"] = [37.3684, -121.8746]
        geo["location_name"] = f"BART Berryessa / North San Jose ({track})"
        if m_type == "ARR":
            # Inbound pulling into Berryessa terminus
            geo["path"] = [
                [37.3860, -121.8860],
                [37.3780, -121.8805],
                [37.3720, -121.8765],
                [37.3684, -121.8746]
            ]
            geo["start_heading"] = 155
            geo["end_heading"] = 155
            geo["speed_label"] = "22 mph • ARRIVING"
        else:
            # Northbound departing towards Milpitas / Richmond / Daly City
            geo["path"] = [
                [37.3684, -121.8746],
                [37.3735, -121.8775],
                [37.3810, -121.8825],
                [37.3910, -121.8890]
            ]
            geo["start_heading"] = 335
            geo["end_heading"] = 335
            geo["speed_label"] = "48 mph • DEPARTING"

    # 3. VTA LIGHT RAIL (Branham Station / Blue Line)
    elif v_type == "light_rail":
        geo["zoom"] = 16
        geo["center"] = [37.2625, -121.8608]
        geo["location_name"] = f"VTA Light Rail • Branham Station ({track})"
        is_south = ("TERESA" in dest) or ("ST" in dest and "SF" not in dest)
        if is_south:
            # Southbound towards Santa Teresa
            geo["path"] = [
                [37.2760, -121.8740],
                [37.2685, -121.8665],
                [37.2625, -121.8608],
                [37.2555, -121.8540]
            ]
            geo["start_heading"] = 138
            geo["end_heading"] = 138
            geo["speed_label"] = "32 mph • SOUTHBOUND"
        else:
            # Northbound towards Baypointe
            geo["path"] = [
                [37.2555, -121.8540],
                [37.2625, -121.8608],
                [37.2685, -121.8665],
                [37.2760, -121.8740]
            ]
            geo["start_heading"] = 318
            geo["end_heading"] = 318
            geo["speed_label"] = "34 mph • NORTHBOUND"

    # 4. VTA BUS 64B (Meridian & Branham / Corte De Callas)
    elif v_type == "bus":
        geo["zoom"] = 17
        geo["center"] = [37.2618, -121.8990]
        geo["location_name"] = f"VTA Bus 64B • Meridian & Branham ({track})"
        is_south = ("ALMADEN" in dest) or ("CAMDEN" in dest)
        if is_south:
            # Southbound down Meridian Ave
            geo["path"] = [
                [37.2710, -121.9010],
                [37.2660, -121.9000],
                [37.2618, -121.8990],
                [37.2570, -121.8980]
            ]
            geo["start_heading"] = 170
            geo["end_heading"] = 170
            geo["speed_label"] = "24 mph • STOPPING"
        else:
            # Northbound towards McKee & White
            geo["path"] = [
                [37.2570, -121.8980],
                [37.2618, -121.8990],
                [37.2660, -121.9000],
                [37.2710, -121.9010]
            ]
            geo["start_heading"] = 350
            geo["end_heading"] = 350
            geo["speed_label"] = "26 mph • DEPARTING"

    # 5. GERMANY - NÜRNBERG HAUPTBAHNHOF (DB Fernverkehr & Regio & S-Bahn)
    elif "NÜRNBERG" in dest or "NURNBERG" in dest or "ICE" in service or "IC " in service or "RE " in service or "RB " in service or "S1" in service or "S2" in service or "S3" in service or "S4" in service or "S5" in service:
        geo["zoom"] = 16
        geo["center"] = [49.4456, 11.0826]
        geo["location_name"] = f"Nürnberg Hauptbahnhof • {track}"
        if m_type == "ARR":
            # Inbound glides into Nürnberg tracks from western corridor
            geo["path"] = [
                [49.4540, 11.0420],
                [49.4495, 11.0610],
                [49.4470, 11.0725],
                [49.4456, 11.0826]
            ]
            geo["start_heading"] = 105
            geo["end_heading"] = 105
            geo["speed_label"] = "38 km/h • EINFAHRT"
        else:
            # Outbound accelerates towards Fürth / Munich
            geo["path"] = [
                [49.4456, 11.0826],
                [49.4475, 11.0710],
                [49.4505, 11.0570],
                [49.4555, 11.0370]
            ]
            geo["start_heading"] = 285
            geo["end_heading"] = 285
            geo["speed_label"] = "85 km/h • AUSFAHRT"

    # 6. CALTRAIN / AMTRAK / ACE (San Jose Diridon Station)
    else:
        geo["zoom"] = 16
        geo["center"] = [37.3302, -121.9022]
        geo["location_name"] = f"San Jose Diridon Station • {track}"
        is_ace = "ACE" in service
        if m_type == "ARR":
            # Inbound train pulling into Diridon
            geo["path"] = [
                [37.3460, -121.9210],
                [37.3385, -121.9115],
                [37.3330, -121.9055],
                [37.3302, -121.9022]
            ]
            geo["start_heading"] = 145
            geo["end_heading"] = 145
            geo["speed_label"] = "18 mph • BRAKING"
        else:
            # Northbound train departing Diridon up the Peninsula or ACE northeast
            if is_ace:
                geo["path"] = [
                    [37.3302, -121.9022],
                    [37.3370, -121.9060],
                    [37.3460, -121.9070],
                    [37.3580, -121.9020]
                ]
                geo["start_heading"] = 355
                geo["end_heading"] = 25
                geo["speed_label"] = "42 mph • ACCELERATING"
            else:
                geo["path"] = [
                    [37.3302, -121.9022],
                    [37.3355, -121.9075],
                    [37.3440, -121.9180],
                    [37.3540, -121.9310]
                ]
                geo["start_heading"] = 325
                geo["end_heading"] = 325
                geo["speed_label"] = "46 mph • DEPARTING"

    item["geo"] = geo
    return item
