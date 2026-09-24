/* MYCOGOLD LOCATION FIX V3.2 - Forces display even on github.io cache */
(function(){
  const DATA = {
    kericho: {name:"Kericho", county:"Kericho", type:"Main Hub", mush:255, button:265, oyster:180, potato:95, onion:105, beef:700, perf:92, tusk:88, vol:"High"},
    molo: {name:"Molo", county:"Nakuru", type:"Collection", mush:242, button:250, oyster:170, potato:85, onion:98, beef:690, perf:78, tusk:82, vol:"Med"},
    wakulima: {name:"Wakulima Market", county:"Nairobi", type:"Market", mush:310, button:320, oyster:195, potato:110, onion:115, beef:750, perf:95, tusk:94, vol:"V.High"},
    nakuru: {name:"Nakuru Town", county:"Nakuru", type:"Market", mush:270, button:280, oyster:185, potato:95, onion:105, beef:710, perf:84, tusk:86, vol:"High"},
    eldoret: {name:"Eldoret", county:"Uasin Gishu", type:"Collection", mush:235, button:245, oyster:165, potato:88, onion:100, beef:695, perf:76, tusk:79, vol:"Med"},
    kisumu: {name:"Kisumu", county:"Kisumu", type:"Market", mush:285, button:295, oyster:190, potato:102, onion:108, beef:720, perf:81, tusk:83, vol:"Med"}
  };

  function buildHTML(){
    let cards = Object.values(DATA).map(d=>{
      let sweet = d.mush>=155 && d.mush<=350 ? '★ SWEET 155-350' : 'OUTSIDE SWEET';
      let color = d.mush>=155 && d.mush<=350 ? '#FFD700' : '#ff6b6b';
      return `
      <div style="background:#151515;border:1px solid #2a2a2a;border-left:3px solid ${color};border-radius:12px;padding:12px;min-width:260px">
        <div style="display:flex;justify-content:space-between"><b>📍 ${d.name}</b><span style="font-size:10px;background:#222;padding:2px 6px;border-radius:8px">${d.type} • ${d.vol}</span></div>
        <div style="font-size:11px;color:#777">${d.county} • Band [150-600]</div>
        <div style="margin-top:8px;font-size:13px;line-height:1.7">
          <div style="display:flex;justify-content:space-between"><span>🍄 Mushroom Index</span><span style="color:${color};font-weight:800">${d.mush} KES</span></div>
          <div style="display:flex;justify-content:space-between"><span>🍄 Button</span><span style="color:#FFD700">${d.button} KES</span></div>
          <div style="display:flex;justify-content:space-between"><span>🍄 Oyster</span><span style="color:#FFD700">${d.oyster} KES</span></div>
          <div style="display:flex;justify-content:space-between"><span>🥔 Potatoes</span><span>${d.potato} KES</span></div>
          <div style="display:flex;justify-content:space-between"><span>🧅 Onions</span><span>${d.onion} KES</span></div>
          <div style="display:flex;justify-content:space-between"><span>🥩 Beef</span><span>${d.beef} KES</span></div>
        </div>
        <div style="margin-top:8px;font-size:11px">
          <div style="display:flex;justify-content:space-between"><span>Performance</span><span style="color:#00ff88">${d.perf}%</span></div>
          <div style="height:4px;background:#222;border-radius:2px;margin-top:2px"><div style="height:100%;width:${d.perf}%;background:linear-gradient(90deg,#FFD700,#00ff88)"></div></div>
          <div style="display:flex;justify-content:space-between;margin-top:4px"><span>TUSK Score</span><span>${d.tusk}% • ${sweet}</span></div>
          <div style="height:4px;background:#222;border-radius:2px;margin-top:2px"><div style="height:100%;width:${d.tusk}%;background:#00ccff"></div></div>
        </div>
      </div>`;
    }).join('');

    return `
    <div id="mfpi-location-forced" style="padding:16px;background:#0a0a0a;display:block !important;visibility:visible !important;min-height:400px">
      <div style="margin-bottom:12px">
        <h3 style="color:#FFD700;margin:0">📍 Locations • All Products Performance + Prizing + TUSK</h3>
        <div style="font-size:12px;color:#888">Mushroom Index Sweet [155-350] | Hard Bands [150-600] | Formula P(t+1)=P(t)+0.15*(252.5-P)+vol*CPRNG</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">${cards}</div>
      <div style="margin-top:14px;padding:10px;background:#111;border:1px solid #222;border-radius:10px;font-size:12px;color:#aaa">
        <b style="color:#fff">🧠 TUSK Overview - Light Speed</b><br/>
        • CPRNG: SHA256(state + time_ns + secrets) → -1 to +1 every 1s autonomous measurable<br/>
        • Mean Reversion: theta 0.15 to target 252.5 (midpoint 155-350)<br/>
        • Bollinger Clamp: 150 lower, 600 upper - never trades outside. Sweet zone gold highlight
      </div>
    </div>`;
  }

  function forceRender(){
    // Find ANY container that says Locations
    let targets = document.querySelectorAll('#location-content, [data-tab="location"], .locations-panel, main, #app, .content-area');
    let injected = false;
    // Try to find the empty dark area from your screenshot
    let empty = document.evaluate("//*[contains(text(),'Locations')]/following::*", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    
    // Direct inject: if Locations button clicked, replace next sibling
    const locBtn = Array.from(document.querySelectorAll('button, div')).find(b=>b.textContent && b.textContent.trim()==='Locations');
    if(locBtn){
      let parent = locBtn.closest('div')?.parentElement?.nextElementSibling || document.querySelector('.main-content') || document.body;
      // Create or replace
      let existing = document.getElementById('mfpi-location-forced');
      if(existing) existing.remove();
      let wrapper = document.createElement('div');
      wrapper.innerHTML = buildHTML();
      // Insert after network graph - your screenshot shows graph on top
      let graph = document.querySelector('canvas, .network-graph, [style*="yellow"]');
      if(graph && graph.parentElement) graph.parentElement.insertAdjacentElement('afterend', wrapper.firstElementChild);
      else document.body.appendChild(wrapper.firstElementChild);
      injected = true;
    }

    // Fallback: append to body
    if(!injected){
      if(!document.getElementById('mfpi-location-forced')){
        let w = document.createElement('div');
        w.innerHTML = buildHTML();
        document.body.appendChild(w.firstElementChild);
      }
    }
    console.log("MFPI Location Forced Rendered");
  }

  // Hook
  document.addEventListener('click', (e)=>{
    if(e.target.textContent && e.target.textContent.includes('Locations')){
      setTimeout(forceRender, 200);
    }
  });
  // Auto render after load
  window.addEventListener('load', ()=>{ setTimeout(forceRender, 1500); });
  setInterval(()=>{
    if(window.location.href.includes('location') || document.body.innerHTML.includes('Locations')){
      if(!document.getElementById('mfpi-location-forced')) forceRender();
    }
  }, 2000);

  // Expose
  window.renderLocationTab = forceRender;
})();
