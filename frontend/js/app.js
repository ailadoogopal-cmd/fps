/**
 * KisanLakshmi Main Application Orchestrator
 * Controls Routing, UI State, Modals, Multi-Language, 2G Low-Data Mode,
 * Direct Farmer Contact, Bulk Orders, Dispute Mediation, & Admin Panel
 */
const App = {
    currentSection: 'home',
    currentLanguage: 'en',
    lowDataMode: false,

    translations: {
        en: {
            slogan: "Where Farmers Meet Buyers Directly",
            mandiTitle: "KISANLAKSHMI MANDI FEED:",
            navHome: "Home",
            navMandi: "📊 Mandi & Forecast",
            navFarmer: "🌾 Farmer Dashboard",
            navBuyer: "🏢 Buyer Marketplace",
            navAdmin: "⚙️ Admin Panel",
            navCommunity: "💬 Community Q&A",
            navSchemes: "🏛️ Govt Schemes",
            bulkBtn: "Bulk Orders",
            voiceBtn: "बोलकर चलाएं"
        },
        hi: {
            slogan: "जहाँ किसान सीधे खरीदार से मिलते हैं",
            mandiTitle: "किसान लक्ष्मी लाइव मंडी भाव:",
            navHome: "होम",
            navMandi: "📊 मंडी भाव व पूर्वानुमान",
            navFarmer: "🌾 किसान डैशबोर्ड",
            navBuyer: "🏢 खरीदार बाज़ार",
            navAdmin: "⚙️ एडमिन पैनल",
            navCommunity: "💬 किसान चौपाल",
            navSchemes: "🏛️ सरकारी योजनाएं",
            bulkBtn: "थोक ऑर्डर",
            voiceBtn: "बोलकर चलाएं"
        },
        pa: {
            slogan: "ਜਿੱਥੇ ਕਿਸਾਨ ਸਿੱਧੇ ਖਰੀਦਦਾਰਾਂ ਨੂੰ ਮਿਲਦੇ ਹਨ",
            mandiTitle: "ਕਿਸਾਨ ਲਕਸ਼ਮੀ ਲਾਈਵ ਮੰਡੀ ਭਾਅ:",
            navHome: "ਹੋਮ",
            navMandi: "📊 ਮੰਡੀ ਭਾਅ ਤੇ ਅਨੁਮਾਨ",
            navFarmer: "🌾 ਕਿਸਾਨ ਡੈਸ਼ਬੋਰਡ",
            navBuyer: "🏢 ਖਰੀਦਦਾਰ ਮੰਡੀ",
            navAdmin: "⚙️ ਐਡਮਿਨ ਪੈਨਲ",
            navCommunity: "💬 ਕਿਸਾਨ ਚੌਪਾਲ",
            navSchemes: "🏛️ ਸਰਕਾਰੀ ਸਕੀਮਾਂ",
            bulkBtn: "ਥੋਕ ਆਰਡਰ",
            voiceBtn: "ਬੋਲ ਕੇ ਚਲਾਓ"
        }
    },

    init: async function () {
        console.log("🌾 Initializing KisanLakshmi Platform...");
        
        Auth.init();
        KrishiVoice.init();
        await Market.init();
        await Buyer.init();
        await Alerts.init();
        await Community.init();
        await Schemes.init();
        Chatbot.init();
        
        if (Auth.currentUser) {
            this.updateGatedView(true);
            if (Auth.currentUser.role === 'seller') {
                await Seller.init();
                this.showSection('seller-dashboard');
            } else if (Auth.currentUser.role === 'buyer') {
                await Buyer.init();
                this.showSection('buyer-dashboard');
            } else if (Auth.currentUser.role === 'admin') {
                this.showSection('admin');
            }
        } else {
            this.updateGatedView(false);
            this.showSection('auth-portal');
        }

        await this.loadGlobalStats();
        this.setupEventListeners();
    },

    updateGatedView: function (isLoggedIn) {
        const liveTicker = document.getElementById('mandi-ticker-content');
        const tickerLockedBadge = document.getElementById('ticker-locked-badge');
        const headerNav = document.getElementById('header-main-nav');
        const chatbotBtn = document.getElementById('floating-chatbot-btn');
        const voiceNavBtn = document.getElementById('global-voice-nav-btn');

        if (isLoggedIn) {
            if (liveTicker) Market.renderTicker();
            if (tickerLockedBadge) tickerLockedBadge.classList.add('hidden');
            if (headerNav) headerNav.classList.remove('hidden');
            if (chatbotBtn) chatbotBtn.classList.remove('hidden');
            if (voiceNavBtn) voiceNavBtn.classList.remove('hidden');
        } else {
            if (liveTicker) {
                liveTicker.innerHTML = `<span class="text-amber-300 font-semibold flex items-center gap-1.5"><i class="fa-solid fa-lock"></i> 🔒 Live Mandi Feeds & Analytics are Protected — Please register or login below to view real-time prices & trading dashboards.</span>`;
            }
            if (tickerLockedBadge) tickerLockedBadge.classList.remove('hidden');
            if (headerNav) headerNav.classList.add('hidden');
            if (chatbotBtn) chatbotBtn.classList.add('hidden');
            if (voiceNavBtn) voiceNavBtn.classList.remove('hidden');
        }
    },

    loadGlobalStats: async function () {
        try {
            const res = await fetch('/api/stats');
            const data = await res.json();
            if (data.success) {
                const s = data.stats;
                const elFarmers = document.getElementById('stat-registered-farmers');
                const elBuyers = document.getElementById('stat-registered-buyers');
                const elVolume = document.getElementById('stat-active-volume');
                const elTrades = document.getElementById('stat-total-trades');
                const elLoans = document.getElementById('stat-disbursed-loans');

                if (elFarmers) elFarmers.textContent = `${s.registered_farmers.toLocaleString()}+`;
                if (elBuyers) elBuyers.textContent = `${s.registered_buyers.toLocaleString()}+`;
                if (elVolume) elVolume.textContent = `${s.active_volume_quintals.toLocaleString()} Q`;
                if (elTrades) elTrades.textContent = `₹${s.total_traded_value_inr.toLocaleString()}`;
                if (elLoans) elLoans.textContent = `₹${s.warehouse_loans_disbursed_inr.toLocaleString()}`;

                document.querySelectorAll('.portal-stat-farmers').forEach(el => el.textContent = `${s.registered_farmers.toLocaleString()}+`);
                document.querySelectorAll('.portal-stat-buyers').forEach(el => el.textContent = `${s.registered_buyers.toLocaleString()}+`);
                document.querySelectorAll('.portal-stat-volume').forEach(el => el.textContent = `${s.active_volume_quintals.toLocaleString()} Q`);
                document.querySelectorAll('.portal-stat-trades').forEach(el => el.textContent = `₹${s.total_traded_value_inr.toLocaleString()}`);
            }
        } catch (e) {
            console.error("Error loading stats:", e);
        }
    },

    showSection: function (sectionId) {
        if (!Auth.currentUser && sectionId !== 'auth-portal') {
            this.showToast("🔒 Please register or login first to view live mandi feeds and dashboards", "warning");
            sectionId = 'auth-portal';
        }

        this.currentSection = sectionId;
        
        const sections = [
            'section-auth-portal',
            'section-home',
            'section-mandi',
            'section-seller-dashboard',
            'section-buyer-dashboard',
            'section-orders',
            'section-roadmap',
            'section-community',
            'section-schemes',
            'section-admin'
        ];
        sections.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });

        const target = document.getElementById(`section-${sectionId}`);
        if (target) {
            target.classList.remove('hidden');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        document.querySelectorAll('.nav-link').forEach(link => {
            const linkTarget = link.getAttribute('data-target');
            if (linkTarget === sectionId) {
                link.classList.add('nav-tab-active', 'text-green-700', 'font-bold');
                link.classList.remove('text-slate-600');
            } else {
                link.classList.remove('nav-tab-active', 'text-green-700', 'font-bold');
                link.classList.add('text-slate-600');
            }
        });

        if (sectionId === 'orders') {
            this.refreshOrdersView();
        } else if (sectionId === 'seller-dashboard' && Auth.currentUser && Auth.currentUser.role === 'seller') {
            Seller.init();
        } else if (sectionId === 'buyer-dashboard' && Auth.currentUser && Auth.currentUser.role === 'buyer') {
            Buyer.loadBuyerData();
        } else if (sectionId === 'admin') {
            if (window.Admin) Admin.loadOverview();
        }
    },

    navigateToDashboard: function (role) {
        if (!Auth.currentUser) {
            this.showSection('auth-portal');
            return;
        }
        if (role === 'seller') {
            this.showSection('seller-dashboard');
        } else if (role === 'admin') {
            this.showSection('admin');
        } else {
            this.showSection('buyer-dashboard');
        }
    },

    setLanguage: function(lang) {
        this.currentLanguage = lang;
        ['en', 'hi', 'pa'].forEach(l => {
            const btn = document.getElementById(`lang-btn-${l}`);
            if (btn) {
                if (l === lang) {
                    btn.className = "flex-1 py-2 rounded-xl text-xs font-black bg-green-600 text-white shadow-xs transition-all";
                } else {
                    btn.className = "flex-1 py-2 rounded-xl text-xs font-black bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all";
                }
            }
        });

        const dict = this.translations[lang] || this.translations.en;
        document.querySelectorAll('header p, footer p.text-green-300').forEach(el => {
            if (el.textContent.includes("Farmers Meet") || el.textContent.includes("सीधे खरीदार") || el.textContent.includes("ਖਰੀਦਦਾਰਾਂ")) {
                el.textContent = dict.slogan;
            }
        });
        const liveTitle = document.getElementById('ticker-live-title');
        if (liveTitle) liveTitle.textContent = dict.mandiTitle;

        const navHome = document.querySelector('button[data-target="home"]');
        if (navHome) navHome.textContent = dict.navHome;
        const navMandi = document.querySelector('button[data-target="mandi"]');
        if (navMandi) navMandi.textContent = dict.navMandi;
        const navFarmer = document.getElementById('nav-dashboard-seller');
        if (navFarmer) navFarmer.textContent = dict.navFarmer;
        const navBuyer = document.getElementById('nav-dashboard-buyer');
        if (navBuyer) navBuyer.textContent = dict.navBuyer;
        const navAdmin = document.getElementById('nav-dashboard-admin');
        if (navAdmin) navAdmin.textContent = dict.navAdmin;
        const navComm = document.querySelector('button[data-target="community"]');
        if (navComm) navComm.textContent = dict.navCommunity;
        const navSchemes = document.querySelector('button[data-target="schemes"]');
        if (navSchemes) navSchemes.textContent = dict.navSchemes;

        this.showToast(`🌐 Language switched to ${lang === 'hi' ? 'हिंदी (Hindi)' : (lang === 'pa' ? 'ਪੰਜਾਬੀ (Punjabi)' : 'English')}`, "info");
    },

    toggleLowDataMode: function() {
        this.lowDataMode = !this.lowDataMode;
        document.body.classList.toggle('low-data-mode', this.lowDataMode);
        const btn = document.getElementById('btn-low-data');
        const label = document.getElementById('low-data-label');
        if (this.lowDataMode) {
            if (btn) btn.className = "px-2.5 py-1.5 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 border border-amber-600 flex items-center gap-1 transition-all shadow-sm";
            if (label) label.textContent = "2G Active";
            this.showToast("⚡ 2G Low-Data Mode Activated! High-resolution background graphics minimized for lightning-fast loading.", "success");
        } else {
            if (btn) btn.className = "px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center gap-1 transition-all";
            if (label) label.textContent = "2G Fast";
            this.showToast("Standard Ultra-HD Mode Restored.", "info");
        }
    },

    openDirectContactModal: function(sellerName, phone, cropInfo, listingId) {
        const nameEl = document.getElementById('contact-farmer-name');
        const cropEl = document.getElementById('contact-crop-info');
        if (nameEl) nameEl.textContent = sellerName || 'Verified Farmer';
        if (cropEl) cropEl.textContent = cropInfo || 'Fresh Produce Lot';

        const cleanPhone = (phone || '9876543210').replace(/\D/g, '');
        const callBtn = document.getElementById('contact-call-btn');
        const waBtn = document.getElementById('contact-wa-btn');
        const chatBtn = document.getElementById('contact-chat-btn');

        if (callBtn) callBtn.href = `tel:+91${cleanPhone}`;
        if (waBtn) {
            const msg = encodeURIComponent(`Hello ${sellerName || 'Farmer'}, I saw your ${cropInfo} listing on KisanLakshmi platform and want to discuss direct procurement.`);
            waBtn.href = `https://wa.me/91${cleanPhone}?text=${msg}`;
        }
        if (chatBtn) {
            chatBtn.onclick = () => {
                App.closeModal('modal-contact-farmer');
                if (window.Chatbot) {
                    Chatbot.openChat();
                    Chatbot.addSystemMessage(`Connecting to direct farmer line with ${sellerName} (${cropInfo})... Type your query below.`);
                }
            };
        }
        App.openModal('modal-contact-farmer');
    },

    submitBulkOrderInquiry: async function(e) {
        if (e) e.preventDefault();
        const buyer_name = document.getElementById('bulk-buyer-name')?.value || Auth.currentUser?.name || 'Commercial Buyer';
        const business_type = document.getElementById('bulk-business-type')?.value || 'Wholesale Trader / Restaurant';
        const commodity = document.getElementById('bulk-commodity')?.value || 'Wheat';
        const quantity_quintals = parseFloat(document.getElementById('bulk-quantity')?.value) || 100;
        const target_price = parseFloat(document.getElementById('bulk-target-price')?.value) || 0;
        const delivery_location = document.getElementById('bulk-location')?.value || 'Indore Mandi';
        const phone = document.getElementById('bulk-phone')?.value || Auth.currentUser?.phone || '9876543210';
        const requirements = document.getElementById('bulk-requirements')?.value || 'Bulk wholesale consignment required with lab assay certificate.';

        try {
            App.showToast("Submitting wholesale procurement inquiry to KisanLakshmi desk...", "info");
            const res = await fetch('/api/bulk-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    buyer_id: Auth.currentUser ? Auth.currentUser.id : 3,
                    buyer_name,
                    business_type,
                    commodity,
                    quantity_quintals,
                    target_price,
                    delivery_location,
                    phone,
                    requirements
                })
            });
            const data = await res.json();
            if (data.success) {
                App.showToast(`🎉 ${data.message} Reference: ${data.inquiry_ref}`, "success");
                App.closeModal('modal-bulk-order');
            } else {
                App.showToast(data.error || "Inquiry submission failed", "error");
            }
        } catch(err) {
            App.showToast("Error communicating with wholesale server", "error");
        }
    },

    openDisputeModal: function(orderId) {
        const idField = document.getElementById('dispute-order-id');
        if (idField) idField.value = orderId;
        App.openModal('modal-raise-dispute');
    },

    submitDispute: async function(e) {
        if (e) e.preventDefault();
        const order_id = parseInt(document.getElementById('dispute-order-id')?.value);
        const reason = document.getElementById('dispute-reason-select')?.value || 'Quality Mismatch';
        const description = document.getElementById('dispute-desc-input')?.value || 'Produce did not match NABL laboratory moisture & purity specifications.';

        try {
            App.showToast("Freezing escrow funds & filing dispute mediation case...", "info");
            const res = await fetch('/api/disputes/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    order_id,
                    raised_by_id: Auth.currentUser ? Auth.currentUser.id : 3,
                    reason,
                    description
                })
            });
            const data = await res.json();
            if (data.success) {
                App.showToast(`⚠️ ${data.message} Escrow payout has been paused.`, "warning");
                App.closeModal('modal-raise-dispute');
                if (Auth.currentUser?.role === 'buyer') await Buyer.loadBuyerData();
                else if (Auth.currentUser?.role === 'seller') await Seller.loadSellerData();
            } else {
                App.showToast(data.error || "Failed to submit dispute", "error");
            }
        } catch(err) {
            App.showToast("Error connecting to dispute desk", "error");
        }
    },

    openAuthModal: function (role = 'seller', authType = 'mobile') {
        Auth.setRole(role);
        Auth.setAuthType(authType);
        this.openModal('modal-auth');
    },

    closeAuthModal: function () {
        this.closeModal('modal-auth');
    },

    openModal: function (modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            document.body.style.overflow = 'hidden';
        }
    },

    closeModal: function (modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            document.body.style.overflow = 'auto';
        }
    },

    showToast: function (message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        let icon = '<i class="fa-solid fa-info-circle text-blue-500"></i>';
        let borderClass = 'border-blue-200 bg-white text-slate-800';

        if (type === 'success') {
            icon = '<i class="fa-solid fa-circle-check text-green-600"></i>';
            borderClass = 'border-green-300 bg-green-50/90 text-green-950';
        } else if (type === 'error') {
            icon = '<i class="fa-solid fa-circle-xmark text-rose-500"></i>';
            borderClass = 'border-rose-300 bg-rose-50/90 text-rose-950';
        } else if (type === 'warning') {
            icon = '<i class="fa-solid fa-triangle-exclamation text-amber-500"></i>';
            borderClass = 'border-amber-300 bg-amber-50/90 text-amber-950';
        }

        toast.className = `p-4 rounded-xl shadow-lg border ${borderClass} flex items-center gap-3 transition-all duration-300 transform translate-y-2 text-sm font-medium max-w-md`;
        toast.innerHTML = `
            <div class="text-lg flex-shrink-0">${icon}</div>
            <div class="flex-1">${message}</div>
            <button onclick="this.parentElement.remove()" class="text-slate-400 hover:text-slate-600 text-xs">
                <i class="fa-solid fa-xmark"></i>
            </button>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.remove('translate-y-2');
        }, 10);

        setTimeout(() => {
            toast.classList.add('opacity-0', 'translate-y-2');
            setTimeout(() => toast.remove(), 300);
        }, 4500);
    },

    setupEventListeners: function () {
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal-container:not(.hidden)').forEach(modal => {
                    this.closeModal(modal.id);
                });
                this.closeMoreMenu();
            }
        });
        // Close More menu & Top Search when clicking outside
        document.addEventListener('click', (e) => {
            const wrapper = document.getElementById('more-menu-wrapper');
            if (wrapper && !wrapper.contains(e.target)) {
                this.closeMoreMenu();
            }
            const searchWrapper = document.getElementById('top-product-search-wrapper');
            if (searchWrapper && !searchWrapper.contains(e.target)) {
                this.closeTopSearchDropdown();
            }
        });
    },

    toggleMoreMenu: function () {
        const panel = document.getElementById('more-menu-panel');
        const chevron = document.getElementById('more-menu-chevron');
        if (!panel) return;
        const isOpen = !panel.classList.contains('hidden');
        if (isOpen) {
            panel.classList.add('hidden');
            if (chevron) chevron.style.transform = '';
        } else {
            panel.classList.remove('hidden');
            if (chevron) chevron.style.transform = 'rotate(180deg)';
        }
    },

    closeMoreMenu: function () {
        const panel = document.getElementById('more-menu-panel');
        const chevron = document.getElementById('more-menu-chevron');
        if (panel) panel.classList.add('hidden');
        if (chevron) chevron.style.transform = '';
    },

    escapeHtml: function(str) {
        if (!str) return '';
        return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    },

    // =========================================================================
    // TOP PRODUCT SEARCH ENGINE
    // =========================================================================
    topSearchDebounce: null,
    cachedTopSearchResults: [],

    handleTopProductSearch: function(query) {
        clearTimeout(this.topSearchDebounce);
        const q = (query || '').trim();
        if (!q) {
            this.renderTopSearchSuggestions();
            return;
        }
        this.topSearchDebounce = setTimeout(async () => {
            try {
                const res = await fetch(`/api/listings?status=active&search=${encodeURIComponent(q)}`);
                const data = await res.json();
                if (data.success) {
                    this.cachedTopSearchResults = data.listings || [];
                    this.renderTopSearchResults(this.cachedTopSearchResults, q);
                }
            } catch(e) {
                console.error("Search error:", e);
            }
        }, 220);
    },

    openTopSearchDropdown: function() {
        const dropdown = document.getElementById('top-product-search-dropdown');
        if (!dropdown) return;
        dropdown.classList.remove('hidden');
        const input = document.getElementById('top-product-search-input');
        const query = (input ? input.value : '').trim();
        if (!query) {
            this.renderTopSearchSuggestions();
        } else {
            this.handleTopProductSearch(query);
        }
    },

    closeTopSearchDropdown: function() {
        const dropdown = document.getElementById('top-product-search-dropdown');
        if (dropdown) dropdown.classList.add('hidden');
    },

    renderTopSearchSuggestions: function() {
        const dropdown = document.getElementById('top-product-search-dropdown');
        if (!dropdown) return;

        dropdown.innerHTML = `
            <div class="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <span class="text-[10px] font-black uppercase tracking-wider text-slate-400">🔥 Popular Crop Searches</span>
                <span class="text-[10px] text-slate-400">Press Enter to search all</span>
            </div>
            <div class="p-3">
                <div class="flex flex-wrap gap-1.5 mb-3">
                    <button type="button" onclick="App.quickSelectSearchTag('Wheat')" class="px-3 py-1 bg-green-50 hover:bg-green-100 text-green-800 rounded-lg text-xs font-bold border border-green-200 transition-colors flex items-center gap-1">🌾 Wheat / गेहूँ</button>
                    <button type="button" onclick="App.quickSelectSearchTag('Soybean')" class="px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-bold border border-amber-200 transition-colors flex items-center gap-1">🌱 Soybean / सोयाबीन</button>
                    <button type="button" onclick="App.quickSelectSearchTag('Mustard')" class="px-3 py-1 bg-yellow-50 hover:bg-yellow-100 text-yellow-900 rounded-lg text-xs font-bold border border-yellow-200 transition-colors flex items-center gap-1">🌻 Mustard / सरसों</button>
                    <button type="button" onclick="App.quickSelectSearchTag('Paddy')" class="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold border border-emerald-200 transition-colors flex items-center gap-1">🌾 Basmati / धान</button>
                    <button type="button" onclick="App.quickSelectSearchTag('Onion')" class="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 rounded-lg text-xs font-bold border border-rose-200 transition-colors flex items-center gap-1">🧅 Onion / प्याज</button>
                    <button type="button" onclick="App.quickSelectSearchTag('Maize')" class="px-3 py-1 bg-orange-50 hover:bg-orange-100 text-orange-800 rounded-lg text-xs font-bold border border-orange-200 transition-colors flex items-center gap-1">🌽 Maize / मक्का</button>
                </div>
                <div class="text-[11px] text-slate-500 flex items-center gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-100">
                    <i class="fa-solid fa-lightbulb text-amber-500"></i>
                    <span>Tip: Type crop name, variety (e.g. Sharbati, Pusa 1121), or mandi district to filter lots instantly.</span>
                </div>
            </div>
        `;
    },

    quickSelectSearchTag: function(term) {
        const input = document.getElementById('top-product-search-input');
        if (input) input.value = term;
        this.submitTopProductSearch(term);
    },

    renderTopSearchResults: function(listings, query) {
        const dropdown = document.getElementById('top-product-search-dropdown');
        if (!dropdown) return;

        if (!listings || listings.length === 0) {
            dropdown.innerHTML = `
                <div class="p-6 text-center text-slate-400 text-xs">
                    <div class="text-2xl mb-1">🌾</div>
                    <div class="font-bold text-slate-700">No matching produce lots found for "${this.escapeHtml(query)}"</div>
                    <p class="text-[11px] mt-1 text-slate-400">Try searching for Wheat, Soybean, Mustard, or Chana</p>
                    <button type="button" onclick="App.submitTopProductSearch()" class="mt-3 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold shadow-xs">View All Marketplace Produce</button>
                </div>
            `;
            return;
        }

        let html = `
            <div class="p-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs">
                <span class="font-bold text-slate-700">Found ${listings.length} produce lot${listings.length > 1 ? 's' : ''}</span>
                <button type="button" onclick="App.submitTopProductSearch()" class="text-green-700 font-bold hover:underline text-[11px]">View all in Marketplace →</button>
            </div>
            <div class="divide-y divide-slate-100">
        `;

        listings.slice(0, 6).forEach(l => {
            const cropEmoji = l.crop_name.toLowerCase().includes('wheat') ? '🌾' :
                             (l.crop_name.toLowerCase().includes('soy') ? '🌱' :
                             (l.crop_name.toLowerCase().includes('mustard') ? '🌻' :
                             (l.crop_name.toLowerCase().includes('onion') ? '🧅' :
                             (l.crop_name.toLowerCase().includes('maize') ? '🌽' : '🌾'))));
            const gradeBadge = l.grade === 'Grade A' ? '<span class="px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-100 text-emerald-800">Grade-A</span>' : `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-700">${l.grade}</span>`;

            html += `
                <div class="p-3 hover:bg-green-50/50 cursor-pointer flex items-center justify-between gap-3 transition-colors" onclick="App.selectProductListing(${l.id})">
                    <div class="flex items-center gap-3 min-w-0">
                        <div class="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-lg flex-shrink-0 border border-slate-200">
                            ${cropEmoji}
                        </div>
                        <div class="min-w-0">
                            <div class="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                                <span class="truncate">${l.crop_name}</span>
                                ${gradeBadge}
                            </div>
                            <div class="text-[11px] text-slate-500 truncate">
                                ${l.variety} • ${l.quantity} Quintals • 📍 ${l.seller_district || 'APMC Cluster'}
                            </div>
                        </div>
                    </div>
                    <div class="text-right flex-shrink-0">
                        <div class="font-black text-xs text-green-700">₹${Number(l.base_price).toLocaleString()}/Q</div>
                        <button type="button" class="mt-1 px-2.5 py-0.5 rounded bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold shadow-xs">
                            View Lot
                        </button>
                    </div>
                </div>
            `;
        });

        html += `
            </div>
            <div class="p-2.5 bg-slate-50 border-t border-slate-100 text-center">
                <button type="button" onclick="App.submitTopProductSearch()" class="w-full py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-xs">
                    See all results for "${this.escapeHtml(query)}" in Marketplace
                </button>
            </div>
        `;

        dropdown.innerHTML = html;
    },

    selectProductListing: function(listingId) {
        this.closeTopSearchDropdown();
        this.showSection('buyer-dashboard');
        setTimeout(() => {
            if (window.Buyer && Buyer.openBidModal) {
                Buyer.openBidModal(listingId);
            }
        }, 150);
    },

    submitTopProductSearch: async function(customQuery = null) {
        const input = document.getElementById('top-product-search-input');
        const q = customQuery !== null ? customQuery : (input ? input.value.trim() : '');
        this.closeTopSearchDropdown();
        
        this.showSection('buyer-dashboard');

        if (window.Buyer) {
            await Buyer.loadMarketplace('', q);
            const grid = document.getElementById('buyer-marketplace-grid');
            if (grid) {
                grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            if (q) {
                App.showToast(`🔍 Showing marketplace lots matching "${q}"`, "info");
            }
        }
    },

    // =========================================================================
    // DEDICATED ORDERS & ESCROW DASHBOARD ENGINE
    // =========================================================================
    currentOrdersFilter: 'all',
    currentOrdersSearch: '',
    cachedOrdersList: [],

    navigateToOrders: function () {
        if (!Auth.currentUser) {
            this.showToast("🔒 Please login or register to view your orders & escrow tracking", "warning");
            this.showSection('auth-portal');
            return;
        }
        this.showSection('orders');
        this.refreshOrdersView();
    },

    refreshOrdersView: async function () {
        const role = Auth.currentUser ? Auth.currentUser.role : 'buyer';
        const userId = Auth.currentUser ? Auth.currentUser.id : null;
        const roleBadge = document.getElementById('orders-banner-role-badge');
        if (roleBadge) {
            roleBadge.textContent = role === 'seller' ? 'Farmer Sales Orders & Escrow' : (role === 'admin' ? 'All Platform Orders & Disputes' : 'Buyer Procurement Orders & Escrow');
        }

        try {
            let url = '/api/orders?';
            if (userId && role !== 'admin') url += `user_id=${userId}&role=${role}`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.success) {
                this.cachedOrdersList = data.orders || [];
                this.updateOrdersTabCounts(this.cachedOrdersList);
                this.renderUnifiedOrders();
            }
        } catch (e) {
            console.error("Error refreshing orders:", e);
        }
    },

    updateOrdersTabCounts: function (orders) {
        const counts = { all: 0, escrow: 0, dispatched: 0, released: 0, refunded: 0 };
        orders.forEach(o => {
            counts.all++;
            const st = (o.escrow_status || '').toLowerCase();
            if (st === 'released') counts.released++;
            else if (st === 'refunded' || o.refund_status === 'processed') counts.refunded++;
            else if (st === 'dispatched') counts.dispatched++;
            else counts.escrow++;
        });

        ['all', 'escrow', 'dispatched', 'released', 'refunded'].forEach(tab => {
            const el = document.getElementById(`orders-tab-count-${tab}`);
            if (el) el.textContent = counts[tab] || 0;
        });

        const headerBadge = document.getElementById('header-orders-badge');
        if (headerBadge) {
            if (counts.all > 0) {
                headerBadge.textContent = counts.all;
                headerBadge.classList.remove('hidden');
            } else {
                headerBadge.classList.add('hidden');
            }
        }
    },

    filterOrdersTab: function (filterName) {
        this.currentOrdersFilter = filterName;
        ['all', 'escrow', 'dispatched', 'released', 'refunded'].forEach(t => {
            const btn = document.getElementById(`order-filter-btn-${t}`);
            if (btn) {
                if (t === filterName) {
                    btn.className = "px-3.5 py-1.5 rounded-xl text-xs font-bold bg-green-600 text-white shadow-xs transition-all";
                } else {
                    btn.className = "px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all";
                }
            }
        });
        this.renderUnifiedOrders();
    },

    searchOrdersList: function (query) {
        this.currentOrdersSearch = (query || '').toLowerCase().trim();
        this.renderUnifiedOrders();
    },

    renderUnifiedOrders: function () {
        const container = document.getElementById('unified-orders-list-container');
        if (!container) return;

        let filtered = this.cachedOrdersList || [];

        // Apply status filter
        if (this.currentOrdersFilter === 'escrow') {
            filtered = filtered.filter(o => o.escrow_status !== 'released' && o.escrow_status !== 'refunded' && o.escrow_status !== 'dispatched');
        } else if (this.currentOrdersFilter === 'dispatched') {
            filtered = filtered.filter(o => o.escrow_status === 'dispatched');
        } else if (this.currentOrdersFilter === 'released') {
            filtered = filtered.filter(o => o.escrow_status === 'released');
        } else if (this.currentOrdersFilter === 'refunded') {
            filtered = filtered.filter(o => o.escrow_status === 'refunded' || o.refund_status === 'processed');
        }

        // Apply search
        if (this.currentOrdersSearch) {
            const term = this.currentOrdersSearch;
            filtered = filtered.filter(o => 
                String(o.id).includes(term) ||
                (o.crop_name && o.crop_name.toLowerCase().includes(term)) ||
                (o.seller_name && o.seller_name.toLowerCase().includes(term)) ||
                (o.buyer_name && o.buyer_name.toLowerCase().includes(term))
            );
        }

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-xs">
                    <div class="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-3xl mx-auto mb-3">
                        📦
                    </div>
                    <h3 class="text-base font-bold text-slate-800">No Orders Found</h3>
                    <p class="text-xs text-slate-500 mt-1 max-w-sm mx-auto">There are no orders matching your current filter. You can browse the marketplace to procure verified produce or list your harvest.</p>
                    <button onclick="App.showSection('buyer-dashboard')" class="mt-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold shadow-xs">
                        Explore Marketplace
                    </button>
                </div>
            `;
            return;
        }

        const isSeller = Auth.currentUser && Auth.currentUser.role === 'seller';
        let html = '';

        filtered.forEach(o => {
            const isReleased = o.escrow_status === 'released';
            const isRefunded = o.escrow_status === 'refunded' || o.refund_status === 'processed';
            const isConfirmed = Number(o.confirmed_by_seller) === 1;

            let statusBadge = '<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">🔒 Bank Escrow Funded</span>';
            if (o.escrow_status === 'assay_approved') statusBadge = '<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">🔬 Lab Assay Approved</span>';
            if (o.escrow_status === 'dispatched') statusBadge = '<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">🚚 In-Transit (GPS Live)</span>';
            if (isReleased) statusBadge = '<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">🎉 Escrow Released</span>';
            if (isRefunded) statusBadge = '<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">🔄 Refunded / Cancelled</span>';

            const counterpartyLabel = isSeller ? 'Buyer / Mill' : 'Farmer / Seller';
            const counterpartyName = isSeller ? (o.buyer_name || 'AgriCorp Wholesalers') : (o.seller_name || 'Farmer Cluster');
            const counterpartyPhone = isSeller ? (o.buyer_phone || '9876543210') : (o.seller_phone || '9876543210');

            html += `
                <div class="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-xs hover:border-green-200 transition-all">
                    <div class="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 mb-3">
                        <div class="flex items-center gap-2.5">
                            <span class="font-mono text-xs font-black text-slate-800 bg-slate-100 px-2.5 py-1 rounded-xl">Order #${o.id}</span>
                            <span class="font-black text-base text-slate-900">${o.crop_name} (${o.quantity} Quintals)</span>
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${isConfirmed ? 'bg-green-100 text-green-800' : 'bg-amber-50 text-amber-800'}">
                                ${isConfirmed ? '✓ Confirmed by Seller' : '⏳ Pending Confirmation'}
                            </span>
                        </div>
                        <div>${statusBadge}</div>
                    </div>

                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 rounded-2xl text-xs mb-4">
                        <div>
                            <span class="text-slate-400 text-[10px] font-bold uppercase">${counterpartyLabel}:</span>
                            <div class="font-bold text-slate-800">${counterpartyName}</div>
                            <div class="text-[10px] text-slate-500">📞 +91 ${counterpartyPhone}</div>
                        </div>
                        <div>
                            <span class="text-slate-400 text-[10px] font-bold uppercase">Escrow Total Amount:</span>
                            <div class="font-black text-sm text-green-700">₹${Number(o.total_amount).toLocaleString()}</div>
                            <div class="text-[10px] text-slate-500">Rate: ₹${Number(o.price_per_quintal || (o.total_amount/o.quantity)).toLocaleString()}/Q</div>
                        </div>
                        <div>
                            <span class="text-slate-400 text-[10px] font-bold uppercase">Logistics & Vehicle:</span>
                            <div class="font-bold text-slate-800">${o.truck_number || 'Truck Assignment Pending'}</div>
                            <div class="text-[10px] text-blue-600 font-semibold">${o.carrier_name || 'AgriLogistics Hub'}</div>
                        </div>
                        <div>
                            <span class="text-slate-400 text-[10px] font-bold uppercase">Created On:</span>
                            <div class="font-bold text-slate-800">${o.created_at ? o.created_at.split(' ')[0] : 'Today'}</div>
                            <div class="text-[10px] text-slate-500">Escrow ID: ESC-${o.id}09</div>
                        </div>
                    </div>

                    <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <div class="flex flex-wrap items-center gap-2">
                            <button onclick="Escrow.openTrackingModal(${o.id})" class="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold border border-blue-200 transition-colors flex items-center gap-1.5 shadow-xs">
                                <i class="fa-solid fa-location-dot text-blue-600"></i> Track Delivery (GPS)
                            </button>
                            <button onclick="App.printInvoice(${o.id})" class="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5">
                                <i class="fa-solid fa-file-invoice"></i> View Invoice
                            </button>
                            ${!isSeller && !isReleased && !isRefunded ? `
                                <button onclick="Escrow.openPaymentModal(${o.id}, ${o.total_amount}, '${o.crop_name}')" class="px-3.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs">
                                    <i class="fa-solid fa-credit-card"></i> Pay via Escrow
                                </button>
                            ` : ''}
                        </div>

                        <div class="flex items-center gap-2">
                            ${!isReleased && !isRefunded ? `
                                <button onclick="Escrow.openDisputeModal(${o.id})" class="px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-50 rounded-xl font-bold border border-amber-200 transition-colors">
                                    <i class="fa-solid fa-triangle-exclamation"></i> Raise Dispute
                                </button>
                                <button onclick="Escrow.openCancelModal(${o.id}, ${o.total_amount})" class="px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-xl font-bold border border-rose-200 transition-colors">
                                    Cancel Order
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    },

    printInvoice: function (orderId) {
        const order = (this.cachedOrdersList || []).find(o => Number(o.id) === Number(orderId));
        if (!order) {
            this.showToast(`Invoice for Order #${orderId} generated. Opening print preview...`, "info");
            window.print();
            return;
        }

        const invoiceWindow = window.open('', '_blank', 'width=800,height=700');
        if (!invoiceWindow) {
            window.print();
            return;
        }

        invoiceWindow.document.write(`
            <html>
            <head>
                <title>KisanLakshmi Tax Invoice - Order #${order.id}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 30px; color: #1e293b; }
                    .header { border-bottom: 2px solid #16a34a; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
                    .logo { font-size: 24px; font-weight: 900; color: #16a34a; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { padding: 10px; border: 1px solid #e2e8f0; text-align: left; }
                    th { background-color: #f8fafc; }
                    .total { font-size: 18px; font-weight: bold; color: #16a34a; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <div class="logo">kisanlakshmi</div>
                        <p style="margin: 3px 0 0 0; font-size: 12px; color: #64748b;">Direct Farmer-to-Buyer Escrow Settlement</p>
                    </div>
                    <div style="text-align: right;">
                        <h3 style="margin:0;">TAX INVOICE</h3>
                        <p style="margin: 3px 0 0 0; font-size: 12px;">Invoice #: KL-INV-${order.id}</p>
                        <p style="margin: 3px 0 0 0; font-size: 12px;">Date: ${order.created_at || 'Current'}</p>
                    </div>
                </div>

                <div style="display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 13px;">
                    <div>
                        <strong>Seller / Farmer:</strong><br/>
                        ${order.seller_name || 'Farmer Cluster'}<br/>
                        Phone: +91 ${order.seller_phone || '9876543210'}<br/>
                        State: ${order.seller_district || 'Madhya Pradesh'}
                    </div>
                    <div style="text-align: right;">
                        <strong>Buyer:</strong><br/>
                        ${order.buyer_name || 'Procurement Buyer'}<br/>
                        Phone: +91 ${order.buyer_phone || '9876543210'}<br/>
                        Status: ${order.escrow_status || 'Escrow Funded'}
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Item / Commodity</th>
                            <th>Variety & Grade</th>
                            <th>Quantity</th>
                            <th>Rate / Q</th>
                            <th>Amount (INR)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>${order.crop_name}</td>
                            <td>${order.variety || 'Standard'} (${order.grade || 'Grade-A'})</td>
                            <td>${order.quantity} Quintals</td>
                            <td>₹${Number(order.price_per_quintal || (order.total_amount/order.quantity)).toLocaleString()}</td>
                            <td>₹${Number(order.total_amount).toLocaleString()}</td>
                        </tr>
                    </tbody>
                </table>

                <div style="text-align: right; margin-top: 20px;">
                    <p class="total">Total Escrow Payable: ₹${Number(order.total_amount).toLocaleString()}</p>
                    <p style="font-size: 11px; color: #64748b;">Bank Escrow Guarantee: Funds held in trust until verified 4-digit Delivery OTP.</p>
                </div>
                <script>window.print();<\/script>
            </body>
            </html>
        `);
        invoiceWindow.document.close();
    }
};

