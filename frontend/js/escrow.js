/**
 * KrishiSetu Escrow & Financial Engine Controller
 * Handles Multi-Method Payments (UPI, NetBanking, RTGS, Wallet),
 * NABL Quality Assaying & Digital Certificates,
 * Policy-Based Order Cancellation & Refunds,
 * 6-Stage Delivery Logistics & Secure 4-Digit Delivery OTP Escrow Release.
 */
const Escrow = {
    currentPaymentOrder: null,
    currentPaymentMethod: 'upi',
    currentTrackingOrder: null,

    init: function () {
        console.log("🔒 Escrow & Quality Engine Initialized");
    },

    // =========================================================================
    appliedCoupon: null,

    // =========================================================================
    // 1. MULTI-METHOD PAYMENT ENGINE
    // =========================================================================
    openPaymentModal: async function (orderId, amount, cropName = 'Produce Lot') {
        this.currentPaymentOrder = { orderId, amount, cropName };
        this.currentPaymentMethod = 'upi';
        this.appliedCoupon = null;

        const modalTitle = document.getElementById('payment-modal-order-title');
        const modalAmount = document.getElementById('payment-modal-amount-display');
        const orderIdHidden = document.getElementById('payment-modal-order-id');
        const couponInput = document.getElementById('payment-coupon-input');
        const discountBadge = document.getElementById('payment-discount-badge');

        if (modalTitle) modalTitle.textContent = `Order #${orderId} • ${cropName}`;
        if (modalAmount) modalAmount.textContent = `₹${amount.toLocaleString()}`;
        if (orderIdHidden) orderIdHidden.value = orderId;
        if (couponInput) couponInput.value = '';
        if (discountBadge) discountBadge.classList.add('hidden');

        this.setPaymentMethod('upi');
        App.openModal('modal-multi-payment');
    },

    applyCoupon: function () {
        const input = document.getElementById('payment-coupon-input');
        const code = input ? input.value.trim().toUpperCase() : '';
        if (code === 'KISAN50') {
            this.appliedCoupon = { code: 'KISAN50', discount: 500 };
            const discountBadge = document.getElementById('payment-discount-badge');
            if (discountBadge) discountBadge.classList.remove('hidden');

            if (this.currentPaymentOrder) {
                const discounted = Math.max(0, this.currentPaymentOrder.amount - 500);
                const amountDisplay = document.getElementById('payment-modal-amount-display');
                if (amountDisplay) amountDisplay.textContent = `₹${discounted.toLocaleString()}`;
            }
            App.showToast("🎉 Promo Code KISAN50 Applied! Flat ₹500 discount deducted from escrow payable amount.", "success");
        } else {
            App.showToast("Invalid coupon. Enter KISAN50 for flat ₹500 off your order!", "warning");
        }
    },

    removeCoupon: function () {
        this.appliedCoupon = null;
        const discountBadge = document.getElementById('payment-discount-badge');
        if (discountBadge) discountBadge.classList.add('hidden');
        if (this.currentPaymentOrder) {
            const amountDisplay = document.getElementById('payment-modal-amount-display');
            if (amountDisplay) amountDisplay.textContent = `₹${this.currentPaymentOrder.amount.toLocaleString()}`;
        }
    },

    setPaymentMethod: async function (method) {
        this.currentPaymentMethod = method;
        const methods = ['upi', 'cod', 'netbanking', 'rtgs', 'wallet'];
        
        methods.forEach(m => {
            const btn = document.getElementById(`pay-tab-${m}`);
            const pane = document.getElementById(`pay-pane-${m}`);
            if (btn) {
                if (m === method) {
                    btn.className = "flex-1 py-2 text-center rounded-xl bg-green-600 text-white shadow-xs transition-all";
                } else {
                    btn.className = "flex-1 py-2 text-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all";
                }
            }
            if (pane) {
                pane.classList.toggle('hidden', m !== method);
            }
        });

        if (!this.currentPaymentOrder) return;
        const { orderId, amount } = this.currentPaymentOrder;
        const payableAmount = this.appliedCoupon ? Math.max(0, amount - 500) : amount;

        // Generate intent via backend
        try {
            const res = await fetch('/api/payments/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    order_id: orderId,
                    amount: payableAmount,
                    payment_method: method,
                    payer_id: Auth.currentUser ? Auth.currentUser.id : 3
                })
            });
            const data = await res.json();
            if (data.success) {
                this.currentPaymentOrder.payment_id = data.payment_id;
                this.currentPaymentOrder.txn_ref = data.txn_ref;

                if (method === 'upi') {
                    const qrImg = document.getElementById('pay-upi-qr-image');
                    const refDisplay = document.getElementById('pay-upi-ref-display');
                    if (qrImg) qrImg.src = data.payment_details.qr_svg_url || `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data.payment_details.upi_uri)}`;
                    if (refDisplay) refDisplay.textContent = `UPI Ref: ${data.txn_ref}`;
                } else if (method === 'rtgs') {
                    const accEl = document.getElementById('pay-rtgs-virtual-acc');
                    const ifscEl = document.getElementById('pay-rtgs-ifsc');
                    if (accEl) accEl.textContent = data.payment_details.virtual_account_no;
                    if (ifscEl) ifscEl.textContent = data.payment_details.ifsc_code;
                }
            }
        } catch (e) {
            console.error("Error creating payment intent:", e);
        }
    },

    confirmCodOrder: async function () {
        if (!this.currentPaymentOrder) return;
        const { orderId, amount } = this.currentPaymentOrder;
        const finalAmount = this.appliedCoupon ? Math.max(0, amount - 500) : amount;

        try {
            App.showToast("Confirming Cash on Delivery / Pay on Inspection...", "info");
            const res = await fetch('/api/payments/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    order_id: orderId,
                    payment_id: this.currentPaymentOrder.payment_id || 1,
                    payment_method: 'cod',
                    txn_ref: 'COD-' + Date.now().toString().slice(-6),
                    bank_name: 'Cash / Pay on Inspection',
                    amount: finalAmount
                })
            });
            const data = await res.json();
            if (data.success) {
                App.showToast("🚚 Order Confirmed via Cash on Delivery! Inspect produce upon arrival and confirm with 4-digit OTP.", "success");
                App.closeModal('modal-multi-payment');
                if (Auth.currentUser && Auth.currentUser.role === 'buyer') {
                    await Buyer.loadBuyerData();
                } else if (Auth.currentUser && Auth.currentUser.role === 'seller') {
                    await Seller.loadSellerData();
                }
            } else {
                App.showToast(data.error || "Failed to confirm COD order", "error");
            }
        } catch (e) {
            App.showToast("Error processing COD confirmation", "error");
        }
    },

    verifyPayment: async function (bank) {
        if (!this.currentPaymentOrder) return;
        const { orderId, amount, txn_ref, payment_id } = this.currentPaymentOrder;
        const finalAmount = this.appliedCoupon ? Math.max(0, amount - 500) : amount;
        const bankName = bank || document.getElementById('pay-netbanking-bank')?.value || 'Razorpay Gateway';

        try {
            App.showToast(`Verifying ${this.currentPaymentMethod.toUpperCase()} Escrow Deposit...`, "info");
            const res = await fetch('/api/payments/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    order_id: orderId,
                    payment_id: payment_id,
                    payment_method: this.currentPaymentMethod,
                    txn_ref: txn_ref,
                    bank_name: bankName,
                    amount: finalAmount
                })
            });
            const data = await res.json();
            if (data.success) {
                App.showToast(`🎉 ${data.message} (Bank UTR: ${data.utr_number})`, "success");
                App.closeModal('modal-multi-payment');
                if (Auth.currentUser && Auth.currentUser.role === 'buyer') {
                    await Buyer.loadBuyerData();
                } else if (Auth.currentUser && Auth.currentUser.role === 'seller') {
                    await Seller.loadSellerData();
                }
            } else {
                App.showToast(data.error || "Payment verification failed", "error");
            }
        } catch (e) {
            App.showToast("Network error verifying payment", "error");
        }
    },

    verifySelectedPayment: async function () {
        return this.verifyPayment();
    },

    advanceCurrentTrackingOrder: async function () {
        if (!this.currentTrackingOrder) return;
        const orderId = this.currentTrackingOrder.id;
        try {
            App.showToast("Advancing logistics pipeline stage...", "info");
            const res = await fetch(`/api/orders/${orderId}/advance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            const data = await res.json();
            if (data.success) {
                App.showToast(`🚚 ${data.message}: Now ${data.order.status.toUpperCase()}`, "success");
                await this.openDeliveryTrackingModal(orderId);
                if (Auth.currentUser && Auth.currentUser.role === 'buyer') {
                    await Buyer.loadBuyerData();
                } else if (Auth.currentUser && Auth.currentUser.role === 'seller') {
                    await Seller.loadSellerData();
                }
            } else {
                App.showToast(data.error || "Cannot advance stage", "info");
            }
        } catch (e) {
            App.showToast("Error advancing logistics stage", "error");
        }
    },

    openLedgerModal: async function () {
        try {
            const res = await fetch('/api/payments/ledger');
            const data = await res.json();
            if (data.success) {
                const container = document.getElementById('payments-ledger-table-body');
                if (!container) return;

                if (!data.ledger || data.ledger.length === 0) {
                    container.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-400">No payment records found in immutable escrow ledger.</td></tr>`;
                } else {
                    let html = '';
                    data.ledger.forEach(p => {
                        let badge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-800">Completed</span>';
                        if (p.payment_status === 'refunded') badge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">Refunded</span>';
                        if (p.payment_status === 'pending') badge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">Pending</span>';

                        html += `
                            <tr class="hover:bg-slate-50 border-b border-slate-100 text-xs">
                                <td class="px-3 py-2.5 font-mono text-[11px] font-bold text-slate-800">#${p.id}</td>
                                <td class="px-3 py-2.5 font-mono text-[11px] text-green-700 font-bold">${p.txn_ref}</td>
                                <td class="px-3 py-2.5 font-mono text-[11px] text-slate-600">${p.utr_number || 'N/A'}</td>
                                <td class="px-3 py-2.5 uppercase font-semibold text-slate-700">${p.payment_method}</td>
                                <td class="px-3 py-2.5 font-extrabold text-green-700">₹${p.amount.toLocaleString()}</td>
                                <td class="px-3 py-2.5">${badge}</td>
                                <td class="px-3 py-2.5 text-slate-400 text-[10px]">${p.created_at || 'Just now'}</td>
                            </tr>
                        `;
                    });
                    container.innerHTML = html;
                }
                App.openModal('modal-payments-ledger');
            }
        } catch (e) {
            console.error("Error loading payment ledger:", e);
        }
    },

    // =========================================================================
    // 2. PRODUCT QUALITY ASSAYING & DIGITAL CERTIFICATES
    // =========================================================================
    openQualityAssayModal: function (orderId, cropName = 'Produce Lot') {
        document.getElementById('assay-order-id').value = orderId;
        document.getElementById('assay-modal-crop-title').textContent = `Assay Inspection for Order #${orderId} • ${cropName}`;
        this.updateAssayGradePreview();
        App.openModal('modal-quality-assay');
    },

    updateAssayGradePreview: function () {
        const m = parseFloat(document.getElementById('assay-moisture').value) || 0;
        const f = parseFloat(document.getElementById('assay-foreign').value) || 0;
        const d = parseFloat(document.getElementById('assay-damaged').value) || 0;
        const previewEl = document.getElementById('assay-grade-preview-badge');
        const noteEl = document.getElementById('assay-grade-preview-note');

        let grade = 'Grade B (Standard Commercial)';
        let badgeClass = 'badge-grade-b';
        let note = 'Meets standard domestic mandi milling specifications.';

        if (m > 16.0 || f > 4.0 || d > 8.0) {
            grade = 'REJECTED (Substandard Quality)';
            badgeClass = 'bg-rose-100 text-rose-800 border border-rose-300 font-black';
            note = '⚠️ Substandard parameters! Submitting rejection will automatically trigger a 100% Full Refund to the Buyer.';
        } else if (m <= 10.5 && f <= 0.5 && d <= 1.0) {
            grade = 'Grade A+ (Premium Export)';
            badgeClass = 'bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold';
            note = '🌟 Exceptional export grade! Zero infestation, premium sortex quality.';
        } else if (m <= 12.0 && f <= 1.2 && d <= 2.5) {
            grade = 'Grade A (Prime Milling Quality)';
            badgeClass = 'badge-grade-a';
            note = '✅ Prime milling standard. High protein & test weight.';
        } else if (m <= 14.5 && f <= 2.5 && d <= 5.0) {
            grade = 'Grade B (Standard)';
            badgeClass = 'badge-grade-b';
            note = 'Standard fair average quality (FAQ).';
        } else {
            grade = 'Grade C (FAQ)';
            badgeClass = 'badge-grade-c';
            note = 'FAQ grade suitable for feed or standard processing.';
        }

        if (previewEl) {
            previewEl.className = `px-3 py-1 rounded-full text-xs ${badgeClass}`;
            previewEl.textContent = grade;
        }
        if (noteEl) {
            noteEl.textContent = note;
        }
    },

    submitQualityAssay: async function (e) {
        if (e) e.preventDefault();
        const order_id = parseInt(document.getElementById('assay-order-id').value);
        const moisture_pct = parseFloat(document.getElementById('assay-moisture').value);
        const foreign_matter_pct = parseFloat(document.getElementById('assay-foreign').value);
        const damaged_grains_pct = parseFloat(document.getElementById('assay-damaged').value);
        const protein_pct = parseFloat(document.getElementById('assay-protein').value);
        const inspector_name = document.getElementById('assay-inspector-name').value.trim() || 'NABL Lab Assayer';
        const notes = document.getElementById('assay-notes').value.trim() || 'Laboratory test completed.';

        try {
            App.showToast("Submitting NABL laboratory assay evaluation...", "info");
            const res = await fetch('/api/quality/assay', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    order_id,
                    moisture_pct,
                    foreign_matter_pct,
                    damaged_grains_pct,
                    protein_pct,
                    inspector_name,
                    notes
                })
            });
            const data = await res.json();
            if (data.success) {
                App.showToast(data.message, data.is_approved ? "success" : "warning");
                App.closeModal('modal-quality-assay');
                if (Auth.currentUser && Auth.currentUser.role === 'buyer') {
                    await Buyer.loadBuyerData();
                } else if (Auth.currentUser && Auth.currentUser.role === 'seller') {
                    await Seller.loadSellerData();
                }
                // Open digital certificate
                if (data.certificate_id) {
                    await this.openCertificateModal(order_id);
                }
            } else {
                App.showToast(data.error || "Quality assay submission failed", "error");
            }
        } catch (e) {
            App.showToast("Error submitting quality assay", "error");
        }
    },

    openCertificateModal: async function (orderId) {
        try {
            const res = await fetch(`/api/quality/order/${orderId}`);
            const data = await res.json();
            if (data.success) {
                const c = data.certificate;
                document.getElementById('cert-modal-id').textContent = `CERT-${c.certificate_number}`;
                document.getElementById('cert-modal-crop').textContent = `${c.crop_name} (${c.variety || 'Standard'})`;
                document.getElementById('cert-modal-grade').textContent = c.grade;
                document.getElementById('cert-modal-status').textContent = c.status.toUpperCase();
                document.getElementById('cert-modal-moisture').textContent = `${c.moisture_pct}%`;
                document.getElementById('cert-modal-foreign').textContent = `${c.foreign_matter_pct}%`;
                document.getElementById('cert-modal-damaged').textContent = `${c.damaged_grains_pct}%`;
                document.getElementById('cert-modal-protein').textContent = `${c.protein_pct}%`;
                document.getElementById('cert-modal-lab').textContent = `${c.lab_name} (Accredited)`;
                document.getElementById('cert-modal-inspector').textContent = c.inspector_name;
                document.getElementById('cert-modal-seal').textContent = c.seal_hash;
                document.getElementById('cert-modal-date').textContent = c.assay_date;

                const statusBadge = document.getElementById('cert-modal-status-badge');
                if (statusBadge) {
                    if (c.status === 'approved') {
                        statusBadge.className = "px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300";
                        statusBadge.innerHTML = `<i class="fa-solid fa-circle-check"></i> Quality Certified & Approved`;
                    } else {
                        statusBadge.className = "px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300";
                        statusBadge.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> Substandard - Rejected`;
                    }
                }

                App.openModal('modal-quality-certificate');
            } else {
                App.showToast("No quality certificate issued for this order yet.", "info");
            }
        } catch (e) {
            console.error("Error loading certificate:", e);
        }
    },

    // =========================================================================
    // 3. ORDER CONFIRMATION & POLICY-BASED CANCELLATION & REFUNDS
    // =========================================================================
    confirmOrderSeller: async function (orderId) {
        try {
            App.showToast(`Confirming Order #${orderId} for dispatch...`, "info");
            const res = await fetch(`/api/orders/${orderId}/confirm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ seller_id: Auth.currentUser ? Auth.currentUser.id : 1 })
            });
            const data = await res.json();
            if (data.success) {
                App.showToast(data.message, "success");
                if (Auth.currentUser && Auth.currentUser.role === 'seller') {
                    await Seller.loadSellerData();
                }
            } else {
                App.showToast(data.error || "Order confirmation failed", "error");
            }
        } catch (e) {
            App.showToast("Error confirming order", "error");
        }
    },

    openCancelOrderModal: function (orderId, amount, isConfirmed = 0, cropName = 'Produce Lot') {
        document.getElementById('cancel-order-id').value = orderId;
        document.getElementById('cancel-modal-order-title').textContent = `Cancel Order #${orderId} • ${cropName}`;
        
        const totalAmountEl = document.getElementById('cancel-total-amount');
        const policyBadgeEl = document.getElementById('cancel-policy-badge');
        const feeAmountEl = document.getElementById('cancel-fee-amount');
        const refundAmountEl = document.getElementById('cancel-refund-amount');
        const policyExplEl = document.getElementById('cancel-policy-explanation');

        if (totalAmountEl) totalAmountEl.textContent = `₹${amount.toLocaleString()}`;

        const isConf = Number(isConfirmed) === 1;
        const feePct = isConf ? 2.5 : 0.0;
        const fee = (amount * feePct) / 100.0;
        const refund = amount - fee;

        if (policyBadgeEl) {
            if (isConf) {
                policyBadgeEl.className = "px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300";
                policyBadgeEl.textContent = "Confirmed by Seller (2.5% Fee Applies)";
            } else {
                policyBadgeEl.className = "px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300";
                policyBadgeEl.textContent = "Unconfirmed (100% Free Full Refund)";
            }
        }

        if (feeAmountEl) feeAmountEl.textContent = `₹${fee.toLocaleString()} (${feePct}%)`;
        if (refundAmountEl) refundAmountEl.textContent = `₹${refund.toLocaleString()}`;

        if (policyExplEl) {
            if (isConf) {
                policyExplEl.innerHTML = `<strong>Refund Policy:</strong> Because the farmer has already confirmed & prepared this lot for dispatch, a nominal <strong>2.5% logistics/processing fee (₹${fee.toLocaleString()})</strong> is deducted. The remaining <strong>₹${refund.toLocaleString()}</strong> is refunded immediately to your original payment method.`;
            } else {
                policyExplEl.innerHTML = `<strong>Refund Policy:</strong> The seller has not yet confirmed this order. You are entitled to an <strong>instant 100% full refund with 0% penalty (₹${amount.toLocaleString()})</strong>.`;
            }
        }

        App.openModal('modal-cancel-order');
    },

    submitOrderCancellation: async function (e) {
        if (e) e.preventDefault();
        const order_id = parseInt(document.getElementById('cancel-order-id').value);
        const reason = document.getElementById('cancel-reason-input').value.trim() || 'Cancelled by buyer request.';

        try {
            App.showToast("Processing order cancellation & policy-based refund...", "info");
            const res = await fetch(`/api/orders/${order_id}/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: Auth.currentUser ? Auth.currentUser.id : 3,
                    reason: reason
                })
            });
            const data = await res.json();
            if (data.success) {
                const rf = data.refund_details;
                App.showToast(`🎉 ${data.message} (Refund Txn: ${rf.refund_txn_id}, Refunded: ₹${rf.refund_amount.toLocaleString()})`, "success");
                App.closeModal('modal-cancel-order');
                if (Auth.currentUser && Auth.currentUser.role === 'buyer') {
                    await Buyer.loadBuyerData();
                } else if (Auth.currentUser && Auth.currentUser.role === 'seller') {
                    await Seller.loadSellerData();
                }
            } else {
                App.showToast(data.error || "Order cancellation failed", "error");
            }
        } catch (e) {
            App.showToast("Error processing cancellation", "error");
        }
    },

    // =========================================================================
    // 4. DELIVERY TRACKING & SECURE 4-DIGIT DELIVERY OTP
    // =========================================================================
    openDeliveryTrackingModal: async function (orderId) {
        try {
            const res = await fetch(`/api/orders/${orderId}/tracking`);
            const data = await res.json();
            if (data.success) {
                const o = data.order;
                this.currentTrackingOrder = o;

                document.getElementById('tracking-modal-order-title').textContent = `Order #${o.id} • ${o.crop_name} (${o.quantity} Q)`;
                document.getElementById('tracking-modal-tracking-id').textContent = o.tracking_id;
                document.getElementById('tracking-modal-vehicle').textContent = o.vehicle_no || 'Pending Allocation';
                document.getElementById('tracking-modal-driver').textContent = o.driver_phone ? `+91 ${o.driver_phone}` : 'Driver Not Assigned';
                document.getElementById('tracking-modal-checkpoint').textContent = o.location_checkpoint || 'Warehouse Dispatch Origin';

                // Render 6-Stage Pipeline Timeline
                const timelineContainer = document.getElementById('tracking-pipeline-timeline');
                if (timelineContainer && data.pipeline_stages) {
                    let tlHtml = '';
                    data.pipeline_stages.forEach(st => {
                        let dotClass = 'bg-slate-200 text-slate-400 border-slate-300';
                        let badgeHtml = '<span class="text-[10px] text-slate-400 font-semibold">Pending</span>';

                        if (st.status === 'completed') {
                            dotClass = 'bg-emerald-600 text-white border-emerald-700 shadow-xs';
                            badgeHtml = '<span class="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">✓ Completed</span>';
                        } else if (st.status === 'in_progress') {
                            dotClass = 'bg-amber-500 text-slate-950 border-amber-600 animate-pulse';
                            badgeHtml = '<span class="text-[10px] text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-300">● Active Step</span>';
                        }

                        tlHtml += `
                            <div class="flex items-start gap-3 relative pb-4">
                                <div class="w-7 h-7 rounded-full border-2 ${dotClass} flex items-center justify-center text-xs font-black flex-shrink-0">
                                    ${st.step_number}
                                </div>
                                <div class="flex-1 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                                    <div class="flex items-center justify-between">
                                        <h5 class="font-extrabold text-xs text-slate-900">${st.name}</h5>
                                        ${badgeHtml}
                                    </div>
                                    <p class="text-[11px] text-slate-500 mt-0.5">${st.description}</p>
                                    ${st.timestamp ? `<div class="text-[9px] text-slate-400 font-mono mt-1"><i class="fa-regular fa-clock mr-1"></i>${st.timestamp}</div>` : ''}
                                </div>
                            </div>
                        `;
                    });
                    timelineContainer.innerHTML = tlHtml;
                }

                // Render GPS Checkpoints
                const cpContainer = document.getElementById('tracking-checkpoints-list');
                if (cpContainer && data.checkpoints) {
                    if (data.checkpoints.length === 0) {
                        cpContainer.innerHTML = `<div class="text-slate-400 text-[11px] italic">No intermediate GPS checkpoints logged yet.</div>`;
                    } else {
                        let cpHtml = '';
                        data.checkpoints.forEach(cp => {
                            cpHtml += `
                                <div class="p-2 bg-white rounded-lg border border-slate-200 text-xs mb-1.5 flex justify-between items-center">
                                    <div>
                                        <div class="font-bold text-slate-800">${cp.checkpoint_name}</div>
                                        <div class="text-[10px] text-slate-400">${cp.status_note || 'Transit Checkpoint'}</div>
                                    </div>
                                    <span class="text-[10px] text-slate-400 font-mono">${cp.timestamp || 'Recent'}</span>
                                </div>
                            `;
                        });
                        cpContainer.innerHTML = cpHtml;
                    }
                }

                // Delivery OTP Section
                const otpSection = document.getElementById('tracking-otp-action-section');
                const otpDisplayEl = document.getElementById('tracking-otp-display-badge');

                if (o.delivery_otp_verified) {
                    if (otpSection) otpSection.innerHTML = `
                        <div class="p-3 bg-emerald-50 border border-emerald-300 rounded-2xl text-center text-xs text-emerald-950 font-bold">
                            🎉 Delivery OTP Verified! 100% Escrow Disbursed to Farmer.
                        </div>
                    `;
                } else {
                    if (otpDisplayEl) {
                        otpDisplayEl.textContent = o.delivery_otp || '4821';
                    }
                }

                App.openModal('modal-delivery-tracking');
            }
        } catch (e) {
            console.error("Error opening delivery tracking:", e);
        }
    },

    submitDeliveryOtp: async function () {
        if (!this.currentTrackingOrder) return;
        const orderId = this.currentTrackingOrder.id;
        const otp = document.getElementById('tracking-otp-input').value.trim();

        if (!otp || otp.length !== 4) {
            App.showToast("Please enter the 4-digit Delivery OTP", "warning");
            return;
        }

        try {
            App.showToast("Verifying OTP & releasing escrow payout to farmer...", "info");
            const res = await fetch(`/api/orders/${orderId}/verify-delivery-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ otp })
            });
            const data = await res.json();
            if (data.success) {
                App.showToast(data.message, "success");
                App.closeModal('modal-delivery-tracking');
                if (Auth.currentUser && Auth.currentUser.role === 'buyer') {
                    await Buyer.loadBuyerData();
                } else if (Auth.currentUser && Auth.currentUser.role === 'seller') {
                    await Seller.loadSellerData();
                }
            } else {
                App.showToast(data.error || "Invalid OTP code", "error");
            }
        } catch (e) {
            App.showToast("Error verifying delivery OTP", "error");
        }
    },

    addLiveCheckpoint: async function () {
        if (!this.currentTrackingOrder) return;
        const orderId = this.currentTrackingOrder.id;
        const checkpointName = prompt("Enter new GPS / Toll checkpoint location (e.g. Ashta Toll Plaza, Bhopal Bypass, Warehouse Gate):");
        if (!checkpointName) return;

        try {
            const res = await fetch(`/api/orders/${orderId}/add-checkpoint`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    checkpoint_name: checkpointName,
                    status_note: "Vehicle cleared checkpoint successfully."
                })
            });
            const data = await res.json();
            if (data.success) {
                App.showToast("GPS Checkpoint added!", "success");
                await this.openDeliveryTrackingModal(orderId);
            }
        } catch (e) {
            App.showToast("Error logging checkpoint", "error");
        }
    },

    // =========================================================================
    // 5. AGMARKET-API SYNC & DISPLAY (https://github.com/DevavratD/AgMarket-API)
    // =========================================================================
    syncAgMarketApi: async function () {
        const btn = document.getElementById('btn-sync-agmarknet');
        const origText = btn ? btn.innerHTML : '';
        if (btn) {
            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> Syncing AgMarket-API...`;
            btn.disabled = true;
        }

        try {
            App.showToast("Connecting to AgMarket-API (Agmarknet Pan-India)...", "info");
            const res = await fetch('/api/agmarknet/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            const data = await res.json();
            if (data.success) {
                App.showToast(`🌾 AgMarket-API Synced: ${data.message} (${data.total_commodities} Pan-India commodities)`, "success");
                await Market.loadPrices();
            } else {
                App.showToast(data.message || "AgMarket-API synced with high-accuracy fallback data.", "info");
            }
        } catch (e) {
            console.error("AgMarket API sync error:", e);
            App.showToast("AgMarket-API Pan-India rates active.", "info");
        } finally {
            if (btn) {
                btn.innerHTML = origText;
                btn.disabled = false;
            }
        }
    },

    openAgMarketApiModal: async function () {
        try {
            const res = await fetch('/api/agmarknet/prices');
            const data = await res.json();
            if (data.success) {
                const container = document.getElementById('agmarket-prices-table-body');
                if (!container) return;

                let html = '';
                data.prices.forEach(p => {
                    html += `
                        <tr class="hover:bg-slate-50 border-b border-slate-100 text-xs">
                            <td class="px-3 py-2.5 font-bold text-slate-900">${p.commodity}</td>
                            <td class="px-3 py-2.5 text-slate-600">${p.market}</td>
                            <td class="px-3 py-2.5 text-slate-600">${p.district}, ${p.state}</td>
                            <td class="px-3 py-2.5 font-extrabold text-green-700">₹${p.modal_price.toLocaleString()}/Q</td>
                            <td class="px-3 py-2.5 text-slate-500 text-[11px]">₹${p.min_price} - ₹${p.max_price}</td>
                            <td class="px-3 py-2.5 text-slate-600 font-medium">${p.arrivals_tonnes} MT</td>
                            <td class="px-3 py-2.5 font-mono text-[10px] text-slate-400">${p.arrival_date || 'Today'}</td>
                        </tr>
                    `;
                });
                container.innerHTML = html;
                App.openModal('modal-agmarket-api');
            }
        } catch (e) {
            console.error("Error loading AgMarket-API prices:", e);
        }
    },

    // =========================================================================
    // 6. REFRESH TRACKING (re-opens modal for current order)
    // =========================================================================
    refreshTracking: async function () {
        if (!this.currentTrackingOrder) return;
        const orderId = this.currentTrackingOrder.id;
        App.showToast("Refreshing live delivery status...", "info");
        await this.openDeliveryTrackingModal(orderId);
    }
};

window.Escrow = Escrow;

