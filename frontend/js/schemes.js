/**
 * KrishiSetu Government Schemes & Subsidies Module
 * Provides easy discovery, eligibility checker, and 1-click links for central & state farming schemes
 */
const Schemes = {
    schemesList: [],

    init: async function () {
        await this.loadSchemes();
    },

    loadSchemes: async function () {
        try {
            const res = await fetch('/api/schemes');
            const data = await res.json();
            if (data.success) {
                this.schemesList = data.schemes;
                this.renderSchemesUI(data.schemes);
            }
        } catch (e) {
            console.error("Error loading government schemes:", e);
        }
    },

    renderSchemesUI: function (schemes) {
        const container = document.getElementById('government-schemes-container');
        if (!container || !schemes) return;

        let html = '';
        schemes.forEach(s => {
            html += `
                <div class="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs hover:border-emerald-300 transition-all flex flex-col justify-between">
                    <div>
                        <div class="flex items-center justify-between gap-2 mb-2">
                            <span class="text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                                ${s.category}
                            </span>
                            <span class="text-xs font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                ${s.subsidy_pct}% Benefit
                            </span>
                        </div>

                        <h4 class="font-black text-slate-900 text-sm mb-1">${s.name}</h4>
                        <p class="text-xs text-slate-600 leading-relaxed mb-3">${s.benefit_desc}</p>

                        <div class="p-2.5 bg-slate-50 rounded-xl text-xs space-y-1 text-slate-700 mb-3 border border-slate-100">
                            <div><strong>Eligibility:</strong> ${s.eligibility}</div>
                            <div><strong>Toll-Free Helpline:</strong> <span class="font-mono font-bold text-green-700">${s.helpline}</span></div>
                        </div>
                    </div>

                    <a href="${s.apply_url}" target="_blank" class="w-full py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold text-center block transition-colors">
                        Official Portal Guidelines <i class="fa-solid fa-arrow-up-right-from-square ml-1 text-[10px]"></i>
                    </a>
                </div>
            `;
        });

        container.innerHTML = html;
    }
};

window.Schemes = Schemes;
