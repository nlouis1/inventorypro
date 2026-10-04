import {NextResponse} from 'next/server';
import {readDB,writeDB} from '@/lib/db';
import {hashPassword} from '@/lib/password';

export async function POST(req:Request){
  if(process.env.NODE_ENV==='production') return NextResponse.json({error:'Disabled in production'},{status:404});
  if(req.headers.get('x-reset-key')!=='inventorypro-local-reset') return NextResponse.json({error:'Not found'},{status:404});
  const db=readDB();
  const user=db.users.find(u=>u.email.toLowerCase()==='alex.admin@inventory.io');
  if(!user) return NextResponse.json({error:'Demo administrator not found'},{status:404});
  user.status='Active';
  user.passwordHash=hashPassword('password');
  writeDB(db);
  return NextResponse.json({ok:true});
}
