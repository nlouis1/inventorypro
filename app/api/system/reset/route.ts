import {NextResponse} from 'next/server';
import {readDB,writeDB,createFreshDB} from '@/lib/db';
import {can,requireUser} from '@/lib/auth';

export async function POST(){
 try{
  const user=await requireUser();
  if(!can(user,'resetSystemData'))return NextResponse.json({error:'You do not have the required privilege to reset system data.'},{status:403});
  const db=readDB();
  const fresh=createFreshDB(db.users.find(u=>u.id===user.id)||user);
  writeDB(fresh);
  return NextResponse.json({ok:true,message:'System reset completed. Operational data, sessions and custom settings were cleared. Your administrator account and default roles were preserved.'});
 }catch(e){
  const status=e instanceof Error&&e.message==='UNAUTHORIZED'?401:e instanceof Error&&e.message==='FORBIDDEN'?403:500;
  return NextResponse.json({error:status===401?'Unauthorized':status===403?'Forbidden':'System reset failed'},{status});
 }
}
