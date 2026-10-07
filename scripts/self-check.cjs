const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const dbPath = path.join(root, 'data', 'db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

const requiredArrays = ['proformas','stores','categories','items','users','transactions','receipts','auditLogs','activities','postedNotes','sessions'];
for (const key of requiredArrays) {
  if (!Array.isArray(db[key])) throw new Error(`Database field ${key} must be an array.`);
}
if (!db.roles || typeof db.roles !== 'object' || Array.isArray(db.roles) || !db.roles.Admin) throw new Error('Database must contain the Admin role.');
if (!Array.isArray(db.users) || db.users.length === 0) throw new Error('Database must contain at least one administrator account.');
const admin = db.users.find((u) => u.role === 'Admin' && u.status === 'Active');
if (!admin) throw new Error('Database must contain an active Admin account.');
if (!admin.email || !admin.passwordHash) throw new Error('The active Admin account must have an email and password hash.');
if (!db.settings || typeof db.settings !== 'object') throw new Error('Database settings are missing.');
if (!db.settings.currency) throw new Error('Database currency is missing.');
if (!packageJson.dependencies?.next || !packageJson.dependencies?.bcryptjs) throw new Error('Required runtime dependencies are missing from package.json.');
if (!packageJson.build?.files || !packageJson.build?.extraResources) throw new Error('Desktop packaging configuration is incomplete.');
if (!fs.existsSync(path.join(root, 'desktop', 'main.cjs'))) throw new Error('Desktop main process is missing.');
const adminCount = db.users.filter((u) => u.role === 'Admin' && u.status === 'Active').length;
if (adminCount < 1) throw new Error('At least one active Admin account is required.');
for (const user of db.users) {
  if (!user.role || !db.roles[user.role]) throw new Error(`User ${user.email || user.id} references a missing role.`);
}
for (const [role, permissions] of Object.entries(db.roles)) {
  if (role === 'Admin') continue;
  for (const key of Object.keys(permissions)) {
    if (!Object.prototype.hasOwnProperty.call(db.roles.Admin, key)) throw new Error(`Role ${role} contains an unknown privilege: ${key}`);
  }
}

console.log('InventoryPro HQ self-check passed.');
console.log(`Version: ${packageJson.version}`);
console.log(`Active admin: ${admin.email}`);
console.log(`Currency: ${db.settings.currency}`);
console.log(`Operational records: ${db.items.length} items, ${db.stores.length} stores, ${db.transactions.length} transactions.`);
