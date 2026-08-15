/**
 * GlobiLive UI Components Renderer
 * Renders real backend data cards, empty state messages, interactive video modals, and playable mini-games.
 */

export const Components = {
  // Render Left Sidebar "Continue watching" / Shorts list
  renderContinueWatching(container, items) {
    if (!container) return;
    if (!items || items.length === 0) {
      container.innerHTML = `
        <div style="font-size:0.75rem; color:#94A3B8; text-align:center; padding:0.5rem;">
          No recent shorts
        </div>
      `;
      return;
    }

    container.innerHTML = items.slice(0, 4).map(item => `
      <div class="continue-item" data-id="${item.id}" onclick="window.playShort('${item.id}')">
        <img src="${item.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop'}" class="continue-thumb" alt="${item.title}" />
        <div class="continue-info">
          <div class="continue-title">${item.title}</div>
          <div class="continue-sub">@${item.host}</div>
        </div>
        <button class="continue-play-btn" title="Play">
          <i class="fa-solid fa-play"></i>
        </button>
      </div>
    `).join('');
  },

  // Render Hero Spotlight Card (with Real Live Stream or App Spotlight)
  renderHeroSpotlight(container, item) {
    if (!container) return;

    if (!item) {
      // Default Spotlight when no stream is live
      container.innerHTML = `
        <img src="https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1400&auto=format&fit=crop" class="hero-bg-image" alt="GlobiLive" />
        <div class="hero-gradient-overlay"></div>
        <div class="hero-inner-content">
          <div class="trending-badge-pill">
            <i class="fa-solid fa-bolt text-amber-400"></i> GlobiLive Ecosystem
          </div>
          <h1 class="hero-main-title">GLOBILIVE REAL-TIME BROADCAST & SHORTS</h1>
          <div class="hero-meta-row">
            <span>2026</span> • <span>Interactive Live</span> • <span>3D Gifts</span>
          </div>
          <p class="hero-description-text">
            Stream Live, Play Mini-Games, and Monetize Your Audience. Download the GlobiLive App to start broadcasting and participate in PK battles!
          </p>
          <div class="hero-buttons-row">
            <a href="https://play.google.com/store/apps/details?id=com.gobilive.gobilive_app" target="_blank" class="btn-watch-main">
              <i class="fa-brands fa-google-play"></i> Download Mobile App
            </a>
            <a href="/admin" class="btn-download-main">
              <i class="fa-solid fa-user-shield"></i> Admin Portal
            </a>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <img src="${item.coverPic || item.thumbnailUrl || 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1400&auto=format&fit=crop'}" class="hero-bg-image" alt="${item.title}" />
      <div class="hero-gradient-overlay"></div>
      
      <div class="hero-inner-content">
        <div class="trending-badge-pill">
          <i class="fa-solid fa-fire text-red-500"></i> ${item.isPKActive ? 'LIVE PK BATTLE' : 'TRENDING LIVE ROOM'}
        </div>

        <h1 class="hero-main-title">${item.title || `${item.hostUsername}'s Live`}</h1>

        <div class="hero-meta-row">
          <span>Host: @${item.hostUsername || 'user'}</span> • <span>${item.viewerCount || 0} Viewers</span> • <span>Level ${item.hostLevel || 1}</span>
        </div>

        <p class="hero-description-text">
          Live stream broadcasting on GlobiLive. Open the mobile app to join the stream, send 3D gifts, and interact with the host in real time!
        </p>

        <div class="hero-buttons-row">
          <button class="btn-watch-main" onclick="window.openLiveModal('${item.channelName}', '${item.hostUsername}', '${item.title}')">
            <i class="fa-solid fa-headset"></i> View Live Stream
          </button>
          <a href="https://play.google.com/store/apps/details?id=com.gobilive.gobilive_app" target="_blank" class="btn-download-main">
            <i class="fa-solid fa-download"></i> Join on App
          </a>
        </div>
      </div>
    `;
  },

  // Render "You Might Like" Cards Grid with REAL DATA & Clean Empty States
  renderYouMightLike(container, items, type = 'live') {
    if (!container) return;

    if (!items || items.length === 0) {
      if (type === 'live' || type === 'pk') {
        container.innerHTML = `
          <div class="empty-state-card" style="grid-column: 1 / -1;">
            <div style="font-size:2.5rem; color:#E11D48; margin-bottom:0.5rem;"><i class="fa-solid fa-headset"></i></div>
            <h3 style="font-size:1.15rem; font-weight:800; color:#0F172A;">No User Currently Live Right Now</h3>
            <p style="font-size:0.875rem; color:#64748B; margin-top:0.25rem;">Download the GlobiLive Mobile App to start a live stream or PK battle!</p>
            <a href="https://play.google.com/store/apps/details?id=com.gobilive.gobilive_app" target="_blank" class="btn-watch-main" style="margin-top:1rem; display:inline-flex;">
              <i class="fa-solid fa-mobile-screen"></i> Start Live on App
            </a>
          </div>
        `;
      } else if (type === 'shorts') {
        container.innerHTML = `
          <div class="empty-state-card" style="grid-column: 1 / -1;">
            <div style="font-size:2.5rem; color:#7C3AED; margin-bottom:0.5rem;"><i class="fa-solid fa-film"></i></div>
            <h3 style="font-size:1.15rem; font-weight:800; color:#0F172A;">No Shorts Uploaded Yet</h3>
            <p style="font-size:0.875rem; color:#64748B; margin-top:0.25rem;">Be the first to upload a video Short using the GlobiLive Mobile App!</p>
            <a href="https://play.google.com/store/apps/details?id=com.gobilive.gobilive_app" target="_blank" class="btn-watch-main" style="margin-top:1rem; display:inline-flex; background:#7C3AED; color:#FFF;">
              <i class="fa-solid fa-plus"></i> Upload Short on App
            </a>
          </div>
        `;
      } else if (type === 'games') {
        this.renderGamesGrid(container);
      }
      return;
    }

    container.innerHTML = items.slice(0, 3).map(item => `
      <div class="card-item" onclick="${type === 'shorts' ? `window.playShort('${item.id}')` : `window.openLiveModal('${item.channelName}', '${item.hostUsername || item.host}', '${item.title}')`}">
        <div class="card-thumb-container">
          <img src="${item.coverPic || item.thumbnailUrl || item.avatar || 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&auto=format&fit=crop'}" class="card-thumb-img" alt="${item.title}" />
          <div class="card-gradient-overlay"></div>
          
          <div class="card-bottom-content">
            <div class="card-text-block">
              <div class="card-title">${item.title || item.hostUsername}</div>
              <div class="card-meta">@${item.hostUsername || item.host || 'user'} • ${item.viewerCount || item.likesCount || 0} ${type === 'shorts' ? 'Likes' : 'Viewers'}</div>
            </div>
            
            <button class="card-red-play-btn">
              <i class="fa-solid ${type === 'shorts' ? 'fa-play' : 'fa-headset'}"></i>
            </button>
          </div>
        </div>
      </div>
    `).join('');
  },

  // Render Playable Mini-Games Cards
  renderGamesGrid(container) {
    if (!container) return;
    container.innerHTML = `
      <div class="card-item" onclick="window.openGameModal('teenpatti')">
        <div class="card-thumb-container">
          <img src="https://images.unsplash.com/photo-1511193311914-0346f16efe90?w=800&auto=format&fit=crop" class="card-thumb-img" alt="Teen Patti" />
          <div class="card-gradient-overlay"></div>
          <div class="card-bottom-content">
            <div class="card-text-block">
              <div class="card-title">Teen Patti Royale</div>
              <div class="card-meta">Playable Mini-Game</div>
            </div>
            <button class="card-red-play-btn" style="background:#7C3AED;">
              <i class="fa-solid fa-gamepad"></i>
            </button>
          </div>
        </div>
      </div>

      <div class="card-item" onclick="window.openGameModal('plinko')">
        <div class="card-thumb-container">
          <img src="https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop" class="card-thumb-img" alt="Plinko" />
          <div class="card-gradient-overlay"></div>
          <div class="card-bottom-content">
            <div class="card-text-block">
              <div class="card-title">Plinko Drop</div>
              <div class="card-meta">Win Multipliers</div>
            </div>
            <button class="card-red-play-btn" style="background:#0284C7;">
              <i class="fa-solid fa-circle-dot"></i>
            </button>
          </div>
        </div>
      </div>

      <div class="card-item" onclick="window.openGameModal('wheel')">
        <div class="card-thumb-container">
          <img src="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop" class="card-thumb-img" alt="Spin Wheel" />
          <div class="card-gradient-overlay"></div>
          <div class="card-bottom-content">
            <div class="card-text-block">
              <div class="card-title">Lucky Fortune Wheel</div>
              <div class="card-meta">Daily Spin Bonus</div>
            </div>
            <button class="card-red-play-btn" style="background:#10B981;">
              <i class="fa-solid fa-arrows-spin"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }
};
