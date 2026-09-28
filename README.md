# Solari Split-Flap Board • Bay Area Transit & SJC Flight Hub

An authentic European train station split-flap (Solari di Udine style) display board, wired to live transit and aviation feeds:
- ✈️ **SJC Airport Flights**: Live aircraft tracked in the San Jose airspace using OpenSky Network ADS-B telemetry, mapped with real carrier flight codes, destinations, and gates.
- 🚆 **Caltrain**: Real-time scheduled electric train departures from San Jose Diridon towards San Francisco (Express, Limited, Local).
- 🚇 **BART**: Official live BART API feed showing train lines, destinations, platforms, and minutes away.
- 🚂 **Amtrak California**: Real-time Capitol Corridor & Coast Starlight trains at San Jose Diridon (`SJC`) via Amtraker API.
- 🚊 **VTA Light Rail**: Santa Clara County Blue, Green, and Orange lines serving Silicon Valley.

---

## Features
- **Authentic Split-Flap Mechanics**: Individual 3D character flaps with mechanical flap dividers, side hinge notches, realistic drum stepping, and cascading wave animations.
- **Procedural Mechanical Audio**: Web Audio synthesizer recreating the organic crisp plastic/metal "clack-clack-clack" sound of real Solari flaps without external audio files.
- **Auto-Cycling Mode**: Automatically cycles between the Unified Hub, SJC Flights, Caltrain, BART, Amtrak, and VTA every 25 seconds.
- **Kiosk & Screen Saver Ready**: Auto-hides mouse cursor and overlay controls after 3.5 seconds of inactivity. Press `F` for instant full screen.
- **Keyboard Shortcuts**:
  - `F`: Toggle Fullscreen
  - `M`: Toggle Sound Mute / Unmute
  - `Space`: Advance to next transit stream
  - `1-6`: Jump directly to a stream (1: Unified, 2: SJC, 3: Caltrain, 4: BART, 5: Amtrak, 6: VTA)

---

## Quick Start

### 1. Launch the Server
```bash
./run.sh
```
Or manually:
```bash
.venv/bin/python server.py
```
Open **[http://localhost:8080](http://localhost:8080)** in your browser.

---

## Running as a macOS Screen Saver

You can display this live board directly as your native Mac screensaver using **WebViewScreenSaver**:

1. **Install WebViewScreenSaver via Homebrew**:
   ```bash
   brew install --cask webviewscreensaver
   ```
2. Open macOS **System Settings** > **Screen Saver**.
3. Select **WebViewScreenSaver** and click **Options**.
4. Add the URL:
   ```
   http://localhost:8080
   ```
5. Whenever your Mac goes idle, your monitor will turn into a live European split-flap departures board!

---

## Running in Fullscreen / Kiosk Mode on a Dedicated Monitor

To launch Google Chrome directly in fullscreen kiosk mode (ideal for a secondary monitor or TV display):
```bash
open -a "Google Chrome" --args --kiosk --incognito http://localhost:8080
```
To exit kiosk mode, press `Command + W` or `Command + Q`.
