export interface AvatarStyle {
  id: string;
  label: string;
}

export interface AvatarPreset {
  id: string;
  style: string;
  name: string;
  label: string;
  group: string;
}

export const AVATAR_STYLES: AvatarStyle[] = [
  { id: "all", label: "Semua" },
  { id: "pixelbot", label: "Pixelbot" },
  { id: "gaze", label: "Gaze" },
  { id: "moods", label: "Moods" },
  { id: "thumbs", label: "Thumbs" },
  { id: "initial-face", label: "Face" },
  { id: "sprouts", label: "Sprouts" },
  { id: "clay", label: "Clay" },
  { id: "voxel-bot", label: "Voxel Bot" },
  { id: "voxel-art", label: "Voxel Art" },
  { id: "critters", label: "Critters" },
];

export const AVATAR_PRESETS: AvatarPreset[] = [
  // Pixelbot (10 variasi)
  { id: "pixelbot:Alpha", style: "pixelbot", name: "Alpha", label: "Pixelbot Alpha", group: "pixelbot" },
  { id: "pixelbot:Spark", style: "pixelbot", name: "Spark", label: "Pixelbot Spark", group: "pixelbot" },
  { id: "pixelbot:Neon", style: "pixelbot", name: "Neon", label: "Pixelbot Neon", group: "pixelbot" },
  { id: "pixelbot:Cyber", style: "pixelbot", name: "Cyber", label: "Pixelbot Cyber", group: "pixelbot" },
  { id: "pixelbot:Gizmo", style: "pixelbot", name: "Gizmo", label: "Pixelbot Gizmo", group: "pixelbot" },
  { id: "pixelbot:Rusty", style: "pixelbot", name: "Rusty", label: "Pixelbot Rusty", group: "pixelbot" },
  { id: "pixelbot:Titan", style: "pixelbot", name: "Titan", label: "Pixelbot Titan", group: "pixelbot" },
  { id: "pixelbot:Volt", style: "pixelbot", name: "Volt", label: "Pixelbot Volt", group: "pixelbot" },
  { id: "pixelbot:Pixel", style: "pixelbot", name: "Pixel", label: "Pixelbot Pixel", group: "pixelbot" },
  { id: "pixelbot:Echo", style: "pixelbot", name: "Echo", label: "Pixelbot Echo", group: "pixelbot" },

  // Gaze (10 variasi)
  { id: "gaze:Felix", style: "gaze", name: "Felix", label: "Gaze Felix", group: "gaze" },
  { id: "gaze:Luna", style: "gaze", name: "Luna", label: "Gaze Luna", group: "gaze" },
  { id: "gaze:Mystic", style: "gaze", name: "Mystic", label: "Gaze Mystic", group: "gaze" },
  { id: "gaze:Zeno", style: "gaze", name: "Zeno", label: "Gaze Zeno", group: "gaze" },
  { id: "gaze:Shadow", style: "gaze", name: "Shadow", label: "Gaze Shadow", group: "gaze" },
  { id: "gaze:Sol", style: "gaze", name: "Sol", label: "Gaze Sol", group: "gaze" },
  { id: "gaze:Nova", style: "gaze", name: "Nova", label: "Gaze Nova", group: "gaze" },
  { id: "gaze:Iris", style: "gaze", name: "Iris", label: "Gaze Iris", group: "gaze" },
  { id: "gaze:Comet", style: "gaze", name: "Comet", label: "Gaze Comet", group: "gaze" },
  { id: "gaze:Orion", style: "gaze", name: "Orion", label: "Gaze Orion", group: "gaze" },

  // Moods (10 variasi)
  { id: "moods:Happy", style: "moods", name: "Happy", label: "Moods Happy", group: "moods" },
  { id: "moods:Cool", style: "moods", name: "Cool", label: "Moods Cool", group: "moods" },
  { id: "moods:Silly", style: "moods", name: "Silly", label: "Moods Silly", group: "moods" },
  { id: "moods:Excited", style: "moods", name: "Excited", label: "Moods Excited", group: "moods" },
  { id: "moods:Love", style: "moods", name: "Love", label: "Moods Love", group: "moods" },
  { id: "moods:Wink", style: "moods", name: "Wink", label: "Moods Wink", group: "moods" },
  { id: "moods:Laugh", style: "moods", name: "Laugh", label: "Moods Laugh", group: "moods" },
  { id: "moods:Surprise", style: "moods", name: "Surprise", label: "Moods Surprise", group: "moods" },
  { id: "moods:Calm", style: "moods", name: "Calm", label: "Moods Calm", group: "moods" },
  { id: "moods:Chill", style: "moods", name: "Chill", label: "Moods Chill", group: "moods" },

  // Thumbs (10 variasi)
  { id: "thumbs:Champ", style: "thumbs", name: "Champ", label: "Thumbs Champ", group: "thumbs" },
  { id: "thumbs:Winner", style: "thumbs", name: "Winner", label: "Thumbs Winner", group: "thumbs" },
  { id: "thumbs:Super", style: "thumbs", name: "Super", label: "Thumbs Super", group: "thumbs" },
  { id: "thumbs:Star", style: "thumbs", name: "Star", label: "Thumbs Star", group: "thumbs" },
  { id: "thumbs:Lucky", style: "thumbs", name: "Lucky", label: "Thumbs Lucky", group: "thumbs" },
  { id: "thumbs:Victory", style: "thumbs", name: "Victory", label: "Thumbs Victory", group: "thumbs" },
  { id: "thumbs:Bravo", style: "thumbs", name: "Bravo", label: "Thumbs Bravo", group: "thumbs" },
  { id: "thumbs:Top", style: "thumbs", name: "Top", label: "Thumbs Top", group: "thumbs" },
  { id: "thumbs:Hero", style: "thumbs", name: "Hero", label: "Thumbs Hero", group: "thumbs" },
  { id: "thumbs:Power", style: "thumbs", name: "Power", label: "Thumbs Power", group: "thumbs" },

  // Initial Face (10 variasi)
  { id: "initial-face:Smile", style: "initial-face", name: "Smile", label: "Face Smile", group: "initial-face" },
  { id: "initial-face:Jolly", style: "initial-face", name: "Jolly", label: "Face Jolly", group: "initial-face" },
  { id: "initial-face:Joy", style: "initial-face", name: "Joy", label: "Face Joy", group: "initial-face" },
  { id: "initial-face:Sunny", style: "initial-face", name: "Sunny", label: "Face Sunny", group: "initial-face" },
  { id: "initial-face:Bliss", style: "initial-face", name: "Bliss", label: "Face Bliss", group: "initial-face" },
  { id: "initial-face:Cheerful", style: "initial-face", name: "Cheerful", label: "Face Cheerful", group: "initial-face" },
  { id: "initial-face:Beam", style: "initial-face", name: "Beam", label: "Face Beam", group: "initial-face" },
  { id: "initial-face:Lively", style: "initial-face", name: "Lively", label: "Face Lively", group: "initial-face" },
  { id: "initial-face:Glow", style: "initial-face", name: "Glow", label: "Face Glow", group: "initial-face" },
  { id: "initial-face:Radiant", style: "initial-face", name: "Radiant", label: "Face Radiant", group: "initial-face" },

  // Sprouts (10 variasi)
  { id: "sprouts:Bloom", style: "sprouts", name: "Bloom", label: "Sprouts Bloom", group: "sprouts" },
  { id: "sprouts:Flora", style: "sprouts", name: "Flora", label: "Sprouts Flora", group: "sprouts" },
  { id: "sprouts:Leaf", style: "sprouts", name: "Leaf", label: "Sprouts Leaf", group: "sprouts" },
  { id: "sprouts:Clover", style: "sprouts", name: "Clover", label: "Sprouts Clover", group: "sprouts" },
  { id: "sprouts:Fern", style: "sprouts", name: "Fern", label: "Sprouts Fern", group: "sprouts" },
  { id: "sprouts:Blossom", style: "sprouts", name: "Blossom", label: "Sprouts Blossom", group: "sprouts" },
  { id: "sprouts:Moss", style: "sprouts", name: "Moss", label: "Sprouts Moss", group: "sprouts" },
  { id: "sprouts:Sage", style: "sprouts", name: "Sage", label: "Sprouts Sage", group: "sprouts" },
  { id: "sprouts:Willow", style: "sprouts", name: "Willow", label: "Sprouts Willow", group: "sprouts" },
  { id: "sprouts:Sprout", style: "sprouts", name: "Sprout", label: "Sprouts Sprout", group: "sprouts" },

  // Clay (10 variasi)
  { id: "clay:Mochi", style: "clay", name: "Mochi", label: "Clay Mochi", group: "clay" },
  { id: "clay:Dough", style: "clay", name: "Dough", label: "Clay Dough", group: "clay" },
  { id: "clay:Sculpt", style: "clay", name: "Sculpt", label: "Clay Sculpt", group: "clay" },
  { id: "clay:Pop", style: "clay", name: "Pop", label: "Clay Pop", group: "clay" },
  { id: "clay:Jelly", style: "clay", name: "Jelly", label: "Clay Jelly", group: "clay" },
  { id: "clay:Gummy", style: "clay", name: "Gummy", label: "Clay Gummy", group: "clay" },
  { id: "clay:Marble", style: "clay", name: "Marble", label: "Clay Marble", group: "clay" },
  { id: "clay:Blob", style: "clay", name: "Blob", label: "Clay Blob", group: "clay" },
  { id: "clay:Putty", style: "clay", name: "Putty", label: "Clay Putty", group: "clay" },
  { id: "clay:Squish", style: "clay", name: "Squish", label: "Clay Squish", group: "clay" },

  // Voxel Bot (10 variasi)
  { id: "voxel-bot:Mecha", style: "voxel-bot", name: "Mecha", label: "Voxel Bot Mecha", group: "voxel-bot" },
  { id: "voxel-bot:Cube", style: "voxel-bot", name: "Cube", label: "Voxel Bot Cube", group: "voxel-bot" },
  { id: "voxel-bot:Grid", style: "voxel-bot", name: "Grid", label: "Voxel Bot Grid", group: "voxel-bot" },
  { id: "voxel-bot:Robo", style: "voxel-bot", name: "Robo", label: "Voxel Bot Robo", group: "voxel-bot" },
  { id: "voxel-bot:Turbo", style: "voxel-bot", name: "Turbo", label: "Voxel Bot Turbo", group: "voxel-bot" },
  { id: "voxel-bot:Unit", style: "voxel-bot", name: "Unit", label: "Voxel Bot Unit", group: "voxel-bot" },
  { id: "voxel-bot:Droid", style: "voxel-bot", name: "Droid", label: "Voxel Bot Droid", group: "voxel-bot" },
  { id: "voxel-bot:Cortex", style: "voxel-bot", name: "Cortex", label: "Voxel Bot Cortex", group: "voxel-bot" },
  { id: "voxel-bot:Pulse", style: "voxel-bot", name: "Pulse", label: "Voxel Bot Pulse", group: "voxel-bot" },
  { id: "voxel-bot:Prime", style: "voxel-bot", name: "Prime", label: "Voxel Bot Prime", group: "voxel-bot" },

  // Voxel Art (10 variasi)
  { id: "voxel-art:PixelCraft", style: "voxel-art", name: "PixelCraft", label: "Voxel Art PixelCraft", group: "voxel-art" },
  { id: "voxel-art:Castle", style: "voxel-art", name: "Castle", label: "Voxel Art Castle", group: "voxel-art" },
  { id: "voxel-art:Brick", style: "voxel-art", name: "Brick", label: "Voxel Art Brick", group: "voxel-art" },
  { id: "voxel-art:Gamer", style: "voxel-art", name: "Gamer", label: "Voxel Art Gamer", group: "voxel-art" },
  { id: "voxel-art:Quest", style: "voxel-art", name: "Quest", label: "Voxel Art Quest", group: "voxel-art" },
  { id: "voxel-art:Block", style: "voxel-art", name: "Block", label: "Voxel Art Block", group: "voxel-art" },
  { id: "voxel-art:Craft", style: "voxel-art", name: "Craft", label: "Voxel Art Craft", group: "voxel-art" },
  { id: "voxel-art:Arcade", style: "voxel-art", name: "Arcade", label: "Voxel Art Arcade", group: "voxel-art" },
  { id: "voxel-art:Legend", style: "voxel-art", name: "Legend", label: "Voxel Art Legend", group: "voxel-art" },
  { id: "voxel-art:Dungeon", style: "voxel-art", name: "Dungeon", label: "Voxel Art Dungeon", group: "voxel-art" },

  // Critters (10 variasi)
  { id: "critters:Foxy", style: "critters", name: "Foxy", label: "Critters Foxy", group: "critters" },
  { id: "critters:Bunny", style: "critters", name: "Bunny", label: "Critters Bunny", group: "critters" },
  { id: "critters:Panda", style: "critters", name: "Panda", label: "Critters Panda", group: "critters" },
  { id: "critters:Kitty", style: "critters", name: "Kitty", label: "Critters Kitty", group: "critters" },
  { id: "critters:Puppy", style: "critters", name: "Puppy", label: "Critters Puppy", group: "critters" },
  { id: "critters:Bear", style: "critters", name: "Bear", label: "Critters Bear", group: "critters" },
  { id: "critters:Koala", style: "critters", name: "Koala", label: "Critters Koala", group: "critters" },
  { id: "critters:Otter", style: "critters", name: "Otter", label: "Critters Otter", group: "critters" },
  { id: "critters:Tiger", style: "critters", name: "Tiger", label: "Critters Tiger", group: "critters" },
  { id: "critters:Raccoon", style: "critters", name: "Raccoon", label: "Critters Raccoon", group: "critters" },
];

