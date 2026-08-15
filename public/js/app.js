/**
 * GlobiLive Main Web App Core
 */

import { ApiService } from './api.js';
import { Components } from './components.js';

class GlobiLiveApp {
  constructor() {
    this.liveRooms = [];
    this.pkBattles = [];
    this.shorts    = [];
    this.activeCategory = 'all';
    this.isShortsMode   = false;
  }

  async init() {
    await this.loadRealData();
    this.setupEventListeners();
    this.renderUserPill();
  }

  async loadRealData() {
    const [rooms, pk, shortsList] = await Promise.all([
      ApiService.getLiveRooms(),
      ApiService.getPKBattles(),
      ApiService.getShorts()
    ]);
    this.liveRooms = rooms;
    this.pkBattles = pk;
    this.shorts    = shortsList;

    // Default: Shorts tab active
    this._showShortsView();

    // Sidebar continue watching
    const continueContainer = document.getElementById('continueWatchingList');
    if (continueContainer) Components.renderContinueWatching(continueContainer, this.shorts);
  }

  // ── CLEAR main content (remove shorts feed / profile / settings views) ──
  _clearMainSlot() {
    const mainContent = document.getElementById('mainContentArea');
    if (!mainContent) return;
    // Remove any dynamically injected views (shorts feed, profile view, settings view)
    const toRemove = mainContent.querySelectorAll(
      '.shorts-feed-container, .shorts-empty-state, .dynamic-view'
    );
    toRemove.forEach(el => el.remove());
  }

  // ── SHOW SHORTS VIEW ──
  _showShortsView() {
    this.isShortsMode = true;
    this._clearMainSlot();

    const heroSection      = document.getElementById('heroSpotlight');
    const youMightSection  = document.getElementById('youMightLikeSection');
    const mainContent      = document.getElementById('mainContentArea');

    if (heroSection)     heroSection.style.display     = 'none';
    if (youMightSection) youMightSection.style.display  = 'none';

    if (mainContent) Components.renderShortsView(mainContent, this.shorts);
  }

  // ── SHOW LIVE / GRID VIEW ──
  _showLiveView(cat) {
    this.isShortsMode = false;
    this._clearMainSlot();

    const heroSection     = document.getElementById('heroSpotlight');
    const youMightSection = document.getElementById('youMightLikeSection');

    // Restore hero & grid
    if (heroSection)     heroSection.style.display     = '';
    if (youMightSection) youMightSection.style.display  = '';

    // Render Hero
    const topRoom = this.liveRooms.length > 0 ? this.liveRooms[0] : null;
    const heroContainer = document.getElementById('heroSpotlight');
    if (heroContainer) Components.renderHeroSpotlight(heroContainer, topRoom);

    // Render Grid
    const gridContainer = document.getElementById('youMightLikeGrid');
    if (!gridContainer) return;

    if (cat === 'pk') {
      Components.renderYouMightLike(gridContainer, this.pkBattles, 'pk');
    } else if (cat === 'teenpatti' || cat === 'plinko' || cat === 'more') {
      Components.renderYouMightLike(gridContainer, [], 'games');
    } else {
      // 'live' and default
      Components.renderYouMightLike(gridContainer, this.liveRooms, 'live');
    }
  }

