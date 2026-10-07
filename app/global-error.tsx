'use client';
import {useEffect} from 'react';

export default function GlobalError({error,reset}:{error:Error & {digest?:string};reset:()=>void}){
  useEffect(()=>{console.error('InventoryPro HQ global client error:',error)},[error]);
  return <html><body><main style={{fontFamily:'system-ui,sans-serif',minHeight:'100vh',display:'grid',placeItems:'center',padding:24}}><section style={{maxWidth:620,width:'100%',border:'1px solid #ddd',borderRadius:12,padding:24}}><h1>InventoryPro HQ</h1><p>The application could not finish loading.</p><p style={{color:'#666'}}>{error?.message||'Unexpected application error.'}</p><div style={{display:'flex',gap:10}}><button onClick={()=>reset()}>Try again</button><button onClick={()=>location.reload()}>Reload application</button></div></section></main></body></html>;
}
