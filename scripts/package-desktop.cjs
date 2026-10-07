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

function stopRunningDesktopApp() {
  if (process.platform !== 'win32') return;
  try {
    // Best-effort: a previous packaged executable can keep files in dist locked.
    spawnSync('taskkill.exe', ['/F', '/T', '/IM', 'InventoryPro HQ.exe'], {
      stdio: 'ignore',
      windowsHide: true,
      shell: false,
    });
  } catch (_) {}
}

function clearReadOnlyAttributes(target) {
  if (process.platform !== 'win32' || !fs.existsSync(target)) return;
  try {
    spawnSync('attrib.exe', ['-R', `${target}\\*`, '/S', '/D'], {
      stdio: 'ignore',
      windowsHide: true,
      shell: false,
    });
  } catch (_) {}
}

function removeDirectorySafe(target, label) {
  if (!fs.existsSync(target)) return true;
  let lastError = null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      clearReadOnlyAttributes(target);
      fs.rmSync(target, {
        recursive: true,
        force: true,
        maxRetries: 2,
        retryDelay: 250,
      });
      return true;
    } catch (error) {
      lastError = error;
      if (process.platform === 'win32') {
        try {
          clearReadOnlyAttributes(target);
          spawnSync('cmd.exe', ['/d', '/c', 'rmdir', '/s', '/q', target], {
            stdio: 'ignore',
            windowsHide: true,
            shell: false,
          });
          if (!fs.existsSync(target)) return true;
        } catch (_) {}
      }
      // Give Windows/Defender/electron-builder time to release transient file handles.
      if (attempt < 5) {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500 * (attempt + 1));
      }
    }
  }
  const code = lastError && lastError.code;
  const message = lastError && lastError.message ? lastError.message : String(lastError);
  throw new Error(`Unable to remove ${label || target} after multiple attempts (${code || 'unknown'}). ` +
    `Close any running "InventoryPro HQ" window and retry. Windows may also be holding the old package with Explorer/antivirus. ` +
    `Original error: ${message}`);
}


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
if (fs.existsSync(publicDest)) removeDirectorySafe(publicDest, 'standalone/public');
fs.cpSync(publicSource, publicDest, { recursive: true });
if (fs.existsSync(resources)) removeDirectorySafe(resources, 'desktop-resources');
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

// Do not let a previous running desktop app lock the package that electron-builder needs to replace.
stopRunningDesktopApp();
const releaseBuild = path.join(root, 'release-build');
if (fs.existsSync(releaseBuild)) removeDirectorySafe(releaseBuild, 'release-build');

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

// The destination may be locked by a previously launched copy of the application.
// Stop the app and retry removal before copying the new build.
stopRunningDesktopApp();
if (fs.existsSync(destination)) removeDirectorySafe(destination, 'dist/InventoryPro-HQ-Windows');
fs.cpSync(built, destination, { recursive: true });
fs.mkdirSync(path.join(destination, 'data'), { recursive: true });
console.log('\nDesktop app created at: ' + destination);
console.log('Copy the entire InventoryPro-HQ-Windows folder to a writable location and run "InventoryPro HQ.exe".');
