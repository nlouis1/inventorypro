import {NextResponse} from 'next/server';
import {readDB,writeDB,sanitizeUser,audit} from '@/lib/db';
import {createSession,verifyPassword} from '@/lib/auth';

export async function POST(req:Request){
  try{
    const body=await req.json();
    const email=String(body.email??'').trim().toLowerCase();
    const password=String(body.password??'');
    if(!email||!password)return NextResponse.json({error:'Email and password are required'},{status:400});
    const db=readDB();
    const user=db.users.find(u=>u.email.trim().toLowerCase()===email);
    if(!user)return NextResponse.json({error:'Invalid email or password'},{status:401});
    if(user.status!=='Active')return NextResponse.json({error:'This account is inactive. Contact an administrator.'},{status:403});
    const valid=await verifyPassword(password,user.passwordHash);
    if(!valid)return NextResponse.json({error:'Invalid email or password'},{status:401});
    await createSession(user.id);
    const auditDB=readDB();audit(auditDB,'LOGIN','USER',user.id,user.name,`Successful sign in by ${user.email}`);writeDB(auditDB);
    return NextResponse.json({ok:true,user:sanitizeUser(user)});
  }catch(error){
    console.error('Login error:',error);
    return NextResponse.json({error:'Unable to sign in. Check the server configuration.'},{status:500});
  }
}
