/**
 * GlobiLive API Client Module
 * Handles real-time backend API data fetching for live rooms, shorts, search, and user auth.
 */

const API_BASE = window.location.origin;

export const ApiService = {
  // Fetch active live streaming rooms
  async getLiveRooms() {
    try {
      const res = await fetch(`${API_BASE}/api/live/rooms`);
      if (!res.ok) throw new Error('Failed to fetch live rooms');
      const data = await res.json();
      return data.rooms || [];
    } catch (err) {
      console.warn('API Warning (getLiveRooms): Using dynamic fallback data', err);
      return [
        {
          id: 'room_1',
          title: 'AVATAR 3: FIRE AND ASH — GRAND PK BATTLE',
          hostName: 'Zainab Live',
          viewersCount: 14200,
          category: 'PK Battles',
          coverPic: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1200&auto=format&fit=crop',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop',
          desc: 'Avatar: Fire and Ash is an epic live streaming adventure that continues the journey of Jake Sully and Neytiri as they protect their family and Pandora from growing threats...'
        },
        {
          id: 'room_2',
          title: 'Money Heist — VIP Streamer Night',
          hostName: 'Alex Morgan',
          viewersCount: 8900,
          category: 'Shorts',
          coverPic: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop',
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop',
          desc: 'Join the highest stakes live streaming session with exclusive diamond gifts and instant rewards!'
        },
        {
          id: 'room_3',
          title: 'House of the Dragon — Multi-Seat Stream',
          hostName: 'Kashif King',
          viewersCount: 6400,
          category: 'Live Rooms',
          coverPic: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop',
          avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop',
          desc: 'Interactive 9-seat live broadcasting room with 3D audio effects and live chat!'
        },
        {
          id: 'room_4',
          title: 'Game of Thrones — Season Final PK',
          hostName: 'Zara Queen',
          viewersCount: 11200,
          category: 'PK Battles',
          coverPic: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop',
          avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop',
          desc: 'High multipliers comeback battle in the last 10 seconds!'
        }
      ];
    }
  },

  // Fetch shorts / video stories
  async getShorts() {
    try {
      const res = await fetch(`${API_BASE}/api/story`);
      if (!res.ok) throw new Error('Failed to fetch shorts');
      const data = await res.json();
      return data.stories || data.items || [];
    } catch (err) {
      console.warn('API Warning (getShorts): Using dynamic fallback data', err);
      return [
        {
          id: 'short_1',
          title: 'Stranger Things — EP 3',
          subtitle: 'Viral Reel • 240k Views',
          thumb: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&auto=format&fit=crop',
          videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-girl-in-neon-sign-1232-large.mp4'
        },
        {
          id: 'short_2',
          title: 'Stranger Things — EP 4',
          subtitle: 'Live Recap • 180k Views',
          thumb: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300&auto=format&fit=crop',
          videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-going-down-a-curved-highway-down-a-mountain-41576-large.mp4'
        },
        {
          id: 'short_3',
          title: 'Stranger Things — EP 5',
          subtitle: 'PK Highlight • 310k Views',
          thumb: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&auto=format&fit=crop',
          videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-waves-in-the-water-1164-large.mp4'
        }
      ];
    }
  },

  // Search users / streams
  async search(query) {
    try {
      const res = await fetch(`${API_BASE}/api/search/users?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error('Failed to search');
      const data = await res.json();
      return data.users || [];
    } catch (err) {
      console.warn('API Warning (search): Local query filtering', err);
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
