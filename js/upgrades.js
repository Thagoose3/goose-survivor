/**
 * Goose Survivor - Roguelite Upgrades Database & Selection Logic
 */

window.GOOSE_UPGRADES = [
  {
    id: "vampirism",
    icon: "🧛",
    name: "Vampiric Goose Fangs",
    category: "SUSTAIN",
    color: "#FF007A",
    description: "Slain enemies restore +3 HP on death. Stacks with higher ranks.",
    apply: (player) => {
      player.vampirismLevel++;
      player.heal(15);
    }
  },
  {
    id: "toast_delivery",
    icon: "🍞",
    name: "Golden Toast Bakery",
    category: "SUSTAIN",
    color: "#00FF66",
    description: "Increases Health Bread drop chance by +15% and instantly heals +40 HP.",
    apply: (player) => {
      player.breadDropBonus += 0.15;
      player.heal(40);
    }
  },
  {
    id: "mega_honk",
    icon: "📢",
    name: "Mega Honk Wave",
    category: "CROWD_CONTROL",
    color: "#FFE600",
    description: "Expands HONK shockwave radius, vaporizes bullet screens, and deals massive damage.",
    apply: (player) => {
      player.megaHonkLevel++;
    }
  },
  {
    id: "feather_gatling",
    icon: "🪶",
    name: "Feather Gatling",
    category: "OFFENSIVE",
    color: "#00F0FF",
    description: "Fires additional rapid razor feathers per salvo with higher attack speed.",
    apply: (player) => {
      player.featherGatlingLevel++;
    }
  },
  {
    id: "egg_mines",
    icon: "🥚",
    name: "Golden Egg Mines",
    category: "OFFENSIVE",
    color: "#FF8800",
    description: "Lays ticking golden eggs as you run that detonate in fiery yolk explosions.",
    apply: (player) => {
      player.eggMineLevel++;
    }
  },
  {
    id: "butter_knife",
    icon: "🔪",
    name: "Peace Was Never An Option",
    category: "DEFENSIVE",
    color: "#FF007A",
    description: "Equips orbiting Butter Knives that spin around the goose, slicing close threats.",
    apply: (player) => {
      player.butterKnifeLevel++;
    }
  },
  {
    id: "goose_zoomies",
    icon: "💨",
    name: "Goose Zoomies",
    category: "MOBILITY",
    color: "#00FF66",
    description: "Increases waddling speed by +25% and reduces Dash roll cooldown by -30%.",
    apply: (player) => {
      player.speed *= 1.25;
      player.dashCooldown = Math.max(0.4, player.dashCooldown * 0.7);
    }
  },
  {
    id: "corn_magnet",
    icon: "🧲",
    name: "Corn Magnet",
    category: "UTILITY",
    color: "#B829FF",
    description: "Vastly expands corn & seed vacuum attraction radius by +75px.",
    apply: (player) => {
      player.pickupRadius += 75;
    }
  },
  {
    id: "iron_gizzard",
    icon: "💖",
    name: "Iron Gizzard",
    category: "SUSTAIN",
    color: "#FF1B44",
    description: "Increases Max HP by +30 and instantly heals +50 HP.",
    apply: (player) => {
      player.maxHp += 30;
      player.heal(50);
    }
  },
  {
    id: "hyper_capacitor",
    icon: "⚡",
    name: "Alpha Goose Energy",
    category: "OFFENSIVE",
    color: "#FFE600",
    description: "Increases damage of all feathers, egg mines, and honks by +35%.",
    apply: (player) => {
      player.damageMultiplier += 0.35;
    }
  }
];

window.getRandomUpgradeDraft = function(count = 3) {
  const all = [...window.GOOSE_UPGRADES];
  const selected = [];
  while (selected.length < count && all.length > 0) {
    const idx = Math.floor(Math.random() * all.length);
    selected.push(all.splice(idx, 1)[0]);
  }
  return selected;
};
