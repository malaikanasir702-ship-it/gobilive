/**
 * GlobiLive Main App — Tailwind CSS mobile-first edition
 * Slot-based view switching: never destroys DOM elements
 */

import { ApiService } from './api.js';
import { Components } from './components.js';

// ── Slot IDs ──
const SLOTS = ['shortsFeedSlot', 'gridSlot', 'profileSlot', 'settingsSlot'];

function showSlot(id) {
  SLOTS.forEach(s => {
    const el = document.getElementById(s);
    if (!el) return;
    el.classList.toggle('hidden', s !== id);
    if (s === 'gridSlot') el.classList.toggle('flex', s === id);
  });
}

class GlobiLiveApp {
  constructor() {
    this.liveRooms = [];
    this.pkBattles = [];
    this.shorts    = [];
    this.activeCategory = 'all';
  }

  async init() {
    await this.loadData();
    this.setupListeners();
    this.renderUserPill();
  }

  async loadData() {
    const [rooms, pk, shortsList] = await Promise.all([
      ApiService.getLiveRooms(),
      ApiService.getPKBattles(),
      ApiService.getShorts()
    ]);
    this.liveRooms = rooms;
    this.pkBattles = pk;
    this.shorts    = shortsList;

    // Render sidebar continue-watching
    Components.renderContinueWatching(
      document.getElementById('continueWatchingList'), this.shorts
    );

    // Default view: Shorts
    this.gotoShorts();
  }

  // ──────────────────────────────────────────────────
  //  VIEW SWITCHERS
  // ──────────────────────────────────────────────────
  gotoShorts() {
    this.activeCategory = 'all';
    showSlot('shortsFeedSlot');
    Components.renderShortsView(
      document.getElementById('shortsFeedSlot'), this.shorts
    );
  }

  gotoGrid(cat) {
    this.activeCategory = cat;
    showSlot('gridSlot');

    const hero = document.getElementById('heroSpotlight');
    const grid = document.getElementById('youMightLikeGrid');

    Components.renderHeroSpotlight(
      hero, this.liveRooms.length ? this.liveRooms[0] : null
    );

    if (cat === 'pk') {
      Components.renderGrid(grid, this.pkBattles, 'pk');
    } else if (['teenpatti','plinko','more'].includes(cat)) {
      Components.renderGamesGrid(grid);
    } else {
      Components.renderGrid(grid, this.liveRooms, 'live');
    }
  }

  gotoProfile() {
    showSlot('profileSlot');
    Components.renderProfile(
      document.getElementById('profileSlot'),
      ApiService.getUserProfile()
    );
  }

  gotoSettings() {
    showSlot('settingsSlot');
    Components.renderSettings(
      document.getElementById('settingsSlot')
    );
  }

