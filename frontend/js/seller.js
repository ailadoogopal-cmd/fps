/**
 * KrishiSetu Seller Dashboard Controller (Farmer & FPO Aggregations)
 * Handles Crop Listings, Quality Grading, Live Bids, e-NWR Warehousing, Credit Scores & Produce Upload
 */
const Seller = {
    myListings: [],
    myBids: [],
    myOrders: [],
    myReceipts: [],
    myRatings: [],
    creditProfile: null,
    uploadedImageUrl: null,

    init: async function () {
        if (!Auth.currentUser || Auth.currentUser.role !== 'seller') return;
        await this.loadSellerData();
        this.bindQualityCalculator();
    },

    loadSellerData: async function () {
        const userId = Auth.currentUser ? Auth.currentUser.id : 1;
        await Promise.all([
            this.loadMyListings(userId),
            this.loadMyBids(userId),
            this.loadMyOrders(userId),
            this.loadMyReceipts(userId),
            this.loadCreditScore(userId),
            this.loadRatings(userId),
            this.loadAiBestCrop()
        ]);
        this.updateSellerSummaryMetrics();
    },

    loadAiBestCrop: async function () {
        try {
            const res = await fetch('/api/ai/best-crop');
            const data = await res.json();
            if (data.success) {
                const confEl = document.getElementById('ai-best-crop-confidence');
                const nameEl = document.getElementById('ai-best-crop-name');
                const changeEl = document.getElementById('ai-best-crop-change');
                const priceEl = document.getElementById('ai-best-crop-price');
                const adviceEl = document.getElementById('ai-best-crop-advice');

                if (confEl) confEl.textContent = data.confidence_score || '92.4%';
                if (nameEl) nameEl.textContent = data.recommended_crop;
                if (changeEl) changeEl.textContent = `${data.projected_change} Surge`;
                if (priceEl) priceEl.textContent = `₹${data.current_price.toLocaleString()} / Quintal`;
                if (adviceEl) adviceEl.textContent = data.action_advice;
            }
        } catch (e) {
            console.error("Error loading AI best crop:", e);
        }
    },

    loadMyOrders: async function (userId) {
        try {
            const res = await fetch(`/api/orders?user_id=${userId}&role=seller`);
            const data = await res.json();
            if (data.success) {
                this.myOrders = data.orders;
                this.renderMyOrders(data.orders);
            }
        } catch (e) {
            console.error("Error loading seller orders:", e);
        }
    },

    renderMyOrders: function (orders) {
        const container = document.getElementById('seller-orders-container');
        if (!container) return;

        if (!orders || orders.length === 0) {
            container.innerHTML = `<div class="p-6 text-center text-slate-400 text-xs">No active buyer orders yet. Accepted bids become locked escrow orders here.</div>`;
            return;
        }

        let html = '';
        orders.forEach(o => {
            const isConfirmed = Number(o.confirmed_by_seller) === 1;
            const isReleased = o.escrow_status === 'released';
            const isRefunded = o.escrow_status === 'refunded';

            html += `
                <div class="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs mb-4">
                    <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div class="flex items-center gap-2">
                            <span class="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">Order #${o.id}</span>
                            <span class="font-black text-slate-900">${o.crop_name} (${o.quantity} Q)</span>
                        </div>
                        <span class="px-2.5 py-0.5 rounded-full text-xs font-bold ${isReleased ? 'bg-green-100 text-green-800' : (isRefunded ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800')}">
                            ${isReleased ? '🎉 Funds Released' : (isRefunded ? '🔄 Refunded' : '🔒 Escrow Locked')}
                        </span>
                    </div>

                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-slate-50 rounded-2xl text-xs mb-3">
                        <div>
                            <span class="text-slate-400 text-[10px]">Buyer / Mill:</span>
                            <div class="font-bold text-slate-800">${o.buyer_name}</div>
                        </div>
                        <div>
                            <span class="text-slate-400 text-[10px]">Escrow Deposit:</span>
                            <div class="font-bold text-green-700">₹${o.total_amount.toLocaleString()}</div>
                        </div>
                        <div>
                            <span class="text-slate-400 text-[10px]">Seller Confirmation:</span>
                            <div class="font-bold ${isConfirmed ? 'text-green-700' : 'text-amber-700'}">${isConfirmed ? '✓ Confirmed' : '⏳ Action Required'}</div>
                        </div>
                        <div>
                            <span class="text-slate-400 text-[10px]">Delivery OTP:</span>
                            <div class="font-mono font-bold text-slate-800">${o.delivery_otp_verified ? '✓ Verified' : 'Buyer Handover'}</div>
                        </div>
                    </div>

                    <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                        <div class="flex items-center gap-2">
                            <button onclick="Escrow.openDeliveryTrackingModal(${o.id})" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors">
                                <i class="fa-solid fa-truck-fast text-green-600"></i> Track Delivery
                            </button>
                            <button onclick="Escrow.openCertificateModal(${o.id})" class="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors">
                                <i class="fa-solid fa-award text-blue-600"></i> Quality Cert
                            </button>
                            <button onclick="Escrow.openQualityAssayModal(${o.id}, '${o.crop_name}')" class="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors">
                                <i class="fa-solid fa-flask-vial text-emerald-600"></i> Lab Assay
                            </button>
                        </div>

                        <div class="flex items-center gap-2">
                            ${!isConfirmed && !isRefunded && !isReleased ? `
                                <button onclick="Escrow.confirmOrderSeller(${o.id})" class="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors">
                                    ✓ Confirm Order & Dispatch
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    },

    loadCreditScore: async function (userId) {
        try {
            const res = await fetch(`/api/farmer/credit-score?user_id=${userId}`);
            const data = await res.json();
            if (data.success) {
                this.creditProfile = data.credit_profile;
                this.renderCreditScoreUI(data.credit_profile);
            }
        } catch (e) {
            console.error("Error loading credit score:", e);
        }
    },

    loadRatings: async function (userId) {
        try {
            const res = await fetch(`/api/ratings?user_id=${userId}`);
            const data = await res.json();
            if (data.success) {
                this.myRatings = data.reviews;
                this.renderRatingsUI(data);
            }
        } catch (e) {
            console.error("Error loading seller ratings:", e);
        }
    },

    renderCreditScoreUI: function (cp) {
        const container = document.getElementById('seller-credit-score-widget');
        if (!container || !cp) return;

        let benefitsList = '';
        cp.benefits.forEach(b => {
            benefitsList += `<li class="flex items-center gap-1.5 text-xs text-emerald-900"><i class="fa-solid fa-circle-check text-emerald-600"></i> ${b}</li>`;
        });

        container.innerHTML = `
            <div class="bg-gradient-to-r from-emerald-900 via-green-900 to-teal-950 text-white p-6 rounded-3xl border border-emerald-500/40 shadow-xl relative overflow-hidden">
                <div class="flex flex-wrap items-center justify-between gap-4 mb-3">
                    <div class="flex items-center gap-3">
                        <div class="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-3xl font-black text-amber-300">
                            🛡️
                        </div>
                        <div>
                            <span class="text-[10px] font-black uppercase tracking-wider text-emerald-300 bg-emerald-800/80 px-2 py-0.5 rounded">${cp.tier}</span>
                            <h3 class="font-extrabold text-xl text-white mt-0.5">Kisan Credit & Trust Score: <span class="text-amber-300 font-black text-2xl">${cp.score}</span> / 850</h3>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="text-xs text-emerald-200">Eligible Pledge LTV</div>
                        <div class="text-2xl font-black text-emerald-300">${cp.ltv_eligible_pct}%</div>
                    </div>
                </div>

                <div class="w-full bg-white/10 rounded-full h-2.5 mb-4 overflow-hidden">
                    <div class="bg-gradient-to-r from-amber-400 to-emerald-400 h-2.5 rounded-full" style="width: ${(cp.score / 850) * 100}%"></div>
                </div>

                <div class="bg-white/95 p-3.5 rounded-2xl">
                    <div class="text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                        <i class="fa-solid fa-gift text-green-600"></i> Active Score Privileges:
                    </div>
                    <ul class="space-y-1">
                        ${benefitsList}
                    </ul>
                </div>
            </div>
        `;
    },

    renderRatingsUI: function (data) {
        const container = document.getElementById('seller-ratings-container');
        if (!container) return;

        if (!data.reviews || data.reviews.length === 0) {
            container.innerHTML = `<div class="p-4 text-xs text-slate-400 text-center">No buyer reviews yet. Completed escrow trades will display here.</div>`;
            return;
        }

        let html = `
            <div class="flex items-center gap-3 mb-3 p-3 bg-amber-50/60 border border-amber-200 rounded-2xl">
                <div class="text-3xl font-black text-amber-600">${data.average_rating}</div>
                <div>
                    <div class="text-amber-500 text-xs">
                        ${'★'.repeat(Math.round(data.average_rating))}${'☆'.repeat(5 - Math.round(data.average_rating))}
                    </div>
                    <div class="text-[11px] text-slate-600 font-bold">${data.total_reviews} Verified Buyer Reviews</div>
                </div>
            </div>
        `;

        data.reviews.slice(0, 3).forEach(r => {
            html += `
                <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl mb-2 text-xs">
                    <div class="flex items-center justify-between mb-1">
                        <span class="font-bold text-slate-800">${r.reviewer_name}</span>
                        <span class="text-amber-500 font-bold">${'★'.repeat(r.rating)}</span>
                    </div>
                    <p class="text-slate-600 text-[11px] italic">"${r.comment}"</p>
                </div>
            `;
        });

        container.innerHTML = html;
    },

    handlePhotoUpload: async function (input) {
        if (!input.files || !input.files[0]) return;
        const file = input.files[0];

        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64Data = e.target.result;
            const preview = document.getElementById('list-photo-preview');
            if (preview) {
                preview.src = base64Data;
                preview.classList.remove('hidden');
            }

            try {
                App.showToast("Uploading produce photograph...", "info");
                const res = await fetch('/api/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filename: file.name, base64: base64Data })
                });
                const data = await res.json();
                if (data.success) {
                    this.uploadedImageUrl = data.file_url;
                    App.showToast("Photograph uploaded successfully!", "success");
                }
            } catch (err) {
                console.error("Upload error:", err);
            }
        };
        reader.readAsDataURL(file);
    },

    loadMyListings: async function (userId) {
        try {
            const res = await fetch(`/api/listings?seller_id=${userId}&status=all`);
            const data = await res.json();
            if (data.success) {
                this.myListings = data.listings;
                this.renderMyListings(data.listings);
            }
        } catch (e) {
            console.error("Error loading seller listings:", e);
        }
    },

    loadMyBids: async function (userId) {
        try {
            const res = await fetch(`/api/bids?seller_id=${userId}`);
            const data = await res.json();
            if (data.success) {
                this.myBids = data.bids;
                this.renderMyBids(data.bids);
            }
        } catch (e) {
            console.error("Error loading seller bids:", e);
        }
    },

    loadMyReceipts: async function (userId) {
        try {
            const res = await fetch(`/api/warehouse/receipts?user_id=${userId}`);
            const data = await res.json();
            if (data.success) {
                this.myReceipts = data.receipts;
                this.renderWarehouseReceipts(data.receipts);
            }
        } catch (e) {
            console.error("Error loading warehouse receipts:", e);
        }
    },

    updateSellerSummaryMetrics: function () {
        const totalListings = this.myListings.length;
        const totalQty = this.myListings.reduce((acc, l) => acc + l.quantity_quintals, 0);
        const pendingBids = this.myBids.filter(b => b.status === 'pending').length;
        const totalStored = this.myReceipts.reduce((acc, r) => acc + r.quantity_quintals, 0);
        const loansReceived = this.myReceipts.reduce((acc, r) => acc + (r.loan_status === 'disbursed' ? r.loan_amount : 0), 0);

        const elListings = document.getElementById('seller-metric-listings');
        const elBids = document.getElementById('seller-metric-bids');
        const elStored = document.getElementById('seller-metric-warehouse');
        const elLoans = document.getElementById('seller-metric-loans');

        if (elListings) elListings.textContent = `${totalListings} (${totalQty} Q)`;
        if (elBids) elBids.textContent = pendingBids;
        if (elStored) elStored.textContent = `${totalStored} Q`;
        if (elLoans) elLoans.textContent = `₹${loansReceived.toLocaleString()}`;
    },

    renderMyListings: function (listings) {
        const container = document.getElementById('seller-listings-table-body');
        if (!container) return;

        if (!listings || listings.length === 0) {
            container.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-slate-400">No active crop listings yet. Click "List New Crop" above to start selling.</td></tr>`;
            return;
        }

        let html = '';
        const cropImgMap = {
            'wheat':'img_wheat.jpg',
            'gehu':'img_wheat.jpg',
            'rice':'img_rice.jpg',
            'chawal':'img_rice.jpg',
            'paddy':'img_rice.jpg',
            'maize':'img_maize.jpg',
            'corn':'img_maize.jpg',
            'makka':'img_maize.jpg',
            'soybean':'img_soybean.jpg',
            'soya':'img_soybean.jpg',
            'mustard':'img_mustard.jpg',
            'sarson':'img_mustard.jpg',
            'onion':'img_onion.jpg',
            'pyaz':'img_onion.jpg',
            'cotton':'img_cotton.jpg',
            'kapas':'img_cotton.jpg',
            'okra':'img_okra_harvest.jpg',
            'bhindi':'img_okra_harvest.jpg',
            'sunflower':'https://images.unsplash.com/photo-1490750967868-88df5691cc99?w=200&auto=format&fit=crop&q=80',
            'groundnut':'https://images.unsplash.com/photo-1567894340315-735d7c361db0?w=200&auto=format&fit=crop&q=80',
            'chana':'https://images.unsplash.com/photo-1515543904379-3d757afe72e4?w=200&auto=format&fit=crop&q=80',
            'chickpea':'https://images.unsplash.com/photo-1515543904379-3d757afe72e4?w=200&auto=format&fit=crop&q=80',
            'tomato':'https://images.unsplash.com/photo-1558818498-28c1e002b655?w=200&auto=format&fit=crop&q=80',
            'potato':'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=200&auto=format&fit=crop&q=80',
            'garlic':'https://images.unsplash.com/photo-1540148426945-6cf22a6b2383?w=200&auto=format&fit=crop&q=80',
            'ginger':'https://images.unsplash.com/photo-1573414405541-c7e4bf94b34b?w=200&auto=format&fit=crop&q=80',
            'turmeric':'https://images.unsplash.com/photo-1615485500704-8e990f9900f7?w=200&auto=format&fit=crop&q=80',
            'chilli':'https://images.unsplash.com/photo-1583119022894-919a68a3d0e3?w=200&auto=format&fit=crop&q=80',
            'sugarcane':'https://images.unsplash.com/photo-1589871973318-9ca1258faa5d?w=200&auto=format&fit=crop&q=80',
            'mango':'https://images.unsplash.com/photo-1553279768-865429fa0078?w=200&auto=format&fit=crop&q=80',
            'banana':'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=200&auto=format&fit=crop&q=80',
        };
        listings.forEach(l => {
            const gradeClass = l.grade.includes('Grade A') ? 'badge-grade-a' : 'badge-grade-b';
            const statusBadge = l.status === 'active' 
                ? `<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">🟢 Active</span>`
                : (l.status === 'sold' ? `<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">🤝 Sold</span>` : `<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">⏳ Negotiation</span>`);
            const cropKey = Object.keys(cropImgMap).find(k => (l.crop_name||'').toLowerCase().includes(k));
            let thumbImg = l.image_url;
            if (!thumbImg || thumbImg.includes('photo-1574323347407-f5e1ad6d020b')) {
                thumbImg = cropKey ? cropImgMap[cropKey] : (thumbImg || 'img_wheat.jpg');
            } else if (cropKey && (thumbImg.includes('img_okra_harvest') || thumbImg.includes('img_corn_sunset'))) {
                thumbImg = cropImgMap[cropKey];
            }

            html += `
                <tr class="hover:bg-slate-50 transition-colors border-b border-slate-100">
                    <td class="px-4 py-3 font-semibold text-slate-900 flex items-center gap-2">
                        <img src="${thumbImg}" class="w-10 h-10 rounded-xl object-cover border border-slate-200 shadow-xs" />
                        <div>
                            <div>${l.crop_name}</div>
                            <span class="text-xs text-slate-500 font-normal">${l.variety || 'Standard'}</span>
                        </div>
                    </td>
                    <td class="px-4 py-3 text-xs font-bold text-slate-800">${l.quantity_quintals} Q</td>
                    <td class="px-4 py-3 text-xs font-bold text-green-700">₹${l.base_price.toLocaleString()}/Q</td>
                    <td class="px-4 py-3"><span class="${gradeClass}">${l.grade}</span></td>
                    <td class="px-4 py-3 text-xs uppercase font-bold ${l.sale_type === 'auction' ? 'text-amber-700' : 'text-slate-600'}">${l.sale_type}</td>
                    <td class="px-4 py-3">${statusBadge}</td>
                    <td class="px-4 py-3 text-xs font-semibold text-slate-700">
                        ${l.bid_count > 0 ? `<span class="text-amber-700 font-bold">${l.bid_count} Bids (Top: ₹${l.highest_bid})</span>` : '0 Bids'}
                    </td>
                </tr>
            `;
        });

        container.innerHTML = html;
    },

    renderMyBids: function (bids) {
        const container = document.getElementById('seller-bids-list-container');
        if (!container) return;

        if (!bids || bids.length === 0) {
            container.innerHTML = `<div class="p-8 text-center text-slate-400 text-xs">No pending buyer bids at this moment.</div>`;
            return;
        }

        let html = '';
        bids.forEach(b => {
            const isPending = b.status === 'pending';
            html += `
                <div class="p-4 bg-slate-50 border border-slate-200 rounded-2xl mb-3 transition-all hover:border-slate-300 shadow-xs">
                    <div class="flex items-center justify-between mb-1.5">
                        <span class="font-bold text-xs text-slate-900">${b.buyer_name} (${b.business_type || 'Trader'})</span>
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold ${isPending ? 'bg-amber-100 text-amber-800' : (b.status === 'accepted' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800')} uppercase">
                            ${b.status}
                        </span>
                    </div>

                    <div class="text-xs text-slate-600 mb-2">
                        Offered <strong class="text-green-700 font-extrabold text-sm">₹${b.bid_price.toLocaleString()}/Q</strong> for <strong>${b.quantity} Q</strong> of ${b.crop_name}
                        <div class="text-[11px] text-slate-500 mt-0.5">Total Value: <strong>₹${(b.bid_price * b.quantity).toLocaleString()}</strong></div>
                    </div>

                    ${b.message ? `<p class="text-[11px] text-slate-500 italic bg-white p-2 rounded-lg border border-slate-100 mb-3">"${b.message}"</p>` : ''}

                    ${isPending ? `
                        <div class="flex gap-2">
                            <button onclick="Seller.respondToBid(${b.id}, 'accept')" class="flex-1 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-xs shadow-xs transition-colors">
                                Accept Bid (Lock Escrow)
                            </button>
                            <button onclick="Seller.respondToBid(${b.id}, 'reject')" class="py-1.5 px-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-bold text-xs transition-colors">
                                Reject
                            </button>
                        </div>
                    ` : ''}
                </div>
            `;
        });

        container.innerHTML = html;
    },

    renderWarehouseReceipts: function (receipts) {
        const container = document.getElementById('seller-warehouse-receipts-container');
        if (!container) return;

        if (!receipts || receipts.length === 0) {
            container.innerHTML = `<div class="p-6 text-center text-slate-400 text-xs col-span-2">No warehouse deposits yet. Click "Warehouse Deposit" above to create an e-NWR receipt.</div>`;
            return;
        }

        let html = '';
        receipts.forEach(r => {
            const hasLoan = r.loan_status === 'disbursed';
            const isApplied = r.loan_status === 'applied';

            html += `
                <div class="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs relative overflow-hidden flex flex-col justify-between">
                    <div>
                        <div class="flex items-center justify-between mb-2">
                            <span class="font-mono text-xs font-extrabold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">${r.receipt_no}</span>
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${hasLoan ? 'bg-blue-100 text-blue-800' : (isApplied ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800')}">
                                ${hasLoan ? '💰 Loan Disbursed' : (isApplied ? '⏳ Loan Applied' : '🟢 Ready for Loan')}
                            </span>
                        </div>

                        <h4 class="font-bold text-slate-900 text-sm">${r.crop_name} (${r.quantity_quintals} Q)</h4>
                        <p class="text-xs text-slate-500 mt-0.5">${r.warehouse_name} • ${r.location}</p>

                        <div class="mt-3 p-3 bg-slate-50 rounded-2xl space-y-1 text-xs">
                            <div class="flex justify-between text-slate-600">
                                <span>Est. Market Value:</span>
                                <span class="font-bold text-slate-900">₹${r.estimated_value.toLocaleString()}</span>
                            </div>
                            <div class="flex justify-between text-emerald-700 font-bold">
                                <span>Max Loan Eligible (75% LTV):</span>
                                <span>₹${r.max_loan_amount.toLocaleString()}</span>
                            </div>
                            ${hasLoan ? `
                                <div class="flex justify-between text-blue-700 font-extrabold pt-1 border-t border-slate-200">
                                    <span>Active Loan Disbursed:</span>
                                    <span>₹${r.loan_amount.toLocaleString()}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>

                    <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span class="text-[10px] text-slate-400">Valid: ${r.deposit_date} to ${r.expiry_date}</span>
                        ${!hasLoan && !isApplied ? `
                            <button onclick="Seller.openPledgeLoanModal(${r.id}, '${r.receipt_no}', ${r.max_loan_amount})" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-xs transition-colors">
                                Apply 75% Pledge Loan
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    },

    bindQualityCalculator: function () {
        const mInput = document.getElementById('list-moisture-input');
        const fInput = document.getElementById('list-foreign-input');
        const preview = document.getElementById('list-grade-preview');

        const updateGrade = () => {
            if (!mInput || !fInput || !preview) return;
            const m = parseFloat(mInput.value) || 0;
            const f = parseFloat(fInput.value) || 0;

            if (m <= 12.0 && f <= 1.0) {
                preview.className = "px-3 py-1 rounded-full text-xs font-bold badge-grade-a";
                preview.textContent = "Grade A (Prime Quality)";
            } else if (m <= 14.0 && f <= 2.0) {
                preview.className = "px-3 py-1 rounded-full text-xs font-bold badge-grade-b";
                preview.textContent = "Grade B (Standard Quality)";
            } else {
                preview.className = "px-3 py-1 rounded-full text-xs font-bold badge-grade-c";
                preview.textContent = "Grade C (FAQ)";
            }
        };

        if (mInput) mInput.addEventListener('input', updateGrade);
        if (fInput) fInput.addEventListener('input', updateGrade);
    },

    submitCropListing: async function (e) {
        if (e) e.preventDefault();

        const crop_name = document.getElementById('list-crop-name').value;
        const variety = document.getElementById('list-variety').value;
        const category = document.getElementById('list-category').value;
        const quantity = parseFloat(document.getElementById('list-quantity').value);
        const base_price = parseFloat(document.getElementById('list-base-price').value);
        const sale_type = document.getElementById('list-sale-type').value;
        const moisture_pct = parseFloat(document.getElementById('list-moisture-input').value);
        const foreign_matter_pct = parseFloat(document.getElementById('list-foreign-input').value);
        const location = document.getElementById('list-location').value;
        const state = document.getElementById('list-state').value;
        const description = `${variety} from ${location}. Moisture: ${moisture_pct}%, Foreign Matter: ${foreign_matter_pct}%. Certified Sortex Clean.`;

        const payload = {
            seller_id: Auth.currentUser ? Auth.currentUser.id : 1,
            crop_name,
            variety,
            category,
            quantity_quintals: quantity,
            base_price,
            sale_type,
            moisture_pct,
            foreign_matter_pct,
            location,
            state,
            description,
            image_url: this.uploadedImageUrl
        };

        try {
            const res = await fetch('/api/listings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (data.success) {
                App.showToast(data.message, "success");
                App.closeModal('modal-list-crop');
                this.uploadedImageUrl = null;
                await this.loadSellerData();
                Market.loadPrices();
            } else {
                App.showToast(data.error || "Failed to post listing", "error");
            }
        } catch (e) {
            App.showToast("Network error submitting listing", "error");
        }
    },

    respondToBid: async function (bidId, action) {
        try {
            const res = await fetch(`/api/bids/${bidId}/respond`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action })
            });
            const data = await res.json();

            if (data.success) {
                App.showToast(data.message, "success");
                await this.loadSellerData();
            } else {
                App.showToast(data.error || "Action failed", "error");
            }
        } catch (e) {
            App.showToast("Network error responding to bid", "error");
        }
    },

    openPledgeLoanModal: function (receiptId, receiptNo, maxLoan) {
        document.getElementById('loan-receipt-id').value = receiptId;
        document.getElementById('loan-receipt-no-display').textContent = receiptNo;
        document.getElementById('loan-max-amount-display').textContent = `₹${maxLoan.toLocaleString()}`;
        document.getElementById('loan-amount-input').value = maxLoan;
        App.openModal('modal-pledge-loan');
    },

    submitPledgeLoan: async function (e) {
        if (e) e.preventDefault();

        const receiptId = document.getElementById('loan-receipt-id').value;
        const loanAmount = parseFloat(document.getElementById('loan-amount-input').value);

        if (!loanAmount || loanAmount <= 0) {
            App.showToast("Please enter a valid loan amount", "warning");
            return;
        }

        try {
            const res = await fetch('/api/warehouse/apply-loan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ receipt_id: receiptId, loan_amount: loanAmount })
            });
            const data = await res.json();

            if (data.success) {
                App.showToast(data.message, "success");
                App.closeModal('modal-pledge-loan');
                await this.loadSellerData();
            } else {
                App.showToast(data.error || "Loan application failed", "error");
            }
        } catch (e) {
            App.showToast("Network error applying for pledge loan", "error");
        }
    }
};

window.Seller = Seller;
