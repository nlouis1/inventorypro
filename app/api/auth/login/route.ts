import {NextResponse} from 'next/server';
import {readDB,writeDB,sanitizeUser,audit} from '@/lib/db';
import {createSession,verifyPassword} from '@/lib/auth';
import {email as validateEmail,password as validatePassword,readJson} from '@/lib/validation';

export async function POST(req:Request){
  try{
    const body=await readJson<Record<string,unknown>>(req);
    const email=validateEmail(body.email);
    const password=String(body.password??'');
    if(!password||password.length>128)return NextResponse.json({error:'Password is required and cannot exceed 128 characters.'},{status:400});
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
    return NextResponse.json({error:error instanceof Error&&error.name==='ValidationError'?error.message:'Unable to sign in. Check the server configuration.'},{status:error instanceof Error&&error.name==='ValidationError'?400:500});
  }
}
