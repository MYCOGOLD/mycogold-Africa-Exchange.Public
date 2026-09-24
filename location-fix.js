/* MYCOGOLD LOCATION FIX V3.3 REFINED - Direct Heading Target Injection - SAME BOUNDS KEPT */
(function(){
  const DATA = {
    kericho: {name:"Kericho", county:"Kericho", type:"Main Hub", mush:155, button:225, oyster:120, potato:95, onion:105, beef:700, perf:92, tusk:88, vol:"High"},
    molo: {name:"Molo", county:"Nakuru", type:"Collection", mush:145, button:180, oyster:110, potato:85, onion:98, beef:690, perf:78, tusk:82, vol:"Med"},
    wakulima: {name:"Wakulima Market", county:"Nairobi", type:"Market", mush:210, button:280, oyster:160, potato:110, onion:115, beef:750, perf:95, tusk:94, vol:"V.High"},
    nakuru: {name:"Nakuru Town", county:"Nakuru", type:"Market", mush:165, button:240, oyster:130, potato:95, onion:105, beef:710, perf:84, tusk:86, vol:"High"},
    eldoret: {name:"Eldoret", county:"Uasin Gishu", type:"Collection", mush:140, button:190, oyster:105, potato:88, onion:100, beef:695, perf:76, tusk:79, vol:"Med"},
    kisumu: {name:"Kisumu", county:"Kisumu", type:"Market", mush:175, button:250, oyster:140, potato:102, onion:108, beef:720, perf:81, tusk:83, vol:"Med"}
  };

  function buildHTML(){
    let cards = Object.values(DATA).map(d=>{
      let isSweet = d.mush>=140 && d.mush<=170;
      let sweet = isSweet ? '★ SWEET 140-170' : 'BOUNDED RANGE';
      let color = isSweet ? '#FFD700' : '#00ff88';
      let boll = ((d.mush-100)/(350-100)*100).toFixed(0); // Floor 100 Premium 350 for TOTAL
      return `
      <div style="background:#151515;border:1px solid #2a2a2a;border-left:3px solid ${color};border-radius:12px;padding:12px;min-width:250px;cursor:pointer" onclick="window.filterByLocation&&filterByLocation('${d.name}')">
        <div style="display:flex;justify-content:space-between;align-items:center"><b>📍 ${d.name}</b><span style="font-size:10px;background:#222;padding:2px 6px;border-radius:8px">${d.type} • ${d.vol}</span></div>
        <div style="font-size:11px;color:#777;margin-top:2px">${d.county} • Floor 100 • Boll ${boll}% • Band [150-600]</div>
        <div style="margin-top:8px;font-size:13px;line-height:1.7">
          <div style="display:flex;justify-content:space-between"><span>🍄 Mushroom Total</span><span style="color:${color};font-weight:800">${d.mush} KES</span></div>
          <div style="display:flex;justify-content:space-between"><span>🍄 Button <small style="color:#888">Floor 90</small></span><span style="color:#FFD700">${d.button} KES</span></div>
          <div style="display:flex;justify-content:space-between"><span>🍄 Oyster <small style="color:#888">Floor 70</small></span><span style="color:#FFD700">${d.oyster} KES</span></div>
          <div style="display:flex;justify-content:space-between"><span>🥔 Potatoes</span><span>${d.potato} KES</span></div>
          <div style="display:flex;justify-content:space-between"><span>🧅 Onions</span><span>${d.onion} KES</span></div>
          <div style="display:flex;justify-content:space-between"><span>🥩 Beef</span><span>${d.beef} KES</span></div>
        </div>
        <div style="margin-top:8px;font-size:11px">
          <div style="display:flex;justify-content:space-between"><span>Performance</span><span style="color:#00ff88">${d.perf}%</span></div>
          <div style="height:4px;background:#222;border-radius:2px;margin-top:2px"><div style="height:100%;width:${d.perf}%;background:linear-gradient(90deg,#FFD700,#00ff88)"></div></div>
          <div style="display:flex;justify-content:space-between;margin-top:4px"><span>TUSK Score</span><span>${d.tusk}% • ${sweet}</span></div>
          <div style="height:4px;background:#222;border-radius:2px;margin-top:2px"><div style="height:100%;width:${d.tusk}%;background:linear-gradient(90deg,#00ccff,#FFD700)"></div></div>
        </div>
      </div>`;
    }).join('');

    return `
    <div id="mfpi-location-forced" style="padding:16px;background:#0a0a0a;display:block !important;visibility:visible !important;margin-top:15px;border-radius:12px;border:1px solid #222;min-height:200px">
      <div style="margin-bottom:12px">
        <h3 style="color:#FFD700;margin:0;font-size:15px">📍 Hub Performance & Dynamic Commodity Collars</h3>
        <div style="font-size:11px;color:#888;margin-top:4px">Mushroom Floor 100 KES | Button Floor 90 KES | Oyster Floor 70 KES | Sweet [155-350] | Bands [150-600] | Autonomous CPRNG TUSK Active</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px">${cards}</div>
      <div style="margin-top:12px;padding:8px;background:#111;border-radius:8px;font-size:10px;color:#666">Formula: P(t+1)=P(t)+0.15*(252.5-P)+vol*CPRNG • Clamped [150,600] • Light-speed observable • ${new Date().toLocaleTimeString()}</div>
    </div>`;
  }

  function forceRender(){
    // Prevent duplicate
    let existing = document.getElementById('mfpi-location-forced');
    if(existing && existing.offsetHeight>100) return;

    // Find the REAL Locations heading in main area (not sidebar button)
    let headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,div,span'))
      .filter(el => el.childElementCount===0 && el.textContent.trim()==='Locations');
    // If not exact, look for contains but in main content (left > 200px)
    if(headings.length===0){
      headings = Array.from(document.querySelectorAll('*'))
        .filter(el => el.children.length===0 && el.textContent.includes('Locations') && el.getBoundingClientRect().left>250);
    }
    let mainHeading = headings[0];
    if(!mainHeading){
      // fallback: find by icon
      mainHeading = document.querySelector('[style*="yellow"]')?.parentElement || document.querySelector('.main-content') || document.body;
    }

    if(mainHeading){
      if(existing) existing.remove();
      let wrapper = document.createElement('div');
      wrapper.innerHTML = buildHTML();
      // Insert right after the Locations label
      mainHeading.insertAdjacentElement('afterend', wrapper.firstElementChild);
      console.log("MFPI Location Rendered below heading - REFINED");
      return true;
    }
    return false;
  }

  // REFINED triggers
  window.addEventListener('DOMContentLoaded', ()=>setTimeout(forceRender, 800));
  window.addEventListener('load', ()=>{ setTimeout(forceRender, 1000); setTimeout(forceRender, 2500); });
  document.addEventListener('click', (e)=>{
    if(e.target.textContent && e.target.textContent.includes('Locations')){
      setTimeout(forceRender, 300);
      setTimeout(forceRender, 800);
    }
  });
  setInterval(forceRender, 3000);
  window.renderLocationTab = forceRender;
})();