const Admin = {
    currentTab: 'farmers',

    showTab: function(tab) {
        this.currentTab = tab;
        const tabs = ['farmers', 'disputes', 'bulk', 'users'];
        tabs.forEach(t => {
            const pane = document.getElementById(`admin-pane-${t}`);
            const btn = document.getElementById(`admin-tab-btn-${t}`);
            if (pane) pane.classList.toggle('hidden', t !== tab);
            if (btn) {
                if (t === tab) {
                    btn.className = "flex-1 py-2.5 text-center rounded-xl bg-purple-600 text-white shadow-xs transition-all";
                } else {
                    btn.className = "flex-1 py-2.5 text-center rounded-xl text-slate-600 hover:text-slate-900 transition-all";
                }
            }
        });
    },

    loadOverview: async function() {
        try {
            const res = await fetch('/api/admin/overview');
            const data = await res.json();
            if (!data.success) return;

            const m = data.metrics || {};
            const farmers = data.farmers || (data.users ? data.users.filter(u => u.role === 'seller') : []);
            const buyers = data.buyers || (data.users ? data.users.filter(u => u.role === 'buyer') : []);
            const pendingCount = m.pending_approvals !== undefined ? m.pending_approvals : (m.pending_kyc !== undefined ? m.pending_kyc : farmers.filter(f => !f.is_approved).length);
            const escrowVol = m.total_escrow_volume !== undefined ? m.total_escrow_volume : (m.escrow_volume || 0);

            if (document.getElementById('admin-metric-farmers')) document.getElementById('admin-metric-farmers').textContent = m.total_farmers || farmers.length || 0;
            if (document.getElementById('admin-metric-buyers')) document.getElementById('admin-metric-buyers').textContent = m.total_buyers || buyers.length || 0;
            if (document.getElementById('admin-metric-listings')) document.getElementById('admin-metric-listings').textContent = m.active_listings || 0;
            if (document.getElementById('admin-metric-pending-kyc')) document.getElementById('admin-metric-pending-kyc').textContent = pendingCount;
            if (document.getElementById('admin-metric-disputes')) document.getElementById('admin-metric-disputes').textContent = m.open_disputes || (data.disputes ? data.disputes.length : 0);
            if (document.getElementById('admin-metric-escrow')) document.getElementById('admin-metric-escrow').textContent = `₹${escrowVol.toLocaleString()}`;

            // Tab 1: Farmers KYC
            const fBody = document.getElementById('admin-farmers-table-body');
            if (fBody) {
                if (!farmers || farmers.length === 0) {
                    fBody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-slate-400">No farmers found in verification queue.</td></tr>`;
                } else {
                    fBody.innerHTML = farmers.map(f => {
                        const isAppr = f.is_approved === 1;
                        return `
                            <tr class="hover:bg-slate-50 transition-colors">
                                <td class="px-4 py-3 font-bold text-slate-900 flex items-center gap-2">
                                    <span class="w-7 h-7 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-black">👨‍🌾</span>
                                    <div>
                                        <div>${f.name}</div>
                                        <div class="text-[10px] text-slate-400">${f.fpo_name || 'Individual Landholder'}</div>
                                    </div>
                                </td>
                                <td class="px-4 py-3 font-mono text-slate-600">+91 ${f.phone || '9876543210'}</td>
                                <td class="px-4 py-3 text-slate-600">${f.district || 'Sehore'}, ${f.state || 'Madhya Pradesh'}</td>
                                <td class="px-4 py-3">
                                    <span class="px-2 py-0.5 rounded-full font-mono font-bold bg-green-50 text-green-700 border border-green-200">
                                        ${f.credit_score || 750} / 850
                                    </span>
                                </td>
                                <td class="px-4 py-3">
                                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${isAppr ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
                                        ${isAppr ? '✓ Approved' : '⏳ Pending Review'}
                                    </span>
                                </td>
                                <td class="px-4 py-3 text-right">
                                    ${isAppr ? `
                                        <button onclick="Admin.approveFarmer(${f.id}, false)" class="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold border border-rose-200 transition-all">
                                            Revoke KYC
                                        </button>
                                    ` : `
                                        <button onclick="Admin.approveFarmer(${f.id}, true)" class="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all">
                                            ✓ Approve KYC
                                        </button>
                                    `}
                                </td>
                            </tr>
                        `;
                    }).join('');
                }
            }

            // Tab 2: Disputes
            const dContainer = document.getElementById('admin-disputes-list');
            if (dContainer && data.disputes) {
                if (data.disputes.length === 0) {
                    dContainer.innerHTML = `<div class="p-8 text-center text-slate-400 text-xs">No active dispute cases in escrow mediation queue. All transactions operating smoothly!</div>`;
                } else {
                    dContainer.innerHTML = data.disputes.map(d => {
                        const isResolved = d.status === 'resolved';
                        return `
                            <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                                <div class="flex flex-wrap items-center justify-between gap-2">
                                    <div class="flex items-center gap-2">
                                        <span class="font-mono text-xs font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded">Dispute #${d.id}</span>
                                        <span class="font-bold text-slate-900">Order #${d.order_id} • ${d.reason}</span>
                                    </div>
                                    <span class="px-2.5 py-0.5 rounded-full text-xs font-bold ${isResolved ? 'bg-green-100 text-green-800' : 'bg-rose-100 text-rose-800'}">
                                        ${isResolved ? `Resolved (${d.resolution})` : '⚠️ Action Required'}
                                    </span>
                                </div>
                                <p class="text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-200">
                                    ${d.description}
                                </p>
                                ${!isResolved ? `
                                    <div class="flex flex-wrap gap-2 pt-1 border-t border-slate-200">
                                        <button onclick="Admin.resolveDispute(${d.id}, 'refund_buyer')" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs transition-all">
                                            <i class="fa-solid fa-rotate-left"></i> 100% Refund to Buyer (Zero Fee)
                                        </button>
                                        <button onclick="Admin.resolveDispute(${d.id}, 'release_seller')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs transition-all">
                                            <i class="fa-solid fa-check"></i> Authorize Release to Farmer
                                        </button>
                                    </div>
                                ` : ''}
                            </div>
                        `;
                    }).join('');
                }
            }

            // Tab 3: Bulk Orders
            const bBody = document.getElementById('admin-bulk-table-body');
            if (bBody && data.bulk_inquiries) {
                if (data.bulk_inquiries.length === 0) {
                    bBody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-400">No bulk inquiries logged yet.</td></tr>`;
                } else {
                    bBody.innerHTML = data.bulk_inquiries.map(b => `
                        <tr class="hover:bg-slate-50 transition-colors">
                            <td class="px-4 py-3 font-bold text-slate-900">${b.buyer_name} <span class="block text-[10px] text-slate-400">${b.business_type}</span></td>
                            <td class="px-4 py-3 font-semibold text-emerald-700">${b.commodity}</td>
                            <td class="px-4 py-3 font-bold text-slate-900">${b.quantity_quintals} Q</td>
                            <td class="px-4 py-3 font-bold text-slate-700">₹${b.target_price || 'Market'}</td>
                            <td class="px-4 py-3 text-slate-600">${b.delivery_location || 'Pan-India'}</td>
                            <td class="px-4 py-3 font-mono text-slate-600">+91 ${b.phone}</td>
                            <td class="px-4 py-3">
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">New Lead</span>
                            </td>
                        </tr>
                    `).join('');
                }
            }

            // Tab 4: Users
            const uBody = document.getElementById('admin-users-table-body');
            if (uBody && data.users) {
                uBody.innerHTML = data.users.map(u => `
                    <tr class="hover:bg-slate-50 transition-colors">
                        <td class="px-4 py-3 font-mono text-slate-400">#${u.id}</td>
                        <td class="px-4 py-3 font-bold text-slate-900">${u.name}</td>
                        <td class="px-4 py-3">
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${u.role === 'seller' ? 'bg-green-100 text-green-800' : (u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-amber-100 text-amber-800')}">
                                ${u.role.toUpperCase()}
                            </span>
                        </td>
                        <td class="px-4 py-3 font-mono text-slate-600">+91 ${u.phone || '–'}</td>
                        <td class="px-4 py-3 text-slate-600">${u.email || '–'}</td>
                        <td class="px-4 py-3 text-slate-600">${u.district || 'Sehore'}, ${u.state || 'MP'}</td>
                        <td class="px-4 py-3 text-slate-600">${u.fpo_name || u.business_type || '–'}</td>
                    </tr>
                `).join('');
            }
        } catch(e) {
            console.error("Error loading admin overview:", e);
        }
    },

    approveFarmer: async function(userId, isApproved) {
        try {
            App.showToast(`${isApproved ? 'Approving' : 'Updating'} farmer KYC...`, "info");
            const res = await fetch('/api/admin/users/approve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, is_approved: isApproved ? 1 : 0 })
            });
            const data = await res.json();
            if (data.success) {
                App.showToast(data.message, "success");
                await this.loadOverview();
            } else {
                App.showToast(data.error || "Approval failed", "error");
            }
        } catch(e) {
            App.showToast("Error communicating with admin server", "error");
        }
    },

    resolveDispute: async function(disputeId, resolution) {
        try {
            App.showToast("Resolving dispute & settling escrow...", "info");
            const res = await fetch('/api/admin/disputes/resolve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dispute_id: disputeId, resolution })
            });
            const data = await res.json();
            if (data.success) {
                App.showToast(data.message, "success");
                await this.loadOverview();
            } else {
                App.showToast(data.error || "Resolution failed", "error");
            }
        } catch(e) {
            App.showToast("Error resolving dispute", "error");
        }
    }
};

