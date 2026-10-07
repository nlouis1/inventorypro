import { NextResponse } from 'next/server';
import { readDB, writeDB, nextId, audit } from '@/lib/db';
import { can, requireUser } from '@/lib/auth';
import {dateOnly,readJson,text} from '@/lib/validation';

const categories=['Rent','Taxes','Sanitation','Repairs & Maintenance','Utilities','Transport','Salaries','Bank Charges','Marketing','Other'];
const methods=['Cash','Bank Transfer','Mobile Money','Card','Other'];

export async function GET(req:Request){
  try{
    const user=await requireUser();
    if(!can(user,'viewActivities')) return NextResponse.json({error:'Forbidden'},{status:403});
    const db=readDB(); const url=new URL(req.url);
    const from=url.searchParams.get('from'), to=url.searchParams.get('to');
    let rows=db.activities||[];
    if(from||to){
      if(!from||!to) return NextResponse.json({error:'Both from and to dates are required'},{status:400});
      const start=new Date(`${from}T00:00:00`), end=new Date(`${to}T23:59:59.999`);
      if(Number.isNaN(start.getTime())||Number.isNaN(end.getTime())||start>end) return NextResponse.json({error:'Invalid date range'},{status:400});
      rows=rows.filter(a=>{const d=new Date(a.date);return d>=start&&d<=end});
    }
    return NextResponse.json({activities:rows});
  }catch(e){return NextResponse.json({error:e instanceof Error&&e.message==='UNAUTHORIZED'?'Unauthorized':'Activities failed'},{status:e instanceof Error&&e.message==='UNAUTHORIZED'?401:500});}
}

export async function POST(req:Request){
  try{
    const user=await requireUser();
    if(!can(user,'manageExpenses')) return NextResponse.json({error:'Forbidden'},{status:403});
    const body=await readJson<Record<string,unknown>>(req); const amount=Number(body.amount);
    const date=dateOnly(body.date,'Activity date'); const category=String(body.category||'').trim();
    const description=text(body.description,'Description',250); const paymentMethod=String(body.paymentMethod||'').trim();
    if(!date||Number.isNaN(new Date(`${date}T00:00:00`).getTime())) return NextResponse.json({error:'A valid activity date is required'},{status:400});
    if(!categories.includes(category)) return NextResponse.json({error:'Invalid activity category'},{status:400});
    if(!Number.isFinite(amount)||amount<=0) return NextResponse.json({error:'Amount must be greater than zero'},{status:400});
    if(!methods.includes(paymentMethod)) return NextResponse.json({error:'Invalid payment method'},{status:400});
    if(description.length>250) return NextResponse.json({error:'Description is too long'},{status:400});
    const db=readDB();
    const activity={id:nextId('ACT',db.activities),date:`${date}T12:00:00.000Z`,category,description,amount,paymentMethod,reference:text(body.reference,'Reference',100),createdBy:user.name,createdById:user.id,createdAt:new Date().toISOString()};
    db.activities.unshift(activity);
    audit(db,'CREATE','Activity',activity.id,user.name,`${category}: ${amount.toFixed(2)} — ${description||'No description'}`);
    writeDB(db);
    return NextResponse.json({activity},{status:201});
  }catch(e){return NextResponse.json({error:e instanceof Error&&e.name==='ValidationError'?e.message:e instanceof Error?e.message:'Could not save activity'},{status:e instanceof Error&&e.name==='ValidationError'?400:500});}
}

export async function DELETE(req:Request){
  try{
    const user=await requireUser();
    if(!can(user,'manageExpenses')) return NextResponse.json({error:'Forbidden'},{status:403});
    const {id}=await readJson<Record<string,unknown>>(req); const db=readDB(); const index=db.activities.findIndex(a=>a.id===id);
    if(index<0) return NextResponse.json({error:'Activity not found'},{status:404});
    const [removed]=db.activities.splice(index,1);
    audit(db,'DELETE','Activity',removed.id,user.name,`${removed.category}: ${removed.amount.toFixed(2)}`,[{field:'record',before:removed,after:'DELETED'}]);
    writeDB(db); return NextResponse.json({ok:true});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Could not delete activity'},{status:e instanceof Error&&e.name==='ValidationError'?400:500});}
}
