import {NextResponse} from 'next/server';import {readDB,itemStatus,sanitizeUser,sanitizeSelfUser} from '@/lib/db';import {requireUser,can} from '@/lib/auth';
export async function GET(){try{const user=await requireUser();if(!can(user,'viewDashboard'))return NextResponse.json({error:'Forbidden'},{status:403});const db=readDB();const activeItems=db.items.filter(i=>i.status!=='DISABLED').map(i=>({...i,status:itemStatus(i)}));const storeInventory=db.items.map(i=>({...i,status:itemStatus(i)}));const activeIds=new Set(activeItems.map(i=>i.id));const activeTransactions=db.transactions.filter(t=>activeIds.has(t.itemId));return NextResponse.json({
 user:sanitizeSelfUser(user),
 permissions:db.roles[user.role]||{},
 stores:db.stores,
 categories:db.categories,
 items:activeItems,
 storeInventory,
 settings:{currency:db.settings?.currency||'RWF',systemName:db.settings?.systemName||'InventoryPro HQ',logoDataUrl:db.settings?.logoDataUrl||''},
 users:can(user,'manageUsers')?db.users.map(sanitizeUser):[],
 transactions:activeTransactions,
 receipts:can(user,'viewReceipts')?db.receipts:[],
 proformas:can(user,'viewProformas')?db.proformas:[],
 activities:can(user,'viewActivities')?(db.activities||[]):[],
 roles:(can(user,'manageUsers')||can(user,'manageRoles'))?db.roles:{},
 auditLogs:can(user,'viewAudit')?db.auditLogs:[],
postedNotes:can(user,'viewPostedNotes')?(db.postedNotes||[]):[]
});}catch{return NextResponse.json({error:'Unauthorized'},{status:401});}}
