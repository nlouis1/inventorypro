import {currentUser,can} from '@/lib/auth';
import {redirect} from 'next/navigation';
import DashboardClient from '@/components/DashboardClient';
export default async function Dashboard(){const user=await currentUser();if(!user){redirect('/login');return null;}if(!can(user,'viewDashboard')){redirect('/login');return null;}return <DashboardClient user={JSON.parse(JSON.stringify(user))}/>}