  // ──────────────────────────────────────────────────
  //  EVENT LISTENERS
  // ──────────────────────────────────────────────────
  setupListeners() {
    // Search
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', e => {
        const q = e.target.value.toLowerCase().trim();
        if (!q || this.activeCategory === 'all') return;
        const grid = document.getElementById('youMightLikeGrid');
        if (!grid) return;
        const filtered = this.liveRooms.filter(r =>
          (r.title||'').toLowerCase().includes(q) ||
          (r.hostUsername||'').toLowerCase().includes(q)
        );
        Components.renderGrid(grid, filtered, 'live');
      });
    }

    // Desktop category pills
    document.querySelectorAll('.category-pill').forEach(pill => {
      pill.addEventListener('click', e => {
        document.querySelectorAll('.category-pill').forEach(p => {
          p.classList.remove('bg-primary','text-white','active-pill');
          p.classList.add('text-slate-600');
        });
        e.currentTarget.classList.add('bg-primary','text-white','active-pill');
        e.currentTarget.classList.remove('text-slate-600');
        this.handleCat(e.currentTarget.getAttribute('data-cat'), null);
      });
    });

    // Mobile bottom nav
    document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        document.querySelectorAll('.mobile-nav-btn').forEach(b => {
          b.classList.remove('text-primary');
          b.classList.add('text-slate-500');
        });
        e.currentTarget.classList.add('text-primary');
        e.currentTarget.classList.remove('text-slate-500');
        const cat  = e.currentTarget.getAttribute('data-cat');
        const view = e.currentTarget.getAttribute('data-view');
        this.handleCat(cat, view);
      });
    });

    // Sidebar nav
    document.querySelectorAll('.sidebar-nav-item').forEach(item => {
      item.addEventListener('click', e => {
        document.querySelectorAll('.sidebar-nav-item').forEach(i => {
          i.classList.remove('active','bg-red-50');
          i.querySelector('a')?.classList.remove('text-primary','font-700');
          i.querySelector('a')?.classList.add('text-slate-600','font-600');
        });
        e.currentTarget.classList.add('active','bg-red-50');
        e.currentTarget.querySelector('a')?.classList.add('text-primary','font-700');
        e.currentTarget.querySelector('a')?.classList.remove('text-slate-600','font-600');

        const view = e.currentTarget.getAttribute('data-view');
        if (view === 'profile')   this.gotoProfile();
        else if (view === 'settings') this.gotoSettings();
        else this.gotoShorts();
      });
    });

    // Global window helpers
    window.openLiveModal    = (ch, host, title) => this.openLiveModal(ch, host, title);
    window.openGameModal    = (type) => this.openGameModal(type);
    window.openShortsViewer = (id) => {
      const idx = this.shorts.findIndex(s => String(s.id) === String(id));
      if (idx >= 0 && window.scrollToShort) window.scrollToShort(idx);
    };
  }

  handleCat(cat, view) {
    if (view === 'profile')   { this.gotoProfile();  return; }
    if (view === 'settings')  { this.gotoSettings(); return; }
    if (!cat || cat === 'all') { this.gotoShorts();  return; }
    this.gotoGrid(cat);
  }

  // ──────────────────────────────────────────────────
  //  MODALS
  // ──────────────────────────────────────────────────
  openLiveModal(channelName, hostName, title) {
    const modal = document.getElementById('mediaModal');
    const body  = document.getElementById('mediaModalBody');
    if (!modal || !body) return;
    body.innerHTML = `
      <div class="p-6 text-center text-white">
        <div class="text-5xl text-primary mb-3"><i class="fa-solid fa-headset"></i></div>
        <h3 class="text-xl font-800 mb-1">${title || hostName + "'s Live"}</h3>
        <p class="text-slate-400 text-sm mb-4">Host: @${hostName || 'user'} • Live Broadcast</p>
        <div class="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4">
          <div class="text-emerald-400 font-700 text-sm mb-1">
            <i class="fa-solid fa-circle text-xs animate-pulse"></i> LIVE on App right now!
          </div>
          <p class="text-white/70 text-sm">Open the GlobiLive app to join, send 3D gifts &amp; chat in real-time.</p>
        </div>
        <a href="https://play.google.com/store/apps/details?id=com.gobilive.gobilive_app" target="_blank"
           class="flex items-center justify-center gap-2 bg-primary text-white px-6 py-3 rounded-full font-700 hover:opacity-90 w-full">
          <i class="fa-brands fa-google-play"></i> Join in GlobiLive App
        </a>
      </div>`;
    modal.classList.add('active');
  }

  openGameModal(type) {
    const modal = document.getElementById('mediaModal');
    const body  = document.getElementById('mediaModalBody');
    if (!modal || !body) return;

    const games = {
      teenpatti: {
        color: '#7C3AED', icon: 'fa-gamepad', title: 'Teen Patti Royale',
        body: `<div class="flex justify-center gap-4 mb-6">
          ${['♠ K','♥ A','♦ J'].map(c=>`<div class="bg-slate-800 border-2 border-violet-500 rounded-2xl p-4 text-2xl font-900 text-rose-400 min-w-[72px] text-center">${c}</div>`).join('')}
        </div>
        <button onclick="alert('You won 500 Diamonds 💎!')" class="bg-violet-600 text-white px-8 py-3 rounded-full font-800 hover:opacity-90">Deal &amp; Bet (100 💎)</button>`
      },
      plinko: {
        color: '#0284C7', icon: 'fa-circle-dot', title: 'Plinko Multiplier Drop',
        body: `<div class="flex justify-center gap-2 mb-6">
          ${['10x','2x','5x','0.5x','10x'].map(m=>`<div class="bg-sky-600 px-3 py-2 rounded-lg font-800 text-sm">${m}</div>`).join('')}
        </div>
        <button onclick="alert('You hit 5x! Won 500 Beans! 🎉')" class="bg-sky-600 text-white px-8 py-3 rounded-full font-800 hover:opacity-90">Drop Ball ⚽</button>`
      },
      wheel: {
        color: '#10B981', icon: 'fa-arrows-spin', title: 'Lucky Fortune Wheel',
        body: `<div class="text-7xl mb-4">🎡</div>
        <button onclick="alert('You won 1,000 Free Beans! 🎊')" class="bg-emerald-500 text-white px-8 py-3 rounded-full font-800 hover:opacity-90">Spin Wheel</button>`
      }
    };

    const g = games[type] || games.wheel;
    body.innerHTML = `
      <div class="p-6 text-center text-white bg-slate-900">
        <div class="text-5xl mb-3" style="color:${g.color}"><i class="fa-solid ${g.icon}"></i></div>
        <h3 class="text-xl font-800 mb-1">${g.title}</h3>
        <p class="text-slate-400 text-sm mb-4">Playable Mini-Game</p>
        ${g.body}
      </div>`;
    modal.classList.add('active');
  }

  renderUserPill() {
    const user = ApiService.getUserProfile();
    const nameEl   = document.getElementById('userPillName');
    const avatarEl = document.getElementById('userPillAvatar');
    if (nameEl)   nameEl.innerText = user.name || 'Alex Morgan';
    if (avatarEl && user.avatar) avatarEl.src = user.avatar;
  }
}

document.addEventListener('DOMContentLoaded', () => new GlobiLiveApp().init());
