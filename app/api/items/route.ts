import {NextResponse} from 'next/server';
import {readDB,writeDB,Item,nextId,itemStatus,audit,auditChange} from '@/lib/db';
import {can,requireUser} from '@/lib/auth';
import {readJson,requiredText,text,nonNegativeNumber} from '@/lib/validation';
const s=(v:unknown)=>String(v??'').trim(); const num=(v:unknown)=>Number(v);
function prices(b:any){return {buyPrice:num(b.buyPrice),sellPrice:num(b.sellPrice??b.unitPrice)}}
function validPrices(p:any){return Number.isFinite(p.buyPrice)&&p.buyPrice>=0&&Number.isFinite(p.sellPrice)&&p.sellPrice>=0}
export async function POST(req:Request){try{const user=await requireUser();if(!can(user,'createItem'))return NextResponse.json({error:'Forbidden'},{status:403});const b=await readJson<Record<string,unknown>>(req);const db=readDB();const p=prices(b);const item:Item={id:nextId('SKU',db.items),name:s(b.name).slice(0,120),category:s(b.category).slice(0,80),itemType:s(b.itemType).slice(0,80)||'General',measurementUnit:s(b.measurementUnit).slice(0,40)||'Piece',storeId:s(b.storeId).slice(0,80),quantity:num(b.quantity),minThreshold:num(b.minThreshold),buyPrice:p.buyPrice,sellPrice:p.sellPrice,unitPrice:p.sellPrice,barcode:s(b.barcode).slice(0,80)||`890${Date.now()}${Math.floor(Math.random()*100)}`,createdAt:new Date().toISOString(),status:'ACTIVE'};if(!item.name||!item.category||!db.stores.some(x=>x.id===item.storeId)||!Number.isInteger(item.quantity)||item.quantity<0||!Number.isFinite(item.minThreshold)||item.minThreshold<0||!validPrices(p)||p.buyPrice>1_000_000_000_000||p.sellPrice>1_000_000_000_000)return NextResponse.json({error:'Invalid item data. Buy and sell prices must be non-negative numbers.'},{status:400});if(db.items.some(x=>x.barcode===item.barcode))return NextResponse.json({error:'Barcode already exists'},{status:409});db.items.unshift(item);
    // A quantity entered while creating a SKU is opening stock, so record it as
    // an IN movement. This keeps the stock ledger and date-filtered reports in
    // sync with the quantity shown on the newly created item.
    if(item.quantity>0){
      const openingAt=item.createdAt;
      db.transactions.unshift({
        id:nextId('TRX',db.transactions),
        itemId:item.id,
        type:'IN',
        qty:item.quantity,
        user:user.name,
        userId:user.id,
        storeId:item.storeId,
        timestamp:openingAt,
        note:'Opening stock recorded when SKU was created',
        reference:'OPENING-STOCK',
        buyPrice:item.buyPrice,
        sellPrice:item.sellPrice,
        unitPrice:item.sellPrice
      });
    }
    audit(db,'CREATE','ITEM',item.id,user.name,`Created ${item.name}${item.quantity>0?` with opening stock of ${item.quantity} ${item.measurementUnit||'Piece'}`:''}`);
    writeDB(db);
    return NextResponse.json({...item,status:itemStatus(item)},{status:201});}catch(e){return NextResponse.json({error:e instanceof Error&&e.message==='UNAUTHORIZED'?'Unauthorized':e instanceof Error&&e.name==='ValidationError'?e.message:'Request failed'},{status:e instanceof Error&&e.name==='ValidationError'?400:e instanceof Error&&e.message==='UNAUTHORIZED'?401:500});}}
