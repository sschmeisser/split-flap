const { launch, getStream, wss } = require("puppeteer-stream");
const { spawn } = require("child_process");
const path = require("path");

const DURATION_SECONDS = 180; // 3 minutes
const OUTPUT_FILE = path.join(__dirname, "split_flap_board_3min.mp4");

async function record() {
    console.log(`[Recorder] Initializing 3-minute full screen recording (${DURATION_SECONDS}s)...`);

    const browser = await launch({
        executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        headless: false,
        args: [
            "--autoplay-policy=no-user-gesture-required",
            "--window-size=2560,1080",
            "--start-fullscreen",
            "--no-first-run",
            "--disable-default-apps"
        ],
        defaultViewport: {
            width: 2560,
            height: 1080
        }
    });

    const page = await browser.newPage();
    await page.goto("http://localhost:8080", { waitUntil: "networkidle0" });

    // 1. Prepare clean fullscreen presentation (hide cursor & controls, unlock audio)
    await page.evaluate(() => {
        document.body.classList.add('idle');
        document.body.style.cursor = 'none';
        
        // Ensure Web Audio context is unblocked and ready
        if (window.solariAudio) {
            window.solariAudio.init();
            window.solariAudio.setVolume(1.0);
            window.solariAudio.setMuted(false);
        }
        
        // Hide unlock banner if present
        const banner = document.getElementById('audioUnlockPrompt');
        if (banner) banner.style.display = 'none';
    });

    // Small delay to let initial layout settle
    await new Promise((r) => setTimeout(r, 1000));

    console.log("[Recorder] Starting capture stream (Audio + Video)...");
    const stream = await getStream(page, { 
        audio: true, 
        video: true,
        frameSize: 20
    });

    // Spawn FFmpeg to encode to high-quality H.264 + AAC MP4
    const ffmpegArgs = [
        "-y",
        "-i", "-",
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "18",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "256k",
        "-ar", "48000",
        "-movflags", "+faststart",
        "-t", String(DURATION_SECONDS),
        OUTPUT_FILE
    ];

    console.log(`[Recorder] Encoding directly to ${OUTPUT_FILE}...`);
    const ffmpeg = spawn("/opt/homebrew/bin/ffmpeg", ffmpegArgs);

    stream.pipe(ffmpeg.stdin);

    ffmpeg.stderr.on("data", (data) => {
        const msg = data.toString();
        const timeMatch = msg.match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/);
        if (timeMatch) {
            process.stdout.write(`\r[Recorder Progress] Recorded: ${timeMatch[1]} / 00:03:00`);
        }
    });

    ffmpeg.on("close", (code) => {
        console.log(`\n[Recorder] FFmpeg exited with code ${code}.`);
    });

    // Trigger board updates every 18 seconds to showcase active split-flap action
    const updateInterval = setInterval(async () => {
        try {
            await page.evaluate(() => {
                if (window.solariApp) {
                    window.solariApp.loadDepartures();
                }
            });
        } catch (e) {}
    }, 18000);

    // Wait for the full 3 minutes
    await new Promise((resolve) => setTimeout(resolve, (DURATION_SECONDS + 2) * 1000));

    clearInterval(updateInterval);
    console.log("\n[Recorder] 3 minutes reached. Finalizing recording...");

    try {
        await stream.destroy();
    } catch (e) {}

    await new Promise((r) => setTimeout(r, 1500));
    await browser.close();
    
    const server = await wss;
    if (server && server.close) server.close();

    const fs = require("fs");
    const publicCopy = path.join(__dirname, "public", "split_flap_board_3min.mp4");
    try {
        fs.copyFileSync(OUTPUT_FILE, publicCopy);
    } catch (e) {}

    console.log(`[Recorder] Success! Saved to: ${OUTPUT_FILE}`);
    console.log(`[Recorder] Web preview available at: http://localhost:8080/split_flap_board_3min.mp4`);
    process.exit(0);
}

record().catch((err) => {
    console.error("[Recorder Error]:", err);
    process.exit(1);
});
