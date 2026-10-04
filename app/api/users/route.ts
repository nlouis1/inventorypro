import {NextResponse} from 'next/server';
import bcrypt from 'bcryptjs';
import {readDB,writeDB,nextId,audit,auditChange,sanitizeUser} from '@/lib/db';
import {can,requireUser} from '@/lib/auth';

const s=(v:unknown)=>String(v??'').trim();

function forbidden(){return NextResponse.json({error:'You do not have the required privilege to manage users.'},{status:403});}

export async function POST(req:Request){
 try{
  const actor=await requireUser();
  if(!can(actor,'manageUsers'))return forbidden();
  const b=await req.json(); const db=readDB();
  const name=s(b.name), email=s(b.email).toLowerCase(), password=s(b.password);
  const role=s(b.role), assignedStore=s(b.assignedStore);
  if(!name||!email||!password||password.length<8||!role)
    return NextResponse.json({error:'Name, email, role and a password of at least 8 characters are required'},{status:400});
  if(!db.roles[role])return NextResponse.json({error:'Unknown role'},{status:400});
  if(assignedStore&&!db.stores.some(x=>x.id===assignedStore))return NextResponse.json({error:'Invalid assigned store'},{status:400});
  if(db.users.some(u=>u.email.toLowerCase()===email))return NextResponse.json({error:'Email already exists'},{status:409});
  const u={id:nextId('USR',db.users),name,email,passwordHash:await bcrypt.hash(password,12),role,status:'Active' as const,assignedStore};
  db.users.push(u); audit(db,'CREATE','USER',u.id,actor.name,`Created ${u.email} with role ${role}`);
  writeDB(db); return NextResponse.json(sanitizeUser(u),{status:201});
 }catch(e){
  return NextResponse.json({error:e instanceof Error&&e.message==='UNAUTHORIZED'?'Unauthorized':'Request failed'},{status:e instanceof Error&&e.message==='UNAUTHORIZED'?401:500});
 }
}

export async function PATCH(req:Request){
 try{
  const actor=await requireUser();
  if(!can(actor,'manageUsers'))return forbidden();
  const b=await req.json(); const db=readDB();
  const u=db.users.find(x=>x.id===s(b.id));
  if(!u)return NextResponse.json({error:'User not found'},{status:404});

  const name=s(b.name), email=s(b.email).toLowerCase(), role=s(b.role);
  const assignedStore=s(b.assignedStore);
  const status=s(b.status) as 'Active'|'Inactive';
  const password=s(b.password);

  if(!name||!email||!role)return NextResponse.json({error:'Name, email and role are required'},{status:400});
  if(!['Active','Inactive'].includes(status))return NextResponse.json({error:'Status must be Active or Inactive'},{status:400});
  if(!db.roles[role])return NextResponse.json({error:'Unknown role'},{status:400});
  if(assignedStore&&!db.stores.some(x=>x.id===assignedStore))return NextResponse.json({error:'Invalid assigned store'},{status:400});
  if(db.users.some(x=>x.id!==u.id&&x.email.toLowerCase()===email))return NextResponse.json({error:'Email already exists'},{status:409});
  if(u.id===actor.id&&status==='Inactive')return NextResponse.json({error:'You cannot disable your own account.'},{status:400});
  if(password && password.length<8)return NextResponse.json({error:'Password must be at least 8 characters when supplied'},{status:400});

  const old={name:u.name,email:u.email,role:u.role,status:u.status,assignedStore:u.assignedStore};
  u.name=name; u.email=email; u.role=role; u.status=status; u.assignedStore=assignedStore;
  if(password)u.passwordHash=await bcrypt.hash(password,12);

  auditChange(db,'UPDATE','USER',u.id,actor.name,`Updated ${u.email}${password?' and reset password':''}`,old,{name:u.name,email:u.email,role:u.role,status:u.status,assignedStore:u.assignedStore});
  writeDB(db); return NextResponse.json(sanitizeUser(u));
 }catch(e){
  return NextResponse.json({error:e instanceof Error&&e.message==='UNAUTHORIZED'?'Unauthorized':'Request failed'},{status:e instanceof Error&&e.message==='UNAUTHORIZED'?401:500});
 }
}
