import {NextResponse} from 'next/server';
import {readDB,writeDB,nextId,audit,auditChange,itemStatus,taxCalculation} from '@/lib/db';
import {can,requireUser} from '@/lib/auth';
import {readJson,text as validateText} from '@/lib/validation';

const text=(v:unknown)=>String(v??'').trim();
export async function POST(req:Request){
 try{
  const user=await requireUser(); const b=await readJson<Record<string,unknown>>(req); const type=text(b.type) as 'IN'|'OUT'|'ADJUSTMENT'|'TRANSFER';
  if(!['IN','OUT','ADJUSTMENT','TRANSFER'].includes(type))return NextResponse.json({error:'Invalid movement type'},{status:400});
  const requiredPrivilege = type==='TRANSFER' ? 'transferStock' : type==='IN' ? 'stockIn' : type==='OUT' ? 'stockOut' : 'adjustStock';
  if(!can(user,requiredPrivilege))return NextResponse.json({error:'Forbidden: missing '+requiredPrivilege},{status:403});
  const db=readDB(); const item=db.items.find(x=>x.id===text(b.itemId)); if(!item)return NextResponse.json({error:'Item not found'},{status:404});if(item.status==='DISABLED')return NextResponse.json({error:'This stock item is disabled and cannot be used.'},{status:409});
  const previousQuantity=item.quantity; const qty=Number(b.qty); if(!Number.isInteger(qty)||qty<=0||qty>1_000_000_000)return NextResponse.json({error:'Quantity must be a positive whole number'},{status:400});
  if((type==='OUT'||type==='TRANSFER')&&item.quantity<qty)return NextResponse.json({error:`Insufficient stock. Available: ${item.quantity}`},{status:409});
  const recipient=text(b.recipient); if(type==='OUT'&&!recipient)return NextResponse.json({error:'Issued to is required for stock-out receipts'},{status:400});
  const reference=text(b.reference).slice(0,100); const note=text(b.note).slice(0,500); const customerPhone=text(b.customerPhone);
  if(type==='OUT' && customerPhone && !/^[0-9+() .-]{6,25}$/.test(customerPhone))return NextResponse.json({error:'Enter a valid customer phone number or leave it blank'},{status:400});
  // Stock-in may carry revised supplier cost and selling price; validate and persist only when supplied.
  const buyPriceInput=b.buyPrice===''||b.buyPrice===undefined?undefined:Number(b.buyPrice);
  const sellPriceInput=b.sellPrice===''||b.sellPrice===undefined?undefined:Number(b.sellPrice);
  if(type==='IN' && ((buyPriceInput!==undefined&&(!Number.isFinite(buyPriceInput)||buyPriceInput<0))||(sellPriceInput!==undefined&&(!Number.isFinite(sellPriceInput)||sellPriceInput<0)))) return NextResponse.json({error:'Prices must be valid non-negative amounts'},{status:400});
  if(type==='IN'){
    if(buyPriceInput!==undefined)item.buyPrice=buyPriceInput;
    if(sellPriceInput!==undefined){item.sellPrice=sellPriceInput;item.unitPrice=sellPriceInput;}
  }
  const buyPrice=Number(type==='IN'?(buyPriceInput??item.buyPrice??0):(item.buyPrice??0));
  const sellPrice=Number(type==='IN'?(sellPriceInput??item.sellPrice??item.unitPrice??0):(item.sellPrice??item.unitPrice??0));
  const configuredTaxRate=Number(db.settings?.taxRate);
  if(type==='OUT' && (!Number.isFinite(configuredTaxRate)||configuredTaxRate<0||configuredTaxRate>100)) return NextResponse.json({error:'Tax rate is not configured. Set it in Settings before issuing stock.'},{status:400});
  const outTax=type==='OUT' ? taxCalculation(qty*sellPrice,configuredTaxRate,false) : null;
  const chargedSellPrice=type==='OUT' && outTax ? sellPrice*(outTax.total/Math.max(1,qty*sellPrice)) : sellPrice;
  const chargedTotal=type==='OUT' && outTax ? outTax.total : undefined;
  let transactionItemId=item.id; let targetStoreId:string|undefined;
  if(type==='TRANSFER'){
    targetStoreId=text(b.targetStoreId); const target=db.stores.find(s=>s.id===targetStoreId); if(!target||target.id===item.storeId)return NextResponse.json({error:'Invalid target store'},{status:400});
    item.quantity-=qty; const targetItem=db.items.find(x=>x.barcode===item.barcode&&x.storeId===target.id);
    if(targetItem)targetItem.quantity+=qty; else db.items.push({...item,id:nextId('SKU',db.items),storeId:target.id,quantity:qty,createdAt:new Date().toISOString()});
  } else if(type==='IN') item.quantity+=qty;
  else if(type==='OUT') item.quantity-=qty;
  else { const adjustedQuantity=Number(b.qty); if(!Number.isInteger(adjustedQuantity)||adjustedQuantity<0||adjustedQuantity>1_000_000_000)return NextResponse.json({error:'Adjusted quantity must be a whole number from 0 to 1,000,000,000'},{status:400}); item.quantity=adjustedQuantity; }
  const now=new Date().toISOString();
  const tx:any={id:nextId('TRX',db.transactions),itemId:transactionItemId,type,qty,user:user.name,userId:user.id,storeId:item.storeId,timestamp:now,note,targetStoreId,recipient:recipient||undefined,reference,buyPrice,sellPrice:chargedSellPrice,unitPrice:chargedSellPrice,totalValue:chargedTotal,costValue:type==='OUT'?qty*buyPrice:undefined,profit:type==='OUT'?(Number(chargedTotal||0)-qty*buyPrice):undefined};
  let receipt:any=null;
  if(type==='OUT'){
    const receiptId=nextId('RCT',db.receipts); const subtotal=qty*sellPrice; const calculated=outTax!;
    tx.receiptId=receiptId;
    receipt={id:receiptId,number:receiptId,customerName:recipient,customerPhone:customerPhone||undefined,storeId:item.storeId,userId:user.id,userName:user.name,timestamp:now,reference:reference||undefined,note:note||undefined,subtotal:calculated.subtotal,taxRate:calculated.taxRate,taxAmount:calculated.taxAmount,taxInclusive:false,totalSales:calculated.total,totalCost:qty*buyPrice,profit:calculated.total-qty*buyPrice,transactionIds:[tx.id],authorizerSignature:user.receiptSignature||undefined,authorizerName:user.name};
    db.receipts.unshift(receipt);
  }
  db.transactions.unshift(tx); auditChange(db,'MOVEMENT','ITEM',item.id,user.name,`${type} ${qty} ${item.name}${recipient?` issued to ${recipient}`:''}`,{quantity:previousQuantity},{quantity:item.quantity,transactionId:tx.id}); writeDB(db);
  return NextResponse.json({...item,status:itemStatus(item),previousQuantity,newQuantity:item.quantity,quantityChange:item.quantity-previousQuantity,transaction:tx,receipt:receipt?`/receipts/${receipt.id}`:null});
 }catch(e){return NextResponse.json({error:e instanceof Error&&e.name==='ValidationError'?e.message:e instanceof Error&&e.message==='UNAUTHORIZED'?'Unauthorized':'Request failed'},{status:e instanceof Error&&e.name==='ValidationError'?400:e instanceof Error&&e.message==='UNAUTHORIZED'?401:500});}
}
