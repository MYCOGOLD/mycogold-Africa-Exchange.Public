/**
 * MYCOGOLD Header Ticker - Product sits respective on price - Good UI
 * Fixes: Onions / 100 KES aligned vertically
 */
const TICKER_BOUNDS = {
  "Onions": {icon:"🧅", floor:60, premium:160},
  "Mushroom": {icon:"🍄", floor:100, premium:350},
  "Oyster": {icon:"🍄", floor:70, premium:200},
  "Button": {icon:"🍄", floor:90, premium:320},
  "Potatoes": {icon:"🥔", floor:47, premium:170},
  "Beef": {icon:"🥩", floor:600, premium:809},
  "Kales": {icon:"🥬", floor:20, premium:80},
  "Cabbage": {icon:"🥬", floor:25, premium:95}
};

function renderMfpiTicker(liveState) {
  // liveState = {Onions:100, Mushroom:69...} from your MYCOGOLD.PVT
  const bar = document.getElementById('mfpi-ticker') || document.querySelector('.mfpi-ticker-bar');
  if(!bar) return;
  bar.innerHTML = '';
  bar.className = 'mfpi-ticker-bar';

  Object.entries(liveState).forEach(([product, price]) => {
    const bounds = TICKER_BOUNDS[product] || {icon:"•", floor:0, premium:9999};
    const pct = ((price - bounds.floor)/(bounds.premium-bounds.floor)*100).toFixed(0);
    const item = document.createElement('div');
    item.className = 'ticker-item';
    item.innerHTML = `
      <div class="ticker-product"><span>${bounds.icon}</span> ${product}</div>
      <div class="ticker-price">${price} <small style="font-size:10px">KES</small></div>
      <div class="ticker-boll">${bounds.floor}-${bounds.premium} • ${pct}%</div>
    `;
    // Click filters market - your global product router
    item.onclick = () => { if(window.filterByProduct) filterByProduct(product); };
    item.style.cursor = 'pointer';
    bar.appendChild(item);
  });
}

// Auto hook to your LIVE_MARKET_STATE from PVT
function hookTickerToPvt() {
  if(window.LIVE_MARKET_STATE) renderMfpiTicker(window.LIVE_MARKET_STATE);
  // Simulate live from backend json if available
  const demo = {Onions:100, Mushroom:69, Oyster:95, Button:94, Potatoes:95, Beef:702, Kales:45, Cabbage:50};
  renderMfpiTicker(demo);

  // Live update every 1s - TUSK light-speed dots
  setInterval(async () => {
    try {
      const res = await fetch('/MYCOGOLD.FRONT/quant_core_essential.json');
      if(res.ok){
        const j = await res.json();
        if(j.sample_ticks){
          const state={};
          j.sample_ticks.forEach(t=> state[t.commodity.replace('MUSHROOM_','').replace('_',' ')] = t.spot_price_kes);
          // Keep names matching your UI
          const mapped = {Onions: state.ONIONS||100, Mushroom: state.TOTAL||69, Oyster: state.OYSTER||95, Button: state.BUTTON||94};
          renderMfpiTicker(mapped);
        }
      }
    } catch(e){ /* keep demo */ }
  }, 1000);
}

document.addEventListener('DOMContentLoaded', hookTickerToPvt);
