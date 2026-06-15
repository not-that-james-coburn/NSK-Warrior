import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.join(__dirname, 'dist');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach(childItemName => {
      copyRecursiveSync(path.join(src, childItemName),
                        path.join(dest, childItemName));
    });
  } else if (exists) {
    fs.copyFileSync(src, dest);
  }
}

const filesToCopy = [
  ...fs.readdirSync(__dirname).filter(file => file.endsWith('.js') || file.endsWith('.html') || file.endsWith('.json') || file.endsWith('.ico')),
  'images',
  'booklet',
  'styles',
  'versions',
  'emulatorjs'
];

for (const file of filesToCopy) {
  const srcPath = path.join(__dirname, file);
  const destPath = path.join(distDir, file);

  if (file.startsWith('package') && file.endsWith('.json')) {
      continue;
  }

  if(file === 'tauri.conf.json'){
      continue;
  }

  if (fs.existsSync(srcPath)) {
    copyRecursiveSync(srcPath, destPath);
  }
}