  // ── SHOW PROFILE VIEW ──
  _showProfileView() {
    this.isShortsMode = false;
    this._clearMainSlot();

    const heroSection     = document.getElementById('heroSpotlight');
    const youMightSection = document.getElementById('youMightLikeSection');
    if (heroSection)     heroSection.style.display     = 'none';
    if (youMightSection) youMightSection.style.display  = 'none';

    const user        = ApiService.getUserProfile();
    const mainContent = document.getElementById('mainContentArea');
    if (!mainContent) return;

    const profileEl = document.createElement('div');
    profileEl.className = 'dynamic-view';
    profileEl.innerHTML = `
      <div class="profile-view-card">

        <!-- Cover banner -->
        <div class="profile-cover-banner">
          <img src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1400&auto=format&fit=crop"
               style="width:100%;height:100%;object-fit:cover;" alt="Cover" />
          <div style="position:absolute;inset:0;background:linear-gradient(180deg,transparent 40%,rgba(15,23,42,0.7) 100%);"></div>
        </div>

        <!-- Avatar + name row -->
        <div class="profile-avatar-row">
          <div class="profile-avatar-ring">
            <img src="${user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop'}"
                 class="profile-avatar-img" alt="${user.name}" />
          </div>
          <div class="profile-name-block">
            <h2 class="profile-display-name">${user.name || 'GlobiLive User'}</h2>
            <span class="profile-username">@${(user.name || 'user').toLowerCase().replace(' ','_')}</span>
          </div>
          <a href="https://play.google.com/store/apps/details?id=com.gobilive.gobilive_app"
             target="_blank" class="profile-edit-btn">
            <i class="fa-solid fa-mobile-screen"></i> Edit on App
          </a>
        </div>

        <!-- Stats row -->
        <div class="profile-stats-row">
          <div class="profile-stat-item">
            <span class="stat-num">0</span>
            <span class="stat-label">Posts</span>
          </div>
          <div class="profile-stat-item">
            <span class="stat-num">0</span>
            <span class="stat-label">Followers</span>
          </div>
          <div class="profile-stat-item">
            <span class="stat-num">0</span>
            <span class="stat-label">Following</span>
          </div>
          <div class="profile-stat-item">
            <span class="stat-num">0</span>
            <span class="stat-label">💎 Diamonds</span>
          </div>
        </div>

        <!-- App CTA -->
        <div class="profile-app-cta">
          <div class="profile-cta-icon"><i class="fa-solid fa-user-circle"></i></div>
          <div>
            <h3 style="font-size:1rem;font-weight:800;color:#0F172A;margin-bottom:0.25rem;">Full Profile on Mobile App</h3>
            <p style="font-size:0.85rem;color:#64748B;">View your posts, followers, diamonds, and live session history on the GlobiLive mobile app.</p>
          </div>
          <a href="https://play.google.com/store/apps/details?id=com.gobilive.gobilive_app" target="_blank"
             class="btn-watch-main" style="white-space:nowrap;flex-shrink:0;">
            <i class="fa-brands fa-google-play"></i> Open App
          </a>
        </div>

      </div>`;
    mainContent.appendChild(profileEl);
  }

  // ── SHOW SETTINGS VIEW ──
  _showSettingsView() {
    this.isShortsMode = false;
    this._clearMainSlot();

    const heroSection     = document.getElementById('heroSpotlight');
    const youMightSection = document.getElementById('youMightLikeSection');
    if (heroSection)     heroSection.style.display     = 'none';
    if (youMightSection) youMightSection.style.display  = 'none';

    const mainContent = document.getElementById('mainContentArea');
    if (!mainContent) return;

    const settingsEl = document.createElement('div');
    settingsEl.className = 'dynamic-view';
    settingsEl.innerHTML = `
      <div class="settings-view-card">
        <div class="settings-header-row">
          <i class="fa-solid fa-gear" style="font-size:1.5rem;color:#E11D48;"></i>
          <h2 style="font-size:1.3rem;font-weight:800;color:#0F172A;">Settings</h2>
        </div>

        <div class="settings-section">
          <div class="settings-section-title">Account</div>
          ${this._settingItem('fa-user', 'Edit Profile', 'Update your name, bio, and profile picture', '#E11D48')}
          ${this._settingItem('fa-lock', 'Privacy Settings', 'Control who sees your content and activity', '#7C3AED')}
          ${this._settingItem('fa-bell', 'Notifications', 'Manage push notification preferences', '#F59E0B')}
        </div>

        <div class="settings-section">
          <div class="settings-section-title">Content & Discovery</div>
          ${this._settingItem('fa-eye-slash', 'Hidden Creators', 'Manage creators you have hidden from discover', '#64748B')}
          ${this._settingItem('fa-heart', 'Story Privacy', 'Control who sees your stories (Everyone / Followers)', '#EC4899')}
          ${this._settingItem('fa-globe', 'Language', 'Select your preferred language', '#0284C7')}
        </div>

        <div class="settings-section">
          <div class="settings-section-title">Support & Legal</div>
          ${this._settingItem('fa-circle-question', 'Help & Support', 'Get help with your account or report an issue', '#10B981')}
          ${this._settingItem('fa-shield-halved', 'Privacy Policy', 'Read our privacy policy', '#64748B')}
          ${this._settingItem('fa-file-contract', 'Terms of Service', 'Read our terms and conditions', '#64748B')}
        </div>

        <div class="settings-app-note">
          <i class="fa-solid fa-mobile-screen-button" style="color:#E11D48;font-size:1.2rem;"></i>
          <span>Full settings are available in the <strong>GlobiLive Mobile App</strong></span>
          <a href="https://play.google.com/store/apps/details?id=com.gobilive.gobilive_app" target="_blank"
             class="btn-watch-main" style="font-size:0.8rem;padding:0.4rem 1rem;">
            <i class="fa-brands fa-google-play"></i> Open App
          </a>
        </div>
      </div>`;
    mainContent.appendChild(settingsEl);
  }

