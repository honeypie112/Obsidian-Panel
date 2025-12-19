const fs = require('fs');
const path = require('path');

// Mock service checks
const resolveJavaPath = (version) => {
    console.log(`[Test] Resolving for version: ${version} (${typeof version})`);

    // Copy-paste logic from minecraftService.js for testing isolation or import it
    // Let's try to mimic the exact logic we wrote
    const paths = {
        8: ['/usr/lib/jvm/java-1.8-openjdk/bin/java', '/usr/lib/jvm/java-8-openjdk/bin/java'],
        17: ['/usr/lib/jvm/java-17-openjdk/bin/java'],
        21: ['/usr/lib/jvm/java-21-openjdk/bin/java']
    };

    const v = parseInt(version);
    if (paths[v]) {
        for (const p of paths[v]) {
            if (fs.existsSync(p)) {
                console.log(`[Test] FOUND hardcoded: ${p}`);
                return p;
            } else {
                console.log(`[Test] MISSING hardcoded: ${p}`);
            }
        }
    }
    return 'java (fallback)';
};

console.log("--- Testing Java 17 Resolution ---");
const result17 = resolveJavaPath(17);
console.log(`Result: ${result17}`);

console.log("\n--- Testing Java 8 Resolution ---");
const result8 = resolveJavaPath(8);
console.log(`Result: ${result8}`);

console.log("\n--- Checking /usr/lib/jvm content ---");
try {
    const files = fs.readdirSync('/usr/lib/jvm');
    console.log(files);
} catch (e) { console.error(e.message); }
