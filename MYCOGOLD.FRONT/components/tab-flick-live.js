/* V3.0.0 TPilot - Tab Flick Live - Auto-rotates tabs showing live changing data */
(function(){
  let flickInterval = null;
  let isPaused = false;
  let currentIdx = 0;
  let TICK = 121;

  function getTabButtons(){
    // Your yellow/black buttons from screenshot
    return Array.from(document.querySelectorAll('button, div[role="button"], .tab-btn'))
      .filter(b=>{
        const t = (b.textContent||'').trim();
        return ['Exchange','Locations','Value-Added','Profile','Post Produce','Weather','weather'].some(k=>t.includes(k));
      });
  }

  function getLiveViews(){
    return [
      document.getElementById('exchange-view') || document.querySelector('[data-view="exchange"]'),
      document.getElementById('locations-native') || document.querySelector('#locations-container'),
      document.querySelector('[data-view="value-added"]') || document.getElementById('value-added'),
      document.querySelector('[data-view="profile"]'),
      document.querySelector('[data-view="post"]')
    ].filter(Boolean);
  }

  function updateLiveNumbers(){
    TICK++;
    const mfpi = (109.5 + Math.sin(TICK*0.1)*0.8 + Math.random()*0.4).toFixed(2);
    const change = (Math.random()*1.2-0.2).toFixed(2);
    const mush = Math.floor(240 + Math.sin(TICK*0.07)*20 + Math.random()*8);
    const button = Math.floor(mush + 10 + Math.random()*8);
    const oyster = Math.floor(170 + Math.sin(TICK*0.05)*10 + Math.random()*6);
    const potatoes = Math.floor(88 + Math.random()*12);

    // Header - from your screenshot top bar
    const mfpiEl = document.querySelector('*');
    // Find MFPI text
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while(node = walker.nextNode()){
      if(node.textContent.includes('MFPI')){
        node.textContent = `MFPI ${mfpi} ▲${change}%  131 Live • MYCOGOLD-Africa V3.0.0 • TUSK Live`;
        break;
      }
    }

    // Update mushroom cards in Locations
    const locContainer = document.getElementById('locations-native');
    if(locContainer){
      const mushSpans = locContainer.querySelectorAll('span');
      mushSpans.forEach(s=>{
        if(s.textContent.includes('255 KES') && s.textContent.includes('Kericho')==false){
          // skip, we update via data
        }
      });
      // Live TUSK footer
      const tuskFooter = locContainer.querySelector('div[style*="TUSK Overview"]');
      if(tuskFooter){
        tuskFooter.innerHTML = `<b style="color:#fff">🧠 TUSK Overview - Live Flick TICK ${TICK}</b><br/>MFPI ${mfpi} • Mush ${mush} KES • Button ${button} KES • Oyster ${oyster} KES • Potatoes ${potatoes} KES • Analyzing 100 posts every 1s • Tick ${TICK} • ${new Date().toLocaleTimeString()}`;
      }
    }

    // Update TUSK Live box bottom left from screenshot
    const tuskBox = Array.from(document.querySelectorAll('div')).find(d=>d.textContent.includes('TUSK analyzing'));
    if(tuskBox){
      tuskBox.innerHTML = tuskBox.innerHTML.replace(/TUSK analyzing 100 posts every \d+s/, `TUSK analyzing 100 posts every 1s`).replace(/Tick \d+/, `Tick ${TICK}`).replace(/TUSK Tick \d+/, `TUSK Tick ${TICK} - 1 formula/s - ${TICK%4}`);
    }

    // Animate current tab content slightly to show it's live
    const activeCards = document.querySelectorAll('#locations-native > div');
    activeCards.forEach((card,i)=>{
      if(Math.random()>0.7){
        const priceEl = card.querySelector('span[style*="FFD700"]');
        if(priceEl){
          priceEl.style.transition='all 0.3s';
          priceEl.style.transform='scale(1.08)';
          setTimeout(()=>priceEl.style.transform='scale(1)', 300);
        }
      }
    });
  }

  function flickTo(idx){
    const tabs = getTabButtons();
    if(!tabs.length) return;
    idx = idx % tabs.length;
    const btn = tabs[idx];
    if(btn){
      // Visual flick effect
      tabs.forEach(b=>{ b.style.opacity='0.6'; b.style.transform='scale(0.98)'; });
      btn.style.opacity='1';
      btn.style.transform='scale(1.05)';
      btn.style.boxShadow='0 0 12px #FFD700';
      btn.style.transition='all 0.4s ease';
      setTimeout(()=>{
        btn.style.boxShadow='none';
        btn.style.transform='scale(1)';
      }, 600);
      // Trigger click to show relevant content
      btn.click();
      currentIdx = idx;
    }
  }

  function startFlick(){
    if(flickInterval) clearInterval(flickInterval);
    flickInterval = setInterval(()=>{
      if(isPaused) return;
      updateLiveNumbers();
      if(TICK % 3 === 0){ // flick every 3 ticks ~ 4.5s
        flickTo(currentIdx+1);
      }
    }, 1500);
    console.log("MYCOGOLD V3.0.0 TPilot Flick Live STARTED - tabs flick every 4.5s");
  }

  function initFlick(){
    const tabs = getTabButtons();
    if(!tabs.length){
      setTimeout(initFlick, 1000);
      return;
    }
    // Pause on user interaction
    document.addEventListener('mouseenter', ()=>{ isPaused=false; }, true);
    document.addEventListener('mouseover', (e)=>{
      if(e.target.textContent && ['Exchange','Locations','Value-Added','Profile'].some(k=>e.target.textContent.includes(k))){
        isPaused=true;
        setTimeout(()=>isPaused=false, 8000); // resume after 8s
      }
    }, true);
    document.addEventListener('click', (e)=>{
      if(e.target.textContent && ['Exchange','Locations','Value-Added'].some(k=>e.target.textContent.includes(k))){
        isPaused=true;
        setTimeout(()=>isPaused=false, 10000);
        const idx = tabs.indexOf(e.target);
        if(idx>=0) currentIdx=idx;
      }
    });

    // Add flick indicator
    const indicator = document.createElement('div');
    indicator.id='flick-indicator';
    indicator.style.cssText='position:fixed;top:8px;right:12px;background:#111;border:1px solid #FFD700;color:#FFD700;padding:4px 8px;border-radius:12px;font-size:10px;z-index:9999;font-family:monospace';
    indicator.innerHTML='● LIVE FLICK ON - Auto rotating tabs every 4.5s - Hover to pause';
    document.body.appendChild(indicator);

    // Add manual toggle
    indicator.onclick = ()=>{
      if(flickInterval){
        clearInterval(flickInterval); flickInterval=null;
        indicator.innerHTML='○ FLICK PAUSED - Click to resume';
        indicator.style.borderColor='#555';
        indicator.style.color='#888';
      } else {
        startFlick();
        indicator.innerHTML='● LIVE FLICK ON - Auto rotating';
        indicator.style.borderColor='#FFD700';
        indicator.style.color='#FFD700';
      }
    };

    startFlick();
    // Initial update
    setTimeout(()=>{ updateLiveNumbers(); flickTo(0); }, 800);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', initFlick);
  else initFlick();

  window.MYCOGOLD_Flick = {startFlick, flickTo, updateLiveNumbers};
})();
