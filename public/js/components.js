/**
 * GlobiLive UI Components Renderer — Tailwind CSS Edition
 */

export const Components = {

  // ── Sidebar Continue Watching ──
  renderContinueWatching(container, items) {
    if (!container) return;
    if (!items || items.length === 0) {
      container.innerHTML = `<div class="text-xs text-slate-400 text-center py-2">No recent shorts</div>`;
      return;
    }

    container.innerHTML = items.slice(0, 4).map(s => `
      <div class="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors"
           onclick="window.openShortsViewer('${s.id}')">
        <img src="${s.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop'}"
             class="w-8 h-8 rounded-full object-cover shrink-0" alt="${s.title}"
             onerror="this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop'" />
        <div class="min-w-0 flex-1">
          <div class="text-xs font-700 text-slate-800 truncate">${s.title}</div>
          <div class="text-[10px] text-slate-400 truncate">@${s.host}</div>
        </div>
        <button class="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px]">
          <i class="fa-solid fa-play"></i>
        </button>
      </div>
    `).join('');
  },

  // ── Hero Spotlight Card ──
  renderHeroSpotlight(container, item) {
    if (!container) return;

    if (!item) {
      container.innerHTML = `
        <img src="https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1400&auto=format&fit=crop"
             class="absolute inset-0 w-full h-full object-cover" alt="Spotlight" />
        <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent"></div>
        <div class="relative z-10 p-6 md:p-8 flex flex-col justify-end h-full min-h-[340px]">
          <div class="inline-flex items-center gap-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-700 px-3 py-1 rounded-full mb-3 w-fit">
            <i class="fa-solid fa-bolt"></i> GlobiLive Ecosystem
          </div>
          <h1 class="text-2xl md:text-3xl font-900 text-white mb-2 uppercase tracking-wide">
            REAL-TIME BROADCAST & SHORTS
          </h1>
          <p class="text-slate-300 text-xs md:text-sm max-w-xl mb-4 line-clamp-2">
            Stream live, participate in PK battles, upload user shorts, and send 3D gifts!
          </p>
          <div class="flex items-center gap-3 flex-wrap">
            <a href="https://play.google.com/store/apps/details?id=com.gobilive.gobilive_app" target="_blank"
               class="bg-primary text-white font-700 text-sm px-5 py-2.5 rounded-full flex items-center gap-2 hover:opacity-90">
              <i class="fa-brands fa-google-play"></i> Get Mobile App
            </a>
            <a href="/admin" class="bg-white/15 text-white font-700 text-sm px-5 py-2.5 rounded-full flex items-center gap-2 hover:bg-white/25">
              <i class="fa-solid fa-user-shield"></i> Admin Portal
            </a>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <img src="${item.thumbnailUrl || item.coverPic || 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1400&auto=format&fit=crop'}"
           class="absolute inset-0 w-full h-full object-cover" alt="${item.title}"
           onerror="this.src='https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1400&auto=format&fit=crop'" />
      <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent"></div>
      
      <div class="relative z-10 p-6 md:p-8 flex flex-col justify-end h-full min-h-[340px]">
        <div class="inline-flex items-center gap-1.5 bg-primary/20 text-rose-300 border border-primary/40 text-xs font-700 px-3 py-1 rounded-full mb-3 w-fit">
          <i class="fa-solid fa-fire text-primary animate-pulse"></i> ${item.isPKActive ? 'LIVE PK BATTLE' : 'TRENDING LIVE ROOM'}
        </div>
        <h1 class="text-2xl md:text-3xl font-900 text-white mb-1">
          ${item.title || `${item.hostUsername}'s Live Stream`}
        </h1>
        <div class="text-xs text-slate-300 font-600 mb-3 flex items-center gap-2 flex-wrap">
          <span>Host: @${item.hostUsername || 'user'}</span> •
          <span>${item.viewerCount || 0} Viewers</span> •
          <span>Level ${item.hostLevel || 1}</span>
        </div>
        <p class="text-slate-300 text-xs md:text-sm max-w-xl mb-4 line-clamp-2">
          Live stream broadcasting on GlobiLive. Open the mobile app to join the stream, send 3D gifts, and interact with host!
        </p>
        <div class="flex items-center gap-3 flex-wrap">
          <button class="bg-primary text-white font-700 text-sm px-5 py-2.5 rounded-full flex items-center gap-2 hover:opacity-90"
                  onclick="window.openLiveModal('${item.channelName}', '${item.hostUsername}', '${item.title}')">
            <i class="fa-solid fa-headset"></i> View Live Stream
          </button>
          <a href="https://play.google.com/store/apps/details?id=com.gobilive.gobilive_app" target="_blank"
             class="bg-white/15 text-white font-700 text-sm px-5 py-2.5 rounded-full flex items-center gap-2 hover:bg-white/25">
            <i class="fa-brands fa-google-play"></i> Join on App
          </a>
        </div>
      </div>
    `;
  },

  // ── TikTok-style Full Vertical Scroll Shorts Feed ──
  renderShortsView(container, shorts) {
    if (!container) return;

    if (!shorts || shorts.length === 0) {
      container.innerHTML = `
        <div class="flex flex-col items-center justify-center text-center p-8 bg-white rounded-3xl min-h-[400px]">
          <div class="text-5xl text-violet-500 mb-3"><i class="fa-solid fa-film"></i></div>
          <h2 class="text-xl font-800 text-slate-900 mb-1">No Shorts Uploaded Yet</h2>
          <p class="text-sm text-slate-500 max-w-sm mb-6">Be the first to upload a video Short using the GlobiLive Mobile App!</p>
          <a href="https://play.google.com/store/apps/details?id=com.gobilive.gobilive_app" target="_blank"
             class="bg-violet-600 text-white font-700 text-sm px-6 py-3 rounded-full flex items-center gap-2 hover:opacity-90">
            <i class="fa-solid fa-plus"></i> Upload Short on App
          </a>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div id="shortsFeed" class="shorts-feed h-[calc(100vh-140px)] rounded-2xl bg-black overflow-y-auto">
        ${shorts.map((s, idx) => this._buildShortCard(s, idx, shorts.length)).join('')}
      </div>
    `;

    requestAnimationFrame(() => this._initShortsPlayer(shorts));
  },

  _buildShortCard(s, idx, total) {
    const isVideo = s.mediaType === 'video' || (s.mediaUrl && s.mediaUrl.match(/\.(mp4|mov|webm)/i));
    const thumb = s.avatar || 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&auto=format&fit=crop';

    return `
      <div class="short-card relative w-full h-[calc(100vh-140px)] flex items-center justify-center bg-slate-950 overflow-hidden"
           id="short-${idx}" data-idx="${idx}" data-id="${s.id}">

        <!-- Media -->
        <div class="absolute inset-0">
          ${isVideo && s.mediaUrl
            ? `<video class="short-video w-full h-full object-cover" src="${s.mediaUrl}" loop playsinline muted preload="none"></video>`
            : `<img class="w-full h-full object-cover" src="${s.mediaUrl || thumb}" onerror="this.src='${thumb}'" alt="${s.title}" />`}
          
          <div class="absolute inset-0 z-10 cursor-pointer" onclick="window.toggleShortPlay(${idx})"></div>
          
          <div id="play-indicator-${idx}"
               class="play-indicator absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-black/60 text-white flex items-center justify-center text-2xl z-20 pointer-events-none">
            <i class="fa-solid fa-pause"></i>
          </div>
        </div>

        <!-- Right Action Column -->
        <div class="absolute right-4 bottom-24 flex flex-col items-center gap-4 z-30">
          <!-- Like Button -->
          <div class="flex flex-col items-center gap-1 cursor-pointer" onclick="window.toggleShortLike(${idx}, '${s.id}')">
            <div id="like-icon-${idx}" class="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-xl text-white transition-all">
              <i class="fa-solid fa-heart"></i>
            </div>
            <span id="like-count-${idx}" class="text-xs font-700 text-white shadow-sm">${s.likesCount || 0}</span>
          </div>

          <!-- Comment Button -->
          <div class="flex flex-col items-center gap-1 cursor-pointer" onclick="window.openShortComments(${idx}, '${s.id}', '${(s.title||'').replace(/'/g,'')}')">
            <div class="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-xl text-white">
              <i class="fa-solid fa-comment-dots"></i>
            </div>
            <span class="text-xs font-700 text-white shadow-sm">${s.commentsCount || 0}</span>
          </div>

          <!-- Share Button -->
          <div class="flex flex-col items-center gap-1 cursor-pointer" onclick="window.shareShort('${s.id}')">
            <div class="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-xl text-white">
              <i class="fa-solid fa-share-from-square"></i>
            </div>
            <span class="text-xs font-700 text-white shadow-sm">${s.sharesCount || 0}</span>
          </div>

          <!-- Author Avatar -->
          <div class="w-12 h-12 rounded-full p-0.5 border-2 border-primary overflow-hidden">
            <img src="${s.avatar || thumb}" class="w-full h-full object-cover rounded-full" onerror="this.src='${thumb}'" />
          </div>
        </div>

        <!-- Bottom Caption Overlay -->
        <div class="absolute bottom-0 left-0 right-16 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-30 text-white">
          <div class="flex items-center gap-2 mb-2">
            <img src="${s.avatar || thumb}" class="w-8 h-8 rounded-full border border-white object-cover" onerror="this.src='${thumb}'" />
            <span class="font-700 text-sm">@${s.host || 'user'}</span>
            <button class="bg-primary text-white text-xs font-700 px-3 py-1 rounded-full ml-2">Follow</button>
          </div>
          <p class="text-sm font-500 line-clamp-2 text-white/90 mb-3">${s.title || 'GlobiLive Short'}</p>
          
          <div class="h-1 bg-white/30 rounded-full overflow-hidden">
            <div id="progress-${idx}" class="progress-fill h-full bg-primary w-0"></div>
          </div>
        </div>

        <!-- Scroll Hints -->
        ${idx > 0 ? `<button onclick="window.scrollToShort(${idx - 1})" class="absolute top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white/20 backdrop-blur-md text-white text-xs flex items-center justify-center z-30"><i class="fa-solid fa-chevron-up"></i></button>` : ''}
        ${idx < total - 1 ? `<button onclick="window.scrollToShort(${idx + 1})" class="absolute bottom-20 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white/20 backdrop-blur-md text-white text-xs flex items-center justify-center z-30"><i class="fa-solid fa-chevron-down"></i></button>` : ''}
      </div>
    `;
  },

  _initShortsPlayer(shorts) {
    let currentIdx = 0;
    const likedSet = new Set();

    window._playShortAt = (idx) => {
      document.querySelectorAll('.short-video').forEach((v, i) => {
        if (i !== idx) { v.pause(); v.currentTime = 0; }
      });
      const card = document.getElementById(`short-${idx}`);
      if (!card) return;
      const video = card.querySelector('.short-video');
      const indicator = document.getElementById(`play-indicator-${idx}`);
      const progressFill = document.getElementById(`progress-${idx}`);

      if (video) {
        video.muted = false;
        video.play().catch(() => { video.muted = true; video.play(); });
        if (indicator) indicator.innerHTML = '<i class="fa-solid fa-pause"></i>';
        video.ontimeupdate = () => {
          if (video.duration && progressFill) {
            progressFill.style.width = ((video.currentTime / video.duration) * 100) + '%';
          }
        };
      }
      currentIdx = idx;
    };

    window.toggleShortPlay = (idx) => {
      const card = document.getElementById(`short-${idx}`);
      if (!card) return;
      const video = card.querySelector('.short-video');
      const indicator = document.getElementById(`play-indicator-${idx}`);
      if (!video) return;
      if (video.paused) {
        video.play();
        if (indicator) { indicator.innerHTML = '<i class="fa-solid fa-pause"></i>'; indicator.classList.remove('show'); }
      } else {
        video.pause();
        if (indicator) { indicator.innerHTML = '<i class="fa-solid fa-play"></i>'; indicator.classList.add('show'); }
      }
    };

    window.scrollToShort = (idx) => {
      const card = document.getElementById(`short-${idx}`);
      if (card) { card.scrollIntoView({ behavior: 'smooth' }); window._playShortAt(idx); }
    };

    window.toggleShortLike = (idx, id) => {
      const key = `${idx}-${id}`;
      const icon = document.getElementById(`like-icon-${idx}`);
      const countEl = document.getElementById(`like-count-${idx}`);
      if (likedSet.has(key)) {
        likedSet.delete(key);
        if (icon) icon.className = "w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-xl text-white transition-all";
        if (countEl) countEl.innerText = Math.max(0, parseInt(countEl.innerText) - 1);
      } else {
        likedSet.add(key);
        if (icon) icon.className = "w-12 h-12 rounded-full bg-primary flex items-center justify-center text-xl text-white transition-all scale-110";
        if (countEl) countEl.innerText = parseInt(countEl.innerText) + 1;
      }
    };

    window.shareShort = (id) => {
      const url = `${window.location.origin}?short=${id}`;
      if (navigator.share) navigator.share({ title: 'GlobiLive Short', url }).catch(() => {});
      else navigator.clipboard.writeText(url).then(() => alert('Link copied! 🔗')).catch(() => {});
    };

    window.openShortComments = (idx, id, title) => {
      const drawer = document.getElementById('commentsDrawer');
      const listEl = document.getElementById('commentsListEl');
      if (!drawer || !listEl) return;

      listEl.innerHTML = `
        <div class="flex items-start gap-2.5">
          <div class="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-800 shrink-0">V</div>
          <div>
            <span class="text-xs font-700 text-slate-400">@viewer</span>
            <p class="text-sm text-white mt-0.5">Awesome short! 🔥</p>
          </div>
        </div>
      `;

      drawer.classList.add('open');

      const input = document.getElementById('commentInputEl');
      const btn = document.getElementById('postCommentBtn');

      const postComm = () => {
        if (input && input.value.trim()) {
          const div = document.createElement('div');
          div.className = 'flex items-start gap-2.5';
          div.innerHTML = `
            <div class="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-800 shrink-0">Y</div>
            <div>
              <span class="text-xs font-700 text-slate-400">@you</span>
              <p class="text-sm text-white mt-0.5">${input.value.trim()}</p>
            </div>
          `;
          listEl.appendChild(div);
          input.value = '';
        }
      };

      if (btn) btn.onclick = postComm;
      if (input) input.onkeydown = (e) => { if (e.key === 'Enter') postComm(); };
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
          const idx = parseInt(entry.target.dataset.idx);
          window._playShortAt(idx);
        }
      });
    }, { threshold: 0.6 });

    document.querySelectorAll('.short-card').forEach(card => observer.observe(card));
    window._playShortAt(0);
  },

  // ── Grid Cards for Live / PK / Search ──
  renderGrid(container, items, type = 'live') {
    if (!container) return;

    if (!items || items.length === 0) {
      container.innerHTML = `
        <div class="col-span-full flex flex-col items-center justify-center text-center p-8 bg-white rounded-3xl min-h-[300px]">
          <div class="text-4xl text-rose-500 mb-2"><i class="fa-solid fa-headset"></i></div>
          <h3 class="text-base font-800 text-slate-900">No User Currently Live Right Now</h3>
          <p class="text-xs text-slate-500 mt-1 max-w-xs">Download the GlobiLive Mobile App to start a live stream or PK battle!</p>
          <a href="https://play.google.com/store/apps/details?id=com.gobilive.gobilive_app" target="_blank"
             class="mt-4 bg-primary text-white text-xs font-700 px-5 py-2.5 rounded-full inline-flex items-center gap-2">
            <i class="fa-solid fa-mobile-screen"></i> Start Live on App
          </a>
        </div>
      `;
      return;
    }

    container.innerHTML = items.slice(0, 6).map(item => `
      <div class="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
           onclick="window.openLiveModal('${item.channelName}', '${item.hostUsername || item.host}', '${(item.title||'').replace(/'/g,'')}')">
        <div class="relative aspect-[4/3] bg-slate-800 overflow-hidden">
          <img src="${item.thumbnailUrl || item.coverPic || 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&auto=format&fit=crop'}"
               class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt="${item.title}"
               onerror="this.src='https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&auto=format&fit=crop'" />
          <div class="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent"></div>
          
          <div class="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2 text-white">
            <div class="min-w-0">
              <div class="text-sm font-800 truncate">${item.title || item.hostUsername}</div>
              <div class="text-xs text-slate-300 truncate">@${item.hostUsername || item.host || 'user'} • ${item.viewerCount || 0} Viewers</div>
            </div>
            <button class="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shrink-0 shadow-md">
              <i class="fa-solid fa-headset text-xs"></i>
            </button>
          </div>
        </div>
      </div>
    `).join('');
  },

  // ── Playable Games Grid ──
  renderGamesGrid(container) {
    if (!container) return;
    const games = [
      { type:'teenpatti', img:'https://images.unsplash.com/photo-1511193311914-0346f16efe90?w=800&auto=format&fit=crop', title:'Teen Patti Royale', meta:'Playable Mini-Game', bg:'bg-violet-600', icon:'fa-gamepad' },
      { type:'plinko',    img:'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop', title:'Plinko Drop', meta:'Win Multipliers', bg:'bg-sky-600', icon:'fa-circle-dot' },
      { type:'wheel',     img:'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop', title:'Lucky Fortune Wheel', meta:'Daily Spin Bonus', bg:'bg-emerald-500', icon:'fa-arrows-spin' }
    ];

    container.innerHTML = games.map(g => `
      <div class="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
           onclick="window.openGameModal('${g.type}')">
        <div class="relative aspect-[4/3] bg-slate-800 overflow-hidden">
          <img src="${g.img}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt="${g.title}" />
          <div class="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent"></div>
          
          <div class="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2 text-white">
            <div>
              <div class="text-sm font-800">${g.title}</div>
              <div class="text-xs text-slate-300">${g.meta}</div>
            </div>
            <button class="w-8 h-8 rounded-full ${g.bg} text-white flex items-center justify-center shrink-0 shadow-md">
              <i class="fa-solid ${g.icon} text-xs"></i>
            </button>
          </div>
        </div>
      </div>
    `).join('');
  },

  // ── Profile View ──
  renderProfile(container, user) {
    if (!container) return;

    container.innerHTML = `
      <div class="bg-white rounded-3xl overflow-hidden shadow-sm">
        <div class="h-44 bg-gradient-to-r from-primary to-violet-600 relative">
          <img src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1400&auto=format&fit=crop" class="w-full h-full object-cover opacity-40" />
        </div>
        
        <div class="px-6 pb-6 relative">
          <div class="flex items-end justify-between gap-4 -mt-12 mb-4 flex-wrap">
            <div class="w-24 h-24 rounded-full border-4 border-white overflow-hidden bg-slate-100 shadow-md shrink-0">
              <img src="${user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop'}"
                   class="w-full h-full object-cover" alt="${user.name}" />
            </div>
            <a href="https://play.google.com/store/apps/details?id=com.gobilive.gobilive_app" target="_blank"
               class="bg-primary text-white text-xs font-700 px-4 py-2 rounded-full inline-flex items-center gap-1.5 hover:opacity-90">
              <i class="fa-solid fa-mobile-screen"></i> Edit on App
            </a>
          </div>

          <h2 class="text-xl font-900 text-slate-900">${user.name || 'Alex Morgan'}</h2>
          <p class="text-xs text-slate-400 font-500 mb-6">@${(user.name||'user').toLowerCase().replace(' ','_')}</p>

          <div class="grid grid-cols-4 gap-2 py-4 border-y border-slate-100 text-center mb-6">
            <div>
              <div class="text-lg font-900 text-slate-900">0</div>
              <div class="text-xs text-slate-400 font-600">Posts</div>
            </div>
            <div>
              <div class="text-lg font-900 text-slate-900">0</div>
              <div class="text-xs text-slate-400 font-600">Followers</div>
            </div>
            <div>
              <div class="text-lg font-900 text-slate-900">0</div>
              <div class="text-xs text-slate-400 font-600">Following</div>
            </div>
            <div>
              <div class="text-lg font-900 text-slate-900">0</div>
              <div class="text-xs text-slate-400 font-600">Diamonds</div>
            </div>
          </div>

          <div class="bg-rose-50 rounded-2xl p-4 flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-lg shrink-0">
              <i class="fa-solid fa-user-circle"></i>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-800 text-slate-900">Full Profile on Mobile App</div>
              <div class="text-xs text-slate-500">View your posts, followers, diamonds, and live history on mobile app.</div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // ── Settings View ──
  renderSettings(container) {
    if (!container) return;

    container.innerHTML = `
      <div class="bg-white rounded-3xl p-6 shadow-sm flex flex-col gap-6">
        <div class="flex items-center gap-3 pb-4 border-b border-slate-100">
          <i class="fa-solid fa-gear text-2xl text-primary"></i>
          <h2 class="text-xl font-900 text-slate-900">Settings</h2>
        </div>

        <div class="space-y-2">
          <div class="text-xs font-800 text-slate-400 uppercase tracking-wider mb-2">Account</div>
          ${this._settingRow('fa-user', 'Edit Profile', 'Update your name, bio, and profile picture', 'text-primary bg-rose-50')}
          ${this._settingRow('fa-lock', 'Privacy Settings', 'Control who sees your content and activity', 'text-violet-600 bg-violet-50')}
          ${this._settingRow('fa-bell', 'Notifications', 'Manage push notification preferences', 'text-amber-600 bg-amber-50')}
        </div>

        <div class="space-y-2">
          <div class="text-xs font-800 text-slate-400 uppercase tracking-wider mb-2">Content & Discovery</div>
          ${this._settingRow('fa-eye-slash', 'Hidden Creators', 'Manage creators hidden from discover', 'text-slate-600 bg-slate-100')}
          ${this._settingRow('fa-heart', 'Story Privacy', 'Control who sees your stories', 'text-pink-600 bg-pink-50')}
          ${this._settingRow('fa-globe', 'Language', 'Select your preferred language', 'text-sky-600 bg-sky-50')}
        </div>

        <div class="bg-slate-50 rounded-2xl p-4 flex items-center justify-between gap-3 border border-slate-100 flex-wrap">
          <span class="text-xs text-slate-600">Full settings available on <strong>GlobiLive Mobile App</strong></span>
          <a href="https://play.google.com/store/apps/details?id=com.gobilive.gobilive_app" target="_blank"
             class="bg-primary text-white text-xs font-700 px-4 py-2 rounded-full inline-flex items-center gap-1.5">
            <i class="fa-brands fa-google-play"></i> Open App
          </a>
        </div>
      </div>
    `;
  },

  _settingRow(icon, title, desc, colorClasses) {
    return `
      <div class="flex items-center gap-3.5 p-3 rounded-2xl hover:bg-slate-50 cursor-pointer transition-colors">
        <div class="w-10 h-10 rounded-xl ${colorClasses} flex items-center justify-center text-sm shrink-0">
          <i class="fa-solid ${icon}"></i>
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-700 text-slate-900">${title}</div>
          <div class="text-xs text-slate-400 truncate">${desc}</div>
        </div>
        <i class="fa-solid fa-chevron-right text-xs text-slate-300"></i>
      </div>
    `;
  }
};
