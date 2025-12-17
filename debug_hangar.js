const https = require('https');

function get(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'ObsidianPanel/Test' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(`URL: ${url}`);
                console.log(`Status: ${res.statusCode}`);
                try {
                    const json = JSON.parse(data);
                    console.log(`Results: ${json.result ? json.result.length : 'undefined'}`);
                    if (json.result && json.result.length > 0) {
                        console.log(`First Result: ${json.result[0].name}`);
                    }
                } catch (e) {
                    console.log("Response is not JSON");
                }
            });
        }).on('error', reject);
    });
}

(async () => {
    // Test without order (known working)
    await get('https://hangar.papermc.io/api/v1/projects?q=ViaVersion&limit=5');

    // Test with &order=stars (used in service)
    await get('https://hangar.papermc.io/api/v1/projects?q=ViaVersion&limit=5&order=stars');

    // Test with &sort=-stars (common alternative)
    await get('https://hangar.papermc.io/api/v1/projects?q=ViaVersion&limit=5&sort=-stars');
})();
