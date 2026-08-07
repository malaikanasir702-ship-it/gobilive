import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import mongoose from 'mongoose';
import { Gift } from '../features/gifts/gift.model';

export const TIKTOK_GIFTS_SEED = [
  { id: 'local_rose', name: 'Rose', emoji: '🌹', diamondCost: 1, rcoinEarned: 0, sortOrder: 1 },
  { id: 'local_lollipop', name: 'Lollipop', emoji: '🍭', diamondCost: 1, rcoinEarned: 0, sortOrder: 2 },
  { id: 'local_finger_heart', name: 'Finger Heart', emoji: '🫰', diamondCost: 5, rcoinEarned: 2, sortOrder: 3 },
  { id: 'local_sunglasses', name: 'Sunglasses', emoji: '🕶️', diamondCost: 5, rcoinEarned: 2, sortOrder: 4 },
  { id: 'local_galaxy', name: 'Galaxy', emoji: '🌌', diamondCost: 10, rcoinEarned: 5, sortOrder: 5 },
  { id: 'local_perfume', name: 'Perfume', emoji: '🧴', diamondCost: 10, rcoinEarned: 5, sortOrder: 6 },
  { id: 'local_crown', name: 'Crown', emoji: '👑', diamondCost: 20, rcoinEarned: 10, sortOrder: 7 },
  { id: 'local_butterfly', name: 'Butterfly', emoji: '🦋', diamondCost: 20, rcoinEarned: 10, sortOrder: 8 },
  { id: 'local_diamond', name: 'Diamond', emoji: '💎', diamondCost: 50, rcoinEarned: 25, sortOrder: 9 },
  { id: 'local_cake', name: 'Cake', emoji: '🎂', diamondCost: 50, rcoinEarned: 25, sortOrder: 10 },
  { id: 'local_rocket', name: 'Rocket', emoji: '🚀', diamondCost: 100, rcoinEarned: 50, sortOrder: 11 },
  { id: 'local_guitar', name: 'Guitar', emoji: '🎸', diamondCost: 100, rcoinEarned: 50, sortOrder: 12 },
  { id: 'local_ice_cream', name: 'Ice Cream', emoji: '🍦', diamondCost: 1, rcoinEarned: 0, sortOrder: 13 },
  { id: 'local_teddy_bear', name: 'Teddy Bear', emoji: '🧸', diamondCost: 5, rcoinEarned: 2, sortOrder: 14 },
  { id: 'local_love_letter', name: 'Love Letter', emoji: '💌', diamondCost: 5, rcoinEarned: 2, sortOrder: 15 },
  { id: 'local_mic', name: 'Mic', emoji: '🎤', diamondCost: 10, rcoinEarned: 5, sortOrder: 16 },
  { id: 'local_stars', name: 'Stars', emoji: '✨', diamondCost: 10, rcoinEarned: 5, sortOrder: 17 },
  { id: 'local_trophy', name: 'Trophy', emoji: '🏆', diamondCost: 20, rcoinEarned: 10, sortOrder: 18 },
  { id: 'local_fire', name: 'Fire', emoji: '🔥', diamondCost: 20, rcoinEarned: 10, sortOrder: 19 },
  { id: 'local_lion', name: 'Lion', emoji: '🦁', diamondCost: 50, rcoinEarned: 25, sortOrder: 20 },
  { id: 'local_sports_car', name: 'Sports Car', emoji: '🏎️', diamondCost: 50, rcoinEarned: 25, sortOrder: 21 },
  { id: 'local_fireworks', name: 'Fireworks', emoji: '🎆', diamondCost: 100, rcoinEarned: 50, sortOrder: 22 },
  { id: 'local_yacht', name: 'Yacht', emoji: '🛥️', diamondCost: 200, rcoinEarned: 100, sortOrder: 23 },
  { id: 'local_castle', name: 'Castle', emoji: '🏰', diamondCost: 200, rcoinEarned: 100, sortOrder: 24 },
  { id: 'local_universe', name: 'Universe', emoji: '🪐', diamondCost: 500, rcoinEarned: 250, sortOrder: 25 },
  { id: 'local_rainbow', name: 'Rainbow', emoji: '🌈', diamondCost: 1, rcoinEarned: 0, sortOrder: 26 },
  { id: 'local_balloon', name: 'Balloon', emoji: '🎈', diamondCost: 1, rcoinEarned: 0, sortOrder: 27 },
  { id: 'local_candy', name: 'Candy', emoji: '🍬', diamondCost: 1, rcoinEarned: 0, sortOrder: 28 },
  { id: 'local_flower_bouquet', name: 'Flower Bouquet', emoji: '💐', diamondCost: 5, rcoinEarned: 2, sortOrder: 29 },
  { id: 'local_piano', name: 'Piano', emoji: '🎹', diamondCost: 5, rcoinEarned: 2, sortOrder: 30 },
  { id: 'local_heart_locket', name: 'Heart Locket', emoji: '💖', diamondCost: 10, rcoinEarned: 5, sortOrder: 31 },
  { id: 'local_ring', name: 'Ring', emoji: '💍', diamondCost: 20, rcoinEarned: 10, sortOrder: 32 },
  { id: 'local_luxury_bag', name: 'Luxury Bag', emoji: '👜', diamondCost: 50, rcoinEarned: 25, sortOrder: 33 },
  { id: 'local_jet_plane', name: 'Jet Plane', emoji: '✈️', diamondCost: 100, rcoinEarned: 50, sortOrder: 34 },
  { id: 'local_palace', name: 'Palace', emoji: '🏯', diamondCost: 200, rcoinEarned: 100, sortOrder: 35 },
  { id: 'local_power', name: 'Power', emoji: '⚡', diamondCost: 500, rcoinEarned: 250, sortOrder: 36 },
  { id: 'local_gem', name: 'Gem', emoji: '💎', diamondCost: 1, rcoinEarned: 0, sortOrder: 37 },
  { id: 'local_sunflower', name: 'Sunflower', emoji: '🌻', diamondCost: 1, rcoinEarned: 0, sortOrder: 38 },
  { id: 'local_moon', name: 'Moon', emoji: '🌙', diamondCost: 5, rcoinEarned: 2, sortOrder: 39 },
  { id: 'local_superhero', name: 'Superhero', emoji: '🦸', diamondCost: 10, rcoinEarned: 5, sortOrder: 40 },
  { id: 'local_medal', name: 'Medal', emoji: '🥇', diamondCost: 10, rcoinEarned: 5, sortOrder: 41 },
  { id: 'local_lightning', name: 'Lightning', emoji: '🌩️', diamondCost: 20, rcoinEarned: 10, sortOrder: 42 },
  { id: 'local_dragon', name: 'Dragon', emoji: '🐉', diamondCost: 50, rcoinEarned: 25, sortOrder: 43 },
  { id: 'local_angel', name: 'Angel', emoji: '👼', diamondCost: 100, rcoinEarned: 50, sortOrder: 44 },
  { id: 'local_king', name: 'King', emoji: '🤴', diamondCost: 200, rcoinEarned: 100, sortOrder: 45 },
  { id: 'local_space', name: 'Space', emoji: '🌌', diamondCost: 500, rcoinEarned: 250, sortOrder: 46 },
  { id: 'local_shooting_star', name: 'Shooting Star', emoji: '🌠', diamondCost: 1, rcoinEarned: 0, sortOrder: 47 },
  { id: 'local_penguin', name: 'Penguin', emoji: '🐧', diamondCost: 1, rcoinEarned: 0, sortOrder: 48 },
  { id: 'local_doughnut', name: 'Doughnut', emoji: '🍩', diamondCost: 5, rcoinEarned: 2, sortOrder: 49 },
  { id: 'local_compass', name: 'Compass', emoji: '🧭', diamondCost: 5, rcoinEarned: 2, sortOrder: 50 },
  { id: 'local_cherry', name: 'Cherry', emoji: '🍒', diamondCost: 1, rcoinEarned: 0, sortOrder: 51 },
  { id: 'local_strawberry', name: 'Strawberry', emoji: '🍓', diamondCost: 1, rcoinEarned: 0, sortOrder: 52 },
  { id: 'local_watermelon', name: 'Watermelon', emoji: '🍉', diamondCost: 5, rcoinEarned: 2, sortOrder: 53 },
  { id: 'local_coconut', name: 'Coconut', emoji: '🥥', diamondCost: 5, rcoinEarned: 2, sortOrder: 54 },
  { id: 'local_mushroom', name: 'Mushroom', emoji: '🍄', diamondCost: 10, rcoinEarned: 5, sortOrder: 55 },
  { id: 'local_whale', name: 'Whale', emoji: '🐳', diamondCost: 20, rcoinEarned: 10, sortOrder: 56 },
  { id: 'local_owl', name: 'Owl', emoji: '🦉', diamondCost: 20, rcoinEarned: 10, sortOrder: 57 },
  { id: 'local_wolf', name: 'Wolf', emoji: '🐺', diamondCost: 50, rcoinEarned: 25, sortOrder: 58 },
  { id: 'local_tiger', name: 'Tiger', emoji: '🐅', diamondCost: 100, rcoinEarned: 50, sortOrder: 59 },
  { id: 'local_phoenix', name: 'Phoenix', emoji: '🐦‍🔥', diamondCost: 200, rcoinEarned: 100, sortOrder: 60 },
  { id: 'local_sword', name: 'Sword', emoji: '⚔️', diamondCost: 10, rcoinEarned: 5, sortOrder: 61 },
  { id: 'local_shield', name: 'Shield', emoji: '🛡️', diamondCost: 10, rcoinEarned: 5, sortOrder: 62 },
  { id: 'local_crystal_ball', name: 'Crystal Ball', emoji: '🔮', diamondCost: 20, rcoinEarned: 10, sortOrder: 63 },
  { id: 'local_magic_lamp', name: 'Magic Lamp', emoji: '🪔', diamondCost: 50, rcoinEarned: 25, sortOrder: 64 },
  { id: 'local_treasure_chest', name: 'Treasure Chest', emoji: '🏴‍☠️', diamondCost: 100, rcoinEarned: 50, sortOrder: 65 },
  { id: 'local_spaceship', name: 'Spaceship', emoji: '🛸', diamondCost: 200, rcoinEarned: 100, sortOrder: 66 },
  { id: 'local_golden_egg', name: 'Golden Egg', emoji: '🥚', diamondCost: 500, rcoinEarned: 250, sortOrder: 67 },
  { id: 'local_kite', name: 'Kite', emoji: '🪁', diamondCost: 1, rcoinEarned: 0, sortOrder: 68 },
  { id: 'local_pinwheel', name: 'Pinwheel', emoji: '🪅', diamondCost: 1, rcoinEarned: 0, sortOrder: 69 },
  { id: 'local_lantern', name: 'Lantern', emoji: '🏮', diamondCost: 5, rcoinEarned: 2, sortOrder: 70 },
  { id: 'local_teapot', name: 'Teapot', emoji: '🫖', diamondCost: 5, rcoinEarned: 2, sortOrder: 71 },
  { id: 'local_bonsai', name: 'Bonsai', emoji: '🪴', diamondCost: 10, rcoinEarned: 5, sortOrder: 72 },
  { id: 'local_origami', name: 'Origami', emoji: '🕊️', diamondCost: 10, rcoinEarned: 5, sortOrder: 73 },
  { id: 'local_sakura', name: 'Sakura', emoji: '🌸', diamondCost: 20, rcoinEarned: 10, sortOrder: 74 },
  { id: 'local_panda', name: 'Panda', emoji: '🐼', diamondCost: 50, rcoinEarned: 25, sortOrder: 75 },
  { id: 'local_ninja', name: 'Ninja', emoji: '🥷', diamondCost: 100, rcoinEarned: 50, sortOrder: 76 },
  { id: 'local_samurai', name: 'Samurai', emoji: '⚔️', diamondCost: 200, rcoinEarned: 100, sortOrder: 77 },
  { id: 'local_koi_fish', name: 'Koi Fish', emoji: '🐟', diamondCost: 50, rcoinEarned: 25, sortOrder: 78 },
  { id: 'local_bow_tie', name: 'Bow Tie', emoji: '🎀', diamondCost: 5, rcoinEarned: 2, sortOrder: 79 },
  { id: 'local_top_hat', name: 'Top Hat', emoji: '🎩', diamondCost: 10, rcoinEarned: 5, sortOrder: 80 },
  { id: 'local_boxing_glove', name: 'Boxing Glove', emoji: '🥊', diamondCost: 10, rcoinEarned: 5, sortOrder: 81 },
  { id: 'local_basketball', name: 'Basketball', emoji: '🏀', diamondCost: 5, rcoinEarned: 2, sortOrder: 82 },
  { id: 'local_soccer_ball', name: 'Soccer Ball', emoji: '⚽', diamondCost: 5, rcoinEarned: 2, sortOrder: 83 },
  { id: 'local_tennis', name: 'Tennis', emoji: '🎾', diamondCost: 10, rcoinEarned: 5, sortOrder: 84 },
  { id: 'local_baseball', name: 'Baseball', emoji: '⚾', diamondCost: 10, rcoinEarned: 5, sortOrder: 85 },
  { id: 'local_bowling', name: 'Bowling', emoji: '🎳', diamondCost: 20, rcoinEarned: 10, sortOrder: 86 },
  { id: 'local_racing_flag', name: 'Racing Flag', emoji: '🏁', diamondCost: 50, rcoinEarned: 25, sortOrder: 87 },
  { id: 'local_bicycle', name: 'Bicycle', emoji: '🚲', diamondCost: 20, rcoinEarned: 10, sortOrder: 88 },
  { id: 'local_motorcycle', name: 'Motorcycle', emoji: '🏍️', diamondCost: 50, rcoinEarned: 25, sortOrder: 89 },
  { id: 'local_camera', name: 'Camera', emoji: '📷', diamondCost: 10, rcoinEarned: 5, sortOrder: 90 },
  { id: 'local_microwave', name: 'Microwave', emoji: '📻', diamondCost: 5, rcoinEarned: 2, sortOrder: 91 },
  { id: 'local_gaming_controller', name: 'Gaming Controller', emoji: '🎮', diamondCost: 20, rcoinEarned: 10, sortOrder: 92 },
  { id: 'local_headphones', name: 'Headphones', emoji: '🎧', diamondCost: 20, rcoinEarned: 10, sortOrder: 93 },
  { id: 'local_vinyl_record', name: 'Vinyl Record', emoji: '📻', diamondCost: 10, rcoinEarned: 5, sortOrder: 94 },
  { id: 'local_electric_guitar', name: 'Electric Guitar', emoji: '🎸', diamondCost: 50, rcoinEarned: 25, sortOrder: 95 },
  { id: 'local_drum_kit', name: 'Drum Kit', emoji: '🥁', diamondCost: 100, rcoinEarned: 50, sortOrder: 96 },
  { id: 'local_violin', name: 'Violin', emoji: '🎻', diamondCost: 50, rcoinEarned: 25, sortOrder: 97 },
  { id: 'local_harp', name: 'Harp', emoji: '🎼', diamondCost: 100, rcoinEarned: 50, sortOrder: 98 },
  { id: 'local_potion', name: 'Potion', emoji: '🧪', diamondCost: 20, rcoinEarned: 10, sortOrder: 99 },
  { id: 'local_spell_book', name: 'Spell Book', emoji: '📖', diamondCost: 50, rcoinEarned: 25, sortOrder: 100 },
  { id: 'local_wand', name: 'Wand', emoji: '🪄', diamondCost: 100, rcoinEarned: 50, sortOrder: 101 },
  { id: 'local_portal', name: 'Portal', emoji: '🌀', diamondCost: 200, rcoinEarned: 100, sortOrder: 102 },
  { id: 'local_time_machine', name: 'Time Machine', emoji: '⏳', diamondCost: 500, rcoinEarned: 250, sortOrder: 103 },
  { id: 'local_black_hole', name: 'Black Hole', emoji: '🕳️', diamondCost: 1000, rcoinEarned: 500, sortOrder: 104 },
  { id: 'local_universe_egg', name: 'Universe Egg', emoji: '🪐', diamondCost: 1000, rcoinEarned: 500, sortOrder: 105 },
];

async function main() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGO_URI not found in .env');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('✅  Connected to MongoDB');

  for (const giftData of TIKTOK_GIFTS_SEED) {
    await Gift.updateOne(
      { id: giftData.id },
      {
        $set: {
          ...giftData,
          isVipOnly: false,
          animation: 'float',
          giftType: 'emoji',
          isActive: true,
        },
      },
      { upsert: true }
    );
  }

  const count = await Gift.countDocuments();
  console.log(`✅  Seeded ${TIKTOK_GIFTS_SEED.length} TikTok gifts. Total catalog count: ${count}`);
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
