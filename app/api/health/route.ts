import {NextResponse} from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import {readDB} from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const started = Date.now();
  const dataDir = process.env.INVENTORY_DATA_DIR || path.join(process.cwd(), 'data');
  const checks: Record<string, unknown> = {
    database: {ok:false},
    storage: {ok:false},
    sessionSecret: {ok:Boolean(process.env.SESSION_SECRET)},
  };
  try {
    const db = readDB();
    checks.database = {ok:true, users:db.users.length, items:db.items.length, transactions:db.transactions.length};
  } catch (error) {
    checks.database = {ok:false,error:error instanceof Error ? error.message : 'Database unavailable'};
  }
  try {
    fs.accessSync(dataDir, fs.constants.W_OK);
    checks.storage = {ok:true,path:dataDir};
  } catch {
    checks.storage = {ok:false,path:dataDir};
  }
  const ok = Boolean((checks.database as {ok?:boolean}).ok && (checks.storage as {ok?:boolean}).ok);
  return NextResponse.json({ok,status:ok?'healthy':'degraded',checks,uptimeSeconds:Math.round(process.uptime()),responseMs:Date.now()-started,node:process.version,environment:process.env.NODE_ENV||'development'},{status:ok?200:503,headers:{'Cache-Control':'no-store'}});
}
