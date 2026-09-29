"""
Geospatial Telematics Engine
Provides authentic coordinates, transit alignments, motion trajectories,
and physical landmarks for all agencies and transit modes (Planes, Trains, Light Rail, Buses, BART, and DB).
"""

def enrich_geo_telematics(item):
    """
    Enriches a departure/arrival row item with precise physical coordinates,
    authentic transit alignments, motion trajectories, and physical station/airport landmarks.
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
        "center": [37.3300, -121.9030],
        "path": [[37.3300, -121.9030], [37.3400, -121.9120]],
        "start_heading": 320,
        "end_heading": 320,
        "speed_label": "35 mph",
        "location_name": "San Jose Regional Transit Corridor",
        "track_name": track,
        "landmarks": []
    }

    # 1. SJC AIRPORT (Planes) - Exactly aligned to Runway 30R / 12L Centerline
    if v_type == "plane":
        geo["zoom"] = 15
        geo["center"] = [37.3630, -121.9287]
        geo["location_name"] = f"Mineta San Jose Intl Airport • Runway 30R ({track})"
        geo["landmarks"] = [
            {"pos": [37.3653, -121.9255], "title": "✈️ SJC Terminal A", "type": "terminal"},
            {"pos": [37.3615, -121.9216], "title": "✈️ SJC Terminal B", "type": "terminal"},
            {"pos": [37.3524, -121.9168], "title": "Runway 30R Threshold", "type": "runway"},
            {"pos": [37.3737, -121.9407], "title": "Runway 30R Northwest End", "type": "runway"},
            {"pos": [37.3570, -121.9330], "title": "Coleman Avenue / Airport Blvd", "type": "street"}
        ]

        if m_type == "ARR":
            # Glides in on 318° final approach over Coleman Ave, touches down on Runway 30R, rolls out
            geo["path"] = [
                [37.3400, -121.9028],
                [37.3524, -121.9168],
                [37.3615, -121.9270],
                [37.3685, -121.9350]
            ]
            geo["start_heading"] = 318
            geo["end_heading"] = 318
            geo["speed_label"] = "132 kts • TOUCHDOWN"
        else:
            # Starts roll at Runway 30R threshold, accelerates, lifts off, climbs out over Guadalupe River
            geo["path"] = [
                [37.3524, -121.9168],
                [37.3605, -121.9260],
                [37.3705, -121.9370],
                [37.3860, -121.9545]
            ]
            geo["start_heading"] = 318
            geo["end_heading"] = 318
            geo["speed_label"] = "154 kts • CLIMBING"

    # 2. BART BERRYESSA (Subway / Rapid Transit) - Aligned to elevated guideway
    elif v_type == "bart":
        geo["zoom"] = 16
        geo["center"] = [37.3688, -121.8742]
        geo["location_name"] = f"BART Berryessa / North San Jose ({track})"
        geo["landmarks"] = [
            {"pos": [37.3688, -121.8742], "title": "🚇 BART Berryessa Station", "type": "station"},
            {"pos": [37.3725, -121.8765], "title": "Berryessa Road Viaduct", "type": "street"},
            {"pos": [37.3820, -121.8820], "title": "Trade Zone Blvd • Elevated Line", "type": "street"}
        ]

        if m_type == "ARR":
            # Inbound pulling south into Berryessa terminus
            geo["path"] = [
                [37.3820, -121.8820],
                [37.3755, -121.8780],
                [37.3710, -121.8752],
                [37.3688, -121.8742]
            ]
            geo["start_heading"] = 155
            geo["end_heading"] = 155
            geo["speed_label"] = "22 mph • ARRIVING"
        else:
            # Northbound departing Berryessa along aerial viaduct
            geo["path"] = [
                [37.3688, -121.8742],
                [37.3725, -121.8762],
                [37.3785, -121.8798],
                [37.3870, -121.8850]
            ]
            geo["start_heading"] = 335
            geo["end_heading"] = 335
            geo["speed_label"] = "48 mph • DEPARTING"

    # 3. VTA LIGHT RAIL (Branham Station / Blue Line) - Aligned directly in Highway 85 Median
    elif v_type == "light_rail":
        geo["zoom"] = 16
        geo["center"] = [37.2587, -121.8596]
        geo["location_name"] = f"VTA Light Rail • Branham Station ({track})"
        geo["landmarks"] = [
            {"pos": [37.2587, -121.8596], "title": "🚈 VTA Branham Station (Platform 1 & 2)", "type": "station"},
            {"pos": [37.2600, -121.8610], "title": "Highway 85 Transit Corridor", "type": "highway"},
            {"pos": [37.2575, -121.8580], "title": "Branham Lane Overpass", "type": "street"}
        ]

        is_south = ("TERESA" in dest) or ("ST" in dest and "SF" not in dest)
        if is_south:
            # Southbound down Highway 85 median tracks towards Santa Teresa
            geo["path"] = [
                [37.2670, -121.8685],
                [37.2625, -121.8638],
                [37.2587, -121.8596],
                [37.2530, -121.8535]
            ]
            geo["start_heading"] = 138
            geo["end_heading"] = 138
            geo["speed_label"] = "32 mph • SOUTHBOUND"
        else:
            # Northbound towards Baypointe
            geo["path"] = [
                [37.2530, -121.8535],
                [37.2587, -121.8596],
                [37.2625, -121.8638],
                [37.2670, -121.8685]
            ]
            geo["start_heading"] = 318
            geo["end_heading"] = 318
            geo["speed_label"] = "34 mph • NORTHBOUND"

    # 4. VTA BUS 64B (Meridian Ave & Branham / Corte De Callas) - Aligned along Meridian Avenue
    elif v_type == "bus":
        geo["zoom"] = 17
        geo["center"] = [37.2618, -121.8987]
        geo["location_name"] = f"VTA Bus 64B • Meridian & Branham ({track})"
        geo["landmarks"] = [
            {"pos": [37.2592, -121.8986], "title": "🚍 Meridian & Branham Bus Stop", "type": "bus_stop"},
            {"pos": [37.2638, -121.8987], "title": "🚍 Meridian & Corte De Callas Stop", "type": "bus_stop"},
            {"pos": [37.2680, -121.8988], "title": "Meridian Avenue", "type": "street"}
        ]

        is_south = ("ALMADEN" in dest) or ("CAMDEN" in dest)
        if is_south:
            # Southbound directly down Meridian Avenue
            geo["path"] = [
                [37.2690, -121.8988],
                [37.2638, -121.8987],
                [37.2592, -121.8986],
                [37.2535, -121.8985]
            ]
            geo["start_heading"] = 180
            geo["end_heading"] = 180
            geo["speed_label"] = "24 mph • STOPPING"
        else:
            # Northbound directly up Meridian Avenue
            geo["path"] = [
                [37.2535, -121.8985],
                [37.2592, -121.8986],
                [37.2638, -121.8987],
                [37.2690, -121.8988]
            ]
            geo["start_heading"] = 0
            geo["end_heading"] = 0
            geo["speed_label"] = "26 mph • DEPARTING"

    # 5. GERMANY - NÜRNBERG HAUPTBAHNHOF (DB) - Aligned along main tracks
    elif "NÜRNBERG" in dest or "NURNBERG" in dest or "ICE" in service or "IC " in service or "RE " in service or "RB " in service or "S1" in service or "S2" in service or "S3" in service or "S4" in service or "S5" in service:
        geo["zoom"] = 16
        geo["center"] = [49.4458, 11.0825]
        geo["location_name"] = f"Nürnberg Hauptbahnhof • {track}"
        geo["landmarks"] = [
            {"pos": [49.4458, 11.0825], "title": "🚆 Nürnberg Hauptbahnhof (Gleis 1-22)", "type": "station"},
            {"pos": [49.4475, 11.0820], "title": "Bahnhofsplatz / Frauentorgraben", "type": "street"},
            {"pos": [49.4460, 11.0715], "title": "Westliche Hauptgleise (Fürth / München)", "type": "track"}
        ]

        if m_type == "ARR":
            # Inbound glides into Nürnberg platform from western throat
            geo["path"] = [
                [49.4500, 11.0500],
                [49.4475, 11.0660],
                [49.4462, 11.0740],
                [49.4458, 11.0825]
            ]
            geo["start_heading"] = 100
            geo["end_heading"] = 100
            geo["speed_label"] = "38 km/h • EINFAHRT"
        else:
            # Outbound accelerates towards Fürth
            geo["path"] = [
                [49.4458, 11.0825],
                [49.4465, 11.0730],
                [49.4480, 11.0630],
                [49.4510, 11.0480]
            ]
            geo["start_heading"] = 280
            geo["end_heading"] = 280
            geo["speed_label"] = "85 km/h • AUSFAHRT"

    # 6. CALTRAIN / AMTRAK / ACE (San Jose Diridon Station) - Aligned to Peninsula rail corridor
    else:
        geo["zoom"] = 16
        geo["center"] = [37.3300, -121.9030]
        geo["location_name"] = f"San Jose Diridon Station • {track}"
        geo["landmarks"] = [
            {"pos": [37.3300, -121.9030], "title": "🚆 San Jose Diridon Depot", "type": "station"},
            {"pos": [37.3315, -121.9045], "title": "Platforms 1-5 • Caltrain / Amtrak / ACE", "type": "station"},
            {"pos": [37.3328, -121.9012], "title": "SAP Center at San Jose", "type": "landmark"},
            {"pos": [37.3325, -121.9000], "title": "W Santa Clara St / The Alameda", "type": "street"},
            {"pos": [37.3435, -121.9140], "title": "College Park Rail Junction", "type": "track"}
        ]

        if m_type == "ARR":
            # Inbound train pulling south into Diridon platform
            geo["path"] = [
                [37.3450, -121.9160],
                [37.3385, -121.9095],
                [37.3335, -121.9050],
                [37.3300, -121.9030]
            ]
            geo["start_heading"] = 148
            geo["end_heading"] = 148
            geo["speed_label"] = "18 mph • BRAKING"
        else:
            # Northbound train departing Diridon up Peninsula corridor
            geo["path"] = [
                [37.3300, -121.9030],
                [37.3340, -121.9052],
                [37.3410, -121.9118],
                [37.3490, -121.9195]
            ]
            geo["start_heading"] = 328
            geo["end_heading"] = 328
            geo["speed_label"] = "44 mph • DEPARTING"

    item["geo"] = geo
    return item
