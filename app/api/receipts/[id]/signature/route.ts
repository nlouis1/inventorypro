import {NextResponse} from 'next/server';
import {readDB,writeDB,audit} from '@/lib/db';
import {can,requireUser} from '@/lib/auth';

export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const user=await requireUser();
  if(!can(user,'viewReceipts')) return NextResponse.json({error:'Forbidden'},{status:403});
  const {id}=await params; const body=await req.json(); const signature=String(body.signature??'');
  if(signature && !/^data:image\/(png|jpe?g|webp);base64,/i.test(signature)) return NextResponse.json({error:'Signature must be PNG, JPG or WebP.'},{status:400});
  if(signature.length>1_500_000) return NextResponse.json({error:'Signature image is too large.'},{status:400});
  const db=readDB(); const receipt=db.receipts.find(r=>r.id===id);
  if(!receipt) return NextResponse.json({error:'Receipt not found'},{status:404});
  receipt.authorizerSignature=signature||undefined; receipt.authorizerName=user.name;
  audit(db,'UPDATE','RECEIPT',receipt.id,user.name,signature?'Attached authorizer signature before printing receipt':'Removed authorizer signature from receipt');
  writeDB(db);
  return NextResponse.json({ok:true,authorizerSignature:receipt.authorizerSignature||'',authorizerName:receipt.authorizerName});
 }catch(e){return NextResponse.json({error:e instanceof Error&&e.message==='UNAUTHORIZED'?'Unauthorized':'Request failed'},{status:e instanceof Error&&e.message==='UNAUTHORIZED'?401:500});}
}
