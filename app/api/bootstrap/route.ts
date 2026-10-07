import {NextResponse} from 'next/server';
import {readDB,itemStatus,sanitizeUser,sanitizeSelfUser} from '@/lib/db';
import {requireUser,can} from '@/lib/auth';

export async function GET(){
  try{
    const user=await requireUser();
    const db=readDB();
    const inventoryAllowed=can(user,'viewInventory');
    const movementAllowed=can(user,'viewMovements');
    const storesAllowed=can(user,'viewStores');
    const receiptAllowed=can(user,'viewReceipts');
    const proformaAllowed=can(user,'viewProformas');
    const activityAllowed=can(user,'viewActivities');
    const usersAllowed=can(user,'manageUsers');
    const rolesAllowed=can(user,'manageRoles');
    const auditAllowed=can(user,'viewAudit');
    const notesAllowed=can(user,'viewPostedNotes');
    const settingsManageAllowed=can(user,'manageSettings');
    const operationalTaxAllowed=can(user,'generateReceipt')||can(user,'generateProforma')||can(user,'viewReports');

    const activeItems=inventoryAllowed
      ? db.items.filter(i=>i.status!=='DISABLED').map(i=>({...i,status:itemStatus(i)}))
      : [];
    const storeInventory=storesAllowed
      ? db.items.map(i=>({...i,status:itemStatus(i)}))
      : [];
    const activeIds=new Set(activeItems.map(i=>i.id));
    const transactions=movementAllowed
      ? db.transactions.filter(t=>!inventoryAllowed || activeIds.has(t.itemId))
      : [];

    return NextResponse.json({
      user:sanitizeSelfUser(user),
      permissions:db.roles[user.role]||{},
      stores:storesAllowed?db.stores:[],
      categories:inventoryAllowed?db.categories:[],
      items:activeItems,
      storeInventory,
      settings:{
        currency:db.settings?.currency||'RWF',
        systemName:db.settings?.systemName||'InventoryPro HQ',
        logoDataUrl:db.settings?.logoDataUrl||'',
        ...((settingsManageAllowed||operationalTaxAllowed)?{taxRate:db.settings?.taxRate}:{}),
      },
      users:usersAllowed?db.users.map(sanitizeUser):[],
      transactions,
      receipts:receiptAllowed?db.receipts:[],
      proformas:proformaAllowed?db.proformas:[],
      activities:activityAllowed?(db.activities||[]):[],
      roles:(usersAllowed||rolesAllowed)?Object.fromEntries(Object.entries(db.roles).filter(([role,permissions])=>{if(user.role==='Admin')return true;if(role==='Admin')return false;return Object.entries(permissions as Record<string,boolean>).every(([k,v])=>v!==true||can(user,k as any));})): {},
      auditLogs:auditAllowed?db.auditLogs:[],
      postedNotes:notesAllowed?(db.postedNotes||[]):[]
    });
  }catch(e){
    return NextResponse.json({error:e instanceof Error&&e.message==='FORBIDDEN'?'Forbidden':'Unauthorized'},{status:e instanceof Error&&e.message==='FORBIDDEN'?403:401});
  }
}
