/**
 * Goose Survivor: Bullet Hell - Master Engine v2
 * - HiDPI rendering with a responsive world scale (phones see a wider arena, not tiny sprites)
 * - Pre-rendered field background, additive glow FX, hit-flash, boss HP bar
 * - Touch controls, pause menu, auto-pause when the app is backgrounded
 */

class GooseSurvivorGame {
  constructor() {
    this.canvas = document.getElementById("game-canvas");
    this.ctx = this.canvas.getContext("2d", { alpha: false });

    this.bgCanvas = document.createElement("canvas");
    this.bgCtx = this.bgCanvas.getContext("2d");

    this.input = new window.InputManager();
    this.ambient = new window.AmbientField();

    this.state = "START";
    this.player = null;
    this.enemies = [];
    this.enemyBullets = [];
    this.weapons = { feathers: [], eggs: [] };
    this.cornGems = [];
    this.specialItems = [];
    this.particles = new window.ParticleSystem();

    this.gameTime = 0;
    this.renderTime = 0;
    this.wave = 1;
    this.kills = 0;
    this.grazeCount = 0;
    this.screenShake = 0;
    this.damageFlash = 0;
    this.levelFlash = 0;

    this.spawnTimer = 0;
    this.spawnInterval = 1.8;
    this.crateSpawnTimer = 0;
    this.timeFreezeTimer = 0;

    this.lastFrameTime = performance.now();
    this.hudUpdateTimer = 0;
    this.cdUpdateTimer = 0;
    this.animationFrameId = null;
    this.isEcoMode = this.loadPref("eco", true);

    this.maxEnemies = 25;
    this.maxBullets = 60;
    this.maxGems = 40;

    // world (logical) size and render scale
    this.W = 800;
    this.H = 600;
    this.viewScale = 1;
    this.dpr = 1;

    this.best = this.loadPref("best", { time: 0, kills: 0 });

    this.init();
  }

  // ------------------------------------------------------------------ setup

  loadPref(key, fallback) {
    try {
      const v = localStorage.getItem("goose_" + key);
      return v === null ? fallback : JSON.parse(v);
    } catch (_) { return fallback; }
  }

  savePref(key, value) {
    try { localStorage.setItem("goose_" + key, JSON.stringify(value)); } catch (_) { /* private mode */ }
  }

  init() {
    this.particles.setQuality(this.isEcoMode);
    this.syncEcoButton();
    this.resize();
    window.addEventListener("resize", () => this.resize());
    window.addEventListener("orientationchange", () => setTimeout(() => this.resize(), 200));
    if (window.visualViewport) window.visualViewport.addEventListener("resize", () => this.resize());
    this.bindInputs();
    this.bindUIButtons();
    this.bindVisibility();
    this.updateBestLabel();
    this.loop(performance.now());
  }

  resize() {
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    const prevW = this.W, prevH = this.H;

    // Phones: zoom the camera out so the arena isn't cramped. Desktop stays 1:1.
    const minSide = Math.min(cssW, cssH);
    this.viewScale = Math.max(0.62, Math.min(1, minSide / 600));
    const dprCap = this.isEcoMode ? 1.5 : 2.5;
    this.dpr = Math.min(window.devicePixelRatio || 1, dprCap);

    this.W = cssW / this.viewScale;
    this.H = cssH / this.viewScale;

    this.canvas.width = Math.round(cssW * this.dpr);
    this.canvas.height = Math.round(cssH * this.dpr);
    this.canvas.style.width = cssW + "px";
    this.canvas.style.height = cssH + "px";

    this.buildBackground();
    this.ambient.reset(this.W, this.H, this.isEcoMode ? 0 : Math.round((this.W * this.H) / 26000));

    if (this.player) {
      if (this.state === "PLAYING" || this.state === "LEVEL_UP" || this.state === "PAUSED") {
        // keep the goose at the same relative spot
        this.player.x = (this.player.x / prevW) * this.W;
        this.player.y = (this.player.y / prevH) * this.H;
      } else {
        this.player.x = this.W / 2;
        this.player.y = this.H / 2;
      }
    }
  }

  buildBackground() {
    const scale = this.dpr * this.viewScale;
    const W = this.W, H = this.H;
    this.bgCanvas.width = this.canvas.width;
    this.bgCanvas.height = this.canvas.height;
    const g = this.bgCtx;
    g.setTransform(scale, 0, 0, scale, 0, 0);

    // Night field base
    const base = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.hypot(W, H) / 2);
    base.addColorStop(0, "#14301A");
    base.addColorStop(0.6, "#0C1F10");
    base.addColorStop(1, "#050C07");
    g.fillStyle = base;
    g.fillRect(0, 0, W, H);

    // Deterministic RNG so the field looks the same after every resize
    let seed = 1337;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

    // Mowed crop stripes
    g.save();
    g.translate(W / 2, H / 2);
    g.rotate(-0.35);
    const diag = Math.hypot(W, H);
    for (let x = -diag; x < diag; x += 90) {
      g.fillStyle = "rgba(120, 200, 90, 0.035)";
      g.fillRect(x, -diag, 45, diag * 2);
    }
    g.restore();

