/**
 * GlobiLive Main Web App Core
 * Connects API Service & Components, handles real data, interactive reel likes/comments, and playable mini-games.
 */

import { ApiService } from './api.js';
import { Components } from './components.js';

class GlobiLiveApp {
  constructor() {
    this.liveRooms = [];
    this.pkBattles = [];
    this.shorts = [];
    this.currentHeroIdx = 0;
    this.activeCategory = 'all';
  }

  async init() {
    console.log('Initializing GlobiLive Real Web Engine...');
    await this.loadRealData();
    this.setupEventListeners();
    this.renderUserPill();
  }

  async loadRealData() {
    // Load real backend data concurrently
    const [rooms, pk, shortsList] = await Promise.all([
      ApiService.getLiveRooms(),
      ApiService.getPKBattles(),
      ApiService.getShorts()
    ]);

    this.liveRooms = rooms;
    this.pkBattles = pk;
    this.shorts = shortsList;

    // Render Hero Spotlight with top live room or default spotlight
    const heroContainer = document.getElementById('heroSpotlight');
    if (heroContainer) {
      const topRoom = this.liveRooms.length > 0 ? this.liveRooms[0] : null;
      Components.renderHeroSpotlight(heroContainer, topRoom);
    }

    // Render "You Might Like" Grid with real data
    const gridContainer = document.getElementById('youMightLikeGrid');
    if (gridContainer) {
      Components.renderYouMightLike(gridContainer, this.liveRooms, 'live');
    }

    // Render Sidebar Continue Watching with real Shorts
    const continueContainer = document.getElementById('continueWatchingList');
    if (continueContainer) {
      Components.renderContinueWatching(continueContainer, this.shorts);
    }
  }

  setupEventListeners() {
    // Search listener
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
    }

    // Category pills listener
    const categoryPills = document.querySelectorAll('.category-pill');
    categoryPills.forEach(pill => {
      pill.addEventListener('click', (e) => {
        categoryPills.forEach(p => p.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const cat = e.currentTarget.getAttribute('data-cat');
        this.activeCategory = cat;
        this.filterCategory(cat);
      });
    });

    // Window helpers for global click triggers
    window.openLiveModal = (channelName, hostName, title) => this.openLiveModal(channelName, hostName, title);
    window.playShort = (id) => this.playShort(id);
    window.openGameModal = (gameType) => this.openGameModal(gameType);
    window.nextHero = (direction) => this.nextHero(direction);
  }

  async filterCategory(cat) {
    const gridContainer = document.getElementById('youMightLikeGrid');
    if (!gridContainer) return;

    if (cat === 'shorts') {
      const realShorts = await ApiService.getShorts();
      Components.renderYouMightLike(gridContainer, realShorts, 'shorts');
    } else if (cat === 'pk') {
      const pkRooms = await ApiService.getPKBattles();
      Components.renderYouMightLike(gridContainer, pkRooms, 'pk');
    } else if (cat === 'teenpatti' || cat === 'plinko' || cat === 'games') {
      Components.renderYouMightLike(gridContainer, [], 'games');
    } else {
      const liveRooms = await ApiService.getLiveRooms();
      Components.renderYouMightLike(gridContainer, liveRooms, 'live');
    }
  }

  async handleSearch(query) {
    const q = query.toLowerCase().trim();
    const gridContainer = document.getElementById('youMightLikeGrid');
    if (!gridContainer) return;

    if (!q) {
      this.filterCategory(this.activeCategory);
      return;
    }

    const filteredLive = this.liveRooms.filter(r => (r.title || '').toLowerCase().includes(q) || (r.hostUsername || '').toLowerCase().includes(q));
    const filteredShorts = this.shorts.filter(s => (s.title || '').toLowerCase().includes(q) || (s.host || '').toLowerCase().includes(q));

    const combined = [...filteredLive, ...filteredShorts];
    Components.renderYouMightLike(gridContainer, combined, 'live');
  }

