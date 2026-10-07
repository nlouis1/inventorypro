import {redirect} from 'next/navigation';
import {currentUser,can} from '@/lib/auth';
import {PRIVILEGES} from '@/lib/permissions';
export default async function Home(){const user=await currentUser();if(!user){redirect('/login');return null;}const hasApplicationAccess=PRIVILEGES.some((priv)=>can(user,priv));redirect(hasApplicationAccess?'/dashboard':'/login');}
