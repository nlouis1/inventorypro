import {NextResponse} from 'next/server';
import {verifyPassword,can,requireUser} from '@/lib/auth';
import {readDB,writeDB,audit,sanitizeSelfUser} from '@/lib/db';
import {hashPassword} from '@/lib/password';
import {email as validateEmail,imageDataUrl,password as validatePassword,readJson,requiredText,text} from '@/lib/validation';

function fail(error: unknown) {
  if (error instanceof Error && error.name === 'ValidationError') return NextResponse.json({error:error.message},{status:400});
  if (error instanceof Error && error.message === 'UNAUTHORIZED') return NextResponse.json({error:'Unauthorized'},{status:401});
  return NextResponse.json({error:error instanceof Error ? error.message : 'Request failed'},{status:500});
}

export async function PATCH(req:Request){
 try{
  const user=await requireUser();
  if(!can(user,'manageProfile')) return NextResponse.json({error:'Forbidden'},{status:403});
  const b=await readJson<Record<string,unknown>>(req);
  const db=readDB(); const u=db.users.find(x=>x.id===user.id);
  if(!u) return NextResponse.json({error:'User not found'},{status:404});
  const name=text(b.name,'Name',100)||u.name;
  const email= b.email===undefined ? u.email : validateEmail(b.email);
  if(email!==u.email.toLowerCase()&&db.users.some(x=>x.id!==u.id&&x.email.toLowerCase()===email)) return NextResponse.json({error:'Email already exists'},{status:409});
  if(b.receiptSignature!==undefined) u.receiptSignature=imageDataUrl(b.receiptSignature,'Receipt signature',1_500_000,'png|jpe?g|webp');
  u.name=requiredText(name,'Name',100); u.email=email; u.notes=text(b.notes??u.notes??'','Notes',2000);
  audit(db,'UPDATE','PROFILE',u.id,u.name,'Updated profile settings'); writeDB(db);
  return NextResponse.json(sanitizeSelfUser(u));
 }catch(e){return fail(e);}
}

export async function POST(req:Request){
 try{
  const user=await requireUser();
  if(!can(user,'manageProfile')) return NextResponse.json({error:'Forbidden'},{status:403});
  const b=await readJson<Record<string,unknown>>(req);
  const current=String(b.currentPassword??''); const next=validatePassword(b.newPassword,'New password');
  if(current.length===0) return NextResponse.json({error:'Current password is required.'},{status:400});
  const db=readDB(); const u=db.users.find(x=>x.id===user.id);
  if(!u) return NextResponse.json({error:'User not found'},{status:404});
  if(!await verifyPassword(current,u.passwordHash)) return NextResponse.json({error:'Current password is incorrect.'},{status:400});
  u.passwordHash=hashPassword(next); audit(db,'UPDATE','PASSWORD',u.id,u.name,'Changed own password'); writeDB(db);
  return NextResponse.json({ok:true});
 }catch(e){return fail(e);}
}