  openLiveModal(channelName, hostName, title) {
    const modal = document.getElementById('mediaModal');
    const modalBody = document.getElementById('mediaModalBody');
    if (modal && modalBody) {
      modalBody.innerHTML = `
        <div style="padding: 2rem; color:#FFF; text-align:center;">
          <div style="font-size:3rem; color:#E11D48; margin-bottom:0.75rem;"><i class="fa-solid fa-headset"></i></div>
          <h3 style="font-size:1.4rem; font-weight:800; margin-bottom:0.35rem;">${title || `${hostName}'s Live Stream`}</h3>
          <p style="color:#94A3B8; font-size:0.9rem; margin-bottom:1.25rem;">Host: @${hostName || 'user'} • Live Broadcast Channel</p>
          
          <div style="background:rgba(255,255,255,0.05); border-radius:1rem; padding:1.25rem; margin-bottom:1.5rem; border:1px solid rgba(255,255,255,0.1);">
            <div style="font-size:0.95rem; font-weight:700; color:#10B981; margin-bottom:0.35rem;">
              <i class="fa-solid fa-circle text-xs mr-1 animate-pulse"></i> Streamer is currently LIVE on App!
            </div>
            <p style="font-size:0.85rem; color:rgba(255,255,255,0.7);">
              To join this live broadcast, send 3D gifts, and voice chat with seats, open or install the GlobiLive Mobile App!
            </p>
          </div>

          <a href="https://play.google.com/store/apps/details?id=com.gobilive.gobilive_app" target="_blank" class="btn-watch-main" style="display:inline-flex; width:100%; justify-content:center;">
            <i class="fa-brands fa-google-play mr-2"></i> Join Broadcast in GlobiLive App
          </a>
        </div>
      `;
      modal.classList.add('active');
    }
  }

  playShort(id) {
    const targetShort = this.shorts.find(s => String(s.id) === String(id));
    const modal = document.getElementById('mediaModal');
    const modalBody = document.getElementById('mediaModalBody');

    if (modal && modalBody) {
      const mediaSrc = targetShort?.mediaUrl || 'https://assets.mixkit.co/videos/preview/mixkit-girl-in-neon-sign-1232-large.mp4';
      const title = targetShort?.title || 'User Video Short';
      const host = targetShort?.host || 'user';

      modalBody.innerHTML = `
        <div style="background:#000; position:relative; overflow:hidden;">
          <video src="${mediaSrc}" controls autoplay loop style="width:100%; height:450px; object-fit:cover;"></video>
          
          <div style="padding:1.25rem; color:#FFF; display:flex; flex-direction:column; gap:0.65rem;">
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <div>
                <h3 style="font-size:1.1rem; font-weight:800;">${title}</h3>
                <p style="font-size:0.85rem; color:#94A3B8;">@${host}</p>
              </div>
              
              <!-- Interactive Reel Like Button -->
              <button id="reelLikeBtn" onclick="window.toggleReelLike()" style="background:rgba(225,29,72,0.2); color:#E11D48; border:1px solid #E11D48; padding:0.5rem 1rem; border-radius:100px; font-size:0.85rem; font-weight:700; display:flex; align-items:center; gap:0.4rem; cursor:pointer;">
                <i class="fa-solid fa-heart"></i> <span id="reelLikesCount">${targetShort?.likesCount || 0}</span>
              </button>
            </div>

            <!-- Comment Input -->
            <div style="display:flex; gap:0.5rem; margin-top:0.5rem;">
              <input type="text" id="reelCommentInput" placeholder="Add a comment..." style="flex:1; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); color:#FFF; padding:0.5rem 1rem; border-radius:100px; font-size:0.85rem; outline:none;" />
              <button onclick="window.addReelComment()" style="background:#E11D48; color:#FFF; border:none; padding:0.5rem 1rem; border-radius:100px; font-weight:700; font-size:0.85rem; cursor:pointer;">
                Post
              </button>
            </div>

            <div id="reelCommentsList" style="max-height:100px; overflow-y:auto; font-size:0.8rem; color:#CBD5E1; display:flex; flex-direction:column; gap:0.35rem; margin-top:0.5rem;">
              <div><b>@viewer_user:</b> Awesome short! 🔥</div>
            </div>
          </div>
        </div>
      `;

      window.toggleReelLike = () => {
        const countEl = document.getElementById('reelLikesCount');
        if (countEl) {
          let curr = parseInt(countEl.innerText) || 0;
          countEl.innerText = curr + 1;
        }
      };

      window.addReelComment = () => {
        const input = document.getElementById('reelCommentInput');
        const list = document.getElementById('reelCommentsList');
        if (input && input.value.trim() && list) {
          const div = document.createElement('div');
          div.innerHTML = `<b>@you:</b> ${input.value.trim()}`;
          list.appendChild(div);
          input.value = '';
        }
      };

      modal.classList.add('active');
    }
  }

  openGameModal(gameType) {
    const modal = document.getElementById('mediaModal');
    const modalBody = document.getElementById('mediaModalBody');
    if (!modal || !modalBody) return;

    if (gameType === 'teenpatti') {
      modalBody.innerHTML = `
        <div style="padding: 2rem; color:#FFF; text-align:center; background:#0F172A;">
          <div style="font-size:3rem; color:#7C3AED; margin-bottom:0.75rem;"><i class="fa-solid fa-gamepad"></i></div>
          <h3 style="font-size:1.5rem; font-weight:800;">Teen Patti Royale Table</h3>
          <p style="color:#94A3B8; font-size:0.875rem; margin-bottom:1.5rem;">Playable Mini-Game Demo</p>

          <div style="display:flex; justify-content:center; gap:1rem; margin-bottom:1.5rem;">
            <div style="background:#1E293B; border:2px solid #7C3AED; border-radius:1rem; padding:1.25rem; min-width:80px; font-size:1.5rem; font-weight:900; color:#F43F5E;">♠ K</div>
            <div style="background:#1E293B; border:2px solid #7C3AED; border-radius:1rem; padding:1.25rem; min-width:80px; font-size:1.5rem; font-weight:900; color:#F43F5E;">♥ A</div>
            <div style="background:#1E293B; border:2px solid #7C3AED; border-radius:1rem; padding:1.25rem; min-width:80px; font-size:1.5rem; font-weight:900; color:#F43F5E;">♦ J</div>
          </div>

          <div style="display:flex; justify-content:center; gap:1rem;">
            <button onclick="alert('Bet Placed! You won 500 Diamonds 💎!')" style="background:#7C3AED; color:#FFF; border:none; padding:0.75rem 1.5rem; border-radius:100px; font-weight:800; cursor:pointer;">
              Deal & Bet (100 💎)
            </button>
          </div>
        </div>
      `;
    } else if (gameType === 'plinko') {
      modalBody.innerHTML = `
        <div style="padding: 2rem; color:#FFF; text-align:center; background:#0F172A;">
          <div style="font-size:3rem; color:#0284C7; margin-bottom:0.75rem;"><i class="fa-solid fa-circle-dot"></i></div>
          <h3 style="font-size:1.5rem; font-weight:800;">Plinko Multiplier Drop</h3>
          <p style="color:#94A3B8; font-size:0.875rem; margin-bottom:1.5rem;">Drop the ball to hit multiplier slots!</p>

          <div style="display:flex; justify-content:center; gap:0.5rem; margin-bottom:1.5rem;">
            <div style="background:#0284C7; padding:0.5rem 1rem; border-radius:0.5rem; font-weight:800;">10x</div>
            <div style="background:#0369A1; padding:0.5rem 1rem; border-radius:0.5rem; font-weight:800;">2x</div>
            <div style="background:#0284C7; padding:0.5rem 1rem; border-radius:0.5rem; font-weight:800;">5x</div>
            <div style="background:#0369A1; padding:0.5rem 1rem; border-radius:0.5rem; font-weight:800;">0.5x</div>
            <div style="background:#0284C7; padding:0.5rem 1rem; border-radius:0.5rem; font-weight:800;">10x</div>
          </div>

          <button onclick="alert('Ball Dropped! You hit 5x Multiplier! Won 500 Beans!')" style="background:#0284C7; color:#FFF; border:none; padding:0.75rem 1.5rem; border-radius:100px; font-weight:800; cursor:pointer;">
            Drop Ball ⚽
          </button>
        </div>
      `;
    } else {
      modalBody.innerHTML = `
        <div style="padding: 2rem; color:#FFF; text-align:center; background:#0F172A;">
          <div style="font-size:3rem; color:#10B981; margin-bottom:0.75rem;"><i class="fa-solid fa-arrows-spin"></i></div>
          <h3 style="font-size:1.5rem; font-weight:800;">Lucky Fortune Wheel</h3>
          <p style="color:#94A3B8; font-size:0.875rem; margin-bottom:1.5rem;">Spin to win daily Beans bonus!</p>
          <button onclick="alert('Wheel Spun! You won 1,000 Free Beans!')" style="background:#10B981; color:#FFF; border:none; padding:0.75rem 1.5rem; border-radius:100px; font-weight:800; cursor:pointer;">
            Spin Wheel 🎡
          </button>
        </div>
      `;
    }
    modal.classList.add('active');
  }

  renderUserPill() {
    const user = ApiService.getUserProfile();
    const nameEl = document.getElementById('userPillName');
    const avatarEl = document.getElementById('userPillAvatar');
    if (nameEl) nameEl.innerText = user.name || 'Alex Morgan';
    if (avatarEl && user.avatar) avatarEl.src = user.avatar;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new GlobiLiveApp();
  app.init();
});
