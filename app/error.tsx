'use client';
import {useEffect} from 'react';

export default function Error({error,reset}:{error:Error & {digest?:string};reset:()=>void}){
 useEffect(()=>{console.error('InventoryPro HQ client error:',error)},[error]);
 return <main className="auth"><div className="auth-card"><h1>InventoryPro HQ</h1><p className="error">The application encountered an unexpected error while loading.</p><p className="muted">Refresh the application and try again. Your saved data is not deleted by this error.</p><div className="toolbar"><button className="primary" onClick={()=>reset()}>Try again</button><button className="secondary" onClick={()=>location.reload()}>Reload application</button></div></div></main>
}
