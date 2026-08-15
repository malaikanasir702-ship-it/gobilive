/**
 * GlobiLive UI Components Renderer
 */

export const Components = {

  // ── Sidebar "Continue watching" list ──
  renderContinueWatching(container, items) {
    if (!container) return;
    if (!items || items.length === 0) {
      container.innerHTML = `<div style="font-size:0.75rem;color:#94A3B8;text-align:center;padding:0.5rem;">No recent shorts</div>`;
      return;
    }
    container.innerHTML = items.slice(0, 4).map(item => `
      <div class="continue-item" onclick="window.openShortsViewer('${item.id}')">
        <img src="${item.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop'}"
             class="continue-thumb" alt="${item.title}" onerror="this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop'" />
        <div class="continue-info">
          <div class="continue-title">${item.title}</div>
          <div class="continue-sub">@${item.host}</div>
        </div>
        <button class="continue-play-btn"><i class="fa-solid fa-play"></i></button>
      </div>
    `).join('');
  },

  // ── Hero Spotlight (Live Room or default) ──
  renderHeroSpotlight(container, item) {
    if (!container) return;
    if (!item) {
      container.innerHTML = `
        <img src="https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1400&auto=format&fit=crop" class="hero-bg-image" alt="GlobiLive" />
        <div class="hero-gradient-overlay"></div>
        <div class="hero-inner-content">
          <div class="trending-badge-pill"><i class="fa-solid fa-bolt"></i> GlobiLive Ecosystem</div>
          <h1 class="hero-main-title">GLOBILIVE REAL-TIME BROADCAST &amp; SHORTS</h1>
          <div class="hero-meta-row"><span>2026</span> • <span>Interactive Live</span> • <span>3D Gifts</span></div>
          <p class="hero-description-text">Stream Live, Play Mini-Games, and Monetize Your Audience. Download the GlobiLive App to start broadcasting!</p>
          <div class="hero-buttons-row">
            <a href="https://play.google.com/store/apps/details?id=com.gobilive.gobilive_app" target="_blank" class="btn-watch-main">
              <i class="fa-brands fa-google-play"></i> Download App
            </a>
            <a href="/admin" class="btn-download-main"><i class="fa-solid fa-user-shield"></i> Admin Portal</a>
          </div>
        </div>`;
      return;
    }
    container.innerHTML = `
      <img src="${item.thumbnailUrl || 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1400&auto=format&fit=crop'}"
           class="hero-bg-image" alt="${item.title}" onerror="this.src='https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1400&auto=format&fit=crop'" />
      <div class="hero-gradient-overlay"></div>
      <div class="hero-inner-content">
        <div class="trending-badge-pill">
          <i class="fa-solid fa-fire"></i> ${item.isPKActive ? 'LIVE PK BATTLE' : 'TRENDING LIVE ROOM'}
        </div>
        <h1 class="hero-main-title">${item.title || `${item.hostUsername}'s Live`}</h1>
        <div class="hero-meta-row">
          <span>@${item.hostUsername || 'user'}</span> • <span>${item.viewerCount || 0} Viewers</span> • <span>Level ${item.hostLevel || 1}</span>
        </div>
        <p class="hero-description-text">Live broadcast on GlobiLive. Join on the app to send 3D gifts &amp; interact in real time!</p>
        <div class="hero-buttons-row">
          <button class="btn-watch-main" onclick="window.openLiveModal('${item.channelName}','${item.hostUsername}','${item.title}')">
            <i class="fa-solid fa-headset"></i> View Live Stream
          </button>
          <a href="https://play.google.com/store/apps/details?id=com.gobilive.gobilive_app" target="_blank" class="btn-download-main">
            <i class="fa-solid fa-download"></i> Join on App
          </a>
        </div>
      </div>`;
  },

  // ── SHORTS: TikTok-style full vertical scrollable view ──
  renderShortsView(mainContent, shorts) {
    if (!mainContent) return;

    if (!shorts || shorts.length === 0) {
      mainContent.innerHTML = `
        <div class="shorts-empty-state">
          <div style="font-size:3.5rem;color:#7C3AED;margin-bottom:1rem;"><i class="fa-solid fa-film"></i></div>
          <h2 style="font-size:1.4rem;font-weight:800;color:#0F172A;margin-bottom:0.5rem;">No Shorts Uploaded Yet</h2>
          <p style="font-size:0.9rem;color:#64748B;margin-bottom:1.5rem;">Be the first to upload a Short using the GlobiLive Mobile App!</p>
          <a href="https://play.google.com/store/apps/details?id=com.gobilive.gobilive_app" target="_blank"
             style="display:inline-flex;align-items:center;gap:0.5rem;background:#7C3AED;color:#FFF;padding:0.75rem 1.5rem;border-radius:100px;font-weight:700;font-size:0.9rem;text-decoration:none;">
            <i class="fa-solid fa-plus"></i> Upload Short on App
          </a>
        </div>`;
      return;
    }

    mainContent.innerHTML = `
      <div class="shorts-feed-container" id="shortsFeed">
        ${shorts.map((s, idx) => this._buildShortCard(s, idx, shorts.length)).join('')}
      </div>`;

    // After render, start first video
    requestAnimationFrame(() => this._initShortsPlayer(shorts));
  },

  _buildShortCard(s, idx, total) {
    const isVideo = s.mediaType === 'video' || (s.mediaUrl && s.mediaUrl.match(/\.(mp4|mov|webm)/i));
    const thumb = s.avatar || 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&auto=format&fit=crop';

    return `
      <div class="short-card" id="short-${idx}" data-idx="${idx}" data-id="${s.id}">

        <!-- Video / Image media -->
        <div class="short-media-wrapper">
          ${isVideo && s.mediaUrl
            ? `<video class="short-video" src="${s.mediaUrl}" loop playsinline muted preload="none"
                      onerror="this.parentElement.style.background='#1E293B'"></video>`
            : `<img class="short-img" src="${s.mediaUrl || thumb}"
                    onerror="this.src='${thumb}'" alt="${s.title}" />`}
          <!-- Tap to play/pause overlay -->
          <div class="short-tap-overlay" onclick="window.toggleShortPlay(${idx})"></div>
          <!-- Play/pause icon indicator -->
          <div class="short-play-indicator" id="play-indicator-${idx}">
            <i class="fa-solid fa-pause"></i>
          </div>
        </div>

        <!-- Right action buttons (TikTok style) -->
        <div class="short-actions-col">
          <div class="short-action-btn" onclick="window.toggleShortLike(${idx}, '${s.id}')">
            <div class="short-action-icon" id="like-icon-${idx}">
              <i class="fa-solid fa-heart"></i>
            </div>
            <span class="short-action-label" id="like-count-${idx}">${s.likesCount || 0}</span>
          </div>

          <div class="short-action-btn" onclick="window.openShortComments(${idx}, '${s.id}', '${(s.title||'').replace(/'/g,'')}')">
            <div class="short-action-icon">
              <i class="fa-solid fa-comment-dots"></i>
            </div>
            <span class="short-action-label">${s.commentsCount || 0}</span>
          </div>

          <div class="short-action-btn" onclick="window.shareShort('${s.id}')">
            <div class="short-action-icon">
              <i class="fa-solid fa-share-from-square"></i>
            </div>
            <span class="short-action-label">${s.sharesCount || 0}</span>
          </div>

          <div class="short-action-btn">
            <div class="short-action-icon" style="overflow:hidden;border-radius:50%;">
              <img src="${s.avatar || thumb}" style="width:100%;height:100%;object-fit:cover;"
                   onerror="this.src='${thumb}'" alt="avatar" />
            </div>
          </div>
        </div>

        <!-- Bottom overlay: title + host + progress bar -->
        <div class="short-bottom-overlay">
          <div class="short-host-row">
            <img class="short-host-avatar" src="${s.avatar || thumb}"
                 onerror="this.src='${thumb}'" alt="@${s.host}" />
            <span class="short-host-name">@${s.host || 'user'}</span>
            <button class="short-follow-btn">Follow</button>
          </div>
          <p class="short-caption">${s.title || 'GlobiLive Short'}</p>
          <div class="short-progress-bar">
            <div class="short-progress-fill" id="progress-${idx}"></div>
          </div>
        </div>

        <!-- Scroll indicators -->
        ${idx > 0 ? `<div class="short-scroll-hint top" onclick="window.scrollToShort(${idx - 1})"><i class="fa-solid fa-chevron-up"></i></div>` : ''}
        ${idx < total - 1 ? `<div class="short-scroll-hint bottom" onclick="window.scrollToShort(${idx + 1})"><i class="fa-solid fa-chevron-down"></i></div>` : ''}
      </div>`;
  },

  _initShortsPlayer(shorts) {
    let currentIdx = 0;
    const likedSet = new Set();

    // Play video at idx
    window._playShortAt = (idx) => {
      // Pause all others
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

        // Update progress bar
        video.ontimeupdate = () => {
          if (video.duration) {
            const pct = (video.currentTime / video.duration) * 100;
            if (progressFill) progressFill.style.width = pct + '%';
          }
        };
      }
      currentIdx = idx;
    };

    // Toggle play/pause on tap
    window.toggleShortPlay = (idx) => {
      const card = document.getElementById(`short-${idx}`);
      if (!card) return;
      const video = card.querySelector('.short-video');
      const indicator = document.getElementById(`play-indicator-${idx}`);
      if (!video) return;
      if (video.paused) {
        video.play();
        if (indicator) { indicator.innerHTML = '<i class="fa-solid fa-pause"></i>'; indicator.classList.remove('visible'); }
      } else {
        video.pause();
        if (indicator) { indicator.innerHTML = '<i class="fa-solid fa-play"></i>'; indicator.classList.add('visible'); }
      }
    };

    // Scroll to short
    window.scrollToShort = (idx) => {
      const card = document.getElementById(`short-${idx}`);
      if (card) { card.scrollIntoView({ behavior: 'smooth' }); window._playShortAt(idx); }
    };

    // Like toggle
    window.toggleShortLike = (idx, id) => {
      const key = `${idx}-${id}`;
      const icon = document.getElementById(`like-icon-${idx}`);
      const countEl = document.getElementById(`like-count-${idx}`);
      if (likedSet.has(key)) {
        likedSet.delete(key);
        if (icon) { icon.style.color = ''; icon.style.transform = 'scale(1)'; }
        if (countEl) countEl.innerText = Math.max(0, parseInt(countEl.innerText) - 1);
      } else {
        likedSet.add(key);
        if (icon) { icon.style.color = '#E11D48'; icon.style.transform = 'scale(1.3)'; setTimeout(() => { if(icon) icon.style.transform='scale(1)'; }, 300); }
        if (countEl) countEl.innerText = parseInt(countEl.innerText) + 1;
      }
    };

    // Share short
    window.shareShort = (id) => {
      const url = `${window.location.origin}?short=${id}`;
      if (navigator.share) {
        navigator.share({ title: 'Check this Short on GlobiLive!', url }).catch(() => {});
      } else {
        navigator.clipboard.writeText(url).then(() => alert('Link copied! 🔗')).catch(() => {});
      }
    };

    // Comments drawer
    window.openShortComments = (idx, id, title) => {
      let drawer = document.getElementById('shortsCommentsDrawer');
      if (!drawer) {
        drawer = document.createElement('div');
        drawer.id = 'shortsCommentsDrawer';
        drawer.className = 'shorts-comments-drawer';
        document.body.appendChild(drawer);
      }
      drawer.innerHTML = `
        <div class="shorts-drawer-handle" onclick="document.getElementById('shortsCommentsDrawer').classList.remove('open')">
          <div style="width:40px;height:4px;background:rgba(255,255,255,0.3);border-radius:100px;margin:0 auto 0.75rem;"></div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:0 1.25rem 0.75rem;">
            <span style="font-weight:800;font-size:1rem;color:#FFF;">Comments</span>
            <button onclick="document.getElementById('shortsCommentsDrawer').classList.remove('open')"
                    style="background:none;border:none;color:#94A3B8;font-size:1.2rem;cursor:pointer;">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>
        <div class="shorts-comments-list" id="shortsCommentsList-${idx}">
          <div class="shorts-comment-item">
            <div class="sc-avatar">V</div>
            <div>
              <span class="sc-username">@viewer</span>
              <p class="sc-text">Amazing short! 🔥</p>
            </div>
          </div>
          <div class="shorts-comment-item">
            <div class="sc-avatar" style="background:#7C3AED;">G</div>
            <div>
              <span class="sc-username">@globilive_fan</span>
              <p class="sc-text">Love this content! Keep it up 💪</p>
            </div>
          </div>
        </div>
        <div class="shorts-comment-input-row">
          <input type="text" id="shortsCommentBox-${idx}" placeholder="Add a comment..."
                 onkeydown="if(event.key==='Enter') window.postShortComment(${idx})" />
          <button onclick="window.postShortComment(${idx})" style="background:#E11D48;border:none;color:#FFF;padding:0.5rem 1rem;border-radius:100px;font-weight:700;cursor:pointer;">
            <i class="fa-solid fa-paper-plane"></i>
          </button>
        </div>`;
      drawer.classList.add('open');

      window.postShortComment = (i) => {
        const input = document.getElementById(`shortsCommentBox-${i}`);
        const list = document.getElementById(`shortsCommentsList-${i}`);
        if (input && input.value.trim() && list) {
          const div = document.createElement('div');
          div.className = 'shorts-comment-item';
          div.innerHTML = `<div class="sc-avatar" style="background:#E11D48;">Y</div>
            <div><span class="sc-username">@you</span><p class="sc-text">${input.value.trim()}</p></div>`;
          list.appendChild(div);
          input.value = '';
          list.scrollTop = list.scrollHeight;
        }
      };
    };

    // Intersection Observer to auto-play visible short
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
          const idx = parseInt(entry.target.dataset.idx);
          window._playShortAt(idx);
        }
      });
    }, { threshold: 0.6 });

    document.querySelectorAll('.short-card').forEach(card => observer.observe(card));

    // Play first short
    window._playShortAt(0);
  },

  // ── "You Might Like" Grid (for Live Rooms / PK / Games) ──
  renderYouMightLike(container, items, type = 'live') {
    if (!container) return;
    if (!items || items.length === 0) {
      if (type === 'live' || type === 'pk') {
        container.innerHTML = `
          <div class="empty-state-card" style="grid-column:1/-1;">
            <div style="font-size:2.5rem;color:#E11D48;margin-bottom:0.5rem;"><i class="fa-solid fa-headset"></i></div>
            <h3 style="font-size:1.15rem;font-weight:800;color:#0F172A;">No User Currently Live Right Now</h3>
            <p style="font-size:0.875rem;color:#64748B;margin-top:0.25rem;">Open the GlobiLive App to start a live stream or PK battle!</p>
            <a href="https://play.google.com/store/apps/details?id=com.gobilive.gobilive_app" target="_blank"
               class="btn-watch-main" style="margin-top:1rem;display:inline-flex;">
              <i class="fa-solid fa-mobile-screen"></i> Start Live on App
            </a>
          </div>`;
      } else if (type === 'games') {
        this.renderGamesGrid(container);
      }
      return;
    }
    container.innerHTML = items.slice(0, 6).map(item => `
      <div class="card-item" onclick="window.openLiveModal('${item.channelName}','${item.hostUsername || item.host}','${(item.title||'').replace(/'/g,'')}')">
        <div class="card-thumb-container">
          <img src="${item.thumbnailUrl || item.coverPic || 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&auto=format&fit=crop'}"
               class="card-thumb-img" alt="${item.title}"
               onerror="this.src='https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&auto=format&fit=crop'" />
          <div class="card-gradient-overlay"></div>
          <div class="card-bottom-content">
            <div class="card-text-block">
              <div class="card-title">${item.title || item.hostUsername}</div>
              <div class="card-meta">@${item.hostUsername || item.host || 'user'} • ${item.viewerCount || 0} Viewers</div>
            </div>
            <button class="card-red-play-btn"><i class="fa-solid fa-headset"></i></button>
          </div>
        </div>
      </div>`).join('');
  },

  // ── Mini-Games Grid ──
  renderGamesGrid(container) {
    if (!container) return;
    const games = [
      { type:'teenpatti', img:'https://images.unsplash.com/photo-1511193311914-0346f16efe90?w=800&auto=format&fit=crop', title:'Teen Patti Royale', meta:'Playable Mini-Game', bg:'#7C3AED', icon:'fa-gamepad' },
      { type:'plinko',    img:'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop', title:'Plinko Drop',        meta:'Win Multipliers',  bg:'#0284C7', icon:'fa-circle-dot' },
      { type:'wheel',     img:'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop', title:'Fortune Wheel',       meta:'Daily Spin Bonus', bg:'#10B981', icon:'fa-arrows-spin' },
    ];
    container.innerHTML = games.map(g => `
      <div class="card-item" onclick="window.openGameModal('${g.type}')">
        <div class="card-thumb-container">
          <img src="${g.img}" class="card-thumb-img" alt="${g.title}" onerror="this.style.background='#1E293B'" />
          <div class="card-gradient-overlay"></div>
          <div class="card-bottom-content">
            <div class="card-text-block">
              <div class="card-title">${g.title}</div>
              <div class="card-meta">${g.meta}</div>
            </div>
            <button class="card-red-play-btn" style="background:${g.bg};"><i class="fa-solid ${g.icon}"></i></button>
          </div>
        </div>
      </div>`).join('');
  }
};
