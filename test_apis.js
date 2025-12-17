const https = require('https');

function get(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'ObsidianPanel/Test' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    console.log(`\n--- Status Code: ${res.statusCode} ---`);
                    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                        console.log(`Redirect Location: ${res.headers.location}`);
                        resolve({ redirect: res.headers.location });
                    } else {
                        const json = JSON.parse(data);
                        resolve(json);
                    }
                } catch (e) {
                    console.log("Raw Data (Non-JSON):", data.substring(0, 200));
                    resolve(data);
                }
            });
        }).on('error', reject);
    });
}

async function testHangar() {
    console.log("\n=== Testing Hangar API (PaperMC) ===");
    try {
        console.log("Searching 'ViaVersion'...");
        const search = await get('https://hangar.papermc.io/api/v1/projects?q=ViaVersion&limit=1');
        const slug = search.result[0].namespace.slug;
        console.log("Slug Found:", slug);

        console.log("Fetching Versions...");
        const versions = await get(`https://hangar.papermc.io/api/v1/projects/${slug}/versions?limit=1`);
        const latest = versions.result[0];
        console.log("Latest Version:", latest.name);

        console.log("Download URL Construction:");
        // https://hangar.papermc.io/api/v1/projects/{slug}/versions/{name}/PAPER/download
        const downloadUrl = `https://hangar.papermc.io/api/v1/projects/${slug}/versions/${latest.name}/PAPER/download`;
        console.log(downloadUrl);
    } catch (e) {
        console.error("Hangar Error:", e.message);
    }
}

async function testSpiget() {
    console.log("\n=== Testing Spiget API (SpigotMC) ===");
    try {
        console.log("Searching 'ViaVersion'...");
        const search = await get('https://api.spiget.org/v2/search/resources/ViaVersion?size=1');
        const id = search[0].id;
        console.log("ID Found:", id);

        console.log("Testing Download Redirect...");
        const download = await get(`https://api.spiget.org/v2/resources/${id}/download`);
        // We expect a redirect or a binary stream (which will fail JSON parse above, handled in catch)
    } catch (e) {
        console.error("Spiget Error:", e.message);
    }
}

(async () => {
    await testHangar();
    await testSpiget();
})();
