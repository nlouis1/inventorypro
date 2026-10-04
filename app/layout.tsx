import './globals.css';
import type {Metadata} from 'next';
import {readDB} from '@/lib/db';
export function generateMetadata():Metadata{let name='InventoryPro HQ';try{name=readDB().settings?.systemName||name}catch{}return {title:name,description:`${name} inventory management system`}}
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