export const PIXELBOT_SEEDS = AVATAR_PRESETS.map((p) => p.id);

export function getRandomAvatarId(style = "all"): string {
  const filtered = style === "all" ? AVATAR_PRESETS : AVATAR_PRESETS.filter((p) => p.group === style);
  if (filtered.length > 0) {
    const randomItem = filtered[Math.floor(Math.random() * filtered.length)];
    return randomItem.id;
  }
  return AVATAR_PRESETS[0].id;
}

export function generateRandomSeed(style = "pixelbot"): string {
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const actualStyle = style === "all" ? "pixelbot" : style;
  return `${actualStyle}:Avatar${randomNum}`;
}

export function getAvatarUrl(avatarData?: string | null): string {
  if (!avatarData) {
    return "https://api.dicebear.com/10.x/pixelbot/svg?seed=Alpha&tags=animation";
  }

  if (avatarData.startsWith("http://") || avatarData.startsWith("https://")) {
    if (avatarData.includes("dicebear.com") && !avatarData.includes("tags=animation")) {
      const sep = avatarData.includes("?") ? "&" : "?";
      return `${avatarData}${sep}tags=animation`;
    }
    return avatarData;
  }

  // Handle "style:SeedName"
  if (avatarData.includes(":")) {
    const colonIndex = avatarData.indexOf(":");
    const style = avatarData.slice(0, colonIndex);
    const seed = avatarData.slice(colonIndex + 1);
    return `https://api.dicebear.com/10.x/${encodeURIComponent(style)}/svg?seed=${encodeURIComponent(seed)}&tags=animation`;
  }

  // If it's an emoji from old version
  if (/\p{Extended_Pictographic}/u.test(avatarData)) {
    return "https://api.dicebear.com/10.x/pixelbot/svg?seed=Alpha&tags=animation";
  }

  // Default fallback
  return `https://api.dicebear.com/10.x/pixelbot/svg?seed=${encodeURIComponent(avatarData)}&tags=animation`;
}

export function getAvatarInfo(avatarData?: string | null) {
  if (!avatarData) {
    return { name: "Alpha", style: "pixelbot", label: "Pixelbot Alpha" };
  }
  const preset = AVATAR_PRESETS.find((p) => p.id === avatarData);
  if (preset) return preset;

  if (avatarData.includes(":")) {
    const colonIndex = avatarData.indexOf(":");
    const style = avatarData.slice(0, colonIndex);
    const seed = avatarData.slice(colonIndex + 1);
    const styleObj = AVATAR_STYLES.find((s) => s.id === style);
    const styleName = styleObj ? styleObj.label.replace(/^[^\w\s]+/, "").trim() : style;
    return {
      name: seed,
      style,
      label: `${styleName} • ${seed}`,
    };
  }

  return { name: avatarData, style: "pixelbot", label: `Pixelbot • ${avatarData}` };
}

export const getPixelbotUrl = getAvatarUrl;
