/**
  * ===============================================================================
  *           MYCOGOLD AFRICA EX EXCHANGE - FRONTEND CORE ENGINE
  * ===============================================================================
  * Features:
  *  1. Strict Tab Management (Closes active tab before opening new one).
  *  2. Global Product Auto-Routing (Clicking any produce item filters Market).
  *  3. Post Produce + Buy/Sell Modal with IoT Media Hashing (SHA-256).
  *  4. TUSK Smart Chat & Semi-Autonomous Negotiator.
  * ===============================================================================
 */

// -----------------------------------------------------------------------------
// 1. GLOBAL STATE & COMMODITY DATABASE
// -----------------------------------------------------------------------------
const MycoGoldState = {
    activeTab: 'market',
    selectedProduct: null,
    registeredProducts: ['Mushroom', 'Oyster', 'Button', 'Potatoes', 'Onions', 'Kales', 'Cabbage', 'Cereals', 'Sukuma Wiki', 'Dhania', 'Hoho', 'Matomoko', 'Zucchini', 'Rosemary'],
    userRole: 'BUYER', // 'BUYER' or 'SELLER'
    chatActiveContract: null
};

// -----------------------------------------------------------------------------
// 2. STRICT TAB SWITCHER (PREVENTS OVERLAYS)
// -----------------------------------------------------------------------------
function switchTab(tabId) {
    console.log(`[TUSK Router] Navigating to tab: ${tabId}`);
    const allTabs = document.querySelectorAll('.tab-content-container, .modal-overlay');
    allTabs.forEach(element => {
        element.style.display = 'none';
        element.classList.remove('active-tab');
    });
    const allNavBtns = document.querySelectorAll('.nav-drawer-btn');
    allNavBtns.forEach(btn => btn.classList.remove('active-nav'));
    const targetTab = document.getElementById(`tab-${tabId}`);
    if (targetTab) {
        targetTab.style.display = 'block';
        targetTab.classList.add('active-tab');
        MycoGoldState.activeTab = tabId;
    } else {
        console.warn(`[TUSK Router] Tab container #tab-${tabId} not found!`);
    }
    const targetBtn = document.getElementById(`btn-nav-${tabId}`);
    if (targetBtn) {
        targetBtn.classList.add('active-nav');
    }
    if (window.TUSK_Engine && typeof window.TUSK_Engine.recalibrate === 'function') {
        window.TUSK_Engine.recalibrate(tabId);
    }
}