    // Dirt patches
    for (let i = 0; i < (W * H) / 60000; i++) {
      const x = rnd() * W, y = rnd() * H, r = 30 + rnd() * 70;
      const dirt = g.createRadialGradient(x, y, 0, x, y, r);
      dirt.addColorStop(0, "rgba(70, 48, 25, 0.35)");
      dirt.addColorStop(1, "rgba(70, 48, 25, 0)");
      g.fillStyle = dirt;
      g.beginPath(); g.ellipse(x, y, r, r * 0.6, rnd() * Math.PI, 0, Math.PI * 2); g.fill();
    }

    // Grass tufts
    const tufts = Math.round((W * H) / 900);
    g.lineCap = "round";
    for (let i = 0; i < tufts; i++) {
      const x = rnd() * W, y = rnd() * H;
      const shadeV = rnd();
      g.strokeStyle = shadeV > 0.85 ? "rgba(160, 230, 110, 0.28)" : shadeV > 0.4 ? "rgba(70, 150, 60, 0.22)" : "rgba(30, 90, 40, 0.3)";
      g.lineWidth = 1 + rnd();
      g.beginPath();
      const blades = 2 + Math.floor(rnd() * 3);
      for (let b = 0; b < blades; b++) {
        const a = -Math.PI / 2 + (rnd() - 0.5) * 1.1;
        const len = 3 + rnd() * 5;
        g.moveTo(x, y);
        g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      }
      g.stroke();
    }

    // Tiny flowers
    for (let i = 0; i < (W * H) / 9000; i++) {
      const x = rnd() * W, y = rnd() * H;
      g.fillStyle = ["rgba(255,230,0,0.45)", "rgba(255,255,255,0.4)", "rgba(255,120,200,0.4)"][Math.floor(rnd() * 3)];
      g.beginPath(); g.arc(x, y, 1.2, 0, Math.PI * 2); g.fill();
    }

    // Faint neon grid (the "cyber farm" look from v1)
    g.strokeStyle = "rgba(0, 255, 102, 0.045)";
    g.lineWidth = 1;
    g.beginPath();
    for (let x = 0; x < W; x += 60) { g.moveTo(x, 0); g.lineTo(x, H); }
    for (let y = 0; y < H; y += 60) { g.moveTo(0, y); g.lineTo(W, y); }
    g.stroke();

    // Arena border glow
    g.strokeStyle = "rgba(0, 255, 102, 0.12)";
    g.lineWidth = 3;
    g.strokeRect(6, 6, W - 12, H - 12);

