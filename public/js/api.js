/**
 * GlobiLive Real API Client Module
 * Connects directly to backend DB REST endpoints for real User Feed Shorts, Live Streams, and PK Battles.
 */

const API_BASE = window.location.origin;

export const ApiService = {
  // Fetch real active live streams from DB
  async getLiveRooms(category = '') {
    try {
      const url = `${API_BASE}/api/live/public/rooms${category ? `?category=${encodeURIComponent(category)}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch live rooms');
      const data = await res.json();
      return data.rooms || [];
    } catch (err) {
      console.warn('API Error (getLiveRooms):', err);
      return [];
    }
  },

  // Fetch real active PK Battles from DB
  async getPKBattles() {
    try {
      const res = await fetch(`${API_BASE}/api/live/public/rooms?pk=true`);
      if (!res.ok) throw new Error('Failed to fetch PK battles');
      const data = await res.json();
      return data.rooms || [];
    } catch (err) {
      console.warn('API Error (getPKBattles):', err);
      return [];
    }
  },

  // Fetch real uploaded user Shorts/Reels from App Feed (/api/feed/public)
  async getShorts() {
    try {
      // First try Feed Posts uploaded by app users
      const res = await fetch(`${API_BASE}/api/feed/public`);
      if (res.ok) {
        const data = await res.json();
        if (data.posts && data.posts.length > 0) {
          return data.posts.map(p => ({
            id: p._id || p.id,
            title: p.caption || `Short by @${p.username || 'user'}`,
            host: p.username || 'user',
            avatar: p.userProfilePic || '',
            mediaUrl: p.videoUrl || (p.imageUrls && p.imageUrls[0]) || '',
            mediaType: p.postType || 'video',
            likesCount: p.likesCount || 0,
            commentsCount: p.commentsCount || 0,
            sharesCount: p.sharesCount || 0,
            createdAt: p.createdAt
          }));
        }
      }

      // Fallback to story endpoint if feed has no posts yet
      const storyRes = await fetch(`${API_BASE}/api/story/public`);
      if (storyRes.ok) {
        const storyData = await storyRes.json();
        return (storyData.stories || []).map(s => ({
          id: s._id,
          title: s.title || `Short by @${s.username || 'user'}`,
          host: s.username || 'user',
          avatar: s.userProfilePic || '',
          mediaUrl: s.mediaUrl,
          mediaType: s.mediaType || 'video',
          likesCount: s.viewedByUsers?.length || 0,
          createdAt: s.createdAt
        }));
      }

      return [];
    } catch (err) {
      console.warn('API Error (getShorts):', err);
      return [];
    }
  },

  // Search API
  async search(query) {
    try {
      const res = await fetch(`${API_BASE}/api/search/users?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error('Failed to search');
      const data = await res.json();
      return data.users || [];
    } catch (err) {
      console.warn('API Error (search):', err);
      return [];
    }
  },

  // User Profile
  getUserProfile() {
    const saved = localStorage.getItem('admin_user') || localStorage.getItem('user_profile');
    if (saved) {
      try { return JSON.parse(saved); } catch (_) {}
    }
    return { name: 'Alex Morgan', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop' };
  }
};
