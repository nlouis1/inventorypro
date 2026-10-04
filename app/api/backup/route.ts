import {NextResponse} from 'next/server';
import {readDB,backupPayload} from '@/lib/db';
import {can,requireUser} from '@/lib/auth';

export async function GET(){
 try{
  const user=await requireUser();
  if(!can(user,'backupSystem'))return NextResponse.json({error:'You do not have the required privilege to create system backups.'},{status:403});
  const payload=backupPayload(readDB());
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  return new Response(JSON.stringify(payload,null,2),{headers:{'Content-Type':'application/json; charset=utf-8','Content-Disposition':`attachment; filename="inventorypro-full-backup-${stamp}.json"`,'Cache-Control':'no-store'}});
 }catch(e){
  const status=e instanceof Error&&e.message==='UNAUTHORIZED'?401:e instanceof Error&&e.message==='FORBIDDEN'?403:500;
  return NextResponse.json({error:status===401?'Unauthorized':status===403?'Forbidden':'Backup failed'},{status});
 }
}
