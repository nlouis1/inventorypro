import {NextResponse} from 'next/server';
import {readDB,writeDB,auditChange} from '@/lib/db';
import {can,requireUser} from '@/lib/auth';
import {readJson,text as validateText,imageDataUrl} from '@/lib/validation';
const CURRENCIES=['RWF','USD','EUR','GBP','KES','UGX','TZS','ZAR','NGN','JPY','CNY'];

export async function GET(){
  try{
    const user=await requireUser();
    const db=readDB();
    const canProfile=can(user,'manageProfile');
    const canManage=can(user,'manageSettings');
    const canBackup=can(user,'backupSystem');
    const canReset=can(user,'resetSystemData');
    const hasSettingsAccess=canProfile||canManage||canBackup||canReset;
    if(!hasSettingsAccess) return NextResponse.json({error:'You do not have any Settings privilege.'},{status:403});
    const response:any={
      sections:{profile:canProfile,system:canManage,backup:canBackup,reset:canReset},
    };
    // Return only data belonging to sections the caller is actually allowed to see.
    // Sensitive system configuration is only returned to manageSettings users.
    if(canManage){
      response.system={
        currency:db.settings?.currency||'RWF',
        systemName:db.settings?.systemName||'InventoryPro HQ',
        logoDataUrl:db.settings?.logoDataUrl||'',
        taxRate:db.settings?.taxRate,
        currencies:CURRENCIES,
      };
    }
    response.profile={allowed:canProfile};
    response.backup={allowed:canBackup};
    response.reset={allowed:canReset};
    return NextResponse.json(response,{headers:{'Cache-Control':'no-store'}});
  }catch(e){return NextResponse.json({error:e instanceof Error&&e.message==='UNAUTHORIZED'?'Unauthorized':'Request failed'},{status:e instanceof Error&&e.message==='UNAUTHORIZED'?401:500});}
}

export async function PATCH(req:Request){
  try{
    const user=await requireUser();
    if(!can(user,'manageSettings')) return NextResponse.json({error:'You do not have permission to manage system Settings.'},{status:403});
    const b=await readJson<Record<string,unknown>>(req);
    const db=readDB();
    const currency=String(b.currency??db.settings?.currency??'RWF').trim().toUpperCase();
    if(!CURRENCIES.includes(currency))return NextResponse.json({error:'Unsupported currency.'},{status:400});
    const systemName=validateText(b.systemName??db.settings?.systemName??'InventoryPro HQ','System name',80);
    if(!systemName||systemName.length>80)return NextResponse.json({error:'System name must be between 1 and 80 characters.'},{status:400});
    const logoDataUrl=imageDataUrl(b.logoDataUrl??db.settings?.logoDataUrl??'','Logo',2_000_000,'png|jpe?g|webp|svg\\+xml');
    const rawTaxRate=b.taxRate!==undefined?b.taxRate:db.settings?.taxRate;
    const taxRate=rawTaxRate===undefined||rawTaxRate===null?undefined:Number(rawTaxRate);
    if(taxRate!==undefined&&(!Number.isFinite(taxRate)||taxRate<0||taxRate>100))return NextResponse.json({error:'Tax rate must be between 0 and 100 percent.'},{status:400});
    const before={currency:db.settings?.currency||'RWF',systemName:db.settings?.systemName||'InventoryPro HQ',logoConfigured:Boolean(db.settings?.logoDataUrl),taxRate:db.settings?.taxRate};
    db.settings={...db.settings,currency,systemName,logoDataUrl,taxRate};
    auditChange(db,'UPDATE','SETTINGS','branding',user.name,'Updated system branding, currency and tax rate',before,{currency,systemName,logoConfigured:Boolean(logoDataUrl),taxRate});
    writeDB(db);
    return NextResponse.json({currency,systemName,logoDataUrl,taxRate},{headers:{'Cache-Control':'no-store'}});
  }catch(e){return NextResponse.json({error:e instanceof Error&&e.name==='ValidationError'?e.message:e instanceof Error&&e.message==='UNAUTHORIZED'?'Unauthorized':'Request failed'},{status:e instanceof Error&&e.name==='ValidationError'?400:e instanceof Error&&e.message==='UNAUTHORIZED'?401:500});}
}
