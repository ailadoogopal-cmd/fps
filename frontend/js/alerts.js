/**
 * KrishiSetu WhatsApp & SMS Alert Dispatcher & Notification Hub
 * Manages commodity subscriptions, price-change triggers, and payment SMS notifications
 */
const Alerts = {
    subscriptions: [],
    notifications: [],
    unreadCount: 0,
    isDrawerOpen: false,

    init: async function () {
        await this.loadNotifications();
        if (Auth.currentUser) {
            await this.loadMySubscriptions();
        }
        // Periodically check for new notifications every 15 seconds
        setInterval(() => this.loadNotifications(), 15000);
    },

    loadNotifications: async function () {
        try {
            const userId = Auth.currentUser ? Auth.currentUser.id : 1;
            const res = await fetch(`/api/notifications?user_id=${userId}`);
            const data = await res.json();
            if (data.success) {
                this.notifications = data.notifications;
                this.unreadCount = data.unread_count;
                this.updateBadgeUI();
                this.renderNotificationsList();
            }
        } catch (e) {
            console.error("Error loading notifications:", e);
        }
    },

    loadMySubscriptions: async function () {
        try {
            const userId = Auth.currentUser ? Auth.currentUser.id : 1;
            const res = await fetch(`/api/alerts/my-subscriptions?user_id=${userId}`);
            const data = await res.json();
            if (data.success) {
                this.subscriptions = data.subscriptions;
                this.renderSubscriptionsList();
            }
        } catch (e) {
            console.error("Error loading subscriptions:", e);
        }
    },

    toggleDrawer: function () {
        this.isDrawerOpen = !this.isDrawerOpen;
        const drawer = document.getElementById('notifications-drawer');
        const overlay = document.getElementById('notifications-drawer-overlay');

        if (drawer && overlay) {
            if (this.isDrawerOpen) {
                overlay.classList.remove('hidden');
                drawer.classList.remove('translate-x-full');
                this.markAllRead();
            } else {
                drawer.classList.add('translate-x-full');
                overlay.classList.add('hidden');
            }
        }
    },

    markAllRead: async function () {
        try {
            const userId = Auth.currentUser ? Auth.currentUser.id : 1;
            await fetch('/api/notifications/mark-read', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId })
            });
            this.unreadCount = 0;
            this.updateBadgeUI();
        } catch (e) {
            console.error(e);
        }
    },

    updateBadgeUI: function () {
        const badge = document.getElementById('notif-unread-badge');
        if (badge) {
            if (this.unreadCount > 0) {
                badge.textContent = this.unreadCount;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }
    },

    renderNotificationsList: function (filterType = 'all') {
        const container = document.getElementById('drawer-notifications-container');
        if (!container) return;

        let filtered = this.notifications;
        if (filterType === 'payment') {
            filtered = this.notifications.filter(n => n.type === 'payment');
        } else if (filterType === 'whatsapp') {
            filtered = this.notifications.filter(n => n.channel === 'whatsapp' || n.channel === 'both');
        }

        if (!filtered || filtered.length === 0) {
            container.innerHTML = `
                <div class="p-8 text-center text-slate-400">
                    <i class="fa-regular fa-bell text-3xl mb-2 text-slate-300"></i>
                    <p class="text-xs">No alerts in this category yet.</p>
                </div>
            `;
            return;
        }

        let html = '';
        filtered.forEach(n => {
            const isWhatsApp = n.channel === 'whatsapp' || n.channel === 'both';
            const isPayment = n.type === 'payment';
            const channelIcon = isWhatsApp 
                ? '<i class="fa-brands fa-whatsapp text-emerald-600 text-sm font-bold"></i>' 
                : '<i class="fa-solid fa-comment-sms text-blue-600 text-sm"></i>';

            html += `
                <div class="p-3.5 bg-white rounded-xl border ${!n.is_read ? 'border-green-300 bg-green-50/20' : 'border-slate-200'} shadow-xs mb-2.5 transition-all hover:border-slate-300">
                    <div class="flex items-center justify-between gap-2 mb-1.5">
                        <div class="flex items-center gap-1.5">
                            <span class="w-6 h-6 rounded-lg ${isPayment ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'} flex items-center justify-center text-xs">
                                ${isPayment ? '💰' : '🔔'}
                            </span>
                            <h5 class="font-bold text-slate-900 text-xs">${n.title}</h5>
                        </div>
                        <div class="flex items-center gap-1 text-[10px] text-slate-400">
                            ${channelIcon}
                            <span>${new Date(n.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                    </div>
                    <p class="text-xs text-slate-600 leading-relaxed">${n.message.replace(/\n/g, '<br/>')}</p>
                </div>
            `;
        });
        container.innerHTML = html;
    },

    renderSubscriptionsList: function () {
        const container = document.getElementById('my-subscriptions-list');
        if (!container) return;

        if (!this.subscriptions || this.subscriptions.length === 0) {
            container.innerHTML = `<div class="p-3 text-xs text-slate-400 text-center">No active crop alerts. Select a crop above to get instant WhatsApp SMS.</div>`;
            return;
        }

        let html = '';
        this.subscriptions.forEach(s => {
            const condBadge = s.target_condition === 'price_up' 
                ? '<span class="text-green-700 bg-green-100 px-1.5 py-0.5 rounded text-[10px] font-bold">🔺 भाव बढ़ने पर</span>' 
                : (s.target_condition === 'price_down' ? '<span class="text-red-700 bg-red-100 px-1.5 py-0.5 rounded text-[10px] font-bold">🔻 भाव गिरने पर</span>' : '<span class="text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded text-[10px] font-bold">⚖️ सभी बदलाव</span>');

            html += `
                <div class="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs mb-2">
                    <div>
                        <div class="font-bold text-slate-800 flex items-center gap-1.5">
                            <i class="fa-brands fa-whatsapp text-emerald-600"></i> ${s.commodity}
                        </div>
                        <div class="mt-0.5">${condBadge} <span class="text-[10px] text-slate-400 ml-1">+91 ${s.phone}</span></div>
                    </div>
                    <button onclick="Alerts.unsubscribe(${s.id})" class="text-slate-400 hover:text-rose-600 text-xs px-2 py-1" title="Unsubscribe">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `;
        });
        container.innerHTML = html;
    },

    subscribe: async function (e) {
        if (e) e.preventDefault();

        const commodity = document.getElementById('alert-commodity-select').value;
        const target_condition = document.getElementById('alert-condition-select').value;
        const channel = document.getElementById('alert-channel-select').value;
        const phone = document.getElementById('alert-phone-input').value.trim();

        if (!commodity || !phone || phone.length < 10) {
            App.showToast("Please enter a valid 10-digit mobile number for WhatsApp alerts", "warning");
            return;
        }

        const userId = Auth.currentUser ? Auth.currentUser.id : 1;

        try {
            const res = await fetch('/api/alerts/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    commodity,
                    target_condition,
                    channel,
                    phone
                })
            });
            const data = await res.json();

            if (data.success) {
                App.showToast(data.message, "success");
                this.showSimulatedPhoneNotification(
                    "WhatsApp Alert Activated",
                    `KrishiSetu: You will receive live ${commodity} price movement alerts on +91 ${phone}!`,
                    "whatsapp"
                );
                await this.loadMySubscriptions();
                await this.loadNotifications();
            } else {
                App.showToast(data.error || "Subscription failed", "error");
            }
        } catch (e) {
            App.showToast("Network error creating alert subscription", "error");
        }
    },

    unsubscribe: async function (subId) {
        try {
            const res = await fetch('/api/alerts/unsubscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscription_id: subId })
            });
            const data = await res.json();
            if (data.success) {
                App.showToast(data.message, "info");
                await this.loadMySubscriptions();
            }
        } catch (e) {
            console.error(e);
        }
    },

    simulatePriceChange: async function (commodity, direction, changeAmount = 50) {
        try {
            App.showToast(`Simulating Mandi price change for ${commodity} (${direction.toUpperCase()})...`, "info");
            const res = await fetch('/api/alerts/simulate-price-change', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    commodity,
                    direction,
                    change_amount: changeAmount
                })
            });
            const data = await res.json();

            if (data.success) {
                App.showToast(data.message, "success");
                
                // Show floating realistic WhatsApp notification for first alert
                if (data.dispatched_alerts && data.dispatched_alerts.length > 0) {
                    const firstAlert = data.dispatched_alerts[0];
                    this.showSimulatedPhoneNotification(
                        `WhatsApp Mandi Alert • +91 ${firstAlert.phone}`,
                        firstAlert.message,
                        "whatsapp"
                    );
                }

                await this.loadNotifications();
                await Market.loadPrices();
                await Market.loadSpreadData();
            } else {
                App.showToast(data.error || "Simulation failed", "error");
            }
        } catch (e) {
            App.showToast("Error triggering simulation", "error");
        }
    },

    showSimulatedPhoneNotification: function (title, body, type = 'whatsapp') {
        const container = document.getElementById('phone-notification-banner');
        if (!container) return;

        const isWhatsApp = type === 'whatsapp';
        const banner = document.createElement('div');
        banner.className = `p-4 rounded-2xl shadow-2xl border ${isWhatsApp ? 'bg-slate-900 text-white border-emerald-500/50' : 'bg-slate-900 text-white border-blue-500/50'} max-w-sm w-full transition-all duration-500 transform -translate-y-4 opacity-0`;
        
        banner.innerHTML = `
            <div class="flex items-start gap-3">
                <div class="w-10 h-10 rounded-xl ${isWhatsApp ? 'bg-emerald-500' : 'bg-blue-600'} text-white flex items-center justify-center text-lg font-bold flex-shrink-0 shadow-md">
                    ${isWhatsApp ? '<i class="fa-brands fa-whatsapp"></i>' : '<i class="fa-solid fa-comment-sms"></i>'}
                </div>
                <div class="flex-1">
                    <div class="flex items-center justify-between text-[11px] font-bold text-slate-300 mb-0.5">
                        <span>${title}</span>
                        <span class="text-[10px] text-slate-400">now</span>
                    </div>
                    <p class="text-xs font-normal text-slate-100 leading-relaxed">${body.replace(/\n/g, '<br/>')}</p>
                </div>
                <button onclick="this.parentElement.parentElement.remove()" class="text-slate-400 hover:text-white text-xs">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
        `;

        container.appendChild(banner);

        // Animate in
        setTimeout(() => {
            banner.classList.remove('-translate-y-4', 'opacity-0');
        }, 50);

        // Auto dismiss after 6 seconds
        setTimeout(() => {
            banner.classList.add('opacity-0', '-translate-y-4');
            setTimeout(() => banner.remove(), 400);
        }, 6000);
    }
};

window.Alerts = Alerts;
