export default function PremiumFeed({user}){
  if(!user) return <div style={{padding:20,textAlign:'center',marginTop:20,background:'#111',borderRadius:10}}><h3>🔒 Premium Feed Locked</h3><p>Login to see live orders, trust score, region, discounts, chat & place order</p><button style={{padding:'10px 20px',background:'#f5c518',border:'none',borderRadius:20}}>Login with Google</button></div>
  return (
    <div style={{padding:20}}>
      <h3>Live Listing Feed (X-style)</h3>
      <div style={{background:'#1a1a1a',padding:15,borderRadius:10,marginBottom:10}}>
        <b>Oyster 50kg @ 110 KES</b> <span style={{background:'#00ff88',color:'#000',padding:'2px 6px',borderRadius:10,fontSize:12}}>Trust 4.8</span><br/>
        Kericho | Discount -5% if 100kg | Live tick ●<br/>
        <button style={{marginTop:10}}>Chat Seller</button> <button>Place Order</button>
      </div>
    </div>
  )
}
