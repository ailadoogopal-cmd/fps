/**
 * KrishiSetu Vernacular Voice Assistant & Full Voice-Only Navigation
 * Supports Hindi and Indian English voice recognition and speech readout
 */
const KrishiVoice = {
    isSpeaking: false,
    isListening: false,
    synth: window.speechSynthesis || null,
    recognition: null,
    currentLang: 'hi-IN',

    init: function () {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRec();
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
            this.recognition.lang = 'hi-IN';

            this.recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript.toLowerCase();
                console.log("🎙️ Voice Command Heard:", transcript);
                this.executeVoiceCommand(transcript);
            };

            this.recognition.onend = () => {
                this.isListening = false;
                this.updateVoiceNavUI();
            };

            this.recognition.onerror = (e) => {
                console.warn('Voice error:', e);
                this.isListening = false;
                this.updateVoiceNavUI();
            };
        }
    },

    toggleVoiceNav: function () {
        if (!this.recognition) {
            this.init();
        }
        if (!this.recognition) {
            App.showToast("Voice navigation is not supported in this browser", "info");
            return;
        }

        if (this.isListening) {
            this.recognition.stop();
            this.isListening = false;
        } else {
            try {
                this.recognition.start();
                this.isListening = true;
                App.showToast("🎙️ बोलिए... (Listening in Hindi/English... e.g. 'मंडी भाव', 'डैशबोर्ड', 'मौसम')", "info");
            } catch (e) {
                console.error(e);
            }
        }
        this.updateVoiceNavUI();
    },

    updateVoiceNavUI: function () {
        const btn = document.getElementById('global-voice-nav-btn');
        if (btn) {
            if (this.isListening) {
                btn.className = "px-3.5 py-1.5 rounded-xl text-xs font-bold bg-red-600 text-white shadow-lg animate-pulse flex items-center gap-1.5";
                btn.innerHTML = `<i class="fa-solid fa-microphone"></i> <span>सुन रहे हैं... (Listening)</span>`;
            } else {
                btn.className = "px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-sm flex items-center gap-1.5 transition-all";
                btn.innerHTML = `<i class="fa-solid fa-microphone"></i> <span class="hidden sm:inline">बोलकर चलाएं (Voice Mode)</span>`;
            }
        }
    },

    executeVoiceCommand: function (cmd) {
        if (cmd.includes("मंडी") || cmd.includes("mandi") || cmd.includes("bhav") || cmd.includes("भाव") || cmd.includes("rate")) {
            App.showSection('mandi');
            this.speak("लाइव मंडी भाव स्क्रीन खोल दी गई है।", 'hi-IN');
        } else if (cmd.includes("मौसम") || cmd.includes("weather") || cmd.includes("rain") || cmd.includes("बारिश")) {
            App.showSection('mandi');
            const el = document.getElementById('weather-advisory-container');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
            this.speak("मौसम पूर्वानुमान: अगले 48 घंटों में बारिश की संभावना है। कृपया सिंचाई स्थगित रखें।", 'hi-IN');
        } else if (cmd.includes("डैशबोर्ड") || cmd.includes("dashboard") || cmd.includes("मेरा खाता")) {
            if (Auth.currentUser) {
                App.navigateToDashboard(Auth.currentUser.role);
                this.speak("आपका डैशबोर्ड प्रस्तुत है।", 'hi-IN');
            } else {
                App.showSection('auth-portal');
                this.speak("कृपया पहले लॉगिन या रजिस्टर करें।", 'hi-IN');
            }
        } else if (cmd.includes("लिस्ट") || cmd.includes("बेचना") || cmd.includes("sell") || cmd.includes("crop")) {
            App.openModal('modal-list-crop');
            this.speak("फसल लिस्टिंग फॉर्म खोल दिया गया है।", 'hi-IN');
        } else if (cmd.includes("मित्र") || cmd.includes("chatbot") || cmd.includes("ai") || cmd.includes("मदद")) {
            Chatbot.toggleChat();
            this.speak("कृषि मित्र AI सहायक सक्रिय है।", 'hi-IN');
        } else if (cmd.includes("योजना") || cmd.includes("scheme") || cmd.includes("subsidy")) {
            App.showSection('roadmap');
            this.speak("सरकारी योजनाएं और रोडमैप प्रस्तुत है।", 'hi-IN');
        } else {
            Chatbot.toggleChat();
            Chatbot.sendMessage(cmd);
        }
    },

    speak: function (text, lang = null) {
        if (!this.synth) return;
        this.stop();

        const targetLang = lang || this.currentLang || 'hi-IN';
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = targetLang;
        utterance.rate = 0.95;
        utterance.pitch = 1.0;

        const voices = this.synth.getVoices();
        const matchingVoice = voices.find(v => v.lang.includes(targetLang.split('-')[0]) || v.lang === targetLang);
        if (matchingVoice) {
            utterance.voice = matchingVoice;
        }

        utterance.onstart = () => {
            this.isSpeaking = true;
            document.querySelectorAll('.voice-btn-icon').forEach(btn => {
                btn.classList.add('text-green-600', 'animate-pulse');
            });
        };

        utterance.onend = () => {
            this.isSpeaking = false;
            document.querySelectorAll('.voice-btn-icon').forEach(btn => {
                btn.classList.remove('text-green-600', 'animate-pulse');
            });
        };

        utterance.onerror = () => {
            this.isSpeaking = false;
        };

        this.synth.speak(utterance);
    },

    stop: function () {
        if (this.synth && this.synth.speaking) {
            this.synth.cancel();
            this.isSpeaking = false;
        }
    },

    readMandiSummary: function (prices) {
        if (!prices || prices.length === 0) return;
        const top3 = prices.slice(0, 3);
        let text = `आज के प्रमुख मंडी भाव: `;
        top3.forEach(p => {
            text += `${p.commodity} ${p.market} में ${p.modal_price} रुपये प्रति क्विंटल, `;
        });
        text += `। अधिक जानकारी के लिए मंडी भाव देखें।`;
        this.speak(text, 'hi-IN');
    }
};

window.KrishiVoice = KrishiVoice;
