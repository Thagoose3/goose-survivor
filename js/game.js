/**
 * Goose Survivor: Bullet Hell - High-Performance Master Engine
 * Features: Special Items & Power-Ups (Magnet, Time Freeze, Nuke, Coffee, Shield, Chili, Crate).
 */

class GooseSurvivorGame {
  constructor() {
    this.canvas = document.getElementById("game-canvas");
    this.ctx = this.canvas.getContext("2d", { alpha: false });

    this.bgCanvas = document.createElement("canvas");
    this.bgCtx = this.bgCanvas.getContext("2d");

    this.state = "START";
    this.player = null;
    this.enemies = [];
    this.enemyBullets = [];
    this.weapons = {
      feathers: [],
      eggs: []
    };
    this.cornGems = [];
    this.specialItems = [];
    this.particles = new window.ParticleSystem();

    this.inputKeys = {};
    this.gameTime = 0;
    this.wave = 1;
    this.kills = 0;
    this.grazeCount = 0;
    this.screenShake = 0;

    this.spawnTimer = 0;
    this.spawnInterval = 1.8;
    this.crateSpawnTimer = 0;

    // Time Freeze Active Timer
    this.timeFreezeTimer = 0;

    this.lastFrameTime = performance.now();
    this.hudUpdateTimer = 0;
    this.animationFrameId = null;
    this.isEcoMode = true;

    this.maxEnemies = 25;
    this.maxBullets = 60;
    this.maxGems = 40;

    this.init();
  }

  init() {
    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.bindInputs();
    this.bindUIButtons();
    this.bindVisibility();
    this.loop(performance.now());
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    this.bgCanvas.width = this.canvas.width;
    this.bgCanvas.height = this.canvas.height;
    this.bgCtx.fillStyle = "#0A1208";
    this.bgCtx.fillRect(0, 0, this.bgCanvas.width, this.bgCanvas.height);

    this.bgCtx.strokeStyle = "rgba(0, 255, 102, 0.05)";
    this.bgCtx.lineWidth = 1;
    this.bgCtx.beginPath();
    for (let x = 0; x < this.bgCanvas.width; x += 60) {
      this.bgCtx.moveTo(x, 0);
      this.bgCtx.lineTo(x, this.bgCanvas.height);
    }
    for (let y = 0; y < this.bgCanvas.height; y += 60) {
      this.bgCtx.moveTo(0, y);
      this.bgCtx.lineTo(this.bgCanvas.width, y);
    }
    this.bgCtx.stroke();

    if (this.player && this.state !== "PLAYING") {
      this.player.x = this.canvas.width / 2;
      this.player.y = this.canvas.height / 2;
    }
  }

