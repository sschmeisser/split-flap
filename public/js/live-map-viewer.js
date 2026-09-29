/**
 * Live Transit Map Viewer
 * Renders high-contrast dark cartography with street labels, airport/station landmarks,
 * on-vehicle floating telemetry callout tags, and realistic smooth vehicle movement.
 */

class LiveMapViewer {
    constructor() {
        this.overlay = document.getElementById('liveMapOverlay');
        this.mapContainer = document.getElementById('liveMap');
        this.map = null;
        this.currentMarker = null;
        this.currentPathLine = null;
        this.landmarkMarkers = [];
        this.animationFrame = null;
        this.isAnimating = false;
        this.tileLayer = null;
        this.labelLayer = null;

        this.initHUD();
    }

    initHUD() {
        if (!this.overlay) return;
        this.badgeEl = document.getElementById('mapVehicleBadge');
        this.destEl = document.getElementById('mapVehicleDest');
        this.telemetryEl = document.getElementById('mapTelemetryStatus');
        this.locationEl = document.getElementById('mapLocationName');
        this.progressFill = document.getElementById('mapProgressFill');
    }

    initMap() {
        if (this.map) return;
        if (!window.L) {
            console.error('[LiveMap] Leaflet not loaded');
            return;
        }

        // Initialize Leaflet map with dark theme and continuous fractional zoom
        this.map = L.map('liveMap', {
            zoomControl: false,
            attributionControl: false,
            fadeAnimation: true,
            zoomAnimation: true,
            zoomSnap: 0,
            zoomDelta: 0.1
        }).setView([37.3630, -121.9287], 15);

        // 1. Dark Transit Cartography Base (Esri World Dark Gray Canvas with native 16 upscaling)
        this.tileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19,
            maxNativeZoom: 16,
            opacity: 0.95
        }).addTo(this.map);

        // 2. High-Resolution Dark Reference Labels (Streets, Highways, Place Names)
        this.labelLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19,
            maxNativeZoom: 16,
            opacity: 0.90
        }).addTo(this.map);
    }

    getVehicleMarkerIcon(type, heading = 0, info = null) {
        let svgContent = '';

        if (type === 'plane') {
            // Swept-wing commercial airliner with navigation lights & twin turbines
            svgContent = `
                <svg width="48" height="48" viewBox="0 0 100 100" style="filter: drop-shadow(0 6px 14px rgba(0,0,0,0.95));">
                    <!-- Twin Turbine Pods -->
                    <rect x="36" y="44" width="6" height="14" rx="2" fill="#adb5bd"/>
                    <rect x="58" y="44" width="6" height="14" rx="2" fill="#adb5bd"/>
                    <!-- Fuselage Body -->
                    <path d="M50 10 C46 16 44 32 44 56 L44 76 C44 80 47 84 50 84 C53 84 56 80 56 76 L56 56 C56 32 54 16 50 10 Z" fill="#ffffff" stroke="#ced4da" stroke-width="1.5"/>
                    <!-- Main Wings -->
                    <path d="M50 36 L12 60 C9 62 10 65 14 65 L44 54 L44 40 Z" fill="#ffd166"/>
                    <path d="M50 36 L88 60 C91 62 90 65 86 65 L56 54 L56 40 Z" fill="#ffd166"/>
                    <!-- Wingtip Navigation Lights -->
                    <circle cx="12" cy="62" r="3" fill="#ff4d4f"/>
                    <circle cx="88" cy="62" r="3" fill="#2ecc71"/>
                    <!-- Horizontal Stabilizers -->
                    <path d="M50 72 L32 82 C30 83 31 85 33 85 L45 79 Z" fill="#f5b722"/>
                    <path d="M50 72 L68 82 C70 83 69 85 67 85 L55 79 Z" fill="#f5b722"/>
                    <!-- Cockpit Windshield -->
                    <path d="M47 22 Q50 19 53 22 L53 27 Q50 25 47 27 Z" fill="#1e293b"/>
                </svg>
            `;
        } else if (type === 'bus') {
            // Modern Transit Bus with LED Route Display & Headlights
            svgContent = `
                <svg width="44" height="44" viewBox="0 0 100 100" style="filter: drop-shadow(0 6px 14px rgba(0,0,0,0.95));">
                    <!-- Bus Chassis -->
                    <rect x="30" y="14" width="40" height="72" rx="9" fill="#10b981" stroke="#ffffff" stroke-width="2.5"/>
                    <!-- Windshield -->
                    <path d="M34 26 C34 22 36 20 50 20 C64 20 66 22 66 26 L66 36 L34 36 Z" fill="#0f172a"/>
                    <!-- Destination LED Banner -->
                    <rect x="38" y="16" width="24" height="4" rx="1.5" fill="#f5b722"/>
                    <!-- Side Passenger Windows -->
                    <rect x="33" y="42" width="5" height="12" rx="1.5" fill="#0f172a"/>
                    <rect x="33" y="58" width="5" height="12" rx="1.5" fill="#0f172a"/>
                    <rect x="62" y="42" width="5" height="12" rx="1.5" fill="#0f172a"/>
                    <rect x="62" y="58" width="5" height="12" rx="1.5" fill="#0f172a"/>
                    <!-- Dual Headlamps -->
                    <circle cx="36" cy="18" r="3.5" fill="#fffbe6"/>
                    <circle cx="64" cy="18" r="3.5" fill="#fffbe6"/>
                    <!-- Rear Taillights -->
                    <rect x="33" y="82" width="5" height="3" fill="#ef4444"/>
                    <rect x="62" y="82" width="5" height="3" fill="#ef4444"/>
                </svg>
            `;
        } else if (type === 'light_rail') {
            // Modern Articulated Light Rail Vehicle (LRV)
            svgContent = `
                <svg width="44" height="44" viewBox="0 0 100 100" style="filter: drop-shadow(0 6px 14px rgba(0,0,0,0.95));">
                    <!-- Articulated LRV Body -->
                    <rect x="32" y="12" width="36" height="76" rx="8" fill="#0284c7" stroke="#ffffff" stroke-width="2.5"/>
                    <!-- Articulation Accordion Bellows -->
                    <rect x="30" y="48" width="40" height="4" fill="#334155"/>
                    <!-- Front & Rear Windshields -->
                    <rect x="36" y="18" width="28" height="11" rx="2" fill="#090d16"/>
                    <rect x="36" y="71" width="28" height="11" rx="2" fill="#090d16"/>
                    <!-- Passenger Windows -->
                    <rect x="36" y="34" width="28" height="10" rx="1.5" fill="#090d16"/>
                    <rect x="36" y="56" width="28" height="10" rx="1.5" fill="#090d16"/>
                    <!-- Diamond Roof Pantograph -->
                    <path d="M50 40 L44 46 L50 52 L56 46 Z" fill="none" stroke="#f5b722" stroke-width="2.5"/>
                    <!-- Xenon Headlights -->
                    <circle cx="38" cy="15" r="3" fill="#ffe58f"/>
                    <circle cx="62" cy="15" r="3" fill="#ffe58f"/>
                </svg>
            `;
        } else if (type === 'bart') {
            // BART Fleet of the Future Aerodynamic Train Car
            svgContent = `
                <svg width="44" height="44" viewBox="0 0 100 100" style="filter: drop-shadow(0 6px 14px rgba(0,0,0,0.95));">
                    <!-- BART Aluminum Carbody -->
                    <rect x="32" y="12" width="36" height="76" rx="7" fill="#e2e8f0" stroke="#0ea5e9" stroke-width="2.5"/>
                    <!-- Streamlined Nose Chevron (BART Cyan Accent) -->
                    <path d="M32 20 L50 12 L68 20 L68 28 L50 22 L32 28 Z" fill="#0284c7"/>
                    <!-- Tinted Windshield -->
                    <rect x="36" y="24" width="28" height="10" rx="2" fill="#0f172a"/>
                    <!-- Side Windows -->
                    <rect x="35" y="38" width="30" height="9" rx="1.5" fill="#0f172a"/>
                    <rect x="35" y="51" width="30" height="9" rx="1.5" fill="#0f172a"/>
                    <rect x="35" y="64" width="30" height="9" rx="1.5" fill="#0f172a"/>
                    <!-- LED Headlights -->
                    <circle cx="38" cy="15" r="3" fill="#ffffff"/>
                    <circle cx="62" cy="15" r="3" fill="#ffffff"/>
                </svg>
            `;
        } else {
            // Streamlined Passenger Train Locomotive (Caltrain / Amtrak / DB ICE)
            svgContent = `
                <svg width="46" height="46" viewBox="0 0 100 100" style="filter: drop-shadow(0 6px 14px rgba(0,0,0,0.95));">
                    <!-- Locomotive Aerodynamic Body -->
                    <path d="M33 22 C33 13 42 10 50 10 C58 10 67 13 67 22 L67 78 C67 84 60 88 50 88 C40 88 33 84 33 78 Z" fill="#dc2626" stroke="#ffffff" stroke-width="2.5"/>
                    <!-- High-Speed Slanted Windshield -->
                    <path d="M38 24 C38 18 43 16 50 16 C57 16 62 18 62 24 L62 34 L38 34 Z" fill="#090d16"/>
                    <!-- Center Xenon Headlamp with Glow -->
                    <circle cx="50" cy="14" r="5" fill="#ffffff" stroke="#f5b722" stroke-width="1.5"/>
                    <circle cx="38" cy="20" r="3" fill="#fef08a"/>
                    <circle cx="62" cy="20" r="3" fill="#fef08a"/>
                    <!-- Dynamic Airflow Grooves -->
                    <line x1="42" y1="42" x2="42" y2="76" stroke="#991b1b" stroke-width="2"/>
                    <line x1="58" y1="42" x2="58" y2="76" stroke="#991b1b" stroke-width="2"/>
                    <!-- Red Marker Taillights -->
                    <circle cx="39" cy="84" r="2.5" fill="#f87171"/>
                    <circle cx="61" cy="84" r="2.5" fill="#f87171"/>
                </svg>
            `;
        }

        // On-Vehicle Callout Tag (Always Upright and legible)
        let infoTagHtml = '';
        if (info) {
            infoTagHtml = `
                <div class="vehicle-info-tag">
                    <div class="vehicle-tag-title">${info.title || 'TRANSIT'}</div>
                    <div class="vehicle-tag-sub">${info.dest || ''} <span class="vehicle-tag-speed">• ${info.speed || ''}</span></div>
                    <div class="vehicle-tag-pin"></div>
                </div>
            `;
        }

        const html = `
            <div class="vehicle-marker-wrapper">
                ${infoTagHtml}
                <div class="vehicle-icon-rotator" style="transform: rotate(${heading}deg);">
                    ${svgContent}
                </div>
            </div>
        `;

        return L.divIcon({
            html: html,
            className: 'live-transit-marker',
            iconSize: [44, 44],
            iconAnchor: [22, 22]
        });
    }

    interpolatePath(path, t, defaultHeading = 0) {
        if (!path || path.length === 0) return { pos: [37.3302, -121.9022], heading: defaultHeading };
        if (path.length === 1 || t <= 0) return { pos: path[0], heading: defaultHeading };
        if (t >= 1) return { pos: path[path.length - 1], heading: defaultHeading };

        const totalSegments = path.length - 1;
        const segmentProgress = t * totalSegments;
        const segIndex = Math.min(Math.floor(segmentProgress), totalSegments - 1);
        const subT = segmentProgress - segIndex;

        const p0 = path[segIndex];
        const p1 = path[segIndex + 1];

        if (p0[0] === p1[0] && p0[1] === p1[1]) {
            return { pos: p0, heading: defaultHeading };
        }

        const lat = p0[0] + (p1[0] - p0[0]) * subT;
        const lon = p0[1] + (p1[1] - p0[1]) * subT;

        // Calculate heading in degrees from p0 to p1
        const dLat = (p1[0] - p0[0]) * Math.PI / 180;
        const dLon = (p1[1] - p0[1]) * Math.PI / 180;
        const lat1 = p0[0] * Math.PI / 180;
        const lat2 = p1[0] * Math.PI / 180;

        const y = Math.sin(dLon) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
        let heading = Math.atan2(y, x) * 180 / Math.PI;
        heading = (heading + 360) % 360;

        return { pos: [lat, lon], heading: Math.round(heading) };
    }

    showEvent(rowItem, onComplete) {
        if (this.cleanupTimeout) {
            clearTimeout(this.cleanupTimeout);
            this.cleanupTimeout = null;
        }
        if (this.isAnimating) return;
        this.isAnimating = true;

        this.initMap();
        if (!this.map) {
            this.isAnimating = false;
            if (onComplete) onComplete();
            return;
        }

        const geo = rowItem.geo || {
            type: 'train',
            mode_type: rowItem.type || 'DEP',
            center: [37.3300, -121.9030],
            zoom: 17,
            path: [[37.3300, -121.9030], [37.3300, -121.9030]],
            start_heading: 328,
            end_heading: 328,
            speed_label: '0 mph • STANDBY',
            is_stationary: true,
            location_name: 'San Jose Transit Hub',
            track_name: rowItem.track || 'TRK 1',
            landmarks: []
        };

        // Populate HUD Telemetry
        const vehicleEmoji = {
            plane: '✈️',
            train: '🚆',
            light_rail: '🚈',
            bus: '🚍',
            bart: '🚇'
        }[geo.type] || '🚆';

        if (this.badgeEl) {
            this.badgeEl.innerHTML = `${vehicleEmoji} ${rowItem.service || 'TRANSIT'} • ${rowItem.track || 'ACTIVE'}`;
        }

        let cleanDest = (rowItem.destination || 'TRANSIT CORRIDOR').trim();
        if (cleanDest.toUpperCase().startsWith('FROM ')) {
            cleanDest = cleanDest.substring(5).trim();
        } else if (cleanDest.toUpperCase().startsWith('TO ')) {
            cleanDest = cleanDest.substring(3).trim();
        }

        if (this.destEl) {
            let action = rowItem.type === 'ARR' ? 'ARRIVING FROM' : 'SERVICE TO';
            if (geo.is_stationary) {
                action = (geo.type === 'plane') ? 'BOARDING FOR' : 'DEPARTURE TO';
            }
            this.destEl.textContent = `${action} ${cleanDest}`;
        }
        if (this.telemetryEl) {
            this.telemetryEl.textContent = `${geo.speed_label || 'ACTIVE'} • ${rowItem.status || 'LIVE'}`;
        }
        if (this.locationEl) {
            this.locationEl.textContent = geo.location_name || 'San Jose Transit Corridor';
        }
        if (this.progressFill) {
            this.progressFill.style.width = '0%';
        }

        // Show overlay
        this.overlay.classList.add('active');
        document.body.classList.add('map-active');

        // Ensure map renders all tiles across full viewport
        this.map.invalidateSize();
        setTimeout(() => { if (this.map) this.map.invalidateSize(); }, 60);
        setTimeout(() => { if (this.map) this.map.invalidateSize(); }, 250);

        // Frame focal view directly at high precision (starts zoomed in close, then smoothly zooms out)
        const center = geo.center || geo.path[0];
        const baseNominalZoom = geo.zoom || (geo.is_stationary ? 17.5 : 17.0);
        const startZoom = Math.min(18.2, baseNominalZoom + 1.0);
        const endZoom = Math.max(14.0, baseNominalZoom - 1.4);
        this.map.setView(center, startZoom, { animate: false });

        // Smoothly zoom out over 5.0 seconds using hardware-accelerated flyTo
        const targetCenter = geo.is_stationary ? center : (geo.center || center);
        setTimeout(() => {
            if (this.map && this.isAnimating) {
                this.map.flyTo(targetCenter, endZoom, {
                    duration: 5.0,
                    easeLinearity: 0.25
                });
            }
        }, 100);

        // Add prominent station, airport, and street landmark badges on the map (avoiding overlap with vehicle)
        this.clearLandmarks();
        if (geo.landmarks && Array.isArray(geo.landmarks)) {
            const vehiclePos = geo.path[0];
            geo.landmarks.forEach(lm => {
                // Filter out any landmark within 32 meters of vehicle position to prevent clutter/overlap
                const dLat = (lm.pos[0] - vehiclePos[0]) * 111139;
                const dLon = (lm.pos[1] - vehiclePos[1]) * 111139 * Math.cos(vehiclePos[0] * Math.PI / 180);
                if (Math.hypot(dLat, dLon) < 32) return;

                const icon = L.divIcon({
                    html: `<div class="map-landmark-badge ${lm.type || ''}">${lm.title}</div>`,
                    className: 'map-landmark-container',
                    iconAnchor: [0, 0]
                });
                const m = L.marker(lm.pos, { icon: icon, zIndexOffset: 400 }).addTo(this.map);
                this.landmarkMarkers.push(m);
            });
        }

        // Clear previous corridor and path lines
        if (this.corridorGlowLine && this.map) {
            this.map.removeLayer(this.corridorGlowLine);
            this.corridorGlowLine = null;
        }
        if (this.corridorCoreLine && this.map) {
            this.map.removeLayer(this.corridorCoreLine);
            this.corridorCoreLine = null;
        }
        if (this.currentPathLine && this.map) {
            this.map.removeLayer(this.currentPathLine);
            this.currentPathLine = null;
        }

        // Draw highlighted road or rail corridor that the vehicle came from / will travel on
        if (geo.corridor && Array.isArray(geo.corridor) && geo.corridor.length >= 2) {
            const isRail = geo.type === 'train' || geo.type === 'light_rail' || geo.type === 'bart';
            const corridorColor = isRail ? '#38bdf8' : (geo.type === 'plane' ? '#c084fc' : '#34d399');

            // Glowing outer road / rail corridor bedding
            this.corridorGlowLine = L.polyline(geo.corridor, {
                color: corridorColor,
                weight: isRail ? 8 : 10,
                opacity: 0.35,
                lineCap: 'round',
                lineJoin: 'round'
            }).addTo(this.map);

            // Core highlighted road / rail line
            this.corridorCoreLine = L.polyline(geo.corridor, {
                color: corridorColor,
                weight: 3.5,
                opacity: 0.9,
                dashArray: isRail ? '7, 7' : undefined,
                lineCap: 'round',
                lineJoin: 'round'
            }).addTo(this.map);
        }

        // If the vehicle is actively moving, draw active movement vector in vibrant golden amber
        const isMoving = !geo.is_stationary && geo.path && geo.path.length >= 2 &&
            (geo.path[0][0] !== geo.path[1][0] || geo.path[0][1] !== geo.path[1][1]);

        if (isMoving) {
            this.currentPathLine = L.polyline(geo.path, {
                color: '#f5b722',
                weight: 5,
                opacity: 0.95,
                dashArray: '6, 6',
                lineCap: 'round'
            }).addTo(this.map);
        }

        // Build on-vehicle information tag content
        let tagDest = (rowItem.type === 'ARR' ? 'FROM ' : 'TO ') + cleanDest;
        if (geo.is_stationary) {
            tagDest = (rowItem.status || 'BOARDING') + ' • ' + cleanDest;
        }
        const vehicleInfo = {
            title: `${vehicleEmoji} ${rowItem.service || ''} (${rowItem.track || 'LIVE'})`,
            dest: tagDest,
            speed: (geo.speed_label || 'ACTIVE').split('•')[0].trim()
        };

        // Add initial vehicle marker with floating callout badge directly on it
        const startPoint = geo.path[0];
        if (this.currentMarker) {
            this.map.removeLayer(this.currentMarker);
        }
        this.currentMarker = L.marker(startPoint, {
            icon: this.getVehicleMarkerIcon(geo.type, geo.start_heading || 0, vehicleInfo),
            zIndexOffset: 1500
        }).addTo(this.map);

        // Exact 5.5-second animation (smooth, deliberate, cinematic movement with zoom-out)
        const duration = 5500;
        const startTime = performance.now();
        let lastHeading = geo.start_heading || 0;

        const animateStep = (now) => {
            const elapsed = now - startTime;
            const progress = Math.min(1.0, elapsed / duration);

            // Update HUD progress bar
            if (this.progressFill) {
                this.progressFill.style.width = `${Math.round(progress * 100)}%`;
            }

            // Smooth linear motion along physical track/runway
            const interpolated = this.interpolatePath(geo.path, progress, geo.start_heading || 0);
            const currentPos = interpolated.pos;
            const currentHeading = interpolated.heading;

            if (this.currentMarker) {
                this.currentMarker.setLatLng(currentPos);
                if (Math.abs(currentHeading - lastHeading) > 0.5) {
                    this.currentMarker.setIcon(this.getVehicleMarkerIcon(geo.type, currentHeading, vehicleInfo));
                    lastHeading = currentHeading;
                }
            }

            if (progress < 1.0) {
                this.animationFrame = requestAnimationFrame(animateStep);
            } else {
                // 5.5 seconds reached -> return to board
                this.cleanup(onComplete);
            }
        };

        this.animationFrame = requestAnimationFrame(animateStep);
    }

    clearLandmarks() {
        if (this.landmarkMarkers && this.map) {
            this.landmarkMarkers.forEach(m => this.map.removeLayer(m));
        }
        this.landmarkMarkers = [];
    }

    cleanup(onComplete) {
        this.isAnimating = false;
        if (this.map) {
            this.map.stop();
        }
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }

        if (this.cleanupTimeout) {
            clearTimeout(this.cleanupTimeout);
            this.cleanupTimeout = null;
        }

        // Smooth fade out
        this.cleanupTimeout = setTimeout(() => {
            this.cleanupTimeout = null;
            if (this.overlay) {
                this.overlay.classList.remove('active');
            }
            document.body.classList.remove('map-active');

            if (this.currentMarker && this.map) {
                this.map.removeLayer(this.currentMarker);
                this.currentMarker = null;
            }
            if (this.currentPathLine && this.map) {
                this.map.removeLayer(this.currentPathLine);
                this.currentPathLine = null;
            }
            if (this.corridorGlowLine && this.map) {
                this.map.removeLayer(this.corridorGlowLine);
                this.corridorGlowLine = null;
            }
            if (this.corridorCoreLine && this.map) {
                this.map.removeLayer(this.corridorCoreLine);
                this.corridorCoreLine = null;
            }
            this.clearLandmarks();

            this.isAnimating = false;
            if (onComplete) {
                onComplete();
            }
        }, 300);
    }
}

window.LiveMapViewer = LiveMapViewer;
