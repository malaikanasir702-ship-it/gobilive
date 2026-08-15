/**
 * GlobiLive UI Components Renderer
 * Renders pixel-perfect components matching reference design mockup.
 */

export const Components = {
  // Render Left Sidebar "Continue watching" list
  renderContinueWatching(container, items) {
    if (!container) return;
    container.innerHTML = items.map(item => `
      <div class="continue-item" data-id="${item.id}" onclick="window.playMedia('${item.id}')">
        <img src="${item.thumb}" class="continue-thumb" alt="${item.title}" />
        <div class="continue-info">
          <div class="continue-title">${item.title}</div>
          <div class="continue-sub">${item.subtitle || 'EP 3'}</div>
        </div>
        <button class="continue-play-btn" title="Play">
          <i class="fa-solid fa-play"></i>
        </button>
      </div>
    `).join('');
  },

  // Render Hero Spotlight Card
  renderHeroSpotlight(container, item) {
    if (!container || !item) return;
    container.innerHTML = `
      <img src="${item.coverPic}" class="hero-bg-image" alt="${item.title}" />
      <div class="hero-gradient-overlay"></div>
      
      <div class="hero-inner-content">
        <div class="trending-badge-pill">
          <i class="fa-solid fa-fire text-red-500"></i> Trending Now
        </div>

        <h1 class="hero-main-title">${item.title}</h1>

        <div class="hero-meta-row">
          <span>2026</span> • <span>${item.viewersCount ? (item.viewersCount.toLocaleString() + ' Viewers') : '3 hrs'}</span> • <span>IMDB 8.2 /10</span>
        </div>

        <p class="hero-description-text">
          ${item.desc || 'Avatar: Fire and Ash is an epic live streaming adventure that continues the journey of Jake Sully and Neytiri as they protect their family and Pandora from growing threats...'}
        </p>

        <div class="hero-buttons-row">
          <button class="btn-watch-main" onclick="window.playMedia('${item.id}')">
            <i class="fa-solid fa-play"></i> Watch
          </button>
          <a href="https://play.google.com/store/apps/details?id=com.gobilive.gobilive_app" target="_blank" class="btn-download-main">
            <i class="fa-solid fa-download"></i> Download
          </a>
          <button class="btn-circle-action" title="More Options">
            <i class="fa-solid fa-bars"></i>
          </button>
        </div>
      </div>

      <!-- Right Navigation Arrows -->
      <div class="hero-nav-arrows">
        <button class="hero-arrow-btn" onclick="window.nextHero(-1)"><i class="fa-solid fa-chevron-up"></i></button>
        <button class="hero-arrow-btn" onclick="window.nextHero(1)"><i class="fa-solid fa-chevron-down"></i></button>
      </div>
    `;
  },

  // Render "You Might Like" Cards Grid (Matching 3-card layout of reference mockup)
  renderYouMightLike(container, items) {
    if (!container) return;
    container.innerHTML = items.slice(0, 3).map(item => `
      <div class="card-item" onclick="window.playMedia('${item.id}')">
        <div class="card-thumb-container">
          <img src="${item.coverPic}" class="card-thumb-img" alt="${item.title}" />
          <div class="card-gradient-overlay"></div>
          
          <div class="card-bottom-content">
            <div class="card-text-block">
              <div class="card-title">${item.title}</div>
              <div class="card-meta">${item.subtitle || (item.viewersCount ? item.viewersCount + ' Viewers' : '2022 Drama 3 Season')}</div>
            </div>
            
            <button class="card-red-play-btn">
              <i class="fa-solid fa-play"></i>
            </button>
          </div>
        </div>
      </div>
    `).join('');
  }
};
