const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const permissions=fs.readFileSync(path.join(root,'lib','permissions.ts'),'utf8');
const settings=fs.readFileSync(path.join(root,'app','api','settings','route.ts'),'utf8');
const ui=fs.readFileSync(path.join(root,'components','DashboardClient.tsx'),'utf8');
const bootstrap=fs.readFileSync(path.join(root,'app','api','bootstrap','route.ts'),'utf8');
const checks=[
 ['four independent Settings privileges exist',/manageProfile.*manageSettings.*backupSystem.*resetSystemData/s.test(permissions)],
 ['settings GET accepts any Settings privilege',/const hasSettingsAccess=canProfile\|\|canManage\|\|canBackup\|\|canReset/.test(settings)],
 ['settings PATCH requires manageSettings',/if\(!can\(user,'manageSettings'\)\)/.test(settings)],
 ['profile section requires manageProfile',/const showProfile=p\('manageProfile'\)/.test(ui)],
 ['system section requires manageSettings',/const showSystemSettings=p\('manageSettings'\)/.test(ui)],
 ['backup section requires backupSystem',/const showBackup=p\('backupSystem'\)/.test(ui)],
 ['reset section requires resetSystemData',/const showReset=p\('resetSystemData'\)/.test(ui)],
 ['Settings navigation accepts independent privileges',/\['settings','Settings',Settings,'manageProfile\|manageSettings\|backupSystem\|resetSystemData'\]/.test(ui)],
 ['Settings panel accepts independent privileges',/const hasAnySettings=showProfile\|\|showSystemSettings\|\|showBackup\|\|showReset/.test(ui)],
 ['system tax is not returned as a Settings payload to non-managers',/settingsManageAllowed=can\(user,'manageSettings'\)/.test(bootstrap) && /settings:\{/.test(bootstrap)],
 ['settings refresh preserves restricted tax',/next\.canManage===true \|\| next\.sections\?\.system===true/.test(ui)],
 ['Settings navigation uses visibility rather than disabled controls',/manageProfile\|manageSettings\|backupSystem\|resetSystemData/.test(ui)],
 ['Settings API returns per-section flags',/sections:\{profile:canProfile,system:canManage,backup:canBackup,reset:canReset\}/.test(settings)],
 ['viewSettings is no longer a Settings privilege', !/viewSettings/.test(permissions)],
];
const failed=checks.filter(([,ok])=>!ok);
if(failed.length){for(const [name] of failed)console.error('FAIL:',name);process.exit(1)}
console.log(`Settings privilege check passed: ${checks.length} checks.`);
