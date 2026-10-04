const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const standalone = path.join(root, '.next', 'standalone');
const staticSource = path.join(root, '.next', 'static');
const publicSource = path.join(root, 'public');
const staticDest = path.join(standalone, '.next', 'static');
const publicDest = path.join(standalone, 'public');
const resources = path.join(root, 'desktop-resources');

if (process.platform !== 'win32') {
  console.error('Build the Windows desktop package on Windows so the matching Node.js runtime can be bundled.');
  process.exit(1);
}
if (process.arch !== 'x64') {
  console.error(`Windows desktop packaging requires x64 Node.js; current architecture is ${process.arch}.`);
  process.exit(1);
}
if (!fs.existsSync(path.join(standalone, 'server.js'))) {
  console.error('Missing .next/standalone/server.js. Run npm run build first.');
  process.exit(1);
}
fs.mkdirSync(staticDest, { recursive: true });
fs.cpSync(staticSource, staticDest, { recursive: true });
if (fs.existsSync(publicDest)) fs.rmSync(publicDest, { recursive: true, force: true });
fs.cpSync(publicSource, publicDest, { recursive: true });
fs.rmSync(resources, { recursive: true, force: true });
fs.mkdirSync(resources, { recursive: true });
fs.cpSync(standalone, path.join(resources, 'app-server'), { recursive: true });
fs.copyFileSync(path.join(root, 'data', 'db.json'), path.join(resources, 'default-db.json'));
// Electron no longer reliably supports ELECTRON_RUN_AS_NODE in packaged builds.
// Bundle the Node executable used to run this script instead.
if (!fs.existsSync(process.execPath)) {
  console.error(`Node.js runtime not found at ${process.execPath}`);
  process.exit(1);
}
fs.copyFileSync(process.execPath, path.join(resources, 'app-node.exe'));

const npm = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(npm, ['electron-builder', '--win', 'dir', '--x64', '--publish', 'never'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (result.status !== 0) process.exit(result.status || 1);

const built = path.join(root, 'release-build', 'win-unpacked');
const destination = path.join(root, 'dist', 'InventoryPro-HQ-Windows');
if (!fs.existsSync(path.join(built, 'InventoryPro HQ.exe'))) {
  console.error(`Packaged executable not found in ${built}`);
  process.exit(1);
}
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.rmSync(destination, { recursive: true, force: true });
fs.cpSync(built, destination, { recursive: true });
fs.mkdirSync(path.join(destination, 'data'), { recursive: true });
console.log('\nDesktop app created at: ' + destination);
console.log('Copy the entire InventoryPro-HQ-Windows folder to a writable location and run "InventoryPro HQ.exe".');