  bindVisibility() {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.state === "PLAYING") {
        this.lastFrameTime = performance.now();
      }
    });
  }

  startNewGame() {
    this.player = new window.GoosePlayer(this.canvas.width / 2, this.canvas.height / 2);
    this.enemies = [];
    this.enemyBullets = [];
    this.weapons = { feathers: [], eggs: [] };
    this.cornGems = [];
    this.specialItems = [];
    this.particles = new window.ParticleSystem();

    this.gameTime = 0;
    this.wave = 1;
    this.kills = 0;
    this.grazeCount = 0;
    this.screenShake = 0;
    this.spawnInterval = 1.8;
    this.timeFreezeTimer = 0;
    this.crateSpawnTimer = 0;

    this.state = "PLAYING";

    document.getElementById("start-screen").classList.add("hidden");
    document.getElementById("gameover-screen").classList.add("hidden");
    document.getElementById("levelup-modal").classList.add("hidden");

    if (window.gameAudio) {
      window.gameAudio.ensureContext();
      window.gameAudio.playHonk(1.2);
    }
  }

  bindInputs() {
    window.addEventListener("keydown", (e) => {
      const key = e.key.toLowerCase();
      this.inputKeys[key] = true;

      if (this.state === "START" && (e.code === "Space" || e.key === "Enter")) {
        this.startNewGame();
        return;
      }

      if (this.state === "GAMEOVER" && (e.code === "Space" || e.key === "Enter")) {
        this.startNewGame();
        return;
      }

      if (this.state === "LEVEL_UP") {
        if (e.key === "1" || e.key === "2" || e.key === "3") {
          const idx = parseInt(e.key) - 1;
          const cardBtns = document.querySelectorAll(".upgrade-card-btn");
          if (cardBtns[idx]) cardBtns[idx].click();
        }
        return;
      }

      if (this.state === "PLAYING") {
        if (e.code === "Space" || e.key === "Shift") {
          e.preventDefault();
          if (this.player) this.player.triggerDash(this.particles);
        }
        if (key === "h") {
          e.preventDefault();
          if (this.player) this.player.triggerHonk(this.particles, this.enemies, this.enemyBullets);
        }
      }
    });

    window.addEventListener("keyup", (e) => {
      this.inputKeys[e.key.toLowerCase()] = false;
    });

    window.addEventListener("pointerdown", (e) => {
      if (this.state === "PLAYING" && this.player) {
        this.player.triggerHonk(this.particles, this.enemies, this.enemyBullets);
      }
    });
  }

  bindUIButtons() {
    const btnStart = document.getElementById("btn-start-game");
    if (btnStart) btnStart.addEventListener("click", () => this.startNewGame());

    const btnRestart = document.getElementById("btn-restart-game");
    if (btnRestart) btnRestart.addEventListener("click", () => this.startNewGame());

    const btnMute = document.getElementById("btn-toggle-sound");
    if (btnMute) {
      btnMute.addEventListener("click", () => {
        if (window.gameAudio) {
          const isMuted = window.gameAudio.toggleMute();
          btnMute.textContent = isMuted ? "🔇 SOUND [OFF]" : "🔊 SOUND [ON]";
          btnMute.classList.toggle("muted", isMuted);
        }
      });
    }

    const btnEco = document.getElementById("btn-toggle-eco");
    if (btnEco) {
      btnEco.addEventListener("click", () => {
        this.isEcoMode = !this.isEcoMode;
        btnEco.textContent = this.isEcoMode ? "⚡ ECO [ON - SILENT]" : "⚡ ECO [OFF]";
        btnEco.classList.toggle("eco-active", this.isEcoMode);
      });
    }
  }

  spawnEnemies(dt) {
    if (this.enemies.length >= this.maxEnemies) return;

    this.spawnTimer += dt;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;

      const count = Math.min(4, 1 + Math.floor(this.wave * 0.5));
      for (let i = 0; i < count; i++) {
        if (this.enemies.length >= this.maxEnemies) break;

        let sx, sy;
        if (Math.random() > 0.5) {
          sx = Math.random() > 0.5 ? -35 : this.canvas.width + 35;
          sy = Math.random() * this.canvas.height;
        } else {
          sx = Math.random() * this.canvas.width;
          sy = Math.random() > 0.5 ? -35 : this.canvas.height + 35;
        }

        let type = "farmer";
        const rand = Math.random();
        if (this.gameTime > 60 && rand > 0.7) type = "fox";
        else if (this.gameTime > 25 && rand > 0.45) type = "drone";

        this.enemies.push(new window.Enemy(sx, sy, type));
      }

      if (Math.floor(this.gameTime) > 0 && Math.floor(this.gameTime) % 75 === 0 && this.enemies.filter(e => e.type === "harvester_boss").length === 0) {
        if (window.gameAudio) window.gameAudio.playHonk(0.6);
        this.enemies.push(new window.Enemy(this.canvas.width / 2, -80, "harvester_boss"));
        this.particles.spawnFloatingText(this.canvas.width / 2, 100, "⚠️ COMBINE HARVESTER BOSS INCOMING!", "#FF007A", 18, true);
        this.screenShake = 16;
      }
    }

    // Spawn Lucky Mystery Crate every 35-45 seconds
    this.crateSpawnTimer += dt;
    if (this.crateSpawnTimer >= 40) {
      this.crateSpawnTimer = 0;
      const rx = 60 + Math.random() * (this.canvas.width - 120);
      const ry = 60 + Math.random() * (this.canvas.height - 120);
      this.specialItems.push(new window.SpecialItem(rx, ry, "crate"));
      this.particles.spawnFloatingText(rx, ry - 20, "🎁 LUCKY CRATE SPAWNED!", "#FFE600", 14, true);
    }
  }

  triggerLevelUp() {
    this.state = "LEVEL_UP";
    if (window.gameAudio) window.gameAudio.playLevelUp();

    const draft = window.getRandomUpgradeDraft(3);
    const container = document.getElementById("levelup-cards-container");
    container.innerHTML = "";

    draft.forEach((card, idx) => {
      const cardEl = document.createElement("div");
      cardEl.className = "upgrade-card";
      cardEl.style.borderColor = card.color;
      cardEl.innerHTML = `
        <div class="card-key-hint">[${idx + 1}]</div>
        <div class="card-icon">${card.icon}</div>
        <div class="card-title" style="color: ${card.color}">${card.name}</div>
        <div class="card-cat">${card.category}</div>
        <div class="card-desc">${card.description}</div>
        <button class="upgrade-card-btn" style="border-color: ${card.color};">SELECT UPGRADE</button>
      `;

      cardEl.addEventListener("click", () => {
        if (window.gameAudio) window.gameAudio.playCardSelect();
        card.apply(this.player);
        document.getElementById("levelup-modal").classList.add("hidden");
        this.state = "PLAYING";
        this.updateHUD(true);
      });

      container.appendChild(cardEl);
    });

    document.getElementById("levelup-modal").classList.remove("hidden");
  }

  triggerGameOver() {
    this.state = "GAMEOVER";

    document.getElementById("go-time").textContent = this.formatTime(this.gameTime);
    document.getElementById("go-kills").textContent = this.kills;
    document.getElementById("go-grazes").textContent = this.grazeCount;
    document.getElementById("go-level").textContent = `LVL ${this.player.level}`;

    document.getElementById("gameover-screen").classList.remove("hidden");
  }

  activateSpecialItem(type, x, y) {
    if (type === "bread") {
      this.player.heal(25);
      if (window.gameAudio) window.gameAudio.playHealPickup();
      this.particles.spawnFloatingText(this.player.x, this.player.y - 25, "+25 HP 🍞", "#00FF66", 14, true);
    } else if (type === "magnet") {
      // Sucks ALL corn gems on map!
      if (window.gameAudio) window.gameAudio.playMagnet();
      this.cornGems.forEach(gem => {
        gem.x = this.player.x;
        gem.y = this.player.y;
      });
      this.particles.spawnFloatingText(this.player.x, this.player.y - 25, "🧲 VACUUM MAGNET!", "#B829FF", 16, true);
    } else if (type === "freeze") {
      this.timeFreezeTimer = 4.0;
      if (window.gameAudio) window.gameAudio.playTimeFreeze();
      this.particles.spawnFloatingText(this.player.x, this.player.y - 25, "⏱️ TIME FREEZE (4s)!", "#00F0FF", 16, true);
    } else if (type === "nuke") {
      if (window.gameAudio) window.gameAudio.playNuke();
      this.screenShake = 24;
      this.enemyBullets = [];
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        if (e.type !== "harvester_boss") {
          this.killEnemy(e);
        } else {
          e.hp -= 400;
          this.particles.spawnFloatingText(e.x, e.y, "-400 NUKE", "#FF1B44", 16, true);
        }
      }
      this.particles.spawnFloatingText(this.player.x, this.player.y - 30, "💣 GOLDEN EGG NUKE!", "#FF1B44", 18, true);
    } else if (type === "coffee") {
      this.player.coffeeTimer = 6.0;
      if (window.gameAudio) window.gameAudio.playPowerup();
      this.particles.spawnFloatingText(this.player.x, this.player.y - 25, "☕ ESPRESSO HYPER BOOST!", "#FFE600", 15, true);
    } else if (type === "shield") {
      this.player.shieldHits = 3;
      if (window.gameAudio) window.gameAudio.playPowerup();
      this.particles.spawnFloatingText(this.player.x, this.player.y - 25, "🛡️ BUBBLE SHIELD (3 HITS)!", "#00F0FF", 15, true);
    } else if (type === "chili") {
      this.player.chiliTimer = 5.0;
      if (window.gameAudio) window.gameAudio.playPowerup();
      this.particles.spawnFloatingText(this.player.x, this.player.y - 25, "🌶️ SPICY FLAMING GOOSE!", "#FF5500", 15, true);
    } else if (type === "crate") {
      if (window.gameAudio) window.gameAudio.playPowerup();
      this.particles.spawnEggExplosion(x, y, 40);
      this.particles.spawnFloatingText(x, y - 25, "🎁 LUCKY CRATE OPENED!", "#FFE600", 16, true);
      // Spawn 2 random items + 5 corn gems!
      const itemTypes = ["bread", "magnet", "freeze", "nuke", "coffee", "shield", "chili"];
      for (let i = 0; i < 2; i++) {
        const rType = itemTypes[Math.floor(Math.random() * itemTypes.length)];
        const rx = x + (Math.random() - 0.5) * 60;
        const ry = y + (Math.random() - 0.5) * 60;
        this.specialItems.push(new window.SpecialItem(rx, ry, rType));
      }
      for (let i = 0; i < 4; i++) {
        const rx = x + (Math.random() - 0.5) * 50;
        const ry = y + (Math.random() - 0.5) * 50;
        this.cornGems.push(new window.CornGem(rx, ry, 25));
      }
    }
  }

  updateHUD(force = false) {
    if (!this.player) return;

    // HP Bar
    const hpPct = Math.max(0, (this.player.hp / this.player.maxHp) * 100);
    const hpBar = document.getElementById("hud-hp-bar");
    const hpText = document.getElementById("hud-hp-text");
    if (hpBar) hpBar.style.width = `${hpPct}%`;
    if (hpText) hpText.textContent = `${Math.ceil(this.player.hp)} / ${this.player.maxHp}`;

    // EXP Bar
    const expPct = Math.min(100, (this.player.exp / this.player.expToNextLevel) * 100);
    const expBar = document.getElementById("hud-exp-bar");
    const lvlBadge = document.getElementById("hud-level-badge");
    if (expBar) expBar.style.width = `${expPct}%`;
    if (lvlBadge) lvlBadge.textContent = `LVL ${this.player.level}`;

    // Skills
    const dashBadge = document.getElementById("hud-dash-status");
    if (dashBadge) {
      const ready = this.player.dashCooldownTimer <= 0;
      dashBadge.textContent = ready ? "⚡ DASH [SPACE]: READY" : `⚡ DASH: ${(this.player.dashCooldownTimer).toFixed(1)}s`;
      dashBadge.classList.toggle("ready", ready);
    }

    const honkBadge = document.getElementById("hud-honk-status");
    if (honkBadge) {
      const ready = this.player.honkCooldownTimer <= 0;
      honkBadge.textContent = ready ? "📢 HONK [H / CLICK]: READY" : `📢 HONK: ${(this.player.honkCooldownTimer).toFixed(1)}s`;
      honkBadge.classList.toggle("ready", ready);
    }

    // Active Power-Up Badges Bar
    const powerupsContainer = document.getElementById("hud-active-powerups");
    if (powerupsContainer) {
      let badgesHtml = "";
      if (this.timeFreezeTimer > 0) badgesHtml += `<span class="hud-power-chip freeze">⏱️ FREEZE [${this.timeFreezeTimer.toFixed(1)}s]</span>`;
      if (this.player.coffeeTimer > 0) badgesHtml += `<span class="hud-power-chip coffee">☕ ESPRESSO [${this.player.coffeeTimer.toFixed(1)}s]</span>`;
      if (this.player.chiliTimer > 0) badgesHtml += `<span class="hud-power-chip chili">🌶️ FLAMING [${this.player.chiliTimer.toFixed(1)}s]</span>`;
      if (this.player.shieldHits > 0) badgesHtml += `<span class="hud-power-chip shield">🛡️ SHIELD (${this.player.shieldHits})</span>`;
      powerupsContainer.innerHTML = badgesHtml;
    }

    const timerEl = document.getElementById("hud-timer");
    const killsEl = document.getElementById("hud-kills");
    const grazeEl = document.getElementById("hud-graze-count");

    if (timerEl) timerEl.textContent = this.formatTime(this.gameTime);
    if (killsEl) killsEl.textContent = this.kills;
    if (grazeEl) grazeEl.textContent = this.grazeCount;
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  killEnemy(enemy) {
    const idx = this.enemies.indexOf(enemy);
    if (idx !== -1) {
      this.enemies.splice(idx, 1);
      this.kills++;
      this.particles.spawnFeatherPuff(enemy.x, enemy.y, 8);

      if (this.cornGems.length < this.maxGems) {
        this.cornGems.push(new window.CornGem(enemy.x, enemy.y, enemy.expValue));
      }

      // Special Item Drop Roll (16% base, 100% on Boss & Fox)
      const isBoss = enemy.type === "harvester_boss";
      const isFox = enemy.type === "fox";
      const dropRoll = Math.random();

      if (isBoss || isFox || dropRoll < (0.16 + this.player.breadDropBonus)) {
        if (this.specialItems.length < 12) {
          const itemPool = ["bread", "bread", "magnet", "freeze", "nuke", "coffee", "shield", "chili"];
          const itemType = isBoss ? "nuke" : itemPool[Math.floor(Math.random() * itemPool.length)];
          this.specialItems.push(new window.SpecialItem(enemy.x, enemy.y, itemType));
        }
      }

      // Vampiric Life Steal
      if (this.player.vampirismLevel > 0) {
        const stealAmount = this.player.vampirismLevel * 3;
        const healed = this.player.heal(stealAmount);
        if (healed > 0) {
          if (window.gameAudio) window.gameAudio.playLifeSteal();
          this.particles.spawnFloatingText(this.player.x, this.player.y - 25, `+${stealAmount} HP 🩸`, "#FF007A", 12, true);
        }
      }
    }
  }

  update(dt) {
    if (this.state !== "PLAYING") return;

    this.gameTime += dt;
    this.wave = 1 + Math.floor(this.gameTime / 40);
    this.spawnInterval = Math.max(0.7, 2.0 - (this.wave * 0.12));

    if (this.timeFreezeTimer > 0) {
      this.timeFreezeTimer -= dt;
    }

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 25);
    }

    // Update Player & Weapons
    this.player.update(dt, this.inputKeys, this.canvas.width, this.canvas.height, this.particles, this.weapons, this.enemies);
    this.spawnEnemies(dt);

    const isFrozen = this.timeFreezeTimer > 0;

    // Update Feathers
    for (let i = this.weapons.feathers.length - 1; i >= 0; i--) {
      const feather = this.weapons.feathers[i];
      feather.update(dt);
      for (let j = 0; j < this.enemies.length; j++) {
        const e = this.enemies[j];
        const dx = e.x - feather.x;
        const dy = e.y - feather.y;
        if (dx * dx + dy * dy < (e.radius + 6) ** 2) {
          e.hp -= feather.damage;
          this.particles.spawnFeatherPuff(feather.x, feather.y, 3);
          this.particles.spawnFloatingText(e.x, e.y - 10, `-${Math.round(feather.damage)}`, "#00F0FF", 11);
          feather.isDead = true;
          if (e.hp <= 0) this.killEnemy(e);
          break;
        }
      }
      if (feather.isDead) this.weapons.feathers.splice(i, 1);
    }

    // Update Egg Mines
    for (let i = this.weapons.eggs.length - 1; i >= 0; i--) {
      const egg = this.weapons.eggs[i];
      const exploded = egg.update(dt);

      let triggerNear = false;
      for (let j = 0; j < this.enemies.length; j++) {
        const e = this.enemies[j];
        const dx = e.x - egg.x;
        const dy = e.y - egg.y;
        if (dx * dx + dy * dy < (e.radius + egg.radius) ** 2) {
          triggerNear = true;
          break;
        }
      }

      if (exploded || triggerNear) {
        this.weapons.eggs.splice(i, 1);
        this.particles.spawnEggExplosion(egg.x, egg.y, 70);
        if (window.gameAudio) window.gameAudio.playEggBoom();
        this.screenShake = 10;

        const aoeRadiusSq = 90 * 90;
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const e = this.enemies[j];
          const dx = e.x - egg.x;
          const dy = e.y - egg.y;
          if (dx * dx + dy * dy < aoeRadiusSq) {
            e.hp -= egg.damage;
            this.particles.spawnFloatingText(e.x, e.y - 15, `-${Math.round(egg.damage)}`, "#FF8800", 14, true);
            if (e.hp <= 0) this.killEnemy(e);
          }
        }
      }
    }

    // Update Orbiting Butter Knife
    if (this.player.butterKnifeLevel > 0) {
      const knifeDist = 42;
      const count = Math.min(3, this.player.butterKnifeLevel);
      for (let k = 0; k < count; k++) {
        const angle = this.player.knifeAngle + (k * (Math.PI * 2 / count));
        const kx = this.player.x + Math.cos(angle) * knifeDist;
        const ky = this.player.y + Math.sin(angle) * knifeDist;

        for (let b = this.enemyBullets.length - 1; b >= 0; b--) {
          const bul = this.enemyBullets[b];
          const bDx = bul.x - kx;
          const bDy = bul.y - ky;
          if (bDx * bDx + bDy * bDy < 196) {
            this.enemyBullets.splice(b, 1);
            this.particles.spawnFeatherPuff(kx, ky, 2);
          }
        }

        for (let j = 0; j < this.enemies.length; j++) {
          const e = this.enemies[j];
          const eDx = e.x - kx;
          const eDy = e.y - ky;
          if (eDx * eDx + eDy * eDy < (e.radius + 12) ** 2) {
            e.hp -= 25 * this.player.damageMultiplier * dt * 4;
            if (e.hp <= 0) this.killEnemy(e);
          }
        }
      }
    }

    // Update Enemies & Contact Damage / Chili burn
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      enemy.update(dt, this.player.x, this.player.y, this.enemyBullets, isFrozen);

      const dx = this.player.x - enemy.x;
      const dy = this.player.y - enemy.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < (this.player.bodyRadius + enemy.radius) ** 2) {
        // If Flaming Goose is active, scorch the enemy!
        if (this.player.chiliTimer > 0) {
          enemy.hp -= 60 * dt * 60;
          this.particles.spawnFloatingText(enemy.x, enemy.y - 10, "-BURN", "#FF5500", 11);
          if (enemy.hp <= 0) this.killEnemy(enemy);
        }

        const damaged = this.player.takeDamage(15, this.particles);
        if (damaged) {
          this.screenShake = 12;
          this.particles.spawnFeatherPuff(this.player.x, this.player.y, 8);
          if (this.player.hp <= 0) {
            this.triggerGameOver();
            return;
          }
        }
      }
    }

    // Update Enemy Bullets
    if (this.enemyBullets.length > this.maxBullets) {
      this.enemyBullets.splice(0, this.enemyBullets.length - this.maxBullets);
    }

    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const b = this.enemyBullets[i];
      b.update(dt, isFrozen);

      const dx = this.player.x - b.x;
      const dy = this.player.y - b.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < (b.radius + this.player.hitboxRadius) ** 2) {
        if (this.player.isDashing) {
          this.enemyBullets.splice(i, 1);
          this.particles.spawnFeatherPuff(b.x, b.y, 3);
          continue;
        }

        this.enemyBullets.splice(i, 1);
        const damaged = this.player.takeDamage(18, this.particles);
        if (damaged) {
          this.screenShake = 14;
          this.particles.spawnFeatherPuff(this.player.x, this.player.y, 10);
          if (this.player.hp <= 0) {
            this.triggerGameOver();
            return;
          }
        }
        continue;
      }

      if (!b.grazed && distSq < (b.radius + 20) ** 2) {
        b.grazed = true;
        this.grazeCount++;
        this.player.addExp(2);
        if (window.gameAudio) window.gameAudio.playGraze();
        this.particles.spawnFloatingText(b.x, b.y, "+1 GRAZE", "#FFE600", 10);
      }

      if (b.x < -40 || b.x > this.canvas.width + 40 || b.y < -40 || b.y > this.canvas.height + 40) {
        this.enemyBullets.splice(i, 1);
      }
    }

    // Update Corn Gems
    for (let i = this.cornGems.length - 1; i >= 0; i--) {
      const gem = this.cornGems[i];
      const collected = gem.update(dt, this.player.x, this.player.y, this.player.pickupRadius);
      if (collected) {
        if (window.gameAudio) window.gameAudio.playCornPickup();
        const levelUp = this.player.addExp(gem.value);
        this.cornGems.splice(i, 1);
        if (levelUp) {
          this.triggerLevelUp();
          return;
        }
      }
    }

    // Update Special Field Items
    for (let i = this.specialItems.length - 1; i >= 0; i--) {
      const item = this.specialItems[i];
      const collected = item.update(dt, this.player.x, this.player.y, this.player.pickupRadius);
      if (collected) {
        this.specialItems.splice(i, 1);
        this.activateSpecialItem(item.type, item.x, item.y);
      }
    }

    this.particles.update(dt);

    // Throttle HUD updates to 10Hz
    this.hudUpdateTimer += dt;
    if (this.hudUpdateTimer >= 0.1) {
      this.hudUpdateTimer = 0;
      this.updateHUD();
    }
  }

  draw() {
    this.ctx.save();

    if (this.screenShake > 0) {
      const sx = (Math.random() - 0.5) * this.screenShake;
      const sy = (Math.random() - 0.5) * this.screenShake;
      this.ctx.translate(sx, sy);
    }

    this.ctx.drawImage(this.bgCanvas, 0, 0);

    if (this.state === "PLAYING" || this.state === "LEVEL_UP") {
      for (let i = 0; i < this.cornGems.length; i++) this.cornGems[i].draw(this.ctx);
      for (let i = 0; i < this.specialItems.length; i++) this.specialItems[i].draw(this.ctx);
      for (let i = 0; i < this.weapons.eggs.length; i++) this.weapons.eggs[i].draw(this.ctx);
      for (let i = 0; i < this.enemies.length; i++) this.enemies[i].draw(this.ctx);
      for (let i = 0; i < this.enemyBullets.length; i++) this.enemyBullets[i].draw(this.ctx);
      for (let i = 0; i < this.weapons.feathers.length; i++) this.weapons.feathers[i].draw(this.ctx);
      if (this.player) this.player.draw(this.ctx);
      this.particles.draw(this.ctx);
    }

    this.ctx.restore();
  }

  loop(currentTime) {
    const dt = Math.min(0.06, (currentTime - this.lastFrameTime) / 1000);
    this.lastFrameTime = currentTime;

    if (!document.hidden) {
      this.update(dt);
      this.draw();
    }

    this.animationFrameId = requestAnimationFrame((t) => this.loop(t));
  }
}

window.addEventListener("DOMContentLoaded", () => {
  window.game = new GooseSurvivorGame();
});
