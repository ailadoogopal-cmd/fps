/**
 * KrishiSetu Interactive AI Chatbot ("Krishi Mitra / कृषि मित्र")
 * Solves customer problems, provides mandi price lookups, loan advisory, grading & escrow guidance
 */
const Chatbot = {
    isOpen: false,
    history: [],
    recognition: null,
    isListening: false,

    init: function () {
        // Initialize Speech Recognition if supported
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRec();
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
            this.recognition.lang = 'hi-IN';

            this.recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                const input = document.getElementById('chat-input-text');
                if (input) {
                    input.value = transcript;
                    this.sendMessage();
                }
            };

            this.recognition.onend = () => {
                this.isListening = false;
                this.updateVoiceIcon();
            };

            this.recognition.onerror = (e) => {
                console.warn('Speech recognition error:', e);
                this.isListening = false;
                this.updateVoiceIcon();
            };
        }

        // Check Gemini AI configuration
        fetch('/api/ai/config')
            .then(r => r.json())
            .then(cfg => {
                if (cfg.success && cfg.key_configured) {
                    const badge = document.getElementById('chatbot-gemini-badge');
                    if (badge) badge.textContent = `${cfg.key_name || 'Gemini API Key'} Active (${cfg.model || 'Gemini 3.8 Flash'})`;
                }
            })
            .catch(() => {});

        // Add initial greeting message
        this.addBotMessage(
            `### 🙏 नमस्ते! मैं **कृषि मित्र (Krishi Mitra)** हूँ — आपका AI सहायक।\n\n✨ **Google Gemini AI** द्वारा संचालित!\n\nमैं आपकी किसी भी समस्या का समाधान कर सकता हूँ। आप मुझसे **मंडी भाव**, **वेयरहाउस 75% लोन**, **फसल लिस्टिंग**, **ग्रेडिंग**, **एस्क्रो पेमेंट**, या **WhatsApp अलर्ट** के बारे में कुछ भी पूछ सकते हैं!\n\n👇 नीचे दिए गए किसी भी सुझाव पर क्लिक करें या अपना सवाल टाइप करें:`,
            ["🌾 गेहूँ का ताजा भाव?", "🏛️ वेयरहाउस 75% लोन कैसे लें?", "🔒 एस्क्रो पेमेंट सुरक्षा क्या है?", "📦 मेरे ऑर्डर्स देखें (View Orders)"],
            "नमस्ते! मैं कृषि मित्र हूँ। आप मुझसे मंडी भाव या वेयरहाउस लोन के बारे में पूछ सकते हैं।"
        );
    },

    toggleChat: function () {
        this.isOpen = !this.isOpen;
        const panel = document.getElementById('ai-chatbot-panel');
        const badge = document.getElementById('chatbot-unread-dot');

        if (panel) {
            if (this.isOpen) {
                panel.classList.remove('hidden');
                panel.classList.add('flex');
                if (badge) badge.classList.add('hidden');
                setTimeout(() => {
                    const input = document.getElementById('chat-input-text');
                    if (input) input.focus();
                }, 100);
            } else {
                panel.classList.add('hidden');
                panel.classList.remove('flex');
                KrishiVoice.stop();
            }
        }
    },

    toggleVoiceInput: function () {
        if (!this.recognition) {
            App.showToast("Voice input is not supported in this browser. Please type your query.", "info");
            return;
        }

        if (this.isListening) {
            this.recognition.stop();
            this.isListening = false;
        } else {
            try {
                this.recognition.start();
                this.isListening = true;
                App.showToast("🎙️ सुन रहे हैं... बोलिए (Listening in Hindi/English...)", "info");
            } catch (e) {
                console.error(e);
            }
        }
        this.updateVoiceIcon();
    },

    updateVoiceIcon: function () {
        const btn = document.getElementById('chat-mic-btn');
        if (btn) {
            if (this.isListening) {
                btn.className = "w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center animate-pulse";
            } else {
                btn.className = "w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center";
            }
        }
    },

    sendMessage: async function (customText = null) {
        const input = document.getElementById('chat-input-text');
        const text = customText || (input ? input.value.trim() : "");
        if (!text) return;

        if (input && !customText) input.value = '';

        // Add user bubble
        this.addUserMessage(text);

        // Show typing indicator
        this.showTypingIndicator();

        try {
            const role = Auth.currentUser ? Auth.currentUser.role : 'seller';
            const user_id = Auth.currentUser ? Auth.currentUser.id : null;

            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text, role, user_id })
            });
            const data = await res.json();

            this.hideTypingIndicator();

            if (data.success) {
                this.addBotMessage(data.reply, data.suggested_actions, data.audio_text, data.model);
            } else {
                this.addBotMessage("क्षमा करें, आपके अनुरोध को प्रोसेस करने में समस्या हुई। कृपया पुनः प्रयास करें।");
            }
        } catch (e) {
            this.hideTypingIndicator();
            this.addBotMessage("सर्वर से कनेक्ट करने में समस्या हुई। कृपया जांचें।");
        }
    },

    addUserMessage: function (text) {
        const container = document.getElementById('chatbot-messages-container');
        if (!container) return;

        const div = document.createElement('div');
        div.className = "flex items-start justify-end gap-2 my-3";
        div.innerHTML = `
            <div class="max-w-[80%] bg-green-700 text-white p-3 rounded-2xl rounded-tr-xs text-xs shadow-xs">
                ${this.escapeHtml(text)}
            </div>
            <div class="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                <i class="fa-solid fa-user"></i>
            </div>
        `;
        container.appendChild(div);
        this.scrollToBottom();
    },

    addBotMessage: function (markdownText, suggested = [], audioText = "", modelName = "Gemini 3.8 Flash") {
        const container = document.getElementById('chatbot-messages-container');
        if (!container) return;

        const formattedHtml = this.formatMarkdown(markdownText);
        const div = document.createElement('div');
        div.className = "flex items-start gap-2.5 my-3";

        let suggestedHtml = '';
        if (suggested && suggested.length > 0) {
            suggestedHtml = `<div class="flex flex-wrap gap-1.5 mt-3 pt-2 border-t border-slate-100">`;
            suggested.forEach(s => {
                suggestedHtml += `
                    <button onclick="Chatbot.handleSuggestedAction('${this.escapeQuotes(s)}')" class="px-2.5 py-1 bg-green-50 hover:bg-green-100 text-green-800 rounded-lg text-[11px] font-semibold border border-green-200 transition-colors text-left flex items-center gap-1">
                        <span>💬</span> <span>${s}</span>
                    </button>
                `;
            });
            suggestedHtml += `</div>`;
        }

        const audioBtn = audioText ? `
            <button onclick="KrishiVoice.speak('${this.escapeQuotes(audioText)}', 'hi-IN')" class="ml-2 text-slate-400 hover:text-green-700 text-xs" title="Listen Audio">
                <i class="fa-solid fa-volume-high"></i>
            </button>
        ` : '';

        div.innerHTML = `
            <div class="w-8 h-8 rounded-xl bg-gradient-to-br from-green-600 to-emerald-700 text-white flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-xs">
                🌾
            </div>
            <div class="max-w-[85%] bg-white border border-slate-200 p-3.5 rounded-2xl rounded-tl-xs text-xs text-slate-800 shadow-xs">
                <div class="flex items-center justify-between mb-1.5 gap-2">
                    <div class="flex items-center gap-1.5">
                        <span class="font-bold text-[11px] text-green-700">कृषि मित्र (Krishi Mitra AI)</span>
                        <span class="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">✨ ${modelName || 'Gemini 3.8 Flash'}</span>
                    </div>
                    <div>${audioBtn}</div>
                </div>
                <div class="prose-xs leading-relaxed chatbot-markdown-body">
                    ${formattedHtml}
                </div>
                ${suggestedHtml}
            </div>
        `;
        container.appendChild(div);
        this.scrollToBottom();
    },

    handleSuggestedAction: function (actionText) {
        if (actionText.includes("Orders") || actionText.includes("ऑर्डर्स")) {
            App.navigateToOrders();
        } else if (actionText.includes("Subscribe") || actionText.includes("WhatsApp Alert")) {
            App.openModal('modal-whatsapp-alerts');
        } else if (actionText.includes("List my crop") || actionText.includes("List New Crop")) {
            App.openModal('modal-list-crop');
        } else if (actionText.includes("Warehouse Loan") || actionText.includes("deposit produce")) {
            App.showSection('seller-dashboard');
            App.openModal('modal-deposit-warehouse');
        } else if (actionText.includes("Calculate price spread") || actionText.includes("Check Mandi Prices")) {
            App.showSection('mandi');
        } else if (actionText.includes("Explore Marketplace")) {
            App.showSection('buyer-dashboard');
        } else {
            this.sendMessage(actionText);
        }
    },

    showTypingIndicator: function () {
        const container = document.getElementById('chatbot-messages-container');
        if (!container) return;

        const div = document.createElement('div');
        div.id = 'chatbot-typing-indicator';
        div.className = "flex items-center gap-2 my-2 text-slate-400 text-xs";
        div.innerHTML = `
            <div class="w-7 h-7 rounded-xl bg-green-100 text-green-700 flex items-center justify-center text-xs">
                🌾
            </div>
            <div class="bg-slate-100 px-3 py-2 rounded-xl flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"></span>
                <span class="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]"></span>
                <span class="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.4s]"></span>
            </div>
        `;
        container.appendChild(div);
        this.scrollToBottom();
    },

    hideTypingIndicator: function () {
        const el = document.getElementById('chatbot-typing-indicator');
        if (el) el.remove();
    },

    scrollToBottom: function () {
        const container = document.getElementById('chatbot-messages-container');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    },

    formatMarkdown: function (text) {
        if (!text) return "";
        let html = text
            .replace(/### (.*?)\n/g, '<h4 class="font-bold text-slate-900 text-sm mt-1 mb-1">$1</h4>')
            .replace(/\*\*(.*?)\*\*/g, '<strong class="text-slate-900 font-semibold">$1</strong>')
            .replace(/\*(.*?)\*/g, '<em class="text-slate-600">$1</em>')
            .replace(/^- (.*?)$/gm, '<li class="ml-4 list-disc text-slate-700 py-0.5">$1</li>')
            .replace(/\n\n/g, '<div class="h-2"></div>')
            .replace(/\n/g, '<br/>');
        return html;
    },

    escapeHtml: function (str) {
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    },

    escapeQuotes: function (str) {
        return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    }
};

window.Chatbot = Chatbot;
