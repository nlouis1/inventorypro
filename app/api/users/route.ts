import {NextResponse} from 'next/server';
import {hashPassword} from '@/lib/password';
import {readDB,writeDB,nextId,audit,auditChange,sanitizeUser} from '@/lib/db';
import {can,requireUser} from '@/lib/auth';
import {PRIVILEGES} from '@/lib/permissions';
import {email as validateEmail,password as validatePassword,readJson,requiredText,text} from '@/lib/validation';


function forbidden(){return NextResponse.json({error:'You do not have the required privilege to manage users.'},{status:403});}

export async function POST(req:Request){
 try{
  const actor=await requireUser();
  if(!can(actor,'manageUsers'))return forbidden();
  const b=await readJson<Record<string,unknown>>(req); const db=readDB();
  const name=requiredText(b.name,'Name',100), email=validateEmail(b.email), password=validatePassword(b.password);
  const role=requiredText(b.role,'Role',80), assignedStore=text(b.assignedStore,'Assigned store',80);
  if(!name||!email||!password||password.length<8||!role)
    return NextResponse.json({error:'Name, email, role and a password of at least 8 characters are required'},{status:400});
  if(!db.roles[role])return NextResponse.json({error:'Unknown role'},{status:400});
  if(actor.role!=='Admin' && role==='Admin')return NextResponse.json({error:'Only an Admin can assign the Admin role.'},{status:403});
  if(actor.role!=='Admin'){
    const target=db.roles[role]||{};
    const elevated=PRIVILEGES.find(p=>target[p]===true&&!can(actor,p));
    if(elevated)return NextResponse.json({error:`You cannot assign a role containing the ${elevated} privilege.`},{status:403});
  }
  if(assignedStore&&!db.stores.some(x=>x.id===assignedStore))return NextResponse.json({error:'Invalid assigned store'},{status:400});
  if(db.users.some(u=>u.email.toLowerCase()===email))return NextResponse.json({error:'Email already exists'},{status:409});
  const u={id:nextId('USR',db.users),name,email,passwordHash:hashPassword(password),role,status:'Active' as const,assignedStore};
  db.users.push(u); audit(db,'CREATE','USER',u.id,actor.name,`Created ${u.email} with role ${role}`);
  writeDB(db); return NextResponse.json(sanitizeUser(u),{status:201});
 }catch(e){
  return NextResponse.json({error:e instanceof Error&&e.name==='ValidationError'?e.message:e instanceof Error&&e.message==='UNAUTHORIZED'?'Unauthorized':'Request failed'},{status:e instanceof Error&&e.name==='ValidationError'?400:e instanceof Error&&e.message==='UNAUTHORIZED'?401:500});
 }
}

export async function PATCH(req:Request){
 try{
  const actor=await requireUser();
  if(!can(actor,'manageUsers'))return forbidden();
  const b=await readJson<Record<string,unknown>>(req); const db=readDB();
  const u=db.users.find(x=>x.id===text(b.id,'User ID',80));
  if(!u)return NextResponse.json({error:'User not found'},{status:404});

  const name=requiredText(b.name,'Name',100), email=validateEmail(b.email), role=requiredText(b.role,'Role',80);
  const assignedStore=text(b.assignedStore,'Assigned store',80);
  const status=String(b.status??'') as 'Active'|'Inactive';
  const password=b.password===undefined?'':String(b.password);

  if(!name||!email||!role)return NextResponse.json({error:'Name, email and role are required'},{status:400});
  if(!['Active','Inactive'].includes(status))return NextResponse.json({error:'Status must be Active or Inactive'},{status:400});
  if(!db.roles[role])return NextResponse.json({error:'Unknown role'},{status:400});
  if(u.role==='Admin' && actor.role!=='Admin')return NextResponse.json({error:'Only an Admin can modify an Admin account.'},{status:403});
  if(actor.role!=='Admin' && role==='Admin')return NextResponse.json({error:'Only an Admin can assign the Admin role.'},{status:403});
  if(actor.role!=='Admin'){
    const target=db.roles[role]||{};
    const elevated=PRIVILEGES.find(p=>target[p]===true&&!can(actor,p));
    if(elevated)return NextResponse.json({error:`You cannot assign a role containing the ${elevated} privilege.`},{status:403});
  }
  if(assignedStore&&!db.stores.some(x=>x.id===assignedStore))return NextResponse.json({error:'Invalid assigned store'},{status:400});
  if(db.users.some(x=>x.id!==u.id&&x.email.toLowerCase()===email))return NextResponse.json({error:'Email already exists'},{status:409});
  if(u.id===actor.id&&(status==='Inactive'||role!==actor.role))return NextResponse.json({error:'You cannot disable or change the role of your own account.'},{status:400});
  if(u.role==='Admin' && (status==='Inactive'||role!=='Admin') && db.users.filter(x=>x.role==='Admin'&&x.status==='Active').length<=1)return NextResponse.json({error:'The system must keep at least one active Admin account.'},{status:409});
  if(password) validatePassword(password,'Password');

  const old={name:u.name,email:u.email,role:u.role,status:u.status,assignedStore:u.assignedStore};
  u.name=name; u.email=email; u.role=role; u.status=status; u.assignedStore=assignedStore;
  if(password)u.passwordHash=hashPassword(password);

  auditChange(db,'UPDATE','USER',u.id,actor.name,`Updated ${u.email}${password?' and reset password':''}`,old,{name:u.name,email:u.email,role:u.role,status:u.status,assignedStore:u.assignedStore});
  writeDB(db); return NextResponse.json(sanitizeUser(u));
 }catch(e){
  return NextResponse.json({error:e instanceof Error&&e.name==='ValidationError'?e.message:e instanceof Error&&e.message==='UNAUTHORIZED'?'Unauthorized':'Request failed'},{status:e instanceof Error&&e.name==='ValidationError'?400:e instanceof Error&&e.message==='UNAUTHORIZED'?401:500});
 }
}
