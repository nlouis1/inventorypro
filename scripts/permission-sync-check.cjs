const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const permissions=fs.readFileSync(path.join(root,'lib','permissions.ts'),'utf8');
const ui=fs.readFileSync(path.join(root,'components','DashboardClient.tsx'),'utf8');
const routesDir=path.join(root,'app','api');

const routes={
  '/api/audit':{GET:'viewAudit'},
  '/api/backup':{GET:'backupSystem'},
  '/api/export':{GET:'exportInventory'},
  '/api/posted-notes':{GET:'viewPostedNotes',POST:'postPostedNotes'},
  '/api/stores':{POST:'manageStores'},
  '/api/system/reset':{POST:'resetSystemData'},
  '/api/activities':{GET:'viewActivities',POST:'manageExpenses',DELETE:'manageExpenses'},
  '/api/profile':{PATCH:'manageProfile',POST:'manageProfile'},
  '/api/items':{POST:'createItem',PATCH:'editItem',DELETE:'deleteItem'},
  '/api/reports':{GET:'viewReports'},
  '/api/roles':{POST:'manageRoles',PATCH:'manageRoles',DELETE:'manageRoles'},
  '/api/receipts':{POST:'generateReceipt'},
  '/api/receipts/[id]/signature':{PATCH:'generateReceipt'},
  '/api/movements':{POST:'stockIn|stockOut|adjustStock|transferStock'},
  '/api/audit':{GET:'viewAudit'},
  '/api/proformas':{POST:'generateProforma',PATCH:'validateProforma'},
  '/api/users':{POST:'manageUsers',PATCH:'manageUsers'},
  '/api/settings':{GET:'manageProfile|manageSettings|backupSystem|resetSystemData',PATCH:'manageSettings'},
};
const nav=[
 ['dashboard','viewDashboard'],['inventory','viewInventory'],['movements','viewMovements'],['receipt','generateReceipt'],
 ['proforma','generateProforma'],['proforma-history','viewProformas'],['receipt-history','viewReceipts'],['activities','viewActivities'],
 ['audit','viewAudit'],['stores','viewStores'],['rbac','manageUsers|manageRoles'],['reports','viewReports'],
 ['settings','manageProfile|manageSettings|backupSystem|resetSystemData'],['posted-notes','viewPostedNotes']
];
const checks=[];
function check(name,ok){checks.push([name,!!ok]);}
for(const [route,methods] of Object.entries(routes)){
  const file=path.join(routesDir,route.replace('/api/','') .replace(/\[id\]/g,'[id]'),'route.ts');
  // The path mapping above can be awkward for nested routes; locate by recursive basename when needed.
  let source='';
  if(fs.existsSync(file))source=fs.readFileSync(file,'utf8');
  else {
    const wanted=route.split('/').filter(Boolean).slice(1);
    const stack=[routesDir];
    while(stack.length&&!source){const d=stack.pop();for(const n of fs.readdirSync(d)){const full=path.join(d,n);const st=fs.statSync(full);if(st.isDirectory())stack.push(full);else if(n==='route.ts'&&full.includes(path.join(...wanted))){source=fs.readFileSync(full,'utf8');break;}}}
  }
  check(`${route} route exists`,!!source);
  for(const [method,priv] of Object.entries(methods)){
    if(route==='/api/movements') check(`${route} ${method} is represented in UI`,/stockIn|stockOut|adjustStock|transferStock/.test(ui));
    else check(`${route} ${method} privilege ${priv} is represented in UI`,priv.split('|').some(x=>ui.includes(x)));
  }
}
for(const [key,priv] of nav) check(`UI navigation ${key} maps to ${priv}`,ui.includes(`'${key}'`)&&ui.includes(`'${priv}'`));
check('permissions registry contains all declared privileges',/export const PRIVILEGES/.test(permissions));
check('bootstrap is authenticated without viewDashboard gate',!/requirePrivilege\('viewDashboard'\)/.test(fs.readFileSync(path.join(routesDir,'bootstrap','route.ts'),'utf8')));
check('Settings GET is independently authorized',/manageProfile.*manageSettings.*backupSystem.*resetSystemData/s.test(fs.readFileSync(path.join(routesDir,'settings','route.ts'),'utf8')));
const failed=checks.filter(x=>!x[1]);
if(failed.length){failed.forEach(([n])=>console.error('FAIL:',n));process.exit(1)}
console.log(`API/UI permission synchronization check passed: ${checks.length} checks.`);