window.Admin = Admin;
window.App = App;

// =====================================================================
// WALLET MODULE — Balance Check, Deposit, Withdraw & History
// =====================================================================
const Wallet = {
    currentBalance: 0,

    async openModal() {
        App.openModal('modal-wallet');
        Wallet.showTab('deposit');
        await Wallet.loadBalance();
    },

    showTab(tab) {
        ['deposit', 'withdraw', 'history'].forEach(t => {
            const panel = document.getElementById(`wallet-panel-${t}`);
            const tabBtn = document.getElementById(`wallet-tab-${t}`);
            if (panel) panel.classList.toggle('hidden', t !== tab);
            if (tabBtn) {
                if (t === tab) {
                    tabBtn.className = `flex-1 py-2.5 text-center border-b-2 ${tab === 'withdraw' ? 'text-amber-700 border-amber-500' : 'text-emerald-700 border-emerald-600'}`;
                } else {
                    tabBtn.className = 'flex-1 py-2.5 text-center text-slate-500 hover:text-slate-700';
                }
            }
        });
        if (tab === 'history') Wallet.loadHistory();
    },

    async loadBalance() {
        try {
            const userId = (Auth.currentUser && Auth.currentUser.id) || 1;
            const resp = await fetch(`/api/wallet/balance?user_id=${userId}`);
            const data = await resp.json();
            if (data.success) {
                Wallet.currentBalance = data.wallet_balance;
                const fmt = `₹${Number(data.wallet_balance).toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
                const el = document.getElementById('wallet-balance-display');
                const headerEl = document.getElementById('header-wallet-balance');
                const nameEl = document.getElementById('wallet-user-name-label');
                if (el) el.textContent = fmt;
                if (headerEl) headerEl.textContent = `${Number(data.wallet_balance).toLocaleString('en-IN', {maximumFractionDigits: 0})}`;
                if (nameEl) nameEl.textContent = `${data.name} · ${data.role === 'seller' ? 'Farmer' : data.role === 'admin' ? 'Admin' : 'Buyer'} Account`;
            }
        } catch(e) {
            console.error('Wallet balance load error:', e);
        }
    },

    updateHeaderBalance() {
        Wallet.loadBalance();
    },

    showResult(elId, msg, success) {
        const el = document.getElementById(elId);
        if (!el) return;
        el.className = `text-xs font-semibold text-center rounded-xl p-2 ${success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`;
        el.textContent = msg;
        el.classList.remove('hidden');
        setTimeout(() => el.classList.add('hidden'), 5000);
    },

    async deposit() {
        const amount = parseFloat(document.getElementById('wallet-deposit-amount').value);
        const method = document.getElementById('wallet-deposit-method').value;
        if (!amount || amount < 100) {
            Wallet.showResult('wallet-deposit-result', 'Minimum deposit amount is ₹100', false);
            return;
        }
        try {
            const userId = (Auth.currentUser && Auth.currentUser.id) || 1;
            const resp = await fetch('/api/wallet/deposit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, amount, method })
            });
            const data = await resp.json();
            if (data.success) {
                Wallet.currentBalance = data.wallet_balance;
                const fmt = `₹${Number(data.wallet_balance).toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
                document.getElementById('wallet-balance-display').textContent = fmt;
                document.getElementById('header-wallet-balance').textContent =
                    Number(data.wallet_balance).toLocaleString('en-IN', {maximumFractionDigits: 0});
                document.getElementById('wallet-deposit-amount').value = '';
                Wallet.showResult('wallet-deposit-result', `${data.message} Ref: ${data.reference}`, true);
                App.showToast(`Wallet credited ₹${Number(amount).toLocaleString('en-IN')} successfully!`, 'success');
            } else {
                Wallet.showResult('wallet-deposit-result', data.error || 'Deposit failed', false);
            }
        } catch(e) {
            Wallet.showResult('wallet-deposit-result', 'Network error. Please try again.', false);
        }
    },

    async withdraw() {
        const amount = parseFloat(document.getElementById('wallet-withdraw-amount').value);
        const account = document.getElementById('wallet-withdraw-account').value.trim();
        const ifsc = document.getElementById('wallet-withdraw-ifsc').value.trim();
        if (!amount || amount < 100) {
            Wallet.showResult('wallet-withdraw-result', 'Minimum withdrawal amount is ₹100', false);
            return;
        }
        if (!account || !ifsc) {
            Wallet.showResult('wallet-withdraw-result', 'Please enter your bank account number and IFSC code', false);
            return;
        }
        if (amount > Wallet.currentBalance) {
            Wallet.showResult('wallet-withdraw-result', `Insufficient balance. Available: ₹${Number(Wallet.currentBalance).toLocaleString('en-IN')}`, false);
            return;
        }
        try {
            const userId = (Auth.currentUser && Auth.currentUser.id) || 1;
            const resp = await fetch('/api/wallet/withdraw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, amount, method: 'bank_transfer', account_no: account, ifsc })
            });
            const data = await resp.json();
            if (data.success) {
                Wallet.currentBalance = data.wallet_balance;
                const fmt = `₹${Number(data.wallet_balance).toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
                document.getElementById('wallet-balance-display').textContent = fmt;
                document.getElementById('header-wallet-balance').textContent =
                    Number(data.wallet_balance).toLocaleString('en-IN', {maximumFractionDigits: 0});
                document.getElementById('wallet-withdraw-amount').value = '';
                Wallet.showResult('wallet-withdraw-result', `${data.message} Ref: ${data.reference}`, true);
                App.showToast(`₹${Number(amount).toLocaleString('en-IN')} withdrawal initiated!`, 'success');
            } else {
                Wallet.showResult('wallet-withdraw-result', data.error || 'Withdrawal failed', false);
            }
        } catch(e) {
            Wallet.showResult('wallet-withdraw-result', 'Network error. Please try again.', false);
        }
    },

    async loadHistory() {
        const container = document.getElementById('wallet-txn-list');
        if (!container) return;
        container.innerHTML = '<div class="text-center text-slate-400 text-xs py-8">Loading...</div>';
        try {
            const userId = (Auth.currentUser && Auth.currentUser.id) || 1;
            const resp = await fetch(`/api/wallet/transactions?user_id=${userId}`);
            const data = await resp.json();
            if (data.success && data.transactions.length > 0) {
                const icons = {
                    deposit: { icon: 'fa-arrow-down-to-line', color: 'text-emerald-600 bg-emerald-50', sign: '+' },
                    withdrawal: { icon: 'fa-arrow-up-from-line', color: 'text-amber-600 bg-amber-50', sign: '-' },
                    escrow_lock: { icon: 'fa-lock', color: 'text-blue-600 bg-blue-50', sign: '-' },
                    escrow_release: { icon: 'fa-lock-open', color: 'text-green-700 bg-green-50', sign: '+' },
                    refund: { icon: 'fa-rotate-left', color: 'text-purple-600 bg-purple-50', sign: '+' }
                };
                container.innerHTML = data.transactions.map(t => {
                    const meta = icons[t.txn_type] || { icon: 'fa-circle-dot', color: 'text-slate-500 bg-slate-100', sign: '' };
                    const amtFmt = `${meta.sign}₹${Number(t.amount).toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
                    const colorSign = meta.sign === '+' ? 'text-emerald-700 font-black' : 'text-slate-700 font-bold';
                    const dateStr = t.created_at ? new Date(t.created_at).toLocaleDateString('en-IN', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'}) : '';
                    return `<div class="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                        <div class="w-8 h-8 rounded-xl ${meta.color} flex items-center justify-center text-sm flex-shrink-0">
                            <i class="fa-solid ${meta.icon}"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="text-xs font-bold text-slate-900 capitalize">${t.txn_type.replace('_', ' ')}</div>
                            <div class="text-[10px] text-slate-500 truncate">${t.note || t.reference || '—'}</div>
                        </div>
                        <div class="text-right flex-shrink-0">
                            <div class="text-xs ${colorSign}">${amtFmt}</div>
                            <div class="text-[10px] text-slate-400">${dateStr}</div>
                        </div>
                    </div>`;
                }).join('');
            } else {
                container.innerHTML = '<div class="text-center text-slate-400 text-xs py-8 px-4">No transactions yet.<br>Make your first deposit to get started!</div>';
            }
        } catch(e) {
            container.innerHTML = '<div class="text-center text-red-400 text-xs py-8">Error loading history.</div>';
        }
    }
};

window.Wallet = Wallet;

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
