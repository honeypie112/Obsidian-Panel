const https = require('https');

function get(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'ObsidianPanel/Test' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json);
                } catch (e) {
                    resolve(data);
                }
            });
        }).on('error', reject);
    });
}

(async () => {
    console.log("Fetching versions for 'ViaVersion'...");
    // Endpoint used in code: /projects/{slug}/versions
    const response = await get('https://hangar.papermc.io/api/v1/projects/ViaVersion/versions?limit=1');

    // Hangar returns { pagination: ..., result: [...] }
    const version = response.result ? response.result[0] : null;

    if (version) {
        console.log("\n=== Version Object Structure ===");
        console.log("Name:", version.name);
        console.log("Platform Dependencies:", JSON.stringify(version.platformDependencies, null, 2));
        console.log("Downloads Object:", JSON.stringify(version.downloads, null, 2));

        // Check if our logic holds:
        // const deps = v.platformDependencies['PAPER'] || [];
        // downloadUrl = .../projects/{slug}/versions/{name}/PAPER/download
    } else {
        console.log("No versions found or invalid structure:", JSON.stringify(response, null, 2));
    }
})();