export async function PATCH(req:Request){try{const user=await requireUser();const b=await readJson<Record<string,unknown>>(req);const db=readDB();const i=db.items.find(x=>x.id===s(b.id));if(!i)return NextResponse.json({error:'Item not found'},{status:404});
 if(b.status!==undefined){if(!can(user,'deleteItem'))return NextResponse.json({error:'Forbidden'},{status:403});const next=s(b.status).toUpperCase();if(!['ACTIVE','DISABLED'].includes(next))return NextResponse.json({error:'Status must be ACTIVE or DISABLED'},{status:400});if(i.status===next)return NextResponse.json({...i,status:itemStatus(i)});const before={status:i.status||'ACTIVE',disabledAt:i.disabledAt||null,disabledBy:i.disabledByName||null,disabledReason:i.disabledReason||null};i.status=next as 'ACTIVE'|'DISABLED';if(next==='DISABLED'){i.disabledAt=new Date().toISOString();i.disabledById=user.id;i.disabledByName=user.name;i.disabledReason=s(b.reason).slice(0,250)||'Disabled by authorised user';}else{delete i.disabledAt;delete i.disabledById;delete i.disabledByName;delete i.disabledReason;}auditChange(db,next==='DISABLED'?'DISABLE':'ENABLE','ITEM',i.id,user.name,`${next==='DISABLED'?'Disabled':'Enabled'} ${i.name}`,before,{status:i.status,disabledAt:i.disabledAt||null,disabledBy:i.disabledByName||null,disabledReason:i.disabledReason||null});writeDB(db);return NextResponse.json({...i,status:itemStatus(i)});}
 if(!can(user,'editItem'))return NextResponse.json({error:'Forbidden'},{status:403});const p=prices(b),name=s(b.name).slice(0,120),category=s(b.category).slice(0,80),itemType=s(b.itemType).slice(0,80)||'General',measurementUnit=s(b.measurementUnit).slice(0,40)||'Piece',storeId=s(b.storeId).slice(0,80),minThreshold=num(b.minThreshold);if(!name||!category||!db.stores.some(x=>x.id===storeId)||!Number.isFinite(minThreshold)||minThreshold<0||!validPrices(p))return NextResponse.json({error:'Invalid item data. Buy and sell prices must be non-negative numbers.'},{status:400});const before={name:i.name,category:i.category,itemType:i.itemType,measurementUnit:i.measurementUnit,storeId:i.storeId,minThreshold:i.minThreshold,buyPrice:i.buyPrice,sellPrice:i.sellPrice,status:i.status||'ACTIVE'};Object.assign(i,{name,category,itemType,measurementUnit,storeId,minThreshold,buyPrice:p.buyPrice,sellPrice:p.sellPrice,unitPrice:p.sellPrice});auditChange(db,'UPDATE','ITEM',i.id,user.name,`Updated ${i.name}`,before,{name:i.name,category:i.category,itemType:i.itemType,measurementUnit:i.measurementUnit,storeId:i.storeId,minThreshold:i.minThreshold,buyPrice:i.buyPrice,sellPrice:i.sellPrice,status:i.status||'ACTIVE'});writeDB(db);return NextResponse.json({...i,status:itemStatus(i)});}catch(e){return NextResponse.json({error:e instanceof Error&&e.message==='UNAUTHORIZED'?'Unauthorized':e instanceof Error&&e.name==='ValidationError'?e.message:'Request failed'},{status:e instanceof Error&&e.name==='ValidationError'?400:e instanceof Error&&e.message==='UNAUTHORIZED'?401:500});}}

export async function DELETE(req:Request){try{const user=await requireUser();if(!can(user,'deleteItem'))return NextResponse.json({error:'Forbidden'},{status:403});const {id}=await readJson<Record<string,unknown>>(req);const db=readDB();const i=db.items.find(x=>x.id===s(id));if(!i)return NextResponse.json({error:'Item not found'},{status:404});if(db.transactions.some(t=>t.itemId===i.id))return NextResponse.json({error:'Cannot permanently delete an item with transaction history. Disable it instead.'},{status:409});db.items=db.items.filter(x=>x.id!==i.id);audit(db,'DELETE','ITEM',i.id,user.name,`Permanently deleted ${i.name}`,[{field:'status',before:i.status||'ACTIVE',after:'DELETED'}]);writeDB(db);return NextResponse.json({ok:true});}catch(e){return NextResponse.json({error:e instanceof Error&&e.message==='UNAUTHORIZED'?'Unauthorized':e instanceof Error&&e.name==='ValidationError'?e.message:'Request failed'},{status:e instanceof Error&&e.name==='ValidationError'?400:e instanceof Error&&e.message==='UNAUTHORIZED'?401:500});}}
