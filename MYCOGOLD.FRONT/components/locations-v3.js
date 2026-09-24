/* MYCOGOLD V3.0.0 TPilot - Native Locations Tab - No hard force */
(function(){
  const DATA_URL = "MYCOGOLD.FRONT/data/locations.json";
  let LOCS = null;

  async function loadData(){
    try{
      const r = await fetch(DATA_URL);
      if(r.ok){ LOCS = await r.json(); return LOCS; }
    }catch(e){}
    // fallback inline
    LOCS = {
      mushroom_index:{sweet:[155,350],bands:[150,600],target:252.5,mfpi:109.92},
      hubs:[
        {id:"kericho",name:"Kericho",county:"Kericho",type:"Main Hub",mush:255,button:265,oyster:180,potatoes:95,onions:105,beef:700,perf:92,tusk:88,vol:"High"},
        {id:"molo",name:"Molo",county:"Nakuru",type:"Collection",mush:242,button:250,oyster:170,potatoes:85,onions:98,beef:690,perf:78,tusk:82,vol:"Med"},
        {id:"wakulima",name:"Wakulima Market",county:"Nairobi",type:"Market",mush:310,button:320,oyster:195,potatoes:110,onions:115,beef:750,perf:95,tusk:94,vol:"V.High"},
        {id:"nakuru",name:"Nakuru Town",county:"Nakuru",type:"Market",mush:270,button:280,oyster:185,potatoes:95,onions:105,beef:710,perf:84,tusk:86,vol:"High"},
        {id:"eldoret",name:"Eldoret",county:"Uasin Gishu",type:"Collection",mush:235,button:245,oyster:165,potatoes:88,onions:100,beef:695,perf:76,tusk:79,vol:"Med"},
        {id:"kisumu",name:"Kisumu",county:"Kisumu",type:"Market",mush:285,button:295,oyster:190,potatoes:102,onions:108,beef:720,perf:81,tusk:83,vol:"Med"}
      ]
    };
    return LOCS;
  }

  function renderNative(){
    const data = LOCS;
    if(!data) return;

    // Find native Locations container - from your screenshot it's the dark area below graph
    // Try multiple selectors that exist in your current index.html
    let container = document.getElementById('locations-container')
                 || document.querySelector('[data-view="locations"]')
                 || document.querySelector('#locations-panel')
                 || document.querySelector('.locations-content');

    // If not found, find the h3/element that says "Locations" and use its parent as container
    if(!container){
      const locHeading = Array.from(document.querySelectorAll('h2,h3,div')).find(el=>el.textContent.trim()==='Locations' && el.getBoundingClientRect().left>250);
      if(locHeading){
        // create sibling container right after heading
        let existing = document.getElementById('locations-native');
        if(existing) container = existing;
        else {
          container = document.createElement('div');
          container.id = 'locations-native';
          locHeading.parentElement.appendChild(container);
        }
      }
    }
    if(!container) return;

    const cards = data.hubs.map(h=>{
      const isSweet = h.mush>=155 && h.mush<=350;
      return `
      <div style="background:#151515;border:1px solid #222;border-left:3px solid ${isSweet?'#FFD700':'#00ff88'};border-radius:12px;padding:12px">
        <div style="display:flex;justify-content:space-between"><b>📍 ${h.name}</b><span style="font-size:10px;background:#222;padding:2px 6px;border-radius:8px">${h.type} • ${h.vol}</span></div>
        <div style="font-size:11px;color:#777">${h.county} • Band [150-600] • Sweet [155-350]</div>
        <div style="margin-top:8px;font-size:13px;line-height:1.7">
          <div style="display:flex;justify-content:space-between"><span>🍄 Mushroom Index</span><span style="color:#FFD700;font-weight:800">${h.mush} KES ${isSweet?'★':''}</span></div>
          <div style="display:flex;justify-content:space-between"><span>🍄 Button</span><span>${h.button} KES</span></div>
          <div style="display:flex;justify-content:space-between"><span>🍄 Oyster</span><span>${h.oyster} KES</span></div>
          <div style="display:flex;justify-content:space-between"><span>🥔 Potatoes</span><span>${h.potatoes} KES</span></div>
          <div style="display:flex;justify-content:space-between"><span>🧅 Onions</span><span>${h.onions} KES</span></div>
          <div style="display:flex;justify-content:space-between"><span>🥩 Beef</span><span>${h.beef} KES</span></div>
        </div>
        <div style="margin-top:8px;font-size:11px;color:#aaa">
          <div style="display:flex;justify-content:space-between"><span>Performance</span><span style="color:#00ff88">${h.perf}%</span></div>
          <div style="height:4px;background:#222;border-radius:2px"><div style="height:100%;width:${h.perf}%;background:linear-gradient(90deg,#FFD700,#00ff88)"></div></div>
          <div style="display:flex;justify-content:space-between;margin-top:4px"><span>TUSK</span><span>${h.tusk}%</span></div>
          <div style="height:4px;background:#222;border-radius:2px"><div style="height:100%;width:${h.tusk}%;background:#00ccff"></div></div>
        </div>
      </div>`;
    }).join('');

    container.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;margin-top:12px">
        ${cards}
      </div>
      <div style="margin-top:14px;padding:10px;background:#111;border:1px solid #222;border-radius:10px;font-size:11px;color:#888">
        <b style="color:#fff">🧠 TUSK Overview V3.0.0 TPilot</b><br/>
        MFPI ${data.mushroom_index.mfpi} • Sweet ${data.mushroom_index.sweet.join('-')} KES • Bands ${data.mushroom_index.bands.join('-')} KES • Target ${data.mushroom_index.target} • Formula P(t+1)=P(t)+0.15*(252.5-P)+vol*CPRNG • Light-speed SHA256
      </div>
    `;
    container.style.display='block';
    console.log("MYCOGOLD V3.0.0 TPilot Locations native rendered");
  }

  // Hook into existing tab system - wait for Locations click
  async function init(){
    await loadData();
    // render if Locations tab already active (your screenshot shows active)
    setTimeout(renderNative, 500);
    document.addEventListener('click', (e)=>{
      if(e.target.textContent && e.target.textContent.includes('Locations')){
        setTimeout(renderNative, 400);
      }
    });
    // observe tab changes
    const obs = new MutationObserver(()=>{ 
      const locActive = document.querySelector('button.active, div.active, [class*="active"]')?.textContent?.includes('Locations');
      if(locActive) renderNative();
    });
    obs.observe(document.body, {childList:true, subtree:true});
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.MYCOGOLD_LocationsV3 = {renderNative, loadData};
})();
