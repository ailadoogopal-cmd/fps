/**
 * KrishiSetu Buyer Dashboard Controller (Traders, Processors & Exporters)
 * Handles Marketplace Discovery, Hyperlocal Leaflet Map, Live e-Auctions, UPI Payments, Logistics & Escrow
 */
const Buyer = {
    listings: [],
    myBids: [],
    myOrders: [],
    contracts: [],
    selectedListing: null,
    mapInstance: null,
    currentUpiOrder: null,

    init: async function () {
        await this.loadMarketplace();
        if (Auth.currentUser && Auth.currentUser.role === 'buyer') {
            await this.loadBuyerData();
        }
    },

    loadBuyerData: async function () {
        const userId = Auth.currentUser ? Auth.currentUser.id : 3;
        await Promise.all([
            this.loadMyBids(userId),
            this.loadMyOrders(userId),
            this.loadContracts()
        ]);
        this.updateBuyerSummaryMetrics();
    },

    loadMarketplace: async function (category = '', search = '', grade = '', saleType = '', maxKm = '') {
        try {
            let url = '/api/listings?status=active&';
            if (category && category !== 'All') url += `category=${encodeURIComponent(category)}&`;
            if (search) url += `crop=${encodeURIComponent(search)}&`;
            if (grade && grade !== 'All') url += `grade=${encodeURIComponent(grade)}&`;
            if (saleType && saleType !== 'All') url += `sale_type=${encodeURIComponent(saleType)}&`;

            const res = await fetch(url);
            const data = await res.json();
            if (data.success) {
                this.listings = data.listings;
                this.renderMarketplaceGrid(data.listings);
                this.renderLeafletMap(data.listings);
            }
        } catch (e) {
            console.error("Error loading marketplace listings:", e);
        }
    },

    loadNearbyMarketplace: async function (maxKm = 300) {
        try {
            App.showToast(`Filtering listings within ${maxKm} km radius...`, "info");
            const res = await fetch(`/api/marketplace/nearby?lat=22.7196&lng=75.8577&max_km=${maxKm}`);
            const data = await res.json();
            if (data.success) {
                this.listings = data.nearby_listings;
                this.renderMarketplaceGrid(data.nearby_listings, true);
                this.renderLeafletMap(data.nearby_listings);
            }
        } catch (e) {
            console.error("Error loading nearby listings:", e);
        }
    },

    renderLeafletMap: function (listings) {
        const mapDiv = document.getElementById('marketplace-leaflet-map');
        if (!mapDiv || typeof L === 'undefined') return;

        if (!this.mapInstance) {
            this.mapInstance = L.map('marketplace-leaflet-map').setView([22.7196, 75.8577], 6);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(this.mapInstance);
        }

        // Clear existing markers
        this.mapInstance.eachLayer((layer) => {
            if (layer instanceof L.Marker) {
                this.mapInstance.removeLayer(layer);
            }
        });

        listings.forEach(l => {
            const lat = l.latitude || 23.2033;
            const lng = l.longitude || 77.0844;
            const marker = L.marker([lat, lng]).addTo(this.mapInstance);
            
            const popupContent = `
                <div class="p-1 font-sans">
                    <strong class="text-sm font-bold text-slate-900">${l.crop_name} (${l.grade})</strong>
                    <div class="text-xs text-green-700 font-black">₹${l.base_price}/Q • ${l.quantity_quintals} Q</div>
                    <div class="text-[11px] text-slate-600">${l.seller_name} (${l.location})</div>
                    <button onclick="Buyer.openBidModal(${l.id})" class="mt-1.5 px-2 py-1 bg-green-600 text-white rounded text-[11px] font-bold w-full">Procure / Bid</button>
                </div>
            `;
            marker.bindPopup(popupContent);
        });
    },

    loadMyBids: async function (userId) {
        try {
            const res = await fetch(`/api/bids?buyer_id=${userId}`);
            const data = await res.json();
            if (data.success) {
                this.myBids = data.bids;
                this.renderMyBids(data.bids);
            }
        } catch (e) {
            console.error("Error loading buyer bids:", e);
        }
    },

    loadMyOrders: async function (userId) {
        try {
            const res = await fetch(`/api/orders?buyer_id=${userId}&role=buyer`);
            const data = await res.json();
            if (data.success) {
                this.myOrders = data.orders;
                this.renderEscrowOrders(data.orders);
            }
        } catch (e) {
            console.error("Error loading escrow orders:", e);
        }
    },

    loadContracts: async function () {
        try {
            const res = await fetch('/api/contracts');
            const data = await res.json();
            if (data.success) {
                this.contracts = data.contracts;
                this.renderContracts(data.contracts);
            }
        } catch (e) {
            console.error("Error loading contracts:", e);
        }
    },

    updateBuyerSummaryMetrics: function () {
        const activeBids = this.myBids.filter(b => b.status === 'pending').length;
        const totalOrders = this.myOrders.length;
        const totalEscrow = this.myOrders.reduce((acc, o) => acc + (o.escrow_status !== 'released' ? o.total_amount : 0), 0);
        const openContracts = this.contracts.length;

        const elBids = document.getElementById('buyer-metric-bids');
        const elOrders = document.getElementById('buyer-metric-orders');
        const elEscrow = document.getElementById('buyer-metric-escrow');
        const elContracts = document.getElementById('buyer-metric-contracts');

        if (elBids) elBids.textContent = activeBids;
        if (elOrders) elOrders.textContent = totalOrders;
        if (elEscrow) elEscrow.textContent = `₹${totalEscrow.toLocaleString()}`;
        if (elContracts) elContracts.textContent = openContracts;
    },

    renderMarketplaceGrid: function (listings, isHyperlocal = false) {
        const container = document.getElementById('buyer-marketplace-grid');
        if (!container) return;

        if (!listings || listings.length === 0) {
            container.innerHTML = `<div class="p-12 text-center text-slate-400 text-xs col-span-3">No verified crop lots match your filter.</div>`;
            return;
        }

        let html = '';
        listings.forEach((l, idx) => {
            const isAuction = l.sale_type === 'auction';
            const gradeClass = (l.grade || '').includes('Grade A') ? 'badge-grade-a' : 'badge-grade-b';
            const distanceTag = l.distance_km !== undefined ? `<span class="bg-blue-100 text-blue-800 text-[10px] font-black px-2 py-0.5 rounded-full"><i class="fa-solid fa-location-dot"></i> ${l.distance_km} km</span>` : '';
            
            // Crop-specific image map — local high quality images & reliable fallbacks
            const cropImageMap = {
                // Grains & Cereals
                'wheat':      'img_wheat.jpg',
                'gehu':       'img_wheat.jpg',
                'rice':       'img_rice.jpg',
                'chawal':     'img_rice.jpg',
                'paddy':      'img_rice.jpg',
                'dhan':       'img_rice.jpg',
                'maize':      'img_maize.jpg',
                'corn':       'img_maize.jpg',
                'makka':      'img_maize.jpg',
                'jowar':      'img_corn_sunset.jpg',
                'bajra':      'img_wheat.jpg',
                'barley':     'img_wheat.jpg',
                // Oilseeds
                'soybean':    'img_soybean.jpg',
                'soya':       'img_soybean.jpg',
                'mustard':    'img_mustard.jpg',
                'sarson':     'img_mustard.jpg',
                'sunflower':  'https://images.unsplash.com/photo-1490750967868-88df5691cc99?w=600&auto=format&fit=crop&q=80',
                'groundnut':  'https://images.unsplash.com/photo-1567894340315-735d7c361db0?w=600&auto=format&fit=crop&q=80',
                'peanut':     'https://images.unsplash.com/photo-1567894340315-735d7c361db0?w=600&auto=format&fit=crop&q=80',
                'sesame':     'img_mustard.jpg',
                // Pulses
                'chana':      'https://images.unsplash.com/photo-1515543904379-3d757afe72e4?w=600&auto=format&fit=crop&q=80',
                'chickpea':   'https://images.unsplash.com/photo-1515543904379-3d757afe72e4?w=600&auto=format&fit=crop&q=80',
                'tur':        'img_soybean.jpg',
                'arhar':      'img_soybean.jpg',
                'lentil':     'img_soybean.jpg',
                'moong':      'img_soybean.jpg',
                'urad':       'img_mustard.jpg',
                // Vegetables
                'onion':      'img_onion.jpg',
                'pyaz':       'img_onion.jpg',
                'tomato':     'https://images.unsplash.com/photo-1558818498-28c1e002b655?w=600&auto=format&fit=crop&q=80',
                'potato':     'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600&auto=format&fit=crop&q=80',
                'garlic':     'https://images.unsplash.com/photo-1540148426945-6cf22a6b2383?w=600&auto=format&fit=crop&q=80',
                'ginger':     'https://images.unsplash.com/photo-1573414405541-c7e4bf94b34b?w=600&auto=format&fit=crop&q=80',
                'okra':       'img_okra_harvest.jpg',
                'bhindi':     'img_okra_harvest.jpg',
                'cabbage':    'https://images.unsplash.com/photo-1594282486552-05b4d80fbb9f?w=600&auto=format&fit=crop&q=80',
                'cauliflower':'https://images.unsplash.com/photo-1613743983303-b3e89f8a2b80?w=600&auto=format&fit=crop&q=80',
                'brinjal':    'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=600&auto=format&fit=crop&q=80',
                'eggplant':   'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=600&auto=format&fit=crop&q=80',
                // Cash crops
                'cotton':     'img_cotton.jpg',
                'kapas':      'img_cotton.jpg',
                'sugarcane':  'https://images.unsplash.com/photo-1589871973318-9ca1258faa5d?w=600&auto=format&fit=crop&q=80',
            };
            // Find matching image by checking if crop name contains any key
            const cropNameLower = (l.crop_name || '').toLowerCase();
            const matchedKey = Object.keys(cropImageMap).find(k => cropNameLower.includes(k));
            const defaultImg = idx % 2 === 0 ? 'img_okra_harvest.jpg' : 'img_corn_sunset.jpg';
            
            // Accurately resolve crop photo:
            let cardImg = l.image_url;
            if (!cardImg || cardImg.includes('photo-1574323347407-f5e1ad6d020b')) {
                cardImg = matchedKey ? cropImageMap[matchedKey] : (cardImg || defaultImg);
            } else if (matchedKey && (cardImg.includes('img_okra_harvest') || cardImg.includes('img_corn_sunset'))) {
                // If seeded with generic placeholder, use precise crop photo
                cardImg = cropImageMap[matchedKey];
            }


            const sellerPhone = l.seller_phone || '9876543210';
            const waText = encodeURIComponent(`नमस्ते ${l.seller_name} जी! I am interested in procuring your ${l.quantity_quintals} Q of ${l.crop_name} (${l.grade || 'Grade A'}) at ₹${l.base_price}/Q on KisanLakshmi.`);
            const shareText = encodeURIComponent(`🌾 KisanLakshmi Verified Farmgate Deal:\n${l.crop_name} (${l.quantity_quintals} Q) at ₹${l.base_price}/Q from ${l.seller_name} (${l.location}, ${l.state}). 100% Escrow Protected!`);

            html += `
                <div class="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-lg transition-all duration-300 flex flex-col justify-between">
                    <div>
                        <div class="relative h-48 bg-slate-100 overflow-hidden">
                            <img src="${cardImg}" alt="${l.crop_name}" class="w-full h-full object-cover" />
                            <div class="absolute top-3 left-3 flex flex-wrap gap-1.5">
                                <span class="${gradeClass}">${l.grade || 'Grade A'}</span>
                                <span class="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs"><i class="fa-solid fa-leaf"></i> Fresh Verified</span>
                                ${l.is_organic ? '<span class="bg-green-700 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs">🌱 Organic</span>' : ''}
                                ${distanceTag}
                            </div>
                            <div class="absolute top-3 right-3">
                                <span class="px-2.5 py-1 rounded-full text-xs font-bold ${isAuction ? 'bg-amber-500 text-slate-950 shadow-md' : 'bg-slate-900/80 backdrop-blur-md text-white'} uppercase">
                                    ${isAuction ? '🔨 e-Auction' : '⚡ Buy Direct'}
                                </span>
                            </div>
                        </div>

                        <div class="p-5">
                            <div class="flex items-start justify-between gap-2 mb-2">
                                <div>
                                    <h4 class="font-black text-slate-900 text-base">${l.crop_name} (${l.variety || 'Standard'})</h4>
                                    <p class="text-xs text-slate-500">${l.location}, ${l.state}</p>
                                </div>
                                <div class="text-right">
                                    <div class="text-xs text-slate-400 font-medium">Base Price</div>
                                    <div class="text-lg font-black text-green-700">₹${l.base_price.toLocaleString()}<span class="text-xs text-slate-400 font-normal">/Q</span></div>
                                </div>
                            </div>

                            <div class="grid grid-cols-2 gap-2 my-3 p-3 bg-slate-50 rounded-2xl text-xs">
                                <div>
                                    <span class="text-slate-400 text-[10px]">Available Lot:</span>
                                    <div class="font-bold text-slate-800">${l.quantity_quintals} Q</div>
                                </div>
                                <div>
                                    <span class="text-slate-400 text-[10px]">Quality Assay:</span>
                                    <div class="font-bold text-slate-800">💧 ${l.moisture_pct}% | 🌿 ${l.foreign_matter_pct}%</div>
                                </div>
                            </div>

                            <div class="flex items-center justify-between text-xs text-slate-600 mb-3">
                                <span class="flex items-center gap-1 font-bold text-slate-800">
                                    <i class="fa-solid fa-circle-check text-green-600"></i> ${l.seller_name}
                                </span>
                                <span class="text-amber-500 font-bold">★ ${l.seller_rating || '4.9'} (${l.review_count || 12})</span>
                            </div>

                            <!-- DIRECT CONTACT SYSTEM (sn1.txt Item 1 USP: Call / WhatsApp / Chat / Share) -->
                            <div class="grid grid-cols-4 gap-1.5 pt-2 border-t border-slate-100 text-xs">
                                <a href="tel:+91${sellerPhone.replace(/\D/g,'')}" class="py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-black text-[11px] text-center border border-blue-200 transition-colors flex items-center justify-center gap-1" title="Direct Phone Call">
                                    <i class="fa-solid fa-phone"></i> Call
                                </a>
                                <a href="https://wa.me/91${sellerPhone.replace(/\D/g,'')}?text=${waText}" target="_blank" class="py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl font-black text-[11px] text-center border border-emerald-300 transition-colors flex items-center justify-center gap-1" title="Chat on WhatsApp">
                                    <i class="fa-brands fa-whatsapp text-emerald-600"></i> WA
                                </a>
                                <button onclick="App.openDirectContactModal('${l.seller_name.replace(/'/g, "\\'")}', '${sellerPhone}', '${l.crop_name} (${l.quantity_quintals} Q)', ${l.id})" class="py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-black text-[11px] text-center transition-colors flex items-center justify-center gap-1" title="Direct Kisan Messenger">
                                    <i class="fa-solid fa-comment-dots"></i> Chat
                                </button>
                                <a href="https://wa.me/?text=${shareText}" target="_blank" class="py-1.5 bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 rounded-xl font-black text-[11px] text-center border border-slate-200 transition-colors flex items-center justify-center gap-1" title="Share Deal on WhatsApp">
                                    <i class="fa-solid fa-share-nodes text-emerald-600"></i>
                                </a>
                            </div>
                        </div>
                    </div>

                    <div class="p-5 pt-0">
                        <button onclick="Buyer.openBidModal(${l.id})" class="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-xs shadow-md shadow-green-600/20 flex items-center justify-center gap-2 transition-all">
                            <span>${isAuction ? 'Place Live Auction Bid' : 'Procure Produce with Escrow'}</span>
                            <i class="fa-solid fa-arrow-right"></i>
                        </button>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    },

    renderEscrowOrders: function (orders) {
        const container = document.getElementById('buyer-orders-container');
        if (!container) return;

        if (!orders || orders.length === 0) {
            container.innerHTML = `<div class="p-8 text-center text-slate-400 text-xs">No active escrow orders. Accept a bid or procure from marketplace above.</div>`;
            return;
        }

        let html = '';
        orders.forEach(o => {
            const isReleased = o.escrow_status === 'released';
            const isRefunded = o.escrow_status === 'refunded' || o.refund_status === 'processed';
            const isConfirmed = Number(o.confirmed_by_seller) === 1;

            let escrowBadge = '<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">🔒 Bank Escrow Funded</span>';
            if (o.escrow_status === 'assay_approved') escrowBadge = '<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">🔬 Lab Assay Approved</span>';
            if (o.escrow_status === 'dispatched') escrowBadge = '<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800">🚚 In-Transit (GPS Live)</span>';
            if (isReleased) escrowBadge = '<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800">🎉 Escrow Released</span>';
            if (isRefunded) escrowBadge = '<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">🔄 Refunded to Buyer</span>';

            html += `
                <div class="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs mb-4">
                    <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <div class="flex items-center gap-2">
                            <span class="font-mono text-xs font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded">Order #${o.id}</span>
                            <span class="font-bold text-sm text-slate-900">${o.crop_name} (${o.quantity} Q)</span>
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded ${isConfirmed ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}">
                                ${isConfirmed ? '✓ Confirmed by Seller' : '⏳ Unconfirmed'}
                            </span>
                        </div>
                        <div>${escrowBadge}</div>
                    </div>

                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-2xl text-xs mb-3">
                        <div>
                            <span class="text-slate-400 text-[10px]">Seller:</span>
                            <div class="font-bold text-slate-800">${o.seller_name}</div>
                        </div>
                        <div>
                            <span class="text-slate-400 text-[10px]">Total Escrow Amount:</span>
                            <div class="font-bold text-green-700">₹${o.total_amount.toLocaleString()}</div>
                        </div>
                        <div>
                            <span class="text-slate-400 text-[10px]">Logistics Status:</span>
                            <div class="font-bold text-slate-800">${o.transport_status}</div>
                        </div>
                        <div>
                            <span class="text-slate-400 text-[10px]">Delivery OTP:</span>
                            <div class="font-mono font-bold text-emerald-700">${o.delivery_otp_verified ? '✓ Verified' : (o.delivery_otp || '4821')}</div>
                        </div>
                    </div>

                    ${isRefunded ? `
                        <div class="p-3 bg-rose-50/70 border border-rose-200 rounded-2xl mb-3 text-xs text-rose-950">
                            <div class="flex justify-between font-bold mb-1">
                                <span>🔄 Order Refunded: ₹${(o.refund_amount || o.total_amount).toLocaleString()}</span>
                                <span class="font-mono text-[10px]">${o.refund_txn_id || 'REF-KS-SETTLED'}</span>
                            </div>
                            <div class="text-[11px] text-rose-700">${o.cancellation_reason || 'Policy refund settled to original bank account.'}</div>
                        </div>
                    ` : ''}

                    <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                        <div class="flex flex-wrap items-center gap-2">
                            <button onclick="Escrow.openDeliveryTrackingModal(${o.id})" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors">
                                <i class="fa-solid fa-truck-fast text-green-600"></i> 6-Stage Delivery Tracker
                            </button>
                            <button onclick="Escrow.openCertificateModal(${o.id})" class="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors">
                                <i class="fa-solid fa-award text-blue-600"></i> Quality Cert
                            </button>
                            <button onclick="Escrow.openQualityAssayModal(${o.id}, '${o.crop_name}')" class="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors">
                                <i class="fa-solid fa-flask-vial text-emerald-600"></i> Lab Assay
                            </button>
                        </div>

                        <div class="flex flex-wrap items-center gap-2">
                            ${!isReleased && !isRefunded ? `
                                <button onclick="Escrow.openPaymentModal(${o.id}, ${o.total_amount}, '${o.crop_name}')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1">
                                    <i class="fa-solid fa-wallet"></i> Pay Escrow
                                </button>
                                <button onclick="Escrow.openCancelOrderModal(${o.id}, ${o.total_amount}, ${o.confirmed_by_seller || 0}, '${o.crop_name}')" class="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl transition-colors">
                                    Cancel & Refund
                                </button>
                                <button onclick="App.openDisputeModal(${o.id})" class="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold text-xs rounded-xl transition-colors flex items-center gap-1" title="Report quality or logistics issue to pause escrow">
                                    <i class="fa-solid fa-triangle-exclamation text-amber-600"></i> Dispute
                                </button>
                                <button onclick="Buyer.advanceOrderEscrow(${o.id})" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs transition-colors">
                                    Advance ➔
                                </button>
                            ` : ''}

                            ${isReleased ? `
                                <button onclick="Buyer.openRatingModal(${o.id}, ${o.seller_id}, '${o.seller_name}')" class="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs rounded-xl flex items-center gap-1">
                                    ★ Leave Verified Review
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    },

    renderMyBids: function (bids) {
        // Buyer bids list
    },

    renderContracts: function (contracts) {
        const container = document.getElementById('contracts-list-container');
        if (!container) return;

        if (!contracts || contracts.length === 0) {
            container.innerHTML = `<div class="p-6 text-center text-slate-400 text-xs">No active contract requirements posted.</div>`;
            return;
        }

        let html = '';
        contracts.forEach(c => {
            html += `
                <div class="p-4 bg-slate-50 border border-slate-200 rounded-2xl mb-3 text-xs flex flex-col justify-between">
                    <div class="flex justify-between items-center mb-1">
                        <span class="font-bold text-sm text-slate-900">${c.crop_name} (${c.required_qty} Q)</span>
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">Guaranteed Buyback</span>
                    </div>
                    <div class="text-green-700 font-extrabold text-xs mb-1">Target Price: ₹${c.target_price_per_q.toLocaleString()}/Q • ${c.advance_pct}% Seed Advance</div>
                    <p class="text-slate-600 text-[11px] mb-2">${c.notes || c.quality_specs}</p>
                    <div class="text-[10px] text-slate-400">Deadline: ${c.delivery_deadline} • Region: ${c.location}</div>
                </div>
            `;
        });

        container.innerHTML = html;
    },

    openBidModal: async function (listingId) {
        try {
            const res = await fetch(`/api/listings/${listingId}`);
            const data = await res.json();
            if (data.success) {
                const l = data.listing;
                this.selectedListing = l;
                document.getElementById('bid-listing-id').value = l.id;
                document.getElementById('bid-modal-crop-title').textContent = `${l.crop_name} (${l.variety || 'Standard'})`;
                document.getElementById('bid-modal-seller-name').textContent = l.seller_name;
                document.getElementById('bid-modal-location').textContent = `${l.location}, ${l.state}`;
                document.getElementById('bid-modal-grade').textContent = l.grade;
                document.getElementById('bid-modal-base-price').textContent = `₹${l.base_price.toLocaleString()}/Q`;
                document.getElementById('bid-modal-qty-available').textContent = `${l.quantity_quintals} Quintals`;
                document.getElementById('bid-modal-highest-bid').textContent = `₹${l.base_price.toLocaleString()}/Q`;
                document.getElementById('bid-price-input').value = l.base_price;
                document.getElementById('bid-quantity-input').value = l.quantity_quintals;
                App.openModal('modal-bid');
            }
        } catch (e) {
            console.error(e);
        }
    },

    adjustBidPrice: function (amount) {
        const input = document.getElementById('bid-price-input');
        if (input) {
            input.value = (parseFloat(input.value) || 0) + amount;
        }
    },

    submitBid: async function (e) {
        if (e) e.preventDefault();

        const listing_id = parseInt(document.getElementById('bid-listing-id').value);
        const bid_price = parseFloat(document.getElementById('bid-price-input').value);
        const quantity = parseFloat(document.getElementById('bid-quantity-input').value);
        const message = document.getElementById('bid-message-input').value.trim();

        const buyer_id = Auth.currentUser ? Auth.currentUser.id : 3;

        try {
            const res = await fetch('/api/bids', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ buyer_id, listing_id, bid_price, quantity, message })
            });
            const data = await res.json();
            if (data.success) {
                App.showToast(data.message, "success");
                App.closeModal('modal-bid');
                await this.loadBuyerData();
            } else {
                App.showToast(data.error || "Bid placement failed", "error");
            }
        } catch (e) {
            App.showToast("Network error submitting bid", "error");
        }
    },

    openUpiPaymentModal: async function (orderId, amount) {
        try {
            const res = await fetch('/api/payments/generate-upi-qr', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: orderId, amount })
            });
            const data = await res.json();
            if (data.success) {
                this.currentUpiOrder = { orderId, amount, txnRef: data.txn_ref };
                document.getElementById('upi-qr-image').src = data.qr_svg_url;
                document.getElementById('upi-amount-display').textContent = `₹${amount.toLocaleString()}`;
                document.getElementById('upi-txn-ref-display').textContent = data.txn_ref;
                App.openModal('modal-upi-payment');
            }
        } catch (e) {
            console.error(e);
        }
    },

    verifyUpiPayment: async function () {
        if (!this.currentUpiOrder) return;
        try {
            App.showToast("Verifying UPI transaction with ICICI Escrow Gateway...", "info");
            const res = await fetch('/api/payments/verify-upi', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.currentUpiOrder)
            });
            const data = await res.json();
            if (data.success) {
                App.showToast(data.message, "success");
                App.closeModal('modal-upi-payment');
                await this.loadBuyerData();
            }
        } catch (e) {
            console.error(e);
        }
    },

    openRatingModal: function (orderId, sellerId, sellerName) {
        document.getElementById('rating-order-id').value = orderId;
        document.getElementById('rating-seller-id').value = sellerId;
        document.getElementById('rating-seller-name-display').textContent = sellerName;
        App.openModal('modal-rating-review');
    },

    submitRating: async function (e) {
        if (e) e.preventDefault();

        const order_id = parseInt(document.getElementById('rating-order-id').value);
        const rated_user_id = parseInt(document.getElementById('rating-seller-id').value);
        const rating = parseInt(document.getElementById('rating-stars-select').value);
        const comment = document.getElementById('rating-comment-input').value.trim();

        try {
            const res = await fetch('/api/ratings/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    order_id,
                    rated_user_id,
                    reviewer_id: Auth.currentUser ? Auth.currentUser.id : 3,
                    rating,
                    comment
                })
            });
            const data = await res.json();
            if (data.success) {
                App.showToast(data.message, "success");
                App.closeModal('modal-rating-review');
                await this.loadBuyerData();
            }
        } catch (e) {
            console.error(e);
        }
    },

    openTrackingModal: async function (orderId) {
        try {
            const res = await fetch(`/api/orders/${orderId}/tracking`);
            const data = await res.json();
            if (data.success) {
                const o = data.order;
                const container = document.getElementById('logistics-timeline-container');
                document.getElementById('logistics-order-title').textContent = `Order #${o.id} • ${o.crop_name} (${o.quantity} Q)`;
                document.getElementById('logistics-vehicle-display').textContent = o.vehicle_no;
                document.getElementById('logistics-driver-display').textContent = `+91 ${o.driver_phone}`;
                document.getElementById('logistics-checkpoint-display').textContent = o.location_checkpoint;

                let tlHtml = '';
                data.tracking_timeline.forEach(step => {
                    tlHtml += `
                        <div class="flex items-start gap-3 relative pb-4">
                            <div class="w-6 h-6 rounded-full ${step.done ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-400'} flex items-center justify-center text-xs font-bold flex-shrink-0">
                                ${step.done ? '✓' : '•'}
                            </div>
                            <div>
                                <div class="font-bold text-xs text-slate-800">${step.step}</div>
                                <div class="text-[10px] text-slate-400">${step.time}</div>
                            </div>
                        </div>
                    `;
                });
                container.innerHTML = tlHtml;
                App.openModal('modal-logistics-tracker');
            }
        } catch (e) {
            console.error(e);
        }
    },

    advanceOrderEscrow: async function (orderId) {
        try {
            const res = await fetch(`/api/orders/${orderId}/advance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            const data = await res.json();
            if (data.success) {
                App.showToast(data.message, "success");
                await this.loadBuyerData();
            }
        } catch (e) {
            console.error(e);
        }
    },

    submitContract: async function (e) {
        if (e) e.preventDefault();

        const crop_name = document.getElementById('contract-crop-name').value;
        const required_qty = parseFloat(document.getElementById('contract-qty').value);
        const target_price_per_q = parseFloat(document.getElementById('contract-price').value);
        const advance_pct = parseFloat(document.getElementById('contract-advance').value);
        const delivery_deadline = document.getElementById('contract-deadline').value;
        const location = document.getElementById('contract-cluster').value;

        try {
            const res = await fetch('/api/contracts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    buyer_id: Auth.currentUser ? Auth.currentUser.id : 3,
                    crop_name,
                    required_qty,
                    target_price_per_q,
                    advance_pct,
                    delivery_deadline,
                    location,
                    quality_specs: "Grade A Prime Sortex",
                    notes: "Direct procurement with upfront seed capital advance."
                })
            });
            const data = await res.json();
            if (data.success) {
                App.showToast(data.message, "success");
                App.closeModal('modal-create-contract');
                await this.loadContracts();
            }
        } catch (e) {
            App.showToast("Error creating contract requirement", "error");
        }
    }
};

window.Buyer = Buyer;
