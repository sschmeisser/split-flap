const puppeteer = require('puppeteer-stream');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = '/Users/stefanschmeisser/.gemini/antigravity/brain/e27eb22b-160f-4ec7-bab6-02d89c04a27a';

async function verifyVisualQA() {
    console.log('[QA] Launching Chrome for Visual QA of map views...');

    const browser = await puppeteer.launch({
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--window-size=1920,1080',
            '--disable-web-security'
        ],
        defaultViewport: {
            width: 1920,
            height: 1080
        }
    });

    const page = await browser.newPage();
    page.on('console', msg => console.log('[BROWSER]', msg.text()));
    page.on('pageerror', err => console.error('[BROWSER ERROR]', err));

    await page.goto('http://localhost:8080/', { waitUntil: 'domcontentloaded' });

    console.log('[QA] Page DOM loaded. Waiting for Solari board data...');
    await page.waitForFunction(() => window.solariApp && window.solariApp.lastLoadedRows && window.solariApp.lastLoadedRows.length > 0, { timeout: 10000 });

    // Helper to run a test on liveMapViewer with pip-mode
    async function testVehicle(finderFn, name) {
        console.log(`[QA] Testing ${name}...`);
        const itemTitle = await page.evaluate((fnStr) => {
            window.solariApp.cancelMapTransition();
            const rows = window.solariApp.lastLoadedRows || [];
            const finder = new Function('rows', fnStr);
            const found = finder(rows);

            if (found) {
                const housing = document.getElementById('stationHousing');
                if (housing) housing.classList.add('pip-mode');
                window.liveMapViewer.showEvent(found, () => {
                    console.log(`[Browser] Finished ${found.service}`);
                });
                return `${found.service} (${found.destination})`;
            }
            return null;
        }, finderFn);

        console.log(`[QA] Row selected for ${name}: ${itemTitle}`);
        // 1. Zoomed in close-up at 1.8s (after tiles load & stabilize)
        await new Promise(r => setTimeout(r, 1800));
        await page.screenshot({ path: path.join(ARTIFACT_DIR, `qa_${name}_zoomed_in.png`) });

        // 2. Zoomed out corridor at 4.2s (total 4.2s elapsed, smoothly zoomed out)
        await new Promise(r => setTimeout(r, 2400));
        await page.screenshot({ path: path.join(ARTIFACT_DIR, `qa_${name}_zoomed_out.png`) });

        // Cleanup before next vehicle test
        await page.evaluate(() => {
            window.liveMapViewer.cleanup();
            const housing = document.getElementById('stationHousing');
            if (housing) housing.classList.remove('pip-mode');
        });
        await new Promise(r => setTimeout(r, 600));
    }

    // 1. Test VTA Bus on Meridian Ave
    await testVehicle(`
        return rows.find(r => r.service && r.service.includes('64B')) ||
               rows.find(r => r.geo && r.geo.type === 'bus');
    `, 'bus_meridian');

    // 2. Test Caltrain Locomotive on Peninsula Corridor
    await testVehicle(`
        return rows.find(r => r.service && r.service.includes('CAL')) ||
               rows.find(r => r.geo && r.geo.type === 'train');
    `, 'caltrain');

    // 3. Test BART Elevated Viaduct
    await testVehicle(`
        return rows.find(r => r.service && r.service.includes('BART')) ||
               rows.find(r => r.geo && r.geo.type === 'bart');
    `, 'bart');

    // 4. Test Flight Parked at Gate (Stationary)
    await testVehicle(`
        return rows.find(r => r.geo && r.geo.type === 'plane' && r.geo.is_stationary) ||
               rows.find(r => r.geo && r.geo.type === 'plane');
    `, 'flight_gate');
    await page.evaluate(() => {
        // Trigger row index 1 via app controller
        const row = window.solariApp.lastLoadedRows[1];
        window.solariApp.triggerArrivalDepartureAnimation(1, row);
    });

    // Wait 1.5s (during initial 2.5s highlight before board glides)
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'qa_flow_step1_initial_highlight.png') });

    // Wait 3s (board is in pip-mode, map is active)
    await new Promise(r => setTimeout(r, 3000));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'qa_flow_step2_pip_and_map.png') });

    // Wait 4.5s (map finishes 5.5s, board glides back to full screen, row is STILL highlighted for 5s)
    await new Promise(r => setTimeout(r, 4500));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'qa_flow_step3_board_restored_highlight_retained.png') });

    // Wait 5.5s (row highlight expires after 5s)
    await new Promise(r => setTimeout(r, 5500));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'qa_flow_step4_highlight_cleared.png') });

    console.log('[QA] Visual QA screenshots successfully captured!');
    await browser.close();
}

verifyVisualQA().catch(err => {
    console.error('[QA] Error:', err);
    process.exit(1);
});
