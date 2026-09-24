const TICKER_BOUNDS = {
  "Mushroom": {icon:"🍄", floor:150, premium:600, sweet:"155-350", mean:252.5},
  "Onions": {icon:"🧅", floor:60, premium:160},
  "Potatoes": {icon:"🥔", floor:47, premium:170},
  "Beef": {icon:"🥩", floor:600, premium:809},
  "Oyster": {icon:"🍄", floor:150, premium:600, sweet:"155-350"},
  "Button": {icon:"🍄", floor:150, premium:600, sweet:"155-350"}
};
function renderMfpiTicker(liveState) {
  const bar = document.getElementById('mfpi-ticker') || document.querySelector('.mfpi-ticker-bar');
  if(!bar) return;
  bar.innerHTML=''; bar.className='mfpi-ticker-bar';
  Object.entries(liveState).forEach(([product, price])=>{
    const b = TICKER_BOUNDS[product] || {icon:"•", floor:0, premium:9999};
    const pct = ((price-b.floor)/(b.premium-b.floor)*100).toFixed(0);
    const inSweet = product.includes("Mushroom") || product=="Oyster" || product=="Button"? (price>=155 && price<=350) : true;
    const item=document.createElement('div');
    item.className='ticker-item';
    item.style.borderColor = inSweet? "#FFD700" : "#222";
    item.innerHTML=`
      <div class="ticker-product"><span>${b.icon}</span> ${product}</div>
      <div class="ticker-price" style="color:${inSweet? '#FFD700' : '#aaa'}">${price} <small>KES</small></div>
      <div class="ticker-boll">${b.floor}-${b.premium} ${b.sweet?`★ ${b.sweet}`:''} • ${pct}%</div>
    `;
    item.onclick=()=>{ if(window.filterByProduct) filterByProduct(product); };
    item.style.cursor='pointer';
    bar.appendChild(item);
  });
}
function hookTickerToPvt(){
  const demo={Mushroom:255, Onions:100, Potatoes:95, Oyster:180, Button:260, Beef:702};
  renderMfpiTicker(demo);
  setInterval(async()=>{
    try{
      const res=await fetch('/MYCOGOLD.FRONT/mushroom_index.json');
      if(res.ok){
        const j=await res.json();
        if(j.live){
          renderMfpiTicker({Mushroom:j.live.MUSHROOM, Onions:j.live.ONIONS, Potatoes:j.live.POTATOES, Oyster:j.live.MUSHROOM_OYSTER, Button:j.live.MUSHROOM_BUTTON});
        }
      }
    }catch(e){}
  },1000);
}
document.addEventListener('DOMContentLoaded', hookTickerToPvt);
