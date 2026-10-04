import {NextResponse} from 'next/server';
import bcrypt from 'bcryptjs';
import {verifyPassword} from '@/lib/auth';
import {readDB,writeDB,audit,sanitizeSelfUser} from '@/lib/db';
import {can,requireUser} from '@/lib/auth';
const s=(v:unknown)=>String(v??'').trim();
export async function PATCH(req:Request){
 try{
  const user=await requireUser(); if(!can(user,'manageProfile'))return NextResponse.json({error:'Forbidden'},{status:403}); const b=await req.json(); const db=readDB(); const u=db.users.find(x=>x.id===user.id); if(!u)return NextResponse.json({error:'User not found'},{status:404});
  const name=s(b.name)||u.name, email=s(b.email).toLowerCase()||u.email;
  if(email!==u.email.toLowerCase()&&db.users.some(x=>x.id!==u.id&&x.email.toLowerCase()===email))return NextResponse.json({error:'Email already exists'},{status:409});
  if(b.receiptSignature!==undefined){ if(b.receiptSignature && !/^data:image\/(png|jpe?g|webp);base64,/i.test(String(b.receiptSignature))) return NextResponse.json({error:'Receipt signature must be PNG, JPG or WebP.'},{status:400}); if(String(b.receiptSignature).length>1_500_000)return NextResponse.json({error:'Receipt signature is too large.'},{status:400}); u.receiptSignature=b.receiptSignature||''; }
  u.name=name; u.email=email; u.notes=String(b.notes??u.notes??'');
  audit(db,'UPDATE','PROFILE',u.id,u.name,'Updated profile settings'); writeDB(db); return NextResponse.json(sanitizeSelfUser(u));
 }catch(e){return NextResponse.json({error:e instanceof Error&&e.message==='UNAUTHORIZED'?'Unauthorized':'Request failed'},{status:e instanceof Error&&e.message==='UNAUTHORIZED'?401:500});}
}
export async function POST(req:Request){
 try{const user=await requireUser();if(!can(user,'manageProfile'))return NextResponse.json({error:'Forbidden'},{status:403});const b=await req.json();const current=s(b.currentPassword),next=s(b.newPassword);if(next.length<8)return NextResponse.json({error:'New password must be at least 8 characters.'},{status:400});const db=readDB();const u=db.users.find(x=>x.id===user.id);if(!u)return NextResponse.json({error:'User not found'},{status:404});if(!await verifyPassword(current,u.passwordHash))return NextResponse.json({error:'Current password is incorrect.'},{status:400});u.passwordHash=await bcrypt.hash(next,12);audit(db,'UPDATE','PASSWORD',u.id,u.name,'Changed own password');writeDB(db);return NextResponse.json({ok:true});}catch(e){return NextResponse.json({error:e instanceof Error&&e.message==='UNAUTHORIZED'?'Unauthorized':'Request failed'},{status:e instanceof Error&&e.message==='UNAUTHORIZED'?401:500});}
}
