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

    // Default view: Shorts tab active → show shorts reel
    this._showShortsView();

    // Sidebar continue watching
    const continueContainer = document.getElementById('continueWatchingList');
    if (continueContainer) Components.renderContinueWatching(continueContainer, this.shorts);
  }

  _showShortsView() {
    this.isShortsMode = true;
    const mainContent = document.getElementById('mainContentArea');
    const heroSection = document.getElementById('heroSpotlight');
    const youMightSection = document.getElementById('youMightLikeSection');

    // Hide hero + grid, show shorts feed
    if (heroSection)      heroSection.style.display     = 'none';
    if (youMightSection)  youMightSection.style.display  = 'none';

    if (mainContent) Components.renderShortsView(mainContent, this.shorts);
  }

  _showLiveView(cat) {
    this.isShortsMode = false;
    const mainContent    = document.getElementById('mainContentArea');
    const heroSection    = document.getElementById('heroSpotlight');
    const youMightSection = document.getElementById('youMightLikeSection');

    // Clear shorts feed from main content area inner slot
    const shortsFeed = document.getElementById('shortsFeed');
    if (shortsFeed) shortsFeed.parentElement.remove();

    // Remove shorts empty state if present
    const shortsEmpty = mainContent?.querySelector('.shorts-empty-state, .shorts-feed-container');
    if (shortsEmpty) shortsEmpty.remove();

    if (heroSection)     heroSection.style.display     = '';
    if (youMightSection) youMightSection.style.display  = '';

    const topRoom = this.liveRooms.length > 0 ? this.liveRooms[0] : null;
    const heroContainer = document.getElementById('heroSpotlight');
    if (heroContainer) Components.renderHeroSpotlight(heroContainer, topRoom);

    const gridContainer = document.getElementById('youMightLikeGrid');
    if (!gridContainer) return;

    if (cat === 'pk') {
      Components.renderYouMightLike(gridContainer, this.pkBattles, 'pk');
    } else if (cat === 'teenpatti' || cat === 'plinko' || cat === 'more') {
      Components.renderYouMightLike(gridContainer, [], 'games');
    } else {
      Components.renderYouMightLike(gridContainer, this.liveRooms, 'live');
    }
  }

  setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', e => this.handleSearch(e.target.value));
    }

    const categoryPills = document.querySelectorAll('.category-pill');
    categoryPills.forEach(pill => {
      pill.addEventListener('click', e => {
        categoryPills.forEach(p => p.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const cat = e.currentTarget.getAttribute('data-cat');
        this.activeCategory = cat;

        if (cat === 'all') {
          this._showShortsView();
        } else {
          this._showLiveView(cat);
        }
      });
    });

    // Global handlers
    window.openLiveModal    = (ch, host, title) => this.openLiveModal(ch, host, title);
    window.openShortsViewer = (id) => { const idx = this.shorts.findIndex(s => String(s.id) === String(id)); if (idx >= 0) window.scrollToShort && window.scrollToShort(idx); };
    window.openGameModal    = (type) => this.openGameModal(type);
  }

  async handleSearch(query) {
    const q = query.toLowerCase().trim();
    if (!q) { this.activeCategory === 'all' ? this._showShortsView() : this._showLiveView(this.activeCategory); return; }

    // Only affects live/grid view
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
          ${['10x','2x','5x','0.5x','10x'].map(m => `<div style="background:#0284C7;padding:0.5rem 1rem;border-radius:0.5rem;font-weight:800;">${m}</div>`).join('')}
        </div>
        <button onclick="alert('You hit 5x! Won 500 Beans! 🎉')" style="background:#0284C7;color:#FFF;border:none;padding:0.75rem 1.5rem;border-radius:100px;font-weight:800;cursor:pointer;">Drop Ball ⚽</button>`
      },
      wheel: {
        color: '#10B981', icon: 'fa-arrows-spin', title: 'Lucky Fortune Wheel',
        body: `<div style="font-size:5rem;margin-bottom:1rem;animation:spin 2s linear infinite;">🎡</div>
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
    const user    = ApiService.getUserProfile();
    const nameEl  = document.getElementById('userPillName');
    const avatarEl = document.getElementById('userPillAvatar');
    if (nameEl)  nameEl.innerText = user.name || 'Alex Morgan';
    if (avatarEl && user.avatar) avatarEl.src = user.avatar;
  }
}

document.addEventListener('DOMContentLoaded', () => { new GlobiLiveApp().init(); });
