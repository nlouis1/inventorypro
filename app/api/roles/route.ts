import {NextResponse} from 'next/server';
import {readDB,writeDB,audit,auditChange} from '@/lib/db';
import {can,requireUser} from '@/lib/auth';
import {PRIVILEGES,normalizePermissions} from '@/lib/permissions';
import {readJson,requiredText,text} from '@/lib/validation';

export async function POST(req:Request){
 try{
  const user=await requireUser();
  if(!can(user,'manageRoles'))return NextResponse.json({error:'You do not have the required privilege to manage roles.'},{status:403});
  const b=await readJson<Record<string,unknown>>(req); const db=readDB(); const name=requiredText(b.name,'Role name',80);
  if(!name||db.roles[name])return NextResponse.json({error:'Role name unavailable'},{status:400});
  if(name.length>80)return NextResponse.json({error:'Role name is too long'},{status:400});
  const permissions=normalizePermissions(b.permissions as Record<string, boolean> | undefined);
  if(user.role!=='Admin'){
    const elevated=PRIVILEGES.find(p=>permissions[p]===true&&!can(user,p));
    if(elevated)return NextResponse.json({error:`You cannot grant the ${elevated} privilege because you do not hold it yourself.`},{status:403});
  }
  db.roles[name]=permissions;
  audit(db,'CREATE','ROLE',name,user.name,`Created role ${name} with ${PRIVILEGES.filter(p=>permissions[p]).length} privileges`);
  writeDB(db); return NextResponse.json(permissions,{status:201});
 }catch(e){
  return NextResponse.json({error:e instanceof Error&&e.name==='ValidationError'?e.message:e instanceof Error&&e.message==='UNAUTHORIZED'?'Unauthorized':'Request failed'},{status:e instanceof Error&&e.name==='ValidationError'?400:e instanceof Error&&e.message==='UNAUTHORIZED'?401:500});
 }
}

export async function PATCH(req:Request){
 try{
  const user=await requireUser();
  if(!can(user,'manageRoles'))return NextResponse.json({error:'You do not have the required privilege to manage roles.'},{status:403});
  const b=await readJson<Record<string,unknown>>(req); const oldName=String(b.name||'').trim(); const newName=String(b.newName??oldName).trim();
  const db=readDB();
  if(!oldName||!db.roles[oldName])return NextResponse.json({error:'Role not found'},{status:404});
  if(oldName==='Admin'&&user.role!=='Admin')return NextResponse.json({error:'Only an Admin can modify the Admin role.'},{status:403});
  if(!newName)return NextResponse.json({error:'Role name is required'},{status:400});
  if(newName!==oldName&&db.roles[newName])return NextResponse.json({error:'Role name already exists'},{status:409});
  if(['Admin'].includes(oldName)&&newName!=='Admin')return NextResponse.json({error:'The Admin role cannot be renamed.'},{status:400});
  const permissions=normalizePermissions(b.permissions as Record<string, boolean> | undefined);
  if(user.role!=='Admin'){const elevated=PRIVILEGES.find(p=>permissions[p]===true&&!can(user,p));if(elevated)return NextResponse.json({error:`You cannot grant the ${elevated} privilege because you do not hold it yourself.`},{status:403});}
  const before={name:oldName,permissions:db.roles[oldName]};
  db.roles[newName]=permissions;
  if(newName!==oldName)delete db.roles[oldName];
  for(const u of db.users)if(u.role===oldName)u.role=newName;
  auditChange(db,'UPDATE','ROLE',newName,user.name,`Updated role ${oldName}${newName!==oldName?` → ${newName}`:''}`,before,{name:newName,permissions});
  writeDB(db); return NextResponse.json({name:newName,permissions});
 }catch(e){
  return NextResponse.json({error:e instanceof Error&&e.name==='ValidationError'?e.message:e instanceof Error&&e.message==='UNAUTHORIZED'?'Unauthorized':'Request failed'},{status:e instanceof Error&&e.name==='ValidationError'?400:e instanceof Error&&e.message==='UNAUTHORIZED'?401:500});
 }
}

export async function DELETE(req:Request){
 try{
  const user=await requireUser();
  if(!can(user,'manageRoles'))return NextResponse.json({error:'You do not have the required privilege to manage roles.'},{status:403});
  const b=await readJson<Record<string,unknown>>(req); const name=requiredText(b.name,'Role name',80); const db=readDB();
  if(!name||!db.roles[name])return NextResponse.json({error:'Role not found'},{status:404});
  if(name==='Admin')return NextResponse.json({error:'The Admin role cannot be deleted.'},{status:400});
  const assigned=db.users.filter((u:any)=>u.role===name);
  if(assigned.length>0)return NextResponse.json({error:`Role ${name} is assigned to ${assigned.length} user${assigned.length===1?'':'s'} and cannot be deleted. Reassign those users first.`},{status:409});
  delete db.roles[name];
  auditChange(db,'DELETE','ROLE',name,user.name,`Deleted unassigned role ${name}`,{name,permissions:null},{name:null,permissions:null});
  writeDB(db); return NextResponse.json({deleted:true,name});
 }catch(e){
  return NextResponse.json({error:e instanceof Error&&e.name==='ValidationError'?e.message:e instanceof Error&&e.message==='UNAUTHORIZED'?'Unauthorized':'Request failed'},{status:e instanceof Error&&e.name==='ValidationError'?400:e instanceof Error&&e.message==='UNAUTHORIZED'?401:500});
 }
}
