import fs from 'node:fs';
import path from 'node:path';
import {normalizePermissions, rolePermissions, PRIVILEGES} from './permissions';

export type Store={id:string;name:string;code:string;location:string;manager:string};
export type Item={id:string;name:string;category:string;itemType?:string;measurementUnit?:string;storeId:string;quantity:number;minThreshold:number;buyPrice:number;sellPrice:number;unitPrice?:number;barcode:string;createdAt:string;status?:'ACTIVE'|'DISABLED';disabledAt?:string;disabledById?:string;disabledByName?:string;disabledReason?:string};
export type User={id:string;name:string;email:string;passwordHash:string;role:string;status:'Active'|'Inactive';assignedStore:string;receiptSignature?:string;notes?:string};
export type Session={id:string;userId:string;expiresAt:string;createdAt:string};
export type Transaction={id:string;itemId:string;type:'IN'|'OUT'|'TRANSFER'|'ADJUSTMENT';qty:number;user:string;userId?:string;storeId:string;timestamp:string;note:string;targetStoreId?:string;recipient?:string;customerPhone?:string;reference?:string;buyPrice?:number;sellPrice?:number;unitPrice?:number;totalValue?:number;costValue?:number;profit?:number;receiptId?:string};
export type Proforma={id:string;number:string;customerName:string;customerPhone?:string;storeId:string;userId:string;userName:string;timestamp:string;status:'DRAFT'|'VALIDATED';lines:{itemId:string;itemName:string;sku:string;unit:string;qty:number;unitPrice:number;amount:number}[];total:number;subtotal?:number;taxRate?:number;taxAmount?:number;taxInclusive?:boolean;reference?:string;note?:string;validatedAt?:string;validatedById?:string;validatedByName?:string;validatedBySignature?:string;receiptId?:string};
export type Receipt={id:string;number:string;customerName:string;customerPhone?:string;storeId:string;userId:string;userName:string;timestamp:string;reference?:string;note?:string;subtotal?:number;taxRate?:number;taxAmount?:number;taxInclusive?:boolean;totalSales:number;totalCost:number;profit:number;transactionIds:string[];authorizerSignature?:string;authorizerName?:string};
export type AuditChange={field:string;before:unknown;after:unknown};
export type AuditLog={id:string;action:string;entity:string;entityId:string;user:string;timestamp:string;details:string;changes?:AuditChange[]};
export type PostedNote={id:string;message:string;userId:string;userName:string;timestamp:string};
export type Activity={id:string;date:string;category:string;description:string;amount:number;paymentMethod:string;reference?:string;createdBy:string;createdById:string;createdAt:string};
export type RolePermissions=Record<string,boolean>;
export type SystemSettings={currency:string;systemName?:string;logoDataUrl?:string;taxRate?:number};
export type DB={proformas:Proforma[];stores:Store[];categories:string[];items:Item[];users:User[];transactions:Transaction[];receipts:Receipt[];auditLogs:AuditLog[];activities:Activity[];postedNotes:PostedNote[];roles:Record<string,RolePermissions>;settings?:SystemSettings;sessions?:Session[]};
const dataDir=process.env.INVENTORY_DATA_DIR || path.join(process.cwd(),'data');
const file=path.join(dataDir,'db.json');
function ensureDataFile(){
 if(!fs.existsSync(dataDir)) fs.mkdirSync(dataDir,{recursive:true});
 if(!fs.existsSync(file)) throw new Error(`Inventory database not found at ${file}. Restore data/db.json from the supplied default database or backup.`);
}
export function migrateDB(db:DB){
 db.proformas??=[]; db.stores??=[]; db.categories??=[]; db.items??=[]; db.users??=[]; db.transactions??=[]; db.receipts??=[]; db.auditLogs??=[]; db.activities??=[]; db.postedNotes??=[]; db.sessions??=[];
 db.roles??={Admin:rolePermissions('Admin')};
 db.settings??={currency:'RWF',systemName:'InventoryPro HQ'}; db.settings.currency??='RWF'; db.settings.systemName??='InventoryPro HQ'; db.settings.logoDataUrl??=''; if(db.settings.taxRate!==undefined){db.settings.taxRate=Number(db.settings.taxRate);if(!Number.isFinite(db.settings.taxRate)||db.settings.taxRate<0||db.settings.taxRate>100)delete db.settings.taxRate;}
 for(const u of db.users){u.notes??='';u.receiptSignature??=''; delete (u as any).profilePicture;}
 for(const i of db.items){i.itemType??='General';i.measurementUnit??='Piece';i.status??='ACTIVE';if(i.status==='DISABLED'){i.disabledAt??=undefined; i.disabledById??=undefined; i.disabledByName??=undefined; i.disabledReason??=undefined;}}
 // Normalize every role against the single canonical privilege registry.
 for(const role of Object.keys(db.roles||{})) db.roles[role]=rolePermissions(role,db.roles[role]);
 for(const i of db.items){ i.sellPrice=Number(i.sellPrice??i.unitPrice??0); i.buyPrice=Number(i.buyPrice??0); i.unitPrice=i.sellPrice; }
 for(const t of db.transactions){
   if(t.type==='OUT'){
     t.sellPrice=Number(t.sellPrice??t.unitPrice??0);
     t.buyPrice=Number(t.buyPrice??0);
     t.costValue??=t.qty*(t.buyPrice??0);
     t.profit??=(t.totalValue??t.qty*(t.sellPrice??0))-t.costValue;
   }
 }
 return db;
}
export function readDB():DB{ensureDataFile();return migrateDB(JSON.parse(fs.readFileSync(file,'utf8')) as DB);}
export function writeDB(db:DB){if(!fs.existsSync(dataDir))fs.mkdirSync(dataDir,{recursive:true});migrateDB(db);const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(db,null,2));fs.renameSync(tmp,file);}
export function nextId(prefix:string, records:{id:string}[]){const n=records.reduce((m,r)=>Math.max(m,Number(r.id.replace(/\D/g,''))||0),0)+1;return `${prefix}-${String(n).padStart(3,'0')}`;}

