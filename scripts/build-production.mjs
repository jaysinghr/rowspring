import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const addonDir = path.join(root, 'addon');
const productionDir = path.join(root, 'production');
const outputDir = path.join(productionDir, 'dist');

const applicationFiles = [
  'CalendarClient.js',
  'Code.js',
  'Core.generated.js',
  'Settings.js',
  'Sidebar.html',
  'Sync.js',
];

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

for (const file of applicationFiles) {
  fs.copyFileSync(path.join(addonDir, file), path.join(outputDir, file));
}

fs.copyFileSync(
  path.join(productionDir, 'appsscript.json'),
  path.join(outputDir, 'appsscript.json'),
);

console.log(`Production Apps Script bundle: ${path.relative(root, outputDir)}`);
