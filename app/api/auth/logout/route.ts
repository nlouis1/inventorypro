import {NextResponse} from 'next/server';import {clearSession,currentUser} from '@/lib/auth';import {readDB,writeDB,audit} from '@/lib/db';
export async function POST(){const user=await currentUser();if(user){const db=readDB();audit(db,'LOGOUT','USER',user.id,user.name,`Signed out ${user.email}`);writeDB(db);}await clearSession();return NextResponse.json({ok:true});}
