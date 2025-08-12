const fs = require('fs');
const path = require('path');

const versionPath = path.join(__dirname, 'public', 'version.json');

// Read current version file
let versionData;
try {
  versionData = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
} catch (error) {
  versionData = {
    version: 'v0.1.0',
    commit: 'initial'
  };
}

// Update with current timestamp
versionData.buildDate = new Date().toISOString();

// Try to get git commit hash if available
try {
  const { execSync } = require('child_process');
  const commit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  versionData.commit = commit;
} catch (error) {
  // Fallback if git is not available
  versionData.commit = Math.random().toString(36).substr(2, 7);
}

// Write updated version file
fs.writeFileSync(versionPath, JSON.stringify(versionData, null, 2));

console.log('Version file updated:', versionData);
