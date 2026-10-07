const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const items = fs.readFileSync(path.join(root, 'app', 'api', 'items', 'route.ts'), 'utf8');
const reports = fs.readFileSync(path.join(root, 'app', 'api', 'reports', 'route.ts'), 'utf8');

const checks = [
  ['item creation inserts a transaction for opening quantity', /if\(item\.quantity>0\)[\s\S]*db\.transactions\.unshift\(\{[\s\S]*type:'IN'[\s\S]*qty:item\.quantity/.test(items)],
  ['opening transaction uses the new SKU id', /db\.transactions\.unshift\(\{[\s\S]*itemId:item\.id/.test(items)],
  ['opening transaction uses the SKU creation timestamp', /timestamp:openingAt/.test(items)],
  ['opening transaction stores buy price', /buyPrice:item\.buyPrice/.test(items)],
  ['opening transaction stores a traceable reference', /reference:'OPENING-STOCK'/.test(items)],
  ['date-filtered reports include transaction history for all item ids', /const reportItemIds=new Set\(db\.items\.map\(i=>i\.id\)\);const movements=db\.transactions\.filter\(t=>reportItemIds\.has\(t\.itemId\)/.test(reports)],
  ['movement rows can resolve disabled item history', /const itemById=\(id:string\)=>db\.items\.find\(i=>i\.id===id\)/.test(reports)],
];
const failed = checks.filter(([,ok]) => !ok);
if (failed.length) { failed.forEach(([name]) => console.error('FAIL:', name)); process.exit(1); }
console.log(`Opening-stock/report check passed: ${checks.length} checks.`);
