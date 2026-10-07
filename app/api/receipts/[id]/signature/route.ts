import {NextResponse} from 'next/server';
import {readDB,writeDB,audit} from '@/lib/db';
import {can,requireUser} from '@/lib/auth';
import {readJson,imageDataUrl} from '@/lib/validation';

export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const user=await requireUser();
  if(!can(user,'generateReceipt')) return NextResponse.json({error:'Forbidden'},{status:403});
  const {id}=await params; const body=await readJson<Record<string,unknown>>(req); const signature=imageDataUrl(body.signature??'','Signature',1_500_000,'png|jpe?g|webp');
  const db=readDB(); const receipt=db.receipts.find(r=>r.id===id);
  if(!receipt) return NextResponse.json({error:'Receipt not found'},{status:404});
  receipt.authorizerSignature=signature||undefined; receipt.authorizerName=user.name;
  audit(db,'UPDATE','RECEIPT',receipt.id,user.name,signature?'Attached authorizer signature before printing receipt':'Removed authorizer signature from receipt');
  writeDB(db);
  return NextResponse.json({ok:true,authorizerSignature:receipt.authorizerSignature||'',authorizerName:receipt.authorizerName});
 }catch(e){return NextResponse.json({error:e instanceof Error&&e.name==='ValidationError'?e.message:e instanceof Error&&e.message==='UNAUTHORIZED'?'Unauthorized':'Request failed'},{status:e instanceof Error&&e.name==='ValidationError'?400:e instanceof Error&&e.message==='UNAUTHORIZED'?401:500});}
}
