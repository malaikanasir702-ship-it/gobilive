/**
 * GlobiLive Main Web App Core
 * Connects API Service & Components, handles events & state management.
 */

import { ApiService } from './api.js';
import { Components } from './components.js';

class GlobiLiveApp {
  constructor() {
    this.liveRooms = [];
    this.shorts = [];
    this.currentHeroIdx = 0;
  }

  async init() {
    console.log('Initializing GlobiLive Web App...');
    await this.loadData();
    this.setupEventListeners();
    this.renderUserPill();
  }

  async loadData() {
    this.liveRooms = await ApiService.getLiveRooms();
    this.shorts = await ApiService.getShorts();

    // Render Components
    const heroContainer = document.getElementById('heroSpotlight');
    if (heroContainer && this.liveRooms.length > 0) {
      Components.renderHeroSpotlight(heroContainer, this.liveRooms[this.currentHeroIdx]);
    }

    const gridContainer = document.getElementById('youMightLikeGrid');
    if (gridContainer && this.liveRooms.length > 0) {
      Components.renderYouMightLike(gridContainer, this.liveRooms);
    }

    const continueContainer = document.getElementById('continueWatchingList');
    if (continueContainer && this.shorts.length > 0) {
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
        this.filterCategory(cat);
      });
    });

    // Window media play helper
    window.playMedia = (id) => this.playMedia(id);
    window.nextHero = (direction) => this.nextHero(direction);
  }

  filterCategory(cat) {
    if (cat === 'shorts') {
      Components.renderYouMightLike(document.getElementById('youMightLikeGrid'), this.shorts.map(s => ({
        id: s.id,
        title: s.title,
        subtitle: s.subtitle,
        coverPic: s.thumb
      })));
    } else {
      Components.renderYouMightLike(document.getElementById('youMightLikeGrid'), this.liveRooms);
    }
  }

  handleSearch(query) {
    const q = query.toLowerCase().trim();
    if (!q) {
      Components.renderYouMightLike(document.getElementById('youMightLikeGrid'), this.liveRooms);
      return;
    }
    const filtered = this.liveRooms.filter(r => r.title.toLowerCase().includes(q) || r.hostName.toLowerCase().includes(q));
    Components.renderYouMightLike(document.getElementById('youMightLikeGrid'), filtered);
  }

  nextHero(dir) {
    if (this.liveRooms.length === 0) return;
    this.currentHeroIdx = (this.currentHeroIdx + dir + this.liveRooms.length) % this.liveRooms.length;
    Components.renderHeroSpotlight(document.getElementById('heroSpotlight'), this.liveRooms[this.currentHeroIdx]);
  }

  playMedia(id) {
    const modal = document.getElementById('mediaModal');
    if (modal) {
      modal.classList.add('active');
    }
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
