/**
 * Live Transit Map Viewer
 * Renders high-contrast dark cartography and animates 5-second realistic vehicle movements
 * (Planes taking off/touching down, trains rolling into platforms, buses pulling into stops, etc.)
 */

class LiveMapViewer {
    constructor() {
        this.overlay = document.getElementById('liveMapOverlay');
        this.mapContainer = document.getElementById('liveMap');
        this.map = null;
        this.currentMarker = null;
        this.currentPathLine = null;
        this.animationFrame = null;
        this.isAnimating = false;
        this.tileLayer = null;

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

        // Initialize Leaflet map with dark theme
        this.map = L.map('liveMap', {
            zoomControl: false,
            attributionControl: false,
            fadeAnimation: true,
            zoomAnimation: true
        }).setView([37.3639, -121.9289], 15);

        // Dark Transit Cartography (Esri World Dark Gray Canvas - crisp, authentic dark aesthetic, zero API key)
        this.tileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 16,
            opacity: 0.95
        }).addTo(this.map);
    }

    getVehicleSVG(type, heading = 0) {
        let svgContent = '';

        if (type === 'plane') {
            // Swept-wing commercial jetliner with illuminated wingtips
            svgContent = `
                <svg width="44" height="44" viewBox="0 0 100 100" style="transform: rotate(${heading}deg); transform-origin: 50% 50%; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.8));">
                    <circle cx="50" cy="50" r="46" fill="rgba(245, 183, 34, 0.15)" stroke="#f5b722" stroke-width="2" stroke-dasharray="4,4"/>
                    <!-- Fuselage -->
                    <path d="M50 12 C47 18 45 35 45 55 L45 78 C45 82 48 85 50 85 C52 85 55 82 55 78 L55 55 C55 35 53 18 50 12 Z" fill="#ffffff"/>
                    <!-- Main Wings -->
                    <path d="M50 38 L14 62 C11 64 12 67 15 67 L45 58 L45 42 Z" fill="#ffd166"/>
                    <path d="M50 38 L86 62 C89 64 88 67 85 67 L55 58 L55 42 Z" fill="#ffd166"/>
                    <!-- Tail Horizontal Stabilizers -->
                    <path d="M50 75 L32 86 C30 87 31 89 33 89 L46 82 Z" fill="#f5b722"/>
                    <path d="M50 75 L68 86 C70 87 69 89 67 89 L54 82 Z" fill="#f5b722"/>
                    <!-- Navigation Lights -->
                    <circle cx="14" cy="64" r="3" fill="#ff4d4f"/>
                    <circle cx="86" cy="64" r="3" fill="#52c41a"/>
                    <circle cx="50" cy="14" r="2.5" fill="#00f5d4"/>
                </svg>
            `;
        } else if (type === 'bus') {
            // City transit bus with headlights
            svgContent = `
                <svg width="42" height="42" viewBox="0 0 100 100" style="transform: rotate(${heading}deg); transform-origin: 50% 50%; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.8));">
                    <rect x="30" y="16" width="40" height="68" rx="10" fill="#2ecc71" stroke="#ffffff" stroke-width="3"/>
                    <rect x="34" y="24" width="32" height="14" rx="3" fill="#14151a"/>
                    <!-- Side windows -->
                    <rect x="33" y="44" width="6" height="24" rx="2" fill="#14151a"/>
                    <rect x="61" y="44" width="6" height="24" rx="2" fill="#14151a"/>
                    <!-- Roof beacon -->
                    <circle cx="50" cy="50" r="5" fill="#f5b722"/>
                    <!-- Headlamps -->
                    <circle cx="36" cy="18" r="3.5" fill="#fffbe6"/>
                    <circle cx="64" cy="18" r="3.5" fill="#fffbe6"/>
                </svg>
            `;
        } else if (type === 'light_rail') {
            // Electric light rail LRV
            svgContent = `
                <svg width="44" height="44" viewBox="0 0 100 100" style="transform: rotate(${heading}deg); transform-origin: 50% 50%; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.8));">
                    <rect x="32" y="14" width="36" height="72" rx="8" fill="#3498db" stroke="#ffffff" stroke-width="3"/>
                    <rect x="36" y="20" width="28" height="12" rx="3" fill="#0b1726"/>
                    <rect x="36" y="38" width="28" height="12" rx="2" fill="#0b1726"/>
                    <rect x="36" y="56" width="28" height="12" rx="2" fill="#0b1726"/>
                    <!-- Pantograph diamond -->
                    <path d="M50 44 L44 50 L50 56 L56 50 Z" fill="none" stroke="#f5b722" stroke-width="2"/>
                    <circle cx="38" cy="16" r="3" fill="#ffe58f"/>
                    <circle cx="62" cy="16" r="3" fill="#ffe58f"/>
                </svg>
            `;
        } else {
            // Streamlined Passenger Train Locomotive
            svgContent = `
                <svg width="44" height="44" viewBox="0 0 100 100" style="transform: rotate(${heading}deg); transform-origin: 50% 50%; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.8));">
                    <circle cx="50" cy="50" r="44" fill="rgba(231, 76, 60, 0.12)" stroke="#e74c3c" stroke-width="1.5" stroke-dasharray="3,3"/>
                    <!-- Locomotive body -->
                    <path d="M34 26 C34 18 42 14 50 14 C58 14 66 18 66 26 L66 76 C66 82 60 86 50 86 C40 86 34 82 34 76 Z" fill="#e74c3c" stroke="#ffffff" stroke-width="2.5"/>
                    <!-- Windshield -->
                    <path d="M38 28 C38 22 43 20 50 20 C57 20 62 22 62 28 L62 36 L38 36 Z" fill="#17181c"/>
                    <!-- High-intensity Center Headlamp -->
                    <circle cx="50" cy="18" r="4" fill="#ffffff"/>
                    <circle cx="38" cy="24" r="2.5" fill="#ffe58f"/>
                    <circle cx="62" cy="24" r="2.5" fill="#ffe58f"/>
                    <!-- Red markers rear -->
                    <circle cx="40" cy="82" r="2" fill="#ff4d4f"/>
                    <circle cx="60" cy="82" r="2" fill="#ff4d4f"/>
                </svg>
            `;
        }

        return L.divIcon({
            html: svgContent,
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
            center: [37.3302, -121.9022],
            zoom: 16,
            path: [[37.3302, -121.9022], [37.3400, -121.9120]],
            start_heading: 325,
            end_heading: 325,
            speed_label: '35 mph • ACTIVE',
            location_name: 'San Jose Transit Hub',
            track_name: rowItem.track || 'TRK 1'
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
        if (this.destEl) {
            let destStr = (rowItem.destination || 'TRANSIT CORRIDOR').trim();
            if (rowItem.type === 'ARR') {
                if (destStr.toUpperCase().startsWith('FROM ')) {
                    destStr = destStr.substring(5).trim();
                }
                this.destEl.textContent = `ARRIVING FROM ${destStr}`;
            } else {
                if (destStr.toUpperCase().startsWith('TO ')) {
                    destStr = destStr.substring(3).trim();
                }
                this.destEl.textContent = `SERVICE TO ${destStr}`;
            }
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

        // Set map view directly to focus area
        const center = geo.center || geo.path[0];
        this.map.setView(center, geo.zoom || 16, { animate: false });

        // Draw glowing transit route polyline
        if (this.currentPathLine) {
            this.map.removeLayer(this.currentPathLine);
        }
        this.currentPathLine = L.polyline(geo.path, {
            color: '#f5b722',
            weight: 4,
            opacity: 0.75,
            dashArray: '8, 8',
            lineCap: 'round'
        }).addTo(this.map);

        // Add initial marker
        const startPoint = geo.path[0];
        if (this.currentMarker) {
            this.map.removeLayer(this.currentMarker);
        }
        this.currentMarker = L.marker(startPoint, {
            icon: this.getVehicleSVG(geo.type, geo.start_heading || 0),
            zIndexOffset: 1000
        }).addTo(this.map);

        const duration = 5000; // 5.0 seconds
        const startTime = performance.now();

        const animateStep = (now) => {
            const elapsed = now - startTime;
            const progress = Math.min(1.0, elapsed / duration);

            // Update Progress Bar
            if (this.progressFill) {
                this.progressFill.style.width = `${Math.round(progress * 100)}%`;
            }

            // EaseInOut motion
            const tEased = progress < 0.5 
                ? 2 * progress * progress 
                : -1 + (4 - 2 * progress) * progress;

            const interpolated = this.interpolatePath(geo.path, tEased, geo.start_heading || 0);
            const currentPos = interpolated.pos;
            const currentHeading = interpolated.heading;

            if (this.currentMarker) {
                this.currentMarker.setLatLng(currentPos);
                this.currentMarker.setIcon(this.getVehicleSVG(geo.type, currentHeading));
            }

            // Smoothly pan map alongside if distance is substantial
            if (progress > 0.05 && progress < 0.95 && progress % 0.15 < 0.03) {
                this.map.panTo(currentPos, { animate: true, duration: 0.4 });
            }

            if (progress < 1.0) {
                this.animationFrame = requestAnimationFrame(animateStep);
            } else {
                // Finished 5 seconds
                this.cleanup(onComplete);
            }
        };

        this.animationFrame = requestAnimationFrame(animateStep);
    }

    cleanup(onComplete) {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }

        // Wait brief pause for smooth fade
        setTimeout(() => {
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

            this.isAnimating = false;
            if (onComplete) {
                onComplete();
            }
        }, 300);
    }
}

window.LiveMapViewer = LiveMapViewer;
