'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import { ProfileGuest } from '../../components/ProfileGuest'
import { ProfileLoggedIn } from '../../components/ProfileLoggedIn'
export default function ProfilePage(){const [userId,setUserId]=useState<string|null>(null);const [isStaff,setIsStaff]=useState(false);const [authOpen,setAuthOpen]=useState(false);useEffect(()=>{createClient().auth.getSession().then(({data})=>{const id=data.session?.user.id||null;setUserId(id);if(data.session)fetch('/api/profile-access',{headers:{Authorization:`Bearer ${data.session.access_token}`}}).then(r=>r.json()).then(value=>setIsStaff(value.isStaff===true))})},[]);return <main>{userId?<ProfileLoggedIn userId={userId} isStaff={isStaff} onSignOut={async()=>{await createClient().auth.signOut();setUserId(null)}}/>:<ProfileGuest onSignIn={()=>setAuthOpen(true)}/>} {authOpen&&<div className="fixed inset-0 z-50 grid place-items-center bg-black/80"><div className="glass p-6"><p className="text-xl font-bold">Sign in from the market header</p><button className="gold-btn mt-4" onClick={()=>setAuthOpen(false)}>Close</button></div></div>}</main>}
