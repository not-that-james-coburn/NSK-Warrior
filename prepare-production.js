import fs from 'fs';

let content = fs.readFileSync('version-manager.js', 'utf8');

// 1. Set versionInfo to true for og, v1.1, kf
const targetVersions = ['og', 'v1.1', 'kf'];
for (const v of targetVersions) {
  const regex = new RegExp(`('${v.replace('.', '\\.')}':\\s*\\{[\\s\\S]*?versionInfo:\\s*)false`, 'g');
  content = content.replace(regex, '$1true');
}

// 2. Comment out the "tp" block
const lines = content.split('\n');
let inTpBlock = false;
let bracketDepth = 0;

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  if (line.match(/^\s*'tp':\s*\{/)) {
    inTpBlock = true;
  }

  if (inTpBlock) {
    // Count brackets to know when block ends
    const openCount = (line.match(/\{/g) || []).length;
    const closeCount = (line.match(/\}/g) || []).length;
    bracketDepth += openCount - closeCount;

    // Add comment
    if (!line.trim().startsWith('//')) {
      lines[i] = '// ' + line;
    }

    // If we reach end of block (and the optional comma after it)
    if (bracketDepth === 0 && closeCount > 0) {
      inTpBlock = false;
    }
  }
}

fs.writeFileSync('version-manager.js', lines.join('\n'));
console.log('Successfully prepared version-manager.js for production.');