import {cookies} from 'next/headers';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import {readDB,writeDB,User,cleanupSessions} from './db';
import {verifyScryptPassword} from './password';
import type {Privilege} from './permissions';

export const cookieName='inventorypro_session';
const sessionHours=12;
function sessionSecret(){const secret=process.env.SESSION_SECRET;if(process.env.NODE_ENV==='production'&&!secret)throw new Error('SESSION_SECRET is required in production');return secret||'local-development-only-change-me';}
function tokenHash(token:string){return crypto.createHmac('sha256',sessionSecret()).update(token).digest('hex');}
export async function createSession(userId:string){const db=readDB();cleanupSessions(db);const raw=crypto.randomBytes(32).toString('base64url');const id=tokenHash(raw);const now=new Date();db.sessions!.push({id,userId,createdAt:now.toISOString(),expiresAt:new Date(now.getTime()+sessionHours*3600000).toISOString()});writeDB(db);(await cookies()).set(cookieName,raw,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production' && process.env.INVENTORY_DESKTOP!=='1',maxAge:sessionHours*3600,path:'/'});}
export async function clearSession(){const jar=await cookies();const raw=jar.get(cookieName)?.value;if(raw){const db=readDB();db.sessions=(db.sessions||[]).filter(s=>s.id!==tokenHash(raw));writeDB(db);}jar.delete(cookieName);}
export async function currentUser():Promise<User|null>{const raw=(await cookies()).get(cookieName)?.value;if(!raw)return null;const db=readDB();cleanupSessions(db);const session=db.sessions!.find(s=>s.id===tokenHash(raw)&&Date.parse(s.expiresAt)>Date.now());if(!session)return null;return db.users.find(u=>u.id===session.userId&&u.status==='Active')||null;}
export async function requireUser(){const u=await currentUser();if(!u)throw new Error('UNAUTHORIZED');return u;}
export async function verifyPassword(password:string,hash:string){if(verifyScryptPassword(password,hash))return true;if(hash.startsWith('$2a$')||hash.startsWith('$2b$')||hash.startsWith('$2y$'))return bcrypt.compare(password,hash);return false;}
export function can(user:User,permission:Privilege|string){const db=readDB();return db.roles[user.role]?.[permission]===true;}

export async function requirePrivilege(permission:Privilege){
 const user=await requireUser();
 if(!can(user,permission))throw new Error('FORBIDDEN');
 return user;
}