    // Baked vignette
    const vig = window.Sprites.vignette(W, H);
    g.globalAlpha = 0.75;
    g.drawImage(vig, 0, 0, W, H);
    g.globalAlpha = 1;
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  bindVisibility() {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        if (this.state === "PLAYING") this.pauseGame();
      }
      this.lastFrameTime = performance.now();
    });
    window.addEventListener("blur", () => {
      if (this.state === "PLAYING" && this.input.isTouch) this.pauseGame();
    });
  }

  // ------------------------------------------------------------------ state changes

  startNewGame() {
    this.player = new window.GoosePlayer(this.W / 2, this.H / 2);
    this.enemies = [];
    this.enemyBullets = [];
    this.weapons = { feathers: [], eggs: [] };
    this.cornGems = [];
    this.specialItems = [];
    this.particles = new window.ParticleSystem();
    this.particles.setQuality(this.isEcoMode);

    this.gameTime = 0;
    this.wave = 1;
    this.kills = 0;
    this.grazeCount = 0;
    this.screenShake = 0;
    this.damageFlash = 0;
    this.spawnInterval = 1.8;
    this.spawnTimer = 0;
    this.timeFreezeTimer = 0;
    this.crateSpawnTimer = 0;
    this.lastBossSpawnSecond = -1;

    this.state = "PLAYING";
    document.body.classList.add("in-game");

    ["start-screen", "gameover-screen", "levelup-modal", "pause-screen"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.classList.add("hidden");
    });

    if (window.gameAudio) {
      window.gameAudio.ensureContext();
      window.gameAudio.playHonk(1.2);
    }
    this.particles.spawnShockRing(this.player.x, this.player.y, "#FFE600", 120, 0.6, 4);
    this.updateHUD(true);
  }

  pauseGame() {
    if (this.state !== "PLAYING") return;
    this.state = "PAUSED";
    this.input.releaseJoystick();
    document.getElementById("pause-screen").classList.remove("hidden");
  }

  resumeGame() {
    if (this.state !== "PAUSED") return;
    this.state = "PLAYING";
    this.lastFrameTime = performance.now();
    document.getElementById("pause-screen").classList.add("hidden");
    if (window.gameAudio) window.gameAudio.ensureContext();
  }

  quitToMenu() {
    this.state = "START";
    document.body.classList.remove("in-game");
    document.getElementById("pause-screen").classList.add("hidden");
    document.getElementById("start-screen").classList.remove("hidden");
    this.setBossBar(null);
    this.updateBestLabel();
  }

  bindInputs() {
    this.input.onDash = () => {
      if (this.state === "PLAYING" && this.player && this.player.triggerDash(this.particles)) this.input.vibrate(12);
    };
    this.input.onHonk = () => {
      if (this.state === "PLAYING" && this.player && this.player.triggerHonk(this.particles, this.enemies, this.enemyBullets)) {
        this.input.vibrate(25);
        this.screenShake = Math.max(this.screenShake, 5);
      }
    };

    window.addEventListener("keydown", (e) => {
      const key = e.key.toLowerCase();

      if ((this.state === "START" || this.state === "GAMEOVER") && (e.code === "Space" || e.key === "Enter")) {
        e.preventDefault();
        this.startNewGame();
        return;
      }

      if (key === "escape" || key === "p") {
        if (this.state === "PLAYING") this.pauseGame();
        else if (this.state === "PAUSED") this.resumeGame();
        return;
      }

      if (this.state === "PAUSED" && (e.code === "Space" || e.key === "Enter")) {
        e.preventDefault();
        this.resumeGame();
        return;
      }

      if (this.state === "LEVEL_UP") {
        if (e.key === "1" || e.key === "2" || e.key === "3") {
          const cards = document.querySelectorAll(".upgrade-card");
          const card = cards[parseInt(e.key, 10) - 1];
          if (card) card.click();
        }
        return;
      }

      if (this.state === "PLAYING") {
        if (e.code === "Space" || e.key === "Shift") {
          e.preventDefault();
          if (!e.repeat) this.input.onDash();
        }
        if (key === "h") {
          e.preventDefault();
          this.input.onHonk();
        }
      }
    });

    // Mouse left-click on the arena = HONK (touch uses the on-screen button instead)
    this.canvas.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button === 0) this.input.onHonk();
    });
  }

  bindUIButtons() {
    const on = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("click", fn);
    };

    on("btn-start-game", () => this.startNewGame());
    on("btn-restart-game", () => this.startNewGame());
    on("btn-pause", () => this.pauseGame());
    on("btn-resume", () => this.resumeGame());
    on("btn-quit", () => this.quitToMenu());
    on("btn-menu-from-gameover", () => {
      document.getElementById("gameover-screen").classList.add("hidden");
      this.quitToMenu();
    });

    const toggleSound = () => {
      if (!window.gameAudio) return;
      const isMuted = window.gameAudio.toggleMute();
      document.querySelectorAll(".js-sound-toggle").forEach((b) => {
        b.classList.toggle("muted", isMuted);
        const label = b.querySelector(".lbl");
        if (label) label.textContent = isMuted ? "OFF" : "ON";
        const ic = b.querySelector(".ic");
        if (ic) ic.textContent = isMuted ? "🔇" : "🔊";
      });
    };
    document.querySelectorAll(".js-sound-toggle").forEach((b) => b.addEventListener("click", toggleSound));

    const toggleEco = () => {
      this.isEcoMode = !this.isEcoMode;
      this.savePref("eco", this.isEcoMode);
      this.particles.setQuality(this.isEcoMode);
      this.syncEcoButton();
      this.resize();
    };
    document.querySelectorAll(".js-eco-toggle").forEach((b) => b.addEventListener("click", toggleEco));

    const fsBtns = document.querySelectorAll(".js-fullscreen");
    const canFs = document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen;
    fsBtns.forEach((b) => {
      if (!canFs) { b.classList.add("hidden"); return; }
      b.addEventListener("click", () => {
        const doc = document;
        if (doc.fullscreenElement || doc.webkitFullscreenElement) {
          (doc.exitFullscreen || doc.webkitExitFullscreen).call(doc);
        } else {
          const el = document.documentElement;
          const req = el.requestFullscreen || el.webkitRequestFullscreen;
          try {
            const p = req.call(el, { navigationUI: "hide" });
            if (p && p.then) p.then(() => {
              if (screen.orientation && screen.orientation.lock) screen.orientation.lock("landscape").catch(() => {});
            }).catch(() => {});
          } catch (_) { /* ignore */ }
        }
      });
    });
  }

  syncEcoButton() {
    document.querySelectorAll(".js-eco-toggle").forEach((b) => {
      b.classList.toggle("eco-active", this.isEcoMode);
      const label = b.querySelector(".lbl");
      if (label) label.textContent = this.isEcoMode ? "ECO" : "HIGH";
    });
  }

  updateBestLabel() {
    const el = document.getElementById("menu-best");
    if (!el) return;
    if (this.best && this.best.time > 0) {
      el.textContent = `🏆 BEST: ${this.formatTime(this.best.time)} · ${this.best.kills} KILLS`;
      el.classList.remove("hidden");
    } else {
      el.classList.add("hidden");
    }
  }

  // ------------------------------------------------------------------ spawning

  spawnEnemies(dt) {
    // Boss check runs independently of the regular spawn timer
    const sec = Math.floor(this.gameTime);
    if (sec > 0 && sec % 75 === 0 && sec !== this.lastBossSpawnSecond && !this.enemies.some((e) => e.type === "harvester_boss")) {
      this.lastBossSpawnSecond = sec;
      if (window.gameAudio) window.gameAudio.playHonk(0.6);
      this.enemies.push(new window.Enemy(this.W / 2, -80, "harvester_boss"));
      this.showBanner("⚠️ BOSS INCOMING ⚠️", "COMBINE HARVESTER");
      this.screenShake = 16;
      this.input.vibrate([60, 40, 60]);
    }

    if (this.enemies.length < this.maxEnemies) {
      this.spawnTimer += dt;
      if (this.spawnTimer >= this.spawnInterval) {
        this.spawnTimer = 0;
        const count = Math.min(4, 1 + Math.floor(this.wave * 0.5));
        for (let i = 0; i < count; i++) {
          if (this.enemies.length >= this.maxEnemies) break;
          let sx, sy;
          if (Math.random() > 0.5) {
            sx = Math.random() > 0.5 ? -35 : this.W + 35;
            sy = Math.random() * this.H;
          } else {
            sx = Math.random() * this.W;
            sy = Math.random() > 0.5 ? -35 : this.H + 35;
          }
          let type = "farmer";
          const rand = Math.random();
          if (this.gameTime > 60 && rand > 0.7) type = "fox";
          else if (this.gameTime > 25 && rand > 0.45) type = "drone";
          this.enemies.push(new window.Enemy(sx, sy, type));
        }
      }
    }

    this.crateSpawnTimer += dt;
    if (this.crateSpawnTimer >= 40) {
      this.crateSpawnTimer = 0;
      const rx = 60 + Math.random() * (this.W - 120);
      const ry = 90 + Math.random() * (this.H - 180);
      this.specialItems.push(new window.SpecialItem(rx, ry, "crate"));
      this.particles.spawnShockRing(rx, ry, "#FFE600", 60, 0.6, 3);
      this.particles.spawnFloatingText(rx, ry - 26, "🎁 LUCKY CRATE!", "#FFE600", 14, true);
    }
  }

  showBanner(title, sub) {
    const el = document.getElementById("wave-banner");
    if (!el) return;
    el.querySelector(".banner-title").textContent = title;
    el.querySelector(".banner-sub").textContent = sub || "";
    el.classList.remove("show");
    void el.offsetWidth; // restart CSS animation
    el.classList.add("show");
  }

  // ------------------------------------------------------------------ level up / game over

  triggerLevelUp() {
    this.state = "LEVEL_UP";
    this.input.releaseJoystick();
    this.levelFlash = 0.5;
    if (window.gameAudio) window.gameAudio.playLevelUp();
    this.particles.spawnShockRing(this.player.x, this.player.y, "#FFE600", 140, 0.6, 5);

    const draft = window.getRandomUpgradeDraft(3);
    const container = document.getElementById("levelup-cards-container");
    container.innerHTML = "";
    document.getElementById("levelup-level").textContent = `LVL ${this.player.level}`;

    let armed = false;
    // guard against the tap that triggered the level-up also selecting a card
    setTimeout(() => { armed = true; }, 350);

    draft.forEach((card, idx) => {
      const cardEl = document.createElement("button");
      cardEl.type = "button";
      cardEl.className = "upgrade-card";
      cardEl.style.setProperty("--card-color", card.color);
      cardEl.style.animationDelay = `${idx * 0.07}s`;
      cardEl.innerHTML = `
        <div class="card-key-hint">${idx + 1}</div>
        <div class="card-icon">${card.icon}</div>
        <div class="card-body">
          <div class="card-title">${card.name}</div>
          <div class="card-cat">${card.category.replace("_", " ")}</div>
          <div class="card-desc">${card.description}</div>
        </div>
      `;

      cardEl.addEventListener("click", () => {
        if (!armed || this.state !== "LEVEL_UP") return;
        if (window.gameAudio) window.gameAudio.playCardSelect();
        card.apply(this.player);
        document.getElementById("levelup-modal").classList.add("hidden");
        this.state = "PLAYING";
        this.lastFrameTime = performance.now();
        this.particles.spawnShockRing(this.player.x, this.player.y, card.color, 90, 0.5, 4);
        this.particles.spawnFloatingText(this.player.x, this.player.y - 34, `${card.icon} ${card.name}`, card.color, 14, true);
        this.updateHUD(true);
      });

      container.appendChild(cardEl);
    });

    document.getElementById("levelup-modal").classList.remove("hidden");
  }

  triggerGameOver() {
    this.state = "GAMEOVER";
    this.input.releaseJoystick();
    this.input.vibrate([80, 50, 160]);
    this.particles.spawnDeathBurst(this.player.x, this.player.y, "#FFFFFF", true);
    this.setBossBar(null);

    const isRecord = this.gameTime > (this.best.time || 0);
    if (isRecord) {
      this.best = { time: Math.floor(this.gameTime), kills: this.kills };
      this.savePref("best", this.best);
    }

    document.getElementById("go-time").textContent = this.formatTime(this.gameTime);
    document.getElementById("go-kills").textContent = this.kills;
    document.getElementById("go-grazes").textContent = this.grazeCount;
    document.getElementById("go-level").textContent = `LVL ${this.player.level}`;
    document.getElementById("go-record").classList.toggle("hidden", !isRecord);
    document.getElementById("go-best").textContent = `BEST ${this.formatTime(this.best.time)}`;

    // let the death burst play for a moment before the panel appears
    setTimeout(() => {
      if (this.state === "GAMEOVER") {
        document.body.classList.remove("in-game");
        document.getElementById("gameover-screen").classList.remove("hidden");
      }
    }, 700);
  }

  activateSpecialItem(type, x, y) {
    const p = this.player;
    const color = (window.SpecialItem.COLORS && window.SpecialItem.COLORS[type]) || "#FFFFFF";
    this.particles.spawnShockRing(x, y, color, 50, 0.4, 3);
    this.particles.spawnSparks(x, y, color, 8, 3);

    if (type === "bread") {
      p.heal(25);
      if (window.gameAudio) window.gameAudio.playHealPickup();
      this.particles.spawnFloatingText(p.x, p.y - 25, "+25 HP 🍞", "#00FF66", 14, true);
    } else if (type === "magnet") {
      if (window.gameAudio) window.gameAudio.playMagnet();
      this.cornGems.forEach((gem) => {
        // pull them in visibly instead of teleporting
        gem.popVx = 0; gem.popVy = 0;
        gem.magnetPull = true;
      });
      this.magnetTimer = 2.5;
      this.particles.spawnFloatingText(p.x, p.y - 25, "🧲 VACUUM MAGNET!", "#B829FF", 16, true);
    } else if (type === "freeze") {
      this.timeFreezeTimer = 4.0;
      if (window.gameAudio) window.gameAudio.playTimeFreeze();
      this.particles.spawnShockRing(p.x, p.y, "#00F0FF", Math.max(this.W, this.H), 0.8, 6);
      this.particles.spawnFloatingText(p.x, p.y - 25, "⏱️ TIME FREEZE (4s)!", "#00F0FF", 16, true);
    } else if (type === "nuke") {
      if (window.gameAudio) window.gameAudio.playNuke();
      this.screenShake = 24;
      this.levelFlash = 0.6;
      this.input.vibrate([40, 30, 120]);
      this.enemyBullets = [];
      this.particles.spawnDeathBurst(p.x, p.y, "#FF1B44", true);
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        if (e.type !== "harvester_boss") {
          this.killEnemy(e);
        } else {
          e.hp -= 400;
          e.hitFlash = 0.2;
          this.particles.spawnFloatingText(e.x, e.y, "-400 NUKE", "#FF1B44", 18, true);
          if (e.hp <= 0) this.killEnemy(e);
        }
      }
      this.particles.spawnFloatingText(p.x, p.y - 30, "💣 GOLDEN EGG NUKE!", "#FF1B44", 18, true);
    } else if (type === "coffee") {
      p.coffeeTimer = 6.0;
      if (window.gameAudio) window.gameAudio.playPowerup();
      this.particles.spawnFloatingText(p.x, p.y - 25, "☕ ESPRESSO HYPER BOOST!", "#FFE600", 15, true);
    } else if (type === "shield") {
      p.shieldHits = 3;
      if (window.gameAudio) window.gameAudio.playPowerup();
      this.particles.spawnFloatingText(p.x, p.y - 25, "🛡️ BUBBLE SHIELD (3 HITS)!", "#00F0FF", 15, true);
    } else if (type === "chili") {
      p.chiliTimer = 5.0;
      if (window.gameAudio) window.gameAudio.playPowerup();
      this.particles.spawnFloatingText(p.x, p.y - 25, "🌶️ SPICY FLAMING GOOSE!", "#FF5500", 15, true);
    } else if (type === "crate") {
      if (window.gameAudio) window.gameAudio.playPowerup();
      this.particles.spawnEggExplosion(x, y, 40);
      this.particles.spawnFloatingText(x, y - 25, "🎁 LUCKY CRATE OPENED!", "#FFE600", 16, true);
      const itemTypes = ["bread", "magnet", "freeze", "nuke", "coffee", "shield", "chili"];
      for (let i = 0; i < 2; i++) {
        const rType = itemTypes[Math.floor(Math.random() * itemTypes.length)];
        this.specialItems.push(new window.SpecialItem(x + (Math.random() - 0.5) * 60, y + (Math.random() - 0.5) * 60, rType));
      }
      for (let i = 0; i < 4; i++) {
        this.cornGems.push(new window.CornGem(x + (Math.random() - 0.5) * 50, y + (Math.random() - 0.5) * 50, 25));
      }
    }
  }

  // ------------------------------------------------------------------ HUD

  setBossBar(boss) {
    const wrap = document.getElementById("boss-bar");
    if (!wrap) return;
    if (!boss) { wrap.classList.add("hidden"); return; }
    wrap.classList.remove("hidden");
    const pct = Math.max(0, boss.hp / boss.maxHp) * 100;
    document.getElementById("boss-bar-fill").style.width = `${pct}%`;
  }

  updateHUD() {
    if (!this.player) return;
    const p = this.player;

    const hpPct = Math.max(0, (p.hp / p.maxHp) * 100);
    document.getElementById("hud-hp-bar").style.width = `${hpPct}%`;
    document.getElementById("hud-hp-text").textContent = `${Math.ceil(p.hp)}/${p.maxHp}`;
    document.body.classList.toggle("low-hp", hpPct <= 30 && this.state === "PLAYING");

    const expPct = Math.min(100, (p.exp / p.expToNextLevel) * 100);
    document.getElementById("hud-exp-bar").style.width = `${expPct}%`;
    document.getElementById("hud-level-badge").textContent = `LV ${p.level}`;

    const dashBadge = document.getElementById("hud-dash-status");
    const dashReady = p.dashCooldownTimer <= 0;
    dashBadge.textContent = dashReady ? "⚡ DASH [SPACE]" : `⚡ ${p.dashCooldownTimer.toFixed(1)}s`;
    dashBadge.classList.toggle("ready", dashReady);

    const honkBadge = document.getElementById("hud-honk-status");
    const honkReady = p.honkCooldownTimer <= 0;
    honkBadge.textContent = honkReady ? "📢 HONK [H / CLICK]" : `📢 ${p.honkCooldownTimer.toFixed(1)}s`;
    honkBadge.classList.toggle("ready", honkReady);

    let badgesHtml = "";
    if (this.timeFreezeTimer > 0) badgesHtml += `<span class="hud-power-chip freeze">⏱️ ${this.timeFreezeTimer.toFixed(1)}s</span>`;
    if (p.coffeeTimer > 0) badgesHtml += `<span class="hud-power-chip coffee">☕ ${p.coffeeTimer.toFixed(1)}s</span>`;
    if (p.chiliTimer > 0) badgesHtml += `<span class="hud-power-chip chili">🌶️ ${p.chiliTimer.toFixed(1)}s</span>`;
    if (p.shieldHits > 0) badgesHtml += `<span class="hud-power-chip shield">🛡️ ×${p.shieldHits}</span>`;
    const pu = document.getElementById("hud-active-powerups");
    if (pu.innerHTML !== badgesHtml) pu.innerHTML = badgesHtml;

    document.getElementById("hud-timer").textContent = this.formatTime(this.gameTime);
    document.getElementById("hud-kills").textContent = this.kills;
    document.getElementById("hud-graze-count").textContent = this.grazeCount;

    const boss = this.enemies.find((e) => e.type === "harvester_boss");
    this.setBossBar(boss || null);
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  // ------------------------------------------------------------------ combat

  hitEnemy(e, dmg) {
    e.hp -= dmg;
    e.hitFlash = 0.08;
  }

  killEnemy(enemy) {
    const idx = this.enemies.indexOf(enemy);
    if (idx === -1) return;
    this.enemies.splice(idx, 1);
    this.kills++;

    const isBoss = enemy.type === "harvester_boss";
    this.particles.spawnDeathBurst(enemy.x, enemy.y, enemy.color, isBoss);
    this.particles.spawnFeatherPuff(enemy.x, enemy.y, isBoss ? 12 : 3);
    if (isBoss) {
      this.screenShake = 30;
      this.levelFlash = 0.7;
      this.input.vibrate([100, 50, 200]);
      if (window.gameAudio) window.gameAudio.playNuke();
      this.showBanner("🏆 BOSS DEFEATED!", "+250 EXP · NUKE DROPPED");
    }

    if (this.cornGems.length < this.maxGems) {
      this.cornGems.push(new window.CornGem(enemy.x, enemy.y, enemy.expValue));
    }

    const isFox = enemy.type === "fox";
    const dropRoll = Math.random();
    if (isBoss || isFox || dropRoll < (0.16 + this.player.breadDropBonus)) {
      if (this.specialItems.length < 12) {
        const itemPool = ["bread", "bread", "magnet", "freeze", "nuke", "coffee", "shield", "chili"];
        const itemType = isBoss ? "nuke" : itemPool[Math.floor(Math.random() * itemPool.length)];
        this.specialItems.push(new window.SpecialItem(enemy.x, enemy.y, itemType));
      }
    }

    if (this.player.vampirismLevel > 0) {
      const stealAmount = this.player.vampirismLevel * 3;
      const healed = this.player.heal(stealAmount);
      if (healed > 0) {
        if (window.gameAudio) window.gameAudio.playLifeSteal();
        this.particles.spawnFloatingText(this.player.x, this.player.y - 25, `+${stealAmount} HP 🩸`, "#FF007A", 12, true);
      }
    }
  }

  playerHurt() {
    this.damageFlash = 1;
    this.input.vibrate(35);
  }

  update(dt) {
    this.renderTime += dt;
    if (this.screenShake > 0) this.screenShake = Math.max(0, this.screenShake - dt * 25);
    if (this.damageFlash > 0) this.damageFlash = Math.max(0, this.damageFlash - dt * 2.5);
    if (this.levelFlash > 0) this.levelFlash = Math.max(0, this.levelFlash - dt * 1.5);
    if (!this.isEcoMode) this.ambient.update(dt, this.W, this.H);

    if (this.state === "GAMEOVER") {
      this.particles.update(dt);
      return;
    }
    if (this.state !== "PLAYING") return;

    this.gameTime += dt;
    this.wave = 1 + Math.floor(this.gameTime / 40);
    this.spawnInterval = Math.max(0.7, 2.0 - (this.wave * 0.12));

    if (this.timeFreezeTimer > 0) this.timeFreezeTimer -= dt;
    if (this.magnetTimer > 0) this.magnetTimer -= dt;

    const p = this.player;
    p.update(dt, this.input.getMoveVector(), this.W, this.H, this.particles, this.weapons, this.enemies);
    this.spawnEnemies(dt);

    const isFrozen = this.timeFreezeTimer > 0;

    // Feathers
    for (let i = this.weapons.feathers.length - 1; i >= 0; i--) {
      const feather = this.weapons.feathers[i];
      feather.update(dt);
      for (let j = 0; j < this.enemies.length; j++) {
        const e = this.enemies[j];
        const dx = e.x - feather.x;
        const dy = e.y - feather.y;
        if (dx * dx + dy * dy < (e.radius + 6) ** 2) {
          this.hitEnemy(e, feather.damage);
          this.particles.spawnSparks(feather.x, feather.y, "#00F0FF", 3, 2.5, 0.25);
          this.particles.spawnFloatingText(e.x, e.y - 10, `-${Math.round(feather.damage)}`, "#9FF8FF", 11);
          feather.isDead = true;
          if (e.hp <= 0) this.killEnemy(e);
          break;
        }
      }
      if (feather.isDead) this.weapons.feathers.splice(i, 1);
    }

    // Egg mines
    for (let i = this.weapons.eggs.length - 1; i >= 0; i--) {
      const egg = this.weapons.eggs[i];
      const exploded = egg.update(dt);

      let triggerNear = false;
      for (let j = 0; j < this.enemies.length; j++) {
        const e = this.enemies[j];
        const dx = e.x - egg.x;
        const dy = e.y - egg.y;
        if (dx * dx + dy * dy < (e.radius + egg.radius) ** 2) { triggerNear = true; break; }
      }

      if (exploded || triggerNear) {
        this.weapons.eggs.splice(i, 1);
        this.particles.spawnEggExplosion(egg.x, egg.y, 70);
        if (window.gameAudio) window.gameAudio.playEggBoom();
        this.screenShake = Math.max(this.screenShake, 10);

        const aoeRadiusSq = 90 * 90;
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const e = this.enemies[j];
          const dx = e.x - egg.x;
          const dy = e.y - egg.y;
          if (dx * dx + dy * dy < aoeRadiusSq) {
            this.hitEnemy(e, egg.damage);
            this.particles.spawnFloatingText(e.x, e.y - 15, `-${Math.round(egg.damage)}`, "#FF8800", 14, true);
            if (e.hp <= 0) this.killEnemy(e);
          }
        }
      }
    }

    // Orbiting butter knives
    if (p.butterKnifeLevel > 0) {
      const knifeDist = 42;
      const count = Math.min(3, p.butterKnifeLevel);
      for (let k = 0; k < count; k++) {
        const angle = p.knifeAngle + (k * (Math.PI * 2 / count));
        const kx = p.x + Math.cos(angle) * knifeDist;
        const ky = p.y + Math.sin(angle) * knifeDist;

        for (let b = this.enemyBullets.length - 1; b >= 0; b--) {
          const bul = this.enemyBullets[b];
          const bDx = bul.x - kx;
          const bDy = bul.y - ky;
          if (bDx * bDx + bDy * bDy < 196) {
            this.enemyBullets.splice(b, 1);
            this.particles.spawnSparks(kx, ky, "#FF007A", 2, 2, 0.2);
          }
        }

        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const e = this.enemies[j];
          const eDx = e.x - kx;
          const eDy = e.y - ky;
          if (eDx * eDx + eDy * eDy < (e.radius + 12) ** 2) {
            this.hitEnemy(e, 25 * p.damageMultiplier * dt * 4);
            if (e.hp <= 0) this.killEnemy(e);
          }
        }
      }
    }

    // Enemies & contact damage
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (!enemy) continue;
      enemy.update(dt, p.x, p.y, this.enemyBullets, isFrozen);

      const dx = p.x - enemy.x;
      const dy = p.y - enemy.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < (p.bodyRadius + enemy.radius) ** 2) {
        if (p.chiliTimer > 0) {
          this.hitEnemy(enemy, 60 * dt * 60);
          this.particles.spawnFloatingText(enemy.x, enemy.y - 10, "-BURN", "#FF5500", 11);
          if (enemy.hp <= 0) { this.killEnemy(enemy); continue; }
        }

        const damaged = p.takeDamage(15, this.particles);
        if (damaged) {
          this.screenShake = 12;
          this.playerHurt();
          this.particles.spawnFeatherPuff(p.x, p.y, 8);
          if (p.hp <= 0) { this.triggerGameOver(); return; }
        }
      }
    }

    // Enemy bullets
    if (this.enemyBullets.length > this.maxBullets) {
      this.enemyBullets.splice(0, this.enemyBullets.length - this.maxBullets);
    }

    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const b = this.enemyBullets[i];
      b.update(dt, isFrozen);

      const dx = p.x - b.x;
      const dy = p.y - b.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < (b.radius + p.hitboxRadius) ** 2) {
        this.enemyBullets.splice(i, 1);
        if (p.isDashing) {
          this.particles.spawnSparks(b.x, b.y, b.color, 3, 2);
          continue;
        }
        const damaged = p.takeDamage(18, this.particles);
        if (damaged) {
          this.screenShake = 14;
          this.playerHurt();
          this.particles.spawnFeatherPuff(p.x, p.y, 10);
          if (p.hp <= 0) { this.triggerGameOver(); return; }
        }
        continue;
      }

      if (!b.grazed && distSq < (b.radius + 20) ** 2) {
        b.grazed = true;
        this.grazeCount++;
        p.addExp(2);
        if (window.gameAudio) window.gameAudio.playGraze();
        this.particles.spawnSparks(b.x, b.y, "#FFE600", 2, 1.5, 0.25);
        this.particles.spawnFloatingText(b.x, b.y, "+GRAZE", "#FFE600", 10);
      }

      if (b.x < -40 || b.x > this.W + 40 || b.y < -40 || b.y > this.H + 40) {
        this.enemyBullets.splice(i, 1);
      }
    }

    // Corn gems
    const magnetOn = this.magnetTimer > 0;
    for (let i = this.cornGems.length - 1; i >= 0; i--) {
      const gem = this.cornGems[i];
      const radius = magnetOn && gem.magnetPull ? 99999 : p.pickupRadius;
      const collected = gem.update(dt, p.x, p.y, radius);
      if (collected) {
        if (window.gameAudio) window.gameAudio.playCornPickup();
        this.particles.spawnSparks(gem.x, gem.y, gem.color, 2, 1.5, 0.2);
        const levelUp = p.addExp(gem.value);
        this.cornGems.splice(i, 1);
        if (levelUp) { this.triggerLevelUp(); return; }
      }
    }
    if (!magnetOn) this.cornGems.forEach((g) => { g.magnetPull = false; });

    // Special items
    for (let i = this.specialItems.length - 1; i >= 0; i--) {
      const item = this.specialItems[i];
      if (item.update(dt, p.x, p.y, p.pickupRadius)) {
        this.specialItems.splice(i, 1);
        this.activateSpecialItem(item.type, item.x, item.y);
      }
    }

    this.particles.update(dt);

    this.hudUpdateTimer += dt;
    if (this.hudUpdateTimer >= 0.1) {
      this.hudUpdateTimer = 0;
      this.updateHUD();
    }
    this.cdUpdateTimer += dt;
    if (this.cdUpdateTimer >= 0.05) {
      this.cdUpdateTimer = 0;
      this.input.setCooldowns(
        Math.max(0, p.honkCooldownTimer / p.currentHonkCooldown),
        Math.max(0, p.dashCooldownTimer / p.dashCooldown)
      );
    }
  }

  // ------------------------------------------------------------------ render

  draw() {
    const ctx = this.ctx;
    const t = this.renderTime;
    const scale = this.dpr * this.viewScale;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.bgCanvas, 0, 0);

    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    if (this.screenShake > 0) {
      ctx.translate((Math.random() - 0.5) * this.screenShake, (Math.random() - 0.5) * this.screenShake);
    }

    if (!this.isEcoMode) this.ambient.draw(ctx, t);

    const inRun = this.state === "PLAYING" || this.state === "LEVEL_UP" || this.state === "PAUSED" || this.state === "GAMEOVER";
    if (inRun) {
      for (let i = 0; i < this.weapons.eggs.length; i++) this.weapons.eggs[i].draw(ctx, t);
      for (let i = 0; i < this.cornGems.length; i++) this.cornGems[i].draw(ctx, t);
      for (let i = 0; i < this.specialItems.length; i++) this.specialItems[i].draw(ctx, t);
      for (let i = 0; i < this.enemies.length; i++) this.enemies[i].draw(ctx, t);

      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < this.weapons.feathers.length; i++) this.weapons.feathers[i].draw(ctx);
      ctx.globalCompositeOperation = "source-over";

      if (this.player && this.state !== "GAMEOVER") this.player.draw(ctx, t);

      // bullets on top of everything so they're always readable
      for (let i = 0; i < this.enemyBullets.length; i++) this.enemyBullets[i].draw(ctx);

      this.particles.draw(ctx);
    } else {
      this.drawMenuBackdrop(ctx, t);
    }

    // full-screen tints
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.timeFreezeTimer > 0 && inRun) {
      ctx.fillStyle = `rgba(0, 200, 255, ${0.10 + 0.04 * Math.sin(t * 6)})`;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    if (this.levelFlash > 0) {
      ctx.fillStyle = `rgba(255, 240, 180, ${this.levelFlash * 0.25})`;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    const dmgEl = this._dmgEl || (this._dmgEl = document.getElementById("damage-flash"));
    if (dmgEl) {
      const o = this.damageFlash.toFixed(2);
      if (dmgEl._o !== o) { dmgEl.style.opacity = o; dmgEl._o = o; }
    }
  }

  /** A goose waddling in circles behind the start menu */
  drawMenuBackdrop(ctx, t) {
    if (!this._menuGoose) this._menuGoose = new window.GoosePlayer(this.W / 2, this.H / 2);
    const g = this._menuGoose;
    const r = Math.min(this.W, this.H) * 0.32;
    const a = t * 0.6;
    g.x = this.W / 2 + Math.cos(a) * r;
    g.y = this.H / 2 + Math.sin(a) * r * 0.6;
    g.facingAngle = a + Math.PI / 2;
    g.isMoving = true;
    g.waddleTime = t * 12;
    g.draw(ctx, t);
  }

  loop(currentTime) {
    const dt = Math.min(0.06, Math.max(0, (currentTime - this.lastFrameTime) / 1000));
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
