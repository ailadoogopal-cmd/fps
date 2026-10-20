/**
 * KrishiSetu Market, Mandi Price Intelligence & Smart Price Forecasting
 * Delivers transparent price discovery, historical trends & ML-based price forecasting
 */
const Market = {
    mandiPrices: [],
    spreadData: [],
    forecastData: null,
    weatherData: null,
    chartInstance: null,
    forecastChartInstance: null,
    selectedForecastCrop: 'Wheat',

    init: async function () {
        await this.loadPrices();
        await this.loadSpreadData();
        await this.loadForecast(this.selectedForecastCrop);
        await this.loadWeatherAdvisory();
        this.renderTicker();
    },

    loadPrices: async function (commodity = '', state = '', forceSync = false) {
        try {
            let url = '/api/market/prices?';
            if (commodity) url += `commodity=${encodeURIComponent(commodity)}&`;
            if (state) url += `state=${encodeURIComponent(state)}&`;
            if (forceSync) url += `sync=true&`;

            const res = await fetch(url);
            const data = await res.json();
            if (data.success) {
                this.mandiPrices = data.prices;
                this.renderPricesTable(data.prices);
                this.renderPricesWidget(data.prices);
                const updatedBadge = document.getElementById('mandi-last-updated-badge');
                if (updatedBadge) {
                    const isRailway = data.data_source === 'railway_mandi_api';
                    const dotColor = isRailway ? 'bg-emerald-500 animate-pulse' : 'bg-blue-500';
                    const sourceText = isRailway ? 'Railway API Live' : 'Live Cached Feed';
                    updatedBadge.innerHTML = `<span class="w-2 h-2 rounded-full ${dotColor} inline-block"></span> <span class="font-bold text-slate-700">${sourceText}:</span> ${data.last_updated || 'Today'} <span class="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded ml-1 border border-slate-200">${data.total_commodities || data.prices.length} crops</span>`;
                }
            }
        } catch (e) {
            console.error("Error loading mandi prices:", e);
        }
    },

    syncExternalApi: async function () {
        const btn = document.getElementById('btn-sync-mandi-api');
        const origHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-green-600"></i> <span>Syncing API...</span>`;
            btn.disabled = true;
        }

        try {
            const res = await fetch('/api/market/sync-external', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
            const data = await res.json();
            await this.loadPrices('', '', false);
            
            if (data.success) {
                if (window.App && App.showToast) {
                    App.showToast(`🌾 Mandi Rates Synced: ${data.message}`, 'success');
                } else {
                    alert(data.message);
                }
            } else {
                if (window.App && App.showToast) {
                    App.showToast(`ℹ️ API Status: ${data.message}`, 'info');
                } else {
                    alert(data.message);
                }
            }
        } catch (e) {
            console.error("Error syncing external Mandi API:", e);
            if (window.App && App.showToast) {
                App.showToast('ℹ️ External Railway Mandi API unreachable. High-accuracy local mandi DB active.', 'info');
            }
        } finally {
            if (btn) {
                btn.innerHTML = origHtml;
                btn.disabled = false;
            }
        }
    },

    loadSpreadData: async function () {
        try {
            const res = await fetch('/api/market/spread');
            const data = await res.json();
            if (data.success) {
                this.spreadData = data.spreads;
                this.renderSpreadCards(data.spreads);
                this.renderSpreadChart(data.spreads);
            }
        } catch (e) {
            console.error("Error loading spread data:", e);
        }
    },

    loadForecast: async function (commodity = 'Wheat') {
        try {
            this.selectedForecastCrop = commodity;
            const res = await fetch(`/api/market/forecast?commodity=${encodeURIComponent(commodity)}`);
            const data = await res.json();
            if (data.success) {
                this.forecastData = data;
                this.renderForecastUI(data);
            }
        } catch (e) {
            console.error("Error loading price forecast:", e);
        }
    },

    loadWeatherAdvisory: async function (district = 'Sehore', state = 'Madhya Pradesh') {
        try {
            const res = await fetch(`/api/weather/advisory?district=${encodeURIComponent(district)}&state=${encodeURIComponent(state)}`);
            const data = await res.json();
            if (data.success) {
                this.weatherData = data;
                this.renderWeatherUI(data);
            }
        } catch (e) {
            console.error("Error loading weather advisory:", e);
        }
    },

    renderWeatherUI: function (data) {
        const container = document.getElementById('weather-advisory-container');
        if (!container) return;

        let advisoryList = '';
        data.advisory.forEach(adv => {
            advisoryList += `<li class="flex items-start gap-2 py-1 text-slate-700 text-xs"><span class="text-green-700 font-bold">•</span> <span>${adv}</span></li>`;
        });

        container.innerHTML = `
            <div class="bg-gradient-to-br from-emerald-900 via-green-950 to-slate-900 text-white p-6 rounded-3xl border border-emerald-700/40 shadow-xl relative overflow-hidden">
                <div class="flex flex-wrap items-center justify-between gap-4 mb-4">
                    <div class="flex items-center gap-3">
                        <div class="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-2xl text-amber-300">
                            🌦️
                        </div>
                        <div>
                            <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-800/60 px-2 py-0.5 rounded">Smart Agrometeorology</span>
                            <h3 class="font-extrabold text-lg text-white mt-0.5">${data.location} Weather Advisory</h3>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="text-2xl font-black text-amber-300">${data.current.temp_c}°C</div>
                        <div class="text-[11px] text-slate-300">${data.current.condition}</div>
                    </div>
                </div>

                <div class="grid grid-cols-3 gap-3 p-3 bg-white/5 rounded-2xl border border-white/10 text-center mb-4 text-xs">
                    <div>
                        <div class="text-slate-400 text-[10px]">Humidity</div>
                        <div class="font-bold text-white text-sm mt-0.5">💧 ${data.current.humidity_pct}%</div>
                    </div>
                    <div>
                        <div class="text-slate-400 text-[10px]">Rain Probability</div>
                        <div class="font-bold text-amber-400 text-sm mt-0.5">🌧️ ${data.current.rain_probability_pct}%</div>
                    </div>
                    <div>
                        <div class="text-slate-400 text-[10px]">Wind Velocity</div>
                        <div class="font-bold text-white text-sm mt-0.5">💨 ${data.current.wind_kph} km/h</div>
                    </div>
                </div>

                <div class="bg-white/95 text-slate-900 p-4 rounded-2xl shadow-sm">
                    <h4 class="font-black text-xs text-green-900 flex items-center gap-1.5 mb-2">
                        <i class="fa-solid fa-leaf text-green-600"></i> Actionable Farmgate Advisory:
                    </h4>
                    <ul class="space-y-1">
                        ${advisoryList}
                    </ul>
                </div>
            </div>
        `;
    },

    renderForecastUI: function (data) {
        const titleEl = document.getElementById('forecast-crop-title');
        const curPriceEl = document.getElementById('forecast-current-price');
        const projPriceEl = document.getElementById('forecast-projected-price');
        const pctEl = document.getElementById('forecast-pct-change');
        const recBox = document.getElementById('forecast-recommendation-box');

        if (titleEl) titleEl.textContent = `${data.commodity} (14-Day Price Forecast)`;
        if (curPriceEl) curPriceEl.textContent = `₹${data.current_price.toLocaleString()}/Q`;
        if (projPriceEl) projPriceEl.textContent = `₹${data.forecast_14_days.toLocaleString()}/Q`;

        if (pctEl) {
            const isUp = data.pct_change_14_days >= 0;
            pctEl.className = isUp ? "font-bold text-sm text-green-700 bg-green-100 px-2 py-0.5 rounded" : "font-bold text-sm text-rose-700 bg-rose-100 px-2 py-0.5 rounded";
            pctEl.textContent = `${isUp ? '🔺 +' : '🔻 '}${data.pct_change_14_days}% (14 Days)`;
        }

        if (recBox) {
            recBox.innerHTML = `
                <div class="p-4 rounded-2xl ${data.pct_change_14_days >= 0 ? 'bg-emerald-50 border border-emerald-300 text-emerald-950' : 'bg-amber-50 border border-amber-300 text-amber-950'} text-xs">
                    <div class="flex items-center justify-between font-bold mb-1">
                        <span class="flex items-center gap-1.5"><i class="fa-solid fa-brain"></i> AI Strategic Recommendation:</span>
                        <span class="px-2 py-0.5 rounded text-[10px] bg-white border border-slate-300 font-extrabold uppercase">${data.action_tag}</span>
                    </div>
                    <p class="leading-relaxed font-medium">${data.recommendation}</p>
                </div>
            `;
        }

        this.renderForecastChart(data);
    },

    renderForecastChart: function (data) {
        const canvas = document.getElementById('forecast-price-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (this.forecastChartInstance) {
            this.forecastChartInstance.destroy();
        }

        const histLabels = data.history_points.map(p => {
            const d = new Date(p.date);
            return `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`;
        });
        const histPrices = data.history_points.map(p => p.price);

        const foreLabels = data.forecast_points.map(p => p.date);
        const forePrices = data.forecast_points.map(p => p.forecast_price);

        const combinedLabels = [...histLabels, ...foreLabels];
        
        // Build null-padded series
        const actualSeries = [...histPrices, ...new Array(forePrices.length).fill(null)];
        const projectedSeries = [...new Array(histPrices.length - 1).fill(null), histPrices[histPrices.length - 1], ...forePrices];

        this.forecastChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: combinedLabels,
                datasets: [
                    {
                        label: 'Historical Realized APMC Price (₹/Q)',
                        data: actualSeries,
                        borderColor: '#15803d',
                        backgroundColor: 'rgba(21, 128, 61, 0.1)',
                        borderWidth: 3,
                        pointRadius: 3,
                        tension: 0.2,
                        fill: false
                    },
                    {
                        label: 'AI 14-Day Projected Price (₹/Q)',
                        data: projectedSeries,
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        borderWidth: 3,
                        borderDash: [6, 6],
                        pointRadius: 4,
                        tension: 0.2,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { font: { size: 11, weight: 'bold' } } },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `${ctx.dataset.label}: ₹${ctx.parsed.y.toLocaleString()}/Q`
                        }
                    }
                },
                scales: {
                    y: {
                        ticks: {
                            callback: (val) => `₹${val.toLocaleString()}`,
                            font: { size: 10 }
                        },
                        grid: { color: '#f1f5f9' }
                    },
                    x: {
                        ticks: { font: { size: 10 } },
                        grid: { display: false }
                    }
                }
            }
        });
    },

    renderTicker: function () {
        const tickerContainer = document.getElementById('mandi-ticker-content');
        if (!tickerContainer || this.mandiPrices.length === 0) return;

        let html = '';
        this.mandiPrices.forEach(p => {
            const trendIcon = p.trend === 'up' 
                ? '<i class="fa-solid fa-arrow-trend-up text-green-600"></i>' 
                : (p.trend === 'down' ? '<i class="fa-solid fa-arrow-trend-down text-red-500"></i>' : '<i class="fa-solid fa-minus text-slate-400"></i>');
            
            html += `
                <span class="inline-flex items-center gap-2 mx-4 text-xs font-medium text-slate-700 bg-white/90 py-1 px-3 rounded-full border border-slate-200 shadow-xs">
                    <strong class="text-slate-900">${p.commodity} (${p.market})</strong>:
                    <span class="text-green-700 font-bold">₹${p.modal_price.toLocaleString()}/Q</span>
                    ${trendIcon}
                    <span class="text-[10px] text-slate-400">Retail: ₹${p.retail_price}</span>
                </span>
            `;
        });

        tickerContainer.innerHTML = html;
    },

    renderPricesTable: function (prices) {
        const tbody = document.getElementById('mandi-table-body');
        if (!tbody) return;

        if (!prices || prices.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-slate-400">No mandi price records match your filter criteria.</td></tr>`;
            return;
        }

        let rows = '';
        prices.forEach(p => {
            const trendBadge = p.trend === 'up'
                ? `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800"><i class="fa-solid fa-arrow-up mr-1"></i> Bullish</span>`
                : (p.trend === 'down' 
                    ? `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800"><i class="fa-solid fa-arrow-down mr-1"></i> Bearish</span>` 
                    : `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">Stable</span>`);

            rows += `
                <tr class="hover:bg-slate-50/80 transition-colors border-b border-slate-100">
                    <td class="px-4 py-3.5 font-semibold text-slate-900 flex items-center gap-2">
                        <span class="w-8 h-8 rounded-xl bg-green-50 text-green-700 flex items-center justify-center text-xs font-bold border border-green-200">
                            ${p.commodity.charAt(0)}
                        </span>
                        <div>
                            <div>${p.commodity}</div>
                            <span class="text-xs text-slate-500 font-normal">${p.variety || 'Standard'}</span>
                        </div>
                    </td>
                    <td class="px-4 py-3.5 text-xs text-slate-600">${p.market}</td>
                    <td class="px-4 py-3.5 text-xs text-slate-600">${p.district}, ${p.state}</td>
                    <td class="px-4 py-3.5 text-xs font-bold text-green-700">₹${p.modal_price.toLocaleString()}</td>
                    <td class="px-4 py-3.5 text-xs text-slate-500">₹${p.min_price.toLocaleString()} - ₹${p.max_price.toLocaleString()}</td>
                    <td class="px-4 py-3.5 text-xs text-slate-600">${p.arrivals_tonnes} MT</td>
                    <td class="px-4 py-3.5">${trendBadge}</td>
                </tr>
            `;
        });

        tbody.innerHTML = rows;
    },

    renderPricesWidget: function (prices) {
        const container = document.getElementById('seller-price-quick-cards');
        if (!container || !prices) return;

        let html = '';
        prices.slice(0, 4).forEach(p => {
            html += `
                <div class="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between">
                    <div class="flex items-center justify-between text-xs font-bold text-slate-800">
                        <span>${p.commodity}</span>
                        <span class="${p.trend === 'up' ? 'text-green-600' : 'text-slate-500'} text-[11px]">${p.trend === 'up' ? '📈 Bullish' : '⚖️ Stable'}</span>
                    </div>
                    <div class="my-2">
                        <div class="text-lg font-black text-green-700">₹${p.modal_price.toLocaleString()}<span class="text-xs text-slate-400 font-normal">/Q</span></div>
                        <div class="text-[10px] text-slate-500">${p.market}</div>
                    </div>
                    <button onclick="Market.loadForecast('${p.commodity}')" class="text-[10px] text-green-700 font-bold hover:underline text-left">
                        View 14-Day Forecast ➔
                    </button>
                </div>
            `;
        });
        container.innerHTML = html;
    },

    renderSpreadCards: function (spreads) {
        const container = document.getElementById('price-spread-comparison-cards');
        if (!container || !spreads) return;

        let html = '';
        spreads.slice(0, 3).forEach(s => {
            html += `
                <div class="p-5 bg-slate-50 border border-slate-200 rounded-3xl shadow-xs">
                    <div class="flex items-center justify-between mb-3">
                        <span class="font-extrabold text-sm text-slate-900">${s.commodity} (${s.variety || 'Prime'})</span>
                        <span class="px-2 py-0.5 rounded-full text-xs font-black bg-green-100 text-green-800">+${s.farmer_income_gain_pct}% Gain</span>
                    </div>
                    <div class="space-y-2 text-xs">
                        <div class="flex justify-between text-slate-500">
                            <span>Traditional Distress Gate:</span>
                            <span class="font-semibold line-through text-slate-400">₹${s.traditional_farmgate_price}/Q</span>
                        </div>
                        <div class="flex justify-between text-green-800 font-bold bg-green-50/80 p-2 rounded-xl border border-green-200">
                            <span>KrishiSetu Direct Price:</span>
                            <span class="font-black text-sm">₹${s.platform_direct_price}/Q</span>
                        </div>
                        <div class="flex justify-between text-slate-500 pt-1">
                            <span>Retail Consumer Value:</span>
                            <span class="font-semibold text-slate-700">₹${s.retail_price}/Q</span>
                        </div>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    },

    renderSpreadChart: function (spreads) {
        const canvas = document.getElementById('price-spread-chart');
        if (!canvas || !spreads || spreads.length === 0) return;

        const ctx = canvas.getContext('2d');
        if (this.chartInstance) {
            this.chartInstance.destroy();
        }

        const labels = spreads.slice(0, 6).map(s => s.commodity);
        const traditional = spreads.slice(0, 6).map(s => s.traditional_farmgate_price);
        const platform = spreads.slice(0, 6).map(s => s.platform_direct_price);
        const retail = spreads.slice(0, 6).map(s => s.retail_price);

        this.chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Distress Selling (Traditional Middlemen)',
                        data: traditional,
                        backgroundColor: '#cbd5e1',
                        borderRadius: 6
                    },
                    {
                        label: 'KrishiSetu Platform Realization',
                        data: platform,
                        backgroundColor: '#16a34a',
                        borderRadius: 6
                    },
                    {
                        label: 'End Consumer Retail Price',
                        data: retail,
                        backgroundColor: '#f59e0b',
                        borderRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { font: { size: 11, weight: 'bold' } } }
                },
                scales: {
                    y: {
                        ticks: {
                            callback: (val) => `₹${val.toLocaleString()}`
                        },
                        grid: { color: '#f8fafc' }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });
    }
};

window.Market = Market;
