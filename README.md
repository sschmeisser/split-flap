# Solari Split-Flap Display Board

An authentic mechanical split-flap (Solari di Udine style) display board, featuring dual station hubs:
1. **🇺🇸 San Jose Regional Hub**: Live feeds for SJC Airport, Caltrain Diridon, BART Berryessa, Amtrak Diridon, ACE Train, and VTA Branham & Bus 64B.
2. **🇩🇪 Nürnberg Hauptbahnhof**: Authentic Deutsche Bahn timetable (ICE, IC, RE, RB, S-Bahn Nürnberg) with German CET/CEST clock and terminology.

---

## Key Features

- **Authentic Split-Flap Mechanics**: 12 rows × 52 columns matrix with 3D folding flaps, mechanical seam lines, side hinge notches, and staggered cascading animations.
- **Genuine Sampled Audio**: Authentic recordings of mechanical split-flap drums (`click.wav`, `td_clack.wav`, and `board_cascade.mp3`) with randomized pitch variation (`playbackRate = 0.93 - 1.07`).
- **Airport Chime & Female Voice Announcements**: When SJC flights enter "BOARDING" status, a soothing female voice announces *"Now boarding: [Airline] flight [Number] with service to [Destination], at Gate [Gate]"* preceded by an authentic 2-tone airport terminal chime (strictly limited to max twice per flight).
- **Dual Station Hub Toggle**:
  - Switch instantly between **San Jose Regional Hub** and **Nürnberg Hauptbahnhof** via header toggle or key `H`.
  - Automatically switches clock time zone (`America/Los_Angeles` vs `Europe/Berlin`).
- **San Jose Regional Hub Feeds**:
  - ✈️ **SJC Airport Flights**: Real-time ADS-B flight tracking with recognizable airline branding (`SW`, `FRONT`, `ALASKA`, `DELTA`, `AMER`, `UNITED`) and full gate numbers (`GT 21`, `GT 29`).
  - 🚆 **Caltrain**: San Jose Diridon departures and arrivals to/from San Francisco.
  - 🚇 **BART**: Live Berryessa / North San Jose departures and inbound arrivals.
  - 🚂 **Amtrak California**: Real-time Capitol Corridor & Coast Starlight at Diridon (filters past trains).
  - 🚆 **ACE Train**: Altamont Corridor Express trains at Diridon (`ACE 04`, `ACE 06`, `ACE 08`, `ACE 10`).
  - 🚊 **VTA Transit**: Branham Station Blue Line Light Rail and Bus 64B along Meridian Ave (`M-B&C`), consolidated to one row per bus.
- **Nürnberg Hauptbahnhof Feeds**:
  - 🚄 **Fernverkehr**: ICE 704 (Berlin), ICE 583 (München), ICE 528 (Frankfurt), ICE 28 (Wien), ICE 886 (Hamburg), RJX 67 (Budapest).
  - 🚆 **Regionalverkehr**: RE 19 (Sonneberg), RE 40 (Schwandorf), RE 58 (Würzburg), RE 30 (Bayreuth/Hof).
  - 🚊 **S-Bahn Nürnberg**: S1 (Bamberg), S2 (Roth), S3 (Neumarkt), S4 (Dombühl).
- **Kiosk & Screen Saver Ready**: Auto-hides mouse cursor and overlay controls after 4 seconds of inactivity.

---

## Keyboard Shortcuts

- `H`: Toggle between San Jose Hub and Nürnberg Hauptbahnhof
- `F`: Toggle Fullscreen
- `M`: Toggle Mechanical Sound On/Off
- `V`: Toggle Flight Voice Announcements On/Off
- `T`: Test Mechanical Flap Clack
- `1-7`: Switch individual transit modes

---

## Quick Start

### 1. Launch the Server
```bash
./run.sh
```
Or with Python:
```bash
.venv/bin/python server.py
```
Open **[http://localhost:8080](http://localhost:8080)** in your browser.

---

## Running as a macOS Screen Saver

Display this live board as your native Mac screensaver using **WebViewScreenSaver**:

1. **Install WebViewScreenSaver via Homebrew**:
   ```bash
   brew install --cask webviewscreensaver
   ```
2. Open macOS **System Settings** > **Screen Saver**.
3. Select **WebViewScreenSaver** and click **Options**.
4. Add the URL: `http://localhost:8080`