  _settingItem(icon, title, desc, color) {
    return `
      <div class="settings-item">
        <div class="settings-item-icon" style="background:${color}20;color:${color};">
          <i class="fa-solid ${icon}"></i>
        </div>
        <div class="settings-item-text">
          <div class="settings-item-title">${title}</div>
          <div class="settings-item-desc">${desc}</div>
        </div>
        <i class="fa-solid fa-chevron-right settings-item-arrow"></i>
      </div>`;
  }

  setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', e => this.handleSearch(e.target.value));
    }

    // Top category pills
    const categoryPills = document.querySelectorAll('.category-pill');
    categoryPills.forEach(pill => {
      pill.addEventListener('click', e => {
        categoryPills.forEach(p => p.classList.remove('active'));
        e.currentTarget.classList.add('active');
        // Clear sidebar active
        document.querySelectorAll('.sidebar-nav-item').forEach(i => i.classList.remove('active'));

        const cat = e.currentTarget.getAttribute('data-cat');
        this.activeCategory = cat;
        if (cat === 'all') {
          this._showShortsView();
        } else {
          this._showLiveView(cat);
        }
      });
    });

    // Sidebar nav items
    const sidebarItems = document.querySelectorAll('.sidebar-nav-item[data-view]');
    sidebarItems.forEach(item => {
      item.addEventListener('click', e => {
        sidebarItems.forEach(i => i.classList.remove('active'));
        e.currentTarget.classList.add('active');
        // Clear category pill active
        categoryPills.forEach(p => p.classList.remove('active'));

        const view = e.currentTarget.getAttribute('data-view');
        if (view === 'home' || view === 'explore' || view === 'favorite') {
          // Activate Shorts pill + show shorts
          const shortsPill = document.querySelector('.category-pill[data-cat="all"]');
          if (shortsPill) shortsPill.classList.add('active');
          this._showShortsView();
        } else if (view === 'profile') {
          this._showProfileView();
        } else if (view === 'settings') {
          this._showSettingsView();
        }
      });
    });

    // Global handlers
    window.openLiveModal    = (ch, host, title) => this.openLiveModal(ch, host, title);
    window.openShortsViewer = (id) => { const idx = this.shorts.findIndex(s => String(s.id) === String(id)); if (idx >= 0 && window.scrollToShort) window.scrollToShort(idx); };
    window.openGameModal    = (type) => this.openGameModal(type);
  }

  async handleSearch(query) {
    const q = query.toLowerCase().trim();
    if (!q) {
      if (this.activeCategory === 'all') this._showShortsView();
      else this._showLiveView(this.activeCategory);
      return;
    }
    if (this.isShortsMode) return;
    const filtered = this.liveRooms.filter(r =>
      (r.title || '').toLowerCase().includes(q) || (r.hostUsername || '').toLowerCase().includes(q));
    const gridContainer = document.getElementById('youMightLikeGrid');
    if (gridContainer) Components.renderYouMightLike(gridContainer, filtered, 'live');
  }

  openLiveModal(channelName, hostName, title) {
    const modal     = document.getElementById('mediaModal');
    const modalBody = document.getElementById('mediaModalBody');
    if (!modal || !modalBody) return;
    modalBody.innerHTML = `
      <div style="padding:2rem;color:#FFF;text-align:center;">
        <div style="font-size:3rem;color:#E11D48;margin-bottom:0.75rem;"><i class="fa-solid fa-headset"></i></div>
        <h3 style="font-size:1.4rem;font-weight:800;margin-bottom:0.35rem;">${title || `${hostName}'s Live`}</h3>
        <p style="color:#94A3B8;font-size:0.9rem;margin-bottom:1.25rem;">Host: @${hostName || 'user'} • Live Broadcast</p>
        <div style="background:rgba(255,255,255,0.05);border-radius:1rem;padding:1.25rem;margin-bottom:1.5rem;border:1px solid rgba(255,255,255,0.1);">
          <div style="font-size:0.9rem;font-weight:700;color:#10B981;margin-bottom:0.35rem;">
            <i class="fa-solid fa-circle"></i> Streamer is LIVE on App!
          </div>
          <p style="font-size:0.85rem;color:rgba(255,255,255,0.7);">
            To join, send 3D gifts &amp; voice-chat with seats, open the GlobiLive Mobile App!
          </p>
        </div>
        <a href="https://play.google.com/store/apps/details?id=com.gobilive.gobilive_app" target="_blank"
           class="btn-watch-main" style="display:inline-flex;width:100%;justify-content:center;">
          <i class="fa-brands fa-google-play"></i> Join Broadcast in GlobiLive App
        </a>
      </div>`;
    modal.classList.add('active');
  }

  openGameModal(gameType) {
    const modal     = document.getElementById('mediaModal');
    const modalBody = document.getElementById('mediaModalBody');
    if (!modal || !modalBody) return;
    const games = {
      teenpatti: {
        color: '#7C3AED', icon: 'fa-gamepad', title: 'Teen Patti Royale',
        body: `<div style="display:flex;justify-content:center;gap:1rem;margin-bottom:1.5rem;">
          <div style="background:#1E293B;border:2px solid #7C3AED;border-radius:1rem;padding:1.25rem;font-size:1.5rem;font-weight:900;color:#F43F5E;">♠ K</div>
          <div style="background:#1E293B;border:2px solid #7C3AED;border-radius:1rem;padding:1.25rem;font-size:1.5rem;font-weight:900;color:#F43F5E;">♥ A</div>
          <div style="background:#1E293B;border:2px solid #7C3AED;border-radius:1rem;padding:1.25rem;font-size:1.5rem;font-weight:900;color:#F43F5E;">♦ J</div>
        </div>
        <button onclick="alert('You won 500 Diamonds 💎!')" style="background:#7C3AED;color:#FFF;border:none;padding:0.75rem 1.5rem;border-radius:100px;font-weight:800;cursor:pointer;">Deal &amp; Bet (100 💎)</button>`
      },
      plinko: {
        color: '#0284C7', icon: 'fa-circle-dot', title: 'Plinko Multiplier Drop',
        body: `<div style="display:flex;justify-content:center;gap:0.5rem;margin-bottom:1.5rem;">
          ${['10x','2x','5x','0.5x','10x'].map(m=>`<div style="background:#0284C7;padding:0.5rem 1rem;border-radius:0.5rem;font-weight:800;">${m}</div>`).join('')}
        </div>
        <button onclick="alert('You hit 5x! Won 500 Beans! 🎉')" style="background:#0284C7;color:#FFF;border:none;padding:0.75rem 1.5rem;border-radius:100px;font-weight:800;cursor:pointer;">Drop Ball ⚽</button>`
      },
      wheel: {
        color: '#10B981', icon: 'fa-arrows-spin', title: 'Lucky Fortune Wheel',
        body: `<div style="font-size:5rem;margin-bottom:1rem;">🎡</div>
        <button onclick="alert('You won 1,000 Free Beans! 🎊')" style="background:#10B981;color:#FFF;border:none;padding:0.75rem 1.5rem;border-radius:100px;font-weight:800;cursor:pointer;">Spin Wheel</button>`
      }
    };
    const g = games[gameType] || games.wheel;
    modalBody.innerHTML = `
      <div style="padding:2rem;color:#FFF;text-align:center;background:#0F172A;">
        <div style="font-size:3rem;color:${g.color};margin-bottom:0.75rem;"><i class="fa-solid ${g.icon}"></i></div>
        <h3 style="font-size:1.5rem;font-weight:800;margin-bottom:0.5rem;">${g.title}</h3>
        <p style="color:#94A3B8;font-size:0.875rem;margin-bottom:1.5rem;">Playable Mini-Game</p>
        ${g.body}
      </div>`;
    modal.classList.add('active');
  }

  renderUserPill() {
    const user     = ApiService.getUserProfile();
    const nameEl   = document.getElementById('userPillName');
    const avatarEl = document.getElementById('userPillAvatar');
    if (nameEl)  nameEl.innerText = user.name || 'Alex Morgan';
    if (avatarEl && user.avatar) avatarEl.src = user.avatar;
  }
}

document.addEventListener('DOMContentLoaded', () => { new GlobiLiveApp().init(); });
