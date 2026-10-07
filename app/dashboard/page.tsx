import {currentUser,can} from '@/lib/auth';
import {PRIVILEGES} from '@/lib/permissions';
import {redirect} from 'next/navigation';
import DashboardClient from '@/components/DashboardClient';
export default async function Dashboard(){
  const user=await currentUser();
  if(!user){redirect('/login');return null;}
  const hasApplicationAccess=PRIVILEGES.some((priv)=>can(user,priv));
  if(!hasApplicationAccess){redirect('/login');return null;}
  return <DashboardClient user={JSON.parse(JSON.stringify(user))}/>;
}
