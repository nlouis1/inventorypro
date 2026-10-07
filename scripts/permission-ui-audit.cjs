const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const ui=fs.readFileSync(path.join(root,'components','DashboardClient.tsx'),'utf8');
const permissions=fs.readFileSync(path.join(root,'lib','permissions.ts'),'utf8');
const roles=fs.readFileSync(path.join(root,'app','api','roles','route.ts'),'utf8');
const settings=fs.readFileSync(path.join(root,'app','api','settings','route.ts'),'utf8');
const bootstrap=fs.readFileSync(path.join(root,'app','api','bootstrap','route.ts'),'utf8');
const checks=[];
const check=(name,ok)=>checks.push([name,!!ok]);

const privilegeNames=[...permissions.matchAll(/^\s*'([A-Za-z][A-Za-z0-9]+)',?$/gm)].map(m=>m[1]);
for(const p of privilegeNames){
  check(`Privilege ${p} is registered in UI permission checks`,ui.includes(`p('${p}')`)||ui.includes(`'${p}'`)||ui.includes(`"${p}"`));
}
check('Role POST rejects privileges the actor does not hold',/const elevated=PRIVILEGES\.find\(p=>permissions\[p\]===true&&!can\(user,p\)\)/.test(roles));
check('Role PATCH rejects privileges the actor does not hold',/const elevated=PRIVILEGES\.find\(p=>permissions\[p\]===true&&!can\(user,p\)\)/.test(roles));
check('Settings UI independently hides profile section',/const showProfile=p\('manageProfile'\)/.test(ui));
check('Settings UI independently hides system section',/const showSystemSettings=p\('manageSettings'\)/.test(ui));
check('Settings UI independently hides backup section',/const showBackup=p\('backupSystem'\)/.test(ui));
check('Settings UI independently hides reset section',/const showReset=p\('resetSystemData'\)/.test(ui));
check('Activity write panel is hidden without manageExpenses',/p\('manageExpenses'\)\?\'two\':\'one\'/.test(ui));
check('Posted-note write panel is hidden without postPostedNotes',/p\('postPostedNotes'\)\?\'two\':\'one\'/.test(ui));
check('Validated proforma receipt link requires viewReceipts',/p\.receiptId&&hasPrivilege\('viewReceipts'\)/.test(ui));
check('Proforma validation only opens receipt when viewReceipts is granted',/r\?\.receipt&&hasPrivilege\('viewReceipts'\)/.test(ui));
check('Generated receipt open link requires viewReceipts',/p\('viewReceipts'\)&&<a className=\"primary\" href=\{lastReceipt\}/.test(ui));
check('Settings PATCH requires manageSettings',/if\(!can\(user,'manageSettings'\)\)/.test(settings));
check('Bootstrap filters settings tax to operational users',/operationalTaxAllowed=/.test(bootstrap));
check('Dashboard route permits users with non-dashboard application privileges',!/if\(!can\(user,'viewDashboard'\)\)/.test(fs.readFileSync(path.join(root,'app','dashboard','page.tsx'),'utf8')));
check('Dashboard client resolves to the first allowed tab',/const firstAllowedTab=/.test(ui)&&/const effectiveTab=/.test(ui));
const failed=checks.filter(x=>!x[1]);
if(failed.length){for(const [name] of failed)console.error('FAIL:',name);process.exit(1)}
console.log(`Permission/UI audit passed: ${checks.length} checks.`);
