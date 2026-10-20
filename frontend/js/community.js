/**
 * KrishiSetu Farmer Community Forum & Advisory Q&A
 * Enables farmers to ask agronomy questions, share remedies & upvote solutions
 */
const Community = {
    posts: [],
    selectedFilter: 'All',

    init: async function () {
        await this.loadPosts();
    },

    loadPosts: async function () {
        try {
            const res = await fetch('/api/community/posts');
            const data = await res.json();
            if (data.success) {
                this.posts = data.posts;
                this.renderPostsList();
            }
        } catch (e) {
            console.error("Error loading community posts:", e);
        }
    },

    filterByCategory: function (cat) {
        this.selectedFilter = cat;
        this.renderPostsList();
    },

    renderPostsList: function () {
        const container = document.getElementById('community-posts-container');
        if (!container) return;

        let filtered = this.posts;
        if (this.selectedFilter && this.selectedFilter !== 'All') {
            filtered = this.posts.filter(p => p.category.toLowerCase().includes(this.selectedFilter.toLowerCase()) || (p.crop_tag && p.crop_tag.toLowerCase().includes(this.selectedFilter.toLowerCase())));
        }

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="p-8 text-center text-slate-400 bg-white rounded-3xl border border-slate-200">
                    <i class="fa-regular fa-comments text-3xl mb-2 text-slate-300"></i>
                    <p class="text-xs">No questions found in this category. Be the first to ask!</p>
                </div>
            `;
            return;
        }

        let html = '';
        filtered.forEach(p => {
            let answersHtml = '';
            if (p.answers && p.answers.length > 0) {
                answersHtml = '<div class="mt-3 pt-3 border-t border-slate-100 space-y-2">';
                p.answers.forEach(a => {
                    const expertBadge = a.is_expert ? '<span class="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded mr-1">Agronomist</span>' : '';
                    answersHtml += `
                        <div class="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                            <div class="flex items-center justify-between text-[11px] font-bold text-slate-700 mb-1">
                                <span>${expertBadge} ${a.author_name}</span>
                                <span class="text-emerald-700">👍 ${a.upvotes} helpful</span>
                            </div>
                            <p class="text-slate-600 text-xs leading-relaxed">${a.answer_text}</p>
                        </div>
                    `;
                });
                answersHtml += '</div>';
            }

            html += `
                <div class="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs mb-4">
                    <div class="flex items-start justify-between gap-3 mb-2">
                        <div class="flex items-center gap-2">
                            <span class="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">
                                👨‍🌾
                            </span>
                            <div>
                                <h4 class="font-black text-slate-900 text-sm">${p.title}</h4>
                                <div class="text-[10px] text-slate-400 font-medium">By ${p.author_name} (${p.author_district || 'India'}) • Tag: <span class="text-green-700 font-bold">${p.crop_tag || p.category}</span></div>
                            </div>
                        </div>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            ${p.category}
                        </span>
                    </div>

                    <p class="text-xs text-slate-600 leading-relaxed mt-2">${p.description}</p>

                    <div class="flex items-center justify-between mt-3 pt-2 text-xs">
                        <button onclick="Community.upvotePost(${p.id})" class="px-3 py-1 bg-green-50 hover:bg-green-100 text-green-800 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors">
                            <span>👍 Upvote</span>
                            <span class="bg-green-200 text-green-900 px-1.5 py-0.2 rounded font-black text-[10px]">${p.upvotes}</span>
                        </button>
                        <button onclick="Community.toggleAnswerBox(${p.id})" class="text-green-700 hover:text-green-800 font-bold text-xs flex items-center gap-1">
                            <i class="fa-regular fa-comment"></i> Answer (${p.answers ? p.answers.length : 0})
                        </button>
                    </div>

                    <div id="answer-box-${p.id}" class="hidden mt-3 pt-2">
                        <div class="flex gap-2">
                            <input type="text" id="answer-input-${p.id}" placeholder="Write your verified advice/solution..." class="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs" />
                            <button onclick="Community.submitAnswer(${p.id})" class="px-3 py-2 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-xl">Post</button>
                        </div>
                    </div>

                    ${answersHtml}
                </div>
            `;
        });

        container.innerHTML = html;
    },

    toggleAnswerBox: function (postId) {
        const el = document.getElementById(`answer-box-${postId}`);
        if (el) el.classList.toggle('hidden');
    },

    submitQuestion: async function (e) {
        if (e) e.preventDefault();

        const title = document.getElementById('new-post-title').value.trim();
        const category = document.getElementById('new-post-category').value;
        const crop_tag = document.getElementById('new-post-crop').value.trim();
        const description = document.getElementById('new-post-desc').value.trim();

        if (!title || !description) {
            App.showToast("Please provide question title and details", "warning");
            return;
        }

        const userId = Auth.currentUser ? Auth.currentUser.id : 1;

        try {
            const res = await fetch('/api/community/posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    title,
                    category,
                    crop_tag,
                    description
                })
            });
            const data = await res.json();
            if (data.success) {
                App.showToast(data.message, "success");
                App.closeModal('modal-new-question');
                await this.loadPosts();
            } else {
                App.showToast(data.error || "Failed to post question", "error");
            }
        } catch (e) {
            App.showToast("Network error posting to community forum", "error");
        }
    },

    submitAnswer: async function (postId) {
        const input = document.getElementById(`answer-input-${postId}`);
        const text = input ? input.value.trim() : "";
        if (!text) return;

        const userId = Auth.currentUser ? Auth.currentUser.id : 1;

        try {
            const res = await fetch(`/api/community/posts/${postId}/answers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    answer_text: text,
                    is_expert: Auth.currentUser && Auth.currentUser.role === 'buyer' ? 1 : 0
                })
            });
            const data = await res.json();
            if (data.success) {
                App.showToast("Answer posted!", "success");
                await this.loadPosts();
            }
        } catch (e) {
            console.error(e);
        }
    },

    upvotePost: async function (postId) {
        try {
            const res = await fetch(`/api/community/posts/${postId}/upvote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            const data = await res.json();
            if (data.success) {
                await this.loadPosts();
            }
        } catch (e) {
            console.error(e);
        }
    }
};

window.Community = Community;
