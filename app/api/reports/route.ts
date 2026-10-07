import { NextResponse } from 'next/server';
import { readDB, itemStatus } from '@/lib/db';
import { can, requireUser } from '@/lib/auth';

function dayStart(value:string){ return new Date(`${value}T00:00:00`); }
function dayEnd(value:string){ return new Date(`${value}T23:59:59.999`); }

export async function GET(req:Request){
  try{
    const user=await requireUser();
    if(!can(user,'viewReports')) return NextResponse.json({error:'Forbidden'},{status:403});
    const db=readDB();
    const url=new URL(req.url);
    const from=url.searchParams.get('from');
    const to=url.searchParams.get('to');
    const items=db.items.filter(i=>i.status!=='DISABLED').map(i=>({...i,status:itemStatus(i)}));
    const byStore=db.stores.map(s=>({store:s.name,value:items.filter(i=>i.storeId===s.id).reduce((n,i)=>n+i.quantity*(i.sellPrice??i.unitPrice??0),0),units:items.filter(i=>i.storeId===s.id).reduce((n,i)=>n+i.quantity,0)}));
    const byCategory=db.categories.map(c=>({category:c,value:items.filter(i=>i.category===c).reduce((n,i)=>n+i.quantity*(i.sellPrice??i.unitPrice??0),0)})).filter(x=>x.value);
    const allOut=db.transactions.filter(t=>t.type==='OUT');
    const configuredTaxRate=db.settings?.taxRate===undefined?null:Number(db.settings.taxRate);
    const sales=db.receipts.reduce((n,r)=>n+r.totalSales,0),taxCollected=db.receipts.reduce((n,r)=>n+Number(r.taxAmount||0),0),cost=db.receipts.reduce((n,r)=>n+r.totalCost,0),profit=db.receipts.reduce((n,r)=>n+r.profit,0);

    if(!from && !to) return NextResponse.json({valuation:items.reduce((n,i)=>n+i.quantity*(i.sellPrice??i.unitPrice??0),0),units:items.reduce((n,i)=>n+i.quantity,0),low:items.filter(i=>i.status==='Low Stock').length,out:items.filter(i=>i.status==='Out of Stock').length,sales,taxCollected,netSales:sales-taxCollected,cost,profit,byStore,byCategory});
    if(!from || !to) return NextResponse.json({error:'Both from and to dates are required'},{status:400});
    const start=dayStart(from), end=dayEnd(to);
    if(Number.isNaN(start.getTime())||Number.isNaN(end.getTime())||start>end) return NextResponse.json({error:'Invalid date range'},{status:400});
    const reportItemIds=new Set(db.items.map(i=>i.id));const movements=db.transactions.filter(t=>reportItemIds.has(t.itemId)).filter(t=>{const d=new Date(t.timestamp);return d>=start&&d<=end;});
    const activities=(db.activities||[]).filter(a=>{const d=new Date(a.date);return d>=start&&d<=end;});
    const stockIn=movements.filter(t=>t.type==='IN');
    const stockOut=movements.filter(t=>t.type==='OUT');
    const adjustment=movements.filter(t=>t.type==='ADJUSTMENT');
    const transfer=movements.filter(t=>t.type==='TRANSFER');
    const itemById=(id:string)=>db.items.find(i=>i.id===id); const itemName=(id:string)=>itemById(id)?.name||id;
    const rows=movements.map(t=>({id:t.id,date:t.timestamp,type:t.type,itemId:t.itemId,itemName:itemName(t.itemId),category:itemById(t.itemId)?.category||'',itemType:itemById(t.itemId)?.itemType||'General',measurementUnit:itemById(t.itemId)?.measurementUnit||'Piece',qty:t.qty,storeId:t.storeId,store:db.stores.find(s=>s.id===t.storeId)?.name||t.storeId,user:t.user,recipient:t.recipient||'',reference:t.reference||'',note:t.note||'',buyPrice:Number(t.buyPrice??0),sellPrice:Number(t.sellPrice??t.unitPrice??0),salesValue:Number(t.type==='OUT'?(t.totalValue??Number(t.qty||0)*Number(t.sellPrice??t.unitPrice??0)):0),taxRate:Number(t.type==='OUT' ? (db.receipts.find(x=>x.id===t.receiptId)?.taxRate ?? configuredTaxRate ?? 0) : 0),taxAmount:Number(t.type==='OUT' ? (db.receipts.find(x=>x.id===t.receiptId)?.taxAmount ?? 0) / Math.max(1,(db.receipts.find(x=>x.id===t.receiptId)?.transactionIds||[]).length) : 0),costValue:Number(t.type==='IN'?Number(t.qty||0)*Number(t.buyPrice??0):(t.costValue??0)),profit:Number(t.type==='OUT'?(t.profit??(Number(t.totalValue??Number(t.qty||0)*Number(t.sellPrice??t.unitPrice??0))-Number(t.costValue??Number(t.qty||0)*Number(t.buyPrice??0)))):0),receiptId:t.receiptId||''}));
    const sum=(arr:any[],key:string)=>arr.reduce((n,t)=>n+Number(t[key]||0),0);
    const activityTotal=activities.reduce((n,a)=>n+Number(a.amount||0),0);
    const grossProfit=sum(stockOut,'profit'); const periodTax=sum(stockOut,'taxAmount'); const netSales=sum(stockOut,'salesValue')-periodTax;
    return NextResponse.json({from,to,currency:db.settings?.currency||'RWF',taxRate:configuredTaxRate,movements:rows,activities,summary:{movementCount:movements.length,stockInCount:stockIn.length,stockInUnits:sum(stockIn,'qty'),stockInCost:stockIn.reduce((n,t)=>n+Number(t.qty||0)*Number(t.buyPrice??0),0),stockOutCount:stockOut.length,stockOutUnits:sum(stockOut,'qty'),adjustmentCount:adjustment.length,transferCount:transfer.length,sales:sum(stockOut,'salesValue'),taxCollected:periodTax,netSales,cost:sum(stockOut,'costValue'),profit:grossProfit,profitAfterTax:grossProfit-periodTax,activityCount:activities.length,activityTotal,netProfit:grossProfit-periodTax-activityTotal},generatedAt:new Date().toISOString()});
  }catch(e){return NextResponse.json({error:e instanceof Error&&e.message==='UNAUTHORIZED'?'Unauthorized':'Report failed'},{status:e instanceof Error&&e.message==='UNAUTHORIZED'?401:500});}
}
