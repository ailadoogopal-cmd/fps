/**
 * KrishiSetu Authentication Manager
 * Handles Dual-Type Registration (Buyer/Seller) via Mobile Number + OTP or Gmail ID
 * Controls Gated Dashboard Access
 */
const Auth = {
    currentUser: null,
    pendingOtp: null,
    selectedRole: 'seller', // 'seller' or 'buyer'
    selectedAuthType: 'mobile', // 'mobile' or 'gmail'
    portalMode: 'register', // 'register' or 'login'

    init: function () {
        // Load stored session if any
        const saved = localStorage.getItem('krishi_user');
        if (saved) {
            try {
                this.currentUser = JSON.parse(saved);
                this.updateUIForLoggedInUser();
            } catch (e) {
                console.error("Failed to parse saved user", e);
                localStorage.removeItem('krishi_user');
                this.currentUser = null;
            }
        } else {
            this.updateUIForLoggedOutUser();
        }
    },

    // -------------------------------------------------------------
    // IN-PAGE AUTH PORTAL CONTROLS
    // -------------------------------------------------------------
    setPortalMode: function (mode) {
        this.portalMode = mode;
        const regTab = document.getElementById('portal-tab-btn-register');
        const loginTab = document.getElementById('portal-tab-btn-login');
        const regContainer = document.getElementById('portal-register-form-container');
        const loginContainer = document.getElementById('portal-login-form-container');

        if (mode === 'register') {
            if (regTab) regTab.className = "flex-1 py-3 text-center font-bold text-sm border-b-2 border-green-600 text-green-700 bg-white";
            if (loginTab) loginTab.className = "flex-1 py-3 text-center font-semibold text-sm border-b-2 border-transparent text-slate-500 hover:text-slate-700 bg-slate-50/80";
            if (regContainer) regContainer.classList.remove('hidden');
            if (loginContainer) loginContainer.classList.add('hidden');
        } else {
            if (loginTab) loginTab.className = "flex-1 py-3 text-center font-bold text-sm border-b-2 border-green-600 text-green-700 bg-white";
            if (regTab) regTab.className = "flex-1 py-3 text-center font-semibold text-sm border-b-2 border-transparent text-slate-500 hover:text-slate-700 bg-slate-50/80";
            if (loginContainer) loginContainer.classList.remove('hidden');
            if (regContainer) regContainer.classList.add('hidden');
        }
    },

    setPortalRole: function (role) {
        this.selectedRole = role;
        const sellerBtn = document.getElementById('portal-role-seller');
        const buyerBtn = document.getElementById('portal-role-buyer');
        const sellerFields = document.getElementById('portal-seller-fields');
        const buyerFields = document.getElementById('portal-buyer-fields');
        const desc = document.getElementById('portal-role-desc');

        if (role === 'seller') {
            if (sellerBtn) sellerBtn.className = "flex-1 py-2.5 px-3 rounded-xl font-bold text-xs border-2 border-green-600 bg-green-50 text-green-800 shadow-sm flex items-center justify-center gap-1.5 transition-all";
            if (buyerBtn) buyerBtn.className = "flex-1 py-2.5 px-3 rounded-xl font-semibold text-xs border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-1.5 transition-all";
            if (sellerFields) sellerFields.classList.remove('hidden');
            if (buyerFields) buyerFields.classList.add('hidden');
            if (desc) desc.textContent = "🌾 Register as Farmer / FPO to access live mandis & sell directly";
        } else {
            if (buyerBtn) buyerBtn.className = "flex-1 py-2.5 px-3 rounded-xl font-bold text-xs border-2 border-amber-600 bg-amber-50 text-amber-800 shadow-sm flex items-center justify-center gap-1.5 transition-all";
            if (sellerBtn) sellerBtn.className = "flex-1 py-2.5 px-3 rounded-xl font-semibold text-xs border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-1.5 transition-all";
            if (sellerFields) sellerFields.classList.add('hidden');
            if (buyerFields) buyerFields.classList.remove('hidden');
            if (desc) desc.textContent = "🏢 Register as Buyer / Trader / Mill to procure Grade-A crops directly";
        }
    },

    setPortalAuthType: function (type) {
        this.selectedAuthType = type;
        const mobileTab = document.getElementById('portal-auth-tab-mobile');
        const gmailTab = document.getElementById('portal-auth-tab-gmail');
        const mobileContainer = document.getElementById('portal-mobile-inputs');
        const gmailContainer = document.getElementById('portal-gmail-inputs');

        if (type === 'mobile') {
            if (mobileTab) mobileTab.className = "pb-1.5 font-bold text-xs border-b-2 border-green-600 text-green-700 flex items-center gap-1.5 cursor-pointer";
            if (gmailTab) gmailTab.className = "pb-1.5 font-medium text-xs border-b-2 border-transparent text-slate-500 hover:text-slate-700 flex items-center gap-1.5 cursor-pointer";
            if (mobileContainer) mobileContainer.classList.remove('hidden');
            if (gmailContainer) gmailContainer.classList.add('hidden');
        } else {
            if (gmailTab) gmailTab.className = "pb-1.5 font-bold text-xs border-b-2 border-green-600 text-green-700 flex items-center gap-1.5 cursor-pointer";
            if (mobileTab) mobileTab.className = "pb-1.5 font-medium text-xs border-b-2 border-transparent text-slate-500 hover:text-slate-700 flex items-center gap-1.5 cursor-pointer";
            if (gmailContainer) gmailContainer.classList.remove('hidden');
            if (mobileContainer) mobileContainer.classList.add('hidden');
        }
    },

    sendPortalOtp: async function () {
        const phone = document.getElementById('portal-reg-phone').value.trim();
        if (!phone || phone.length < 10) {
            App.showToast("Please enter a valid 10-digit mobile number", "error");
            return;
        }

        const btn = document.getElementById('portal-btn-send-otp');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Sending...`;
        }

        try {
            const res = await fetch('/api/auth/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone })
            });
            const data = await res.json();

            if (data.success) {
                this.pendingOtp = data.demo_otp;
                const otpSec = document.getElementById('portal-otp-section');
                if (otpSec) otpSec.classList.remove('hidden');
                
                const hint = document.getElementById('portal-otp-hint');
                if (hint) {
                    hint.innerHTML = `
                        <div class="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between mt-1">
                            <span>📲 <strong>SMS Received:</strong> OTP is <strong class="text-sm font-mono">${data.demo_otp}</strong></span>
                            <button type="button" onclick="document.getElementById('portal-reg-otp').value='${data.demo_otp}'" class="bg-amber-600 hover:bg-amber-700 text-white px-2 py-0.5 rounded-lg text-xs font-bold">Auto-Fill</button>
                        </div>
                    `;
                }
                App.showToast(`OTP sent to +91 ${phone}`, "success");
            } else {
                App.showToast(data.error || "Failed to send OTP", "error");
            }
        } catch (e) {
            App.showToast("Network error connecting to auth server", "error");
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i class="fa-solid fa-paper-plane mr-1"></i> Get OTP`;
            }
        }
    },

    portalRegisterSubmit: async function (e) {
        if (e) e.preventDefault();

        const role = this.selectedRole;
        const auth_type = this.selectedAuthType;
        const name = document.getElementById('portal-reg-name').value.trim();

        if (!name) {
            App.showToast("Please enter your full name", "warning");
            return;
        }

        const payload = {
            name,
            role,
            auth_type,
            state: document.getElementById('portal-reg-state').value,
            district: document.getElementById('portal-reg-district').value
        };

        if (role === 'seller') {
            payload.fpo_name = document.getElementById('portal-reg-fpo').value.trim();
        } else {
            payload.business_type = document.getElementById('portal-reg-business-type').value;
            payload.gst_number = document.getElementById('portal-reg-gst').value.trim();
        }

        if (auth_type === 'mobile') {
            payload.phone = document.getElementById('portal-reg-phone').value.trim();
            payload.otp = document.getElementById('portal-reg-otp').value.trim();

            if (!payload.phone || payload.phone.length < 10) {
                App.showToast("Please enter a valid 10-digit mobile number", "warning");
                return;
            }
            if (!payload.otp) {
                App.showToast("Please click 'Get OTP' and enter the verification code", "warning");
                return;
            }
        } else {
            payload.email = document.getElementById('portal-reg-email').value.trim();
            payload.password = document.getElementById('portal-reg-password').value;

            if (!payload.email || !payload.email.includes('@')) {
                App.showToast("Please enter a valid Gmail / Email address", "warning");
                return;
            }
            if (!payload.password || payload.password.length < 4) {
                App.showToast("Please enter a password (min 4 characters)", "warning");
                return;
            }
        }

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (data.success) {
                this.currentUser = data.user;
                localStorage.setItem('krishi_user', JSON.stringify(data.user));
                this.updateUIForLoggedInUser();
                App.updateGatedView(true);
                App.showToast(`🎉 Registration complete! Welcome to your ${role.toUpperCase()} dashboard.`, "success");
                App.navigateToDashboard(role);
            } else {
                App.showToast(data.error || "Registration failed", "error");
            }
        } catch (e) {
            App.showToast("Server connection error during registration", "error");
        }
    },

    portalLoginSubmit: async function (e) {
        if (e) e.preventDefault();

        const loginType = document.getElementById('portal-login-type-select') ? document.getElementById('portal-login-type-select').value : 'mobile';
        let payload = { login_type: loginType };

        if (loginType === 'mobile') {
            const phone = document.getElementById('portal-login-phone').value.trim();
            const password = document.getElementById('portal-login-password').value;
            if (!phone) {
                App.showToast("Please enter your registered mobile number", "warning");
                return;
            }
            payload.identifier = phone;
            payload.password = password || "pass123";
        } else {
            const email = document.getElementById('portal-login-email').value.trim();
            const password = document.getElementById('portal-login-email-password').value;
            if (!email) {
                App.showToast("Please enter your Gmail / Email ID", "warning");
                return;
            }
            payload.identifier = email;
            payload.password = password || "pass123";
        }

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (data.success) {
                this.currentUser = data.user;
                localStorage.setItem('krishi_user', JSON.stringify(data.user));
                this.updateUIForLoggedInUser();
                App.updateGatedView(true);
                App.showToast(`Welcome back, ${data.user.name}!`, "success");
                App.navigateToDashboard(data.user.role);
            } else {
                App.showToast(data.error || "Login failed", "error");
            }
        } catch (e) {
            App.showToast("Network error connecting to login server", "error");
        }
    },

    loginAsDemo: async function (userId) {
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ demo_id: userId })
            });
            const data = await res.json();

            if (data.success) {
                this.currentUser = data.user;
                localStorage.setItem('krishi_user', JSON.stringify(data.user));
                App.closeAuthModal();
                this.updateUIForLoggedInUser();
                App.updateGatedView(true);
                App.showToast(`Switched to demo: ${data.user.name} (${data.user.role.toUpperCase()})`, "success");
                App.navigateToDashboard(data.user.role);
            }
        } catch (e) {
            App.showToast("Failed to switch demo account", "error");
        }
    },

    logout: function () {
        this.currentUser = null;
        localStorage.removeItem('krishi_user');
        this.updateUIForLoggedOutUser();
        App.updateGatedView(false);
        App.showToast("Logged out. Dashboard information is now locked.", "info");
        App.showSection('auth-portal');
    },

    updateUIForLoggedInUser: function () {
        const u = this.currentUser;
        if (!u) return;

        // Header controls
        const loggedOutActions = document.getElementById('logged-out-header-actions');
        const loggedInActions = document.getElementById('logged-in-header-actions');
        if (loggedOutActions) loggedOutActions.classList.add('hidden');
        if (loggedInActions) loggedInActions.classList.remove('hidden');

        // User profile pill
        const userName = document.getElementById('header-user-name');
        const userBadge = document.getElementById('header-user-badge');
        if (userName) userName.textContent = u.name;
        if (userBadge) {
            if (u.role === 'seller') {
                userBadge.textContent = '🌾 Farmer/Seller';
                userBadge.className = 'px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800';
            } else if (u.role === 'admin') {
                userBadge.textContent = '🛡️ KisanLakshmi Admin';
                userBadge.className = 'px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800';
            } else {
                userBadge.textContent = '🏢 Verified Buyer';
                userBadge.className = 'px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800';
            }
        }

        // Nav tabs
        const navSeller = document.getElementById('nav-dashboard-seller');
        const navBuyer = document.getElementById('nav-dashboard-buyer');
        const navAdmin = document.getElementById('nav-dashboard-admin');
        if (navSeller) navSeller.classList.toggle('hidden', u.role !== 'seller');
        if (navBuyer) navBuyer.classList.toggle('hidden', u.role !== 'buyer');
        if (navAdmin) navAdmin.classList.toggle('hidden', u.role !== 'admin');

        // Update dashboard user cards
        document.querySelectorAll('.profile-display-name').forEach(el => el.textContent = u.name);
        document.querySelectorAll('.profile-display-location').forEach(el => el.textContent = `${u.district || 'Sehore'}, ${u.state || 'Madhya Pradesh'}`);
        document.querySelectorAll('.profile-display-contact').forEach(el => el.textContent = u.phone ? `+91 ${u.phone}` : u.email);

        // Refresh user alert subscriptions & notification badges
        if (window.Alerts) {
            Alerts.loadMySubscriptions();
            Alerts.loadNotifications();
        }

        // Auto-load wallet balance in header
        if (window.Wallet) {
            setTimeout(() => Wallet.updateHeaderBalance(), 300);
        }
    },

    updateUIForLoggedOutUser: function () {
        const loggedOutActions = document.getElementById('logged-out-header-actions');
        const loggedInActions = document.getElementById('logged-in-header-actions');
        if (loggedOutActions) loggedOutActions.classList.remove('hidden');
        if (loggedInActions) loggedInActions.classList.add('hidden');

        const navSeller = document.getElementById('nav-dashboard-seller');
        const navBuyer = document.getElementById('nav-dashboard-buyer');
        const navAdmin = document.getElementById('nav-dashboard-admin');
        if (navSeller) navSeller.classList.add('hidden');
        if (navBuyer) navBuyer.classList.add('hidden');
        if (navAdmin) navAdmin.classList.add('hidden');
    }
};

window.Auth = Auth;