export function taxCalculation(subtotal:number,taxRate:number,taxInclusive:boolean){
 const base=Math.max(0,Number(subtotal)||0); const rate=Math.max(0,Number(taxRate)||0); const divisor=1+rate/100;
 const tax=taxInclusive ? (divisor>0 ? base-(base/divisor) : 0) : base*(rate/100);
 const total=taxInclusive ? base : base+tax;
 return {subtotal:base,taxRate:rate,taxAmount:tax,total};
}

export function itemStatus(i:Item){if(i.status==='DISABLED')return 'Disabled';return i.quantity<=0?'Out of Stock':i.quantity<=i.minThreshold?'Low Stock':'In Stock';}
export function audit(db:DB,action:string,entity:string,entityId:string,user:string,details:string,changes?:AuditChange[]){db.auditLogs.unshift({id:nextId('AUD',db.auditLogs),action,entity,entityId,user,timestamp:new Date().toISOString(),details,changes:changes&&changes.length?changes:undefined});}
export function auditChange(db:DB,action:string,entity:string,entityId:string,user:string,details:string,before:Record<string,unknown>,after:Record<string,unknown>){const fields=Array.from(new Set([...Object.keys(before),...Object.keys(after)]));const changes=fields.filter(k=>JSON.stringify(before[k])!==JSON.stringify(after[k])).map(field=>({field,before:before[field]??null,after:after[field]??null}));audit(db,action,entity,entityId,user,details,changes);}
export function sanitizeUser(u:User){const {passwordHash,notes,...safe}=u;return safe;}
export function sanitizeSelfUser(u:User){const {passwordHash,...safe}=u;return safe;}
export function cleanupSessions(db:DB){const now=Date.now();db.sessions=(db.sessions||[]).filter(s=>Date.parse(s.expiresAt)>now);}

export function createFreshDB(currentUser:User):DB{
 const roles:Record<string,RolePermissions>={
  Admin:rolePermissions('Admin'),
  'Store Manager':rolePermissions('Store Manager'),
  'Inventory Clerk':rolePermissions('Inventory Clerk'),
  Auditor:rolePermissions('Auditor'),
 };
 const admin:User={...currentUser,role:'Admin',status:'Active',assignedStore:'',notes:'',receiptSignature:currentUser.receiptSignature||''};
 return {proformas:[],stores:[],categories:[],items:[],users:[admin],transactions:[],receipts:[],auditLogs:[],activities:[],postedNotes:[],roles,settings:{currency:'RWF',systemName:'InventoryPro HQ',logoDataUrl:''},sessions:[]};
}

export function backupPayload(db:DB){
 return {
  format:'inventorypro-hq-backup',
  version:1,
  createdAt:new Date().toISOString(),
  database:db,
 };
}
