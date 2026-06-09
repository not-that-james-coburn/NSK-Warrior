import { access, mkdir } from 'node:fs/promises';
import { constants } from 'node:fs';

const requiredFiles = [
  'index.html',
  'manifest.json',
  'service-worker.js',
  'native-web/index.html',
  'netlify/edge-functions/serve-game.js'
];

await mkdir('native-web', { recursive: true });

const missing = [];
for (const file of requiredFiles) {
  try {
    await access(file, constants.R_OK);
  } catch {
    missing.push(file);
  }
}

if (missing.length > 0) {
  console.error(`Missing files required for native packaging:\n${missing.map(file => `- ${file}`).join('\n')}`);
  process.exit(1);
}

console.log('Native web shell is ready. Capacitor will load the hosted Netlify PWA via server.url.');