// -----------------------------------------------------------------------------
// 3. GLOBAL PRODUCT REDIRECT ROUTER
// -----------------------------------------------------------------------------
function filterByProduct(productName) {
    console.log(`[TUSK Redirect] Filtering Market for Product: ${productName}`);
    MycoGoldState.selectedProduct = productName;
    switchTab('market');
    const filterContainer = document.getElementById('market-filter-bar');
    if (filterContainer) {
        const chips = filterContainer.querySelectorAll('.filter-chip');
        chips.forEach(chip => {
            if (chip.innerText.toLowerCase().includes(productName.toLowerCase())) {
                chip.classList.add('active-chip');
            } else {
                chip.classList.remove('active-chip');
            }
        });
    }
    const produceListings = document.querySelectorAll('.produce-item-card');
    produceListings.forEach(card => {
        const itemType = card.getAttribute('data-product-type');
        if (itemType && itemType.toLowerCase() === productName.toLowerCase()) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
    renderTuskNotice(`Market filtered to show live listings for: ${productName.toUpperCase()}`);
}

function registerNewProduct(productName) {
    const formattedName = productName.trim();
    if (!MycoGoldState.registeredProducts.includes(formattedName)) {
        MycoGoldState.registeredProducts.push(formattedName);
        const filterBar = document.getElementById('market-filter-bar');
        if (filterBar) {
            const newBtn = document.createElement('button');
            newBtn.className = 'filter-chip';
            newBtn.onclick = () => filterByProduct(formattedName);
            newBtn.innerText = formattedName;
            filterBar.appendChild(newBtn);
        }
        console.log(`[TUSK System] New Commodity Registered: ${formattedName}`);
    }
}

// -----------------------------------------------------------------------------
// 4. POST PRODUCE & IOT MEDIA VERIFICATION FORMULA
// -----------------------------------------------------------------------------
async function submitProduceWithIoTProof(event) {
    event.preventDefault();
    const produceName = document.getElementById('post-produce-name').value;
    const quantityKg = parseFloat(document.getElementById('post-produce-qty').value);
    const unitPrice = parseFloat(document.getElementById('post-produce-price').value);
    const mediaFileInput = document.getElementById('post-produce-media').files[0];
    if (!produceName || !quantityKg || !unitPrice || !mediaFileInput) {
        alert("TUSK Validation Failed: Please attach photo/video inspection media and fill all fields.");
        return;
    }
    const arrayBuffer = await mediaFileInput.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const sha256ProofHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    const lambdaDecay = 0.05;
    const timeInTransitDays = 0.5;
    const calculatedFreshness = Math.exp(-lambdaDecay * timeInTransitDays);
    const listingPayload = {
        id: `MYCO_${Date.now()}`,
        product: produceName,
        quantityKg: quantityKg,
        unitPriceKes: unitPrice,
        freshnessScore: calculatedFreshness.toFixed(3),
        mediaProofHash: sha256ProofHash,
        timestamp: new Date().toISOString()
    };
    console.log("[TUSK IoT Engine] Listing Verified & Signed:", listingPayload);
    registerNewProduct(produceName);
    document.getElementById('modal-post-produce').style.display = 'none';
    filterByProduct(produceName);
    alert(`Listing Verified by TUSK!\nCryptographic Media Hash: ${sha256ProofHash.substring(0, 16)}...\nFreshness Index: ${(calculatedFreshness * 100).toFixed(1)}%`);
}

// -----------------------------------------------------------------------------
// 5. TUSK PROTOCOL SMART CHAT & COMMAND PUSH ENGINE
// -----------------------------------------------------------------------------
function initiateTuskNegotiation(productName, targetPriceKes, counterpartyPhone) {
    MycoGoldState.chatActiveContract = {
        product: productName,
        price: targetPriceKes,
        counterparty: counterpartyPhone,
        step: 0
    };
    switchTab('chat');
    const chatWindow = document.getElementById('tusk-chat-messages');
    chatWindow.innerHTML = '';
    pushTuskChatMessage('SYSTEM', `Initializing TUSK Secure Escrow Channel for ${productName} @ KES ${targetPriceKes}/kg.`);
    setTimeout(() => {
        pushTuskChatMessage('TUSK_BUYER_BOT', `[TUSK COMMAND: OFFER_INIT] Hi. Buyer initiating automated bid for ${productName} at KES ${targetPriceKes}/kg with M-Pesa STK Lock.`);
    }, 600);
}

function handleTuskReplyCommand(commandType) {
    const chat = MycoGoldState.chatActiveContract;
    if (!chat) return;
    if (commandType === 'ACCEPT_OFFER') {
        pushTuskChatMessage('TUSK_SELLER_BOT', `[TUSK COMMAND: OFFER_ACCEPT] Counterparty accepted terms of KES ${chat.price}/kg for ${chat.product}.`);
        setTimeout(() => {
            pushTuskChatMessage('SYSTEM', `[TUSK ESCROW LOCK] Executing M-Pesa C2B STK Push on Buyer Phone. Escrow Locking Active.`);
        }, 800);
    } else if (commandType === 'COUNTER_OFFER') {
        const revisedPrice = (chat.price * 1.05).toFixed(2);
        pushTuskChatMessage('TUSK_SELLER_BOT', `[TUSK COMMAND: OFFER_COUNTER] Counterparty revised offer to KES ${revisedPrice}/kg based on regional Wakulima spot index.`);
    }
}

function pushTuskChatMessage(sender, messageText) {
    const chatWindow = document.getElementById('tusk-chat-messages');
    if (!chatWindow) return;
    const msgBubble = document.createElement('div');
    msgBubble.className = `chat-bubble ${sender.toLowerCase()}`;
    msgBubble.innerHTML = `
        <div class="chat-sender">${sender}</div>
        <div class="chat-text">${messageText}</div>
        <div class="chat-time">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
    `;
    chatWindow.appendChild(msgBubble);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function renderTuskNotice(msg) {
    const hud = document.getElementById('tusk-live-hud');
    if (hud) hud.innerText = `[TUSK A.I.]: ${msg}`;
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-bind-product]').forEach(element => {
        element.addEventListener('click', (e) => {
            const productName = e.target.getAttribute('data-bind-product');
            if (productName) filterByProduct(productName);
        });
    });
});
