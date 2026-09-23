import { useEffect, useState } from 'react'
export default function MFPIHeader(){
  const [price,setPrice]=useState(104.55)
  const [change,setChange]=useState(2.3)
  useEffect(()=>{
    const i=setInterval(()=>{
      setPrice(p=>+(p+(Math.random()-0.5)*0.3).toFixed(2))
      setChange((Math.random()*4-1).toFixed(1))
    },1000)
    return ()=>clearInterval(i)
  },[])
  return (
    <div style={{position:'sticky',top:0,zIndex:99,background:'#0a0a0a',color:'#fff',padding:'10px 20px',display:'flex',justifyContent:'space-between',borderBottom:'2px solid #f5c518'}}>
      <div><b>MYCOGOLD MFPI</b> <span style={{color:'#f5c518'}}>World First</span></div>
      <div>{price} KES <span style={{color: change>0?'#00ff88':'#ff4444'}}>{change>0?'▲':'▼'} {change}%</span> <span style={{fontSize:10,opacity:0.7}}>LIVE</span></div>
    </div>
  )
}
