/**
 * Goose Survivor - Entities (Player, Enemies, Bullets, Weapons, Pickups)
 * Gameplay values are unchanged from v1; rendering now uses the pre-rendered sprite cache.
 */

const TAU = Math.PI * 2;

class GoosePlayer {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.bodyRadius = 16;
    this.hitboxRadius = 4;

    this.vx = 0;
    this.vy = 0;
    this.baseSpeed = 3.6;
    this.speed = 3.6;
    this.facingAngle = -Math.PI / 2;
    this.waddleTime = 0;
    this.isMoving = false;

    this.maxHp = 100;
    this.hp = 100;
    this.level = 1;
    this.exp = 0;
    this.expToNextLevel = 50;
    this.damageMultiplier = 1.0;
    this.pickupRadius = 120;
    this.grazeCount = 0;

    // Dash & Honk
    this.dashCooldown = 1.0;
    this.dashCooldownTimer = 0;
    this.dashDuration = 0.22;
    this.dashTimer = 0;
    this.isDashing = false;
    this.invulnerableTimer = 0;

    this.honkCooldown = 2.5;
    this.honkCooldownTimer = 0;
    this.honkAnim = 0; // beak-open animation

    // Weapons
    this.featherGatlingLevel = 1;
    this.eggMineLevel = 0;
    this.butterKnifeLevel = 0;
    this.megaHonkLevel = 0;
    this.vampirismLevel = 0;
    this.breadDropBonus = 0;

    this.featherTimer = 0;
    this.eggTimer = 0;
    this.knifeAngle = 0;

    // Special Item Active Power-Ups
    this.coffeeTimer = 0;
    this.chiliTimer = 0;
    this.shieldHits = 0;
    this.chiliParticleTimer = 0;

    // Dash afterimages
    this.trail = [];
    this.trailTimer = 0;
  }

  get currentHonkCooldown() {
    return this.honkCooldown * (this.megaHonkLevel > 0 ? 0.75 : 1.0);
  }

  takeDamage(amount, particles) {
    if (this.isDashing || this.invulnerableTimer > 0) return false;

    if (this.shieldHits > 0) {
      this.shieldHits--;
      this.invulnerableTimer = 0.5;
      if (particles) particles.spawnShockRing(this.x, this.y, "#00F0FF", 40);
      if (window.gameAudio) window.gameAudio.playDash();
      return false;
    }

    this.hp = Math.max(0, this.hp - amount);
    this.invulnerableTimer = 0.6;
    if (window.gameAudio) window.gameAudio.playHurt();
    return true;
  }

  heal(amount) {
    const prev = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    return this.hp - prev;
  }

  addExp(amount) {
    this.exp += amount;
    if (this.exp >= this.expToNextLevel) {
      this.exp -= this.expToNextLevel;
      this.level++;
      this.expToNextLevel = Math.round(this.expToNextLevel * 1.4);
      return true;
    }
    return false;
  }

  triggerDash(particles) {
    if (this.dashCooldownTimer > 0) return false;
    this.isDashing = true;
    this.dashTimer = this.dashDuration;
    this.dashCooldownTimer = this.dashCooldown;
    if (particles) particles.spawnFeatherPuff(this.x, this.y, 8);
    if (window.gameAudio) window.gameAudio.playDash();
    return true;
  }

  triggerHonk(particles, enemies, enemyBullets) {
    if (this.honkCooldownTimer > 0) return false;
    this.honkCooldownTimer = this.currentHonkCooldown;
    this.honkAnim = 0.35;
    const honkRadius = 180 + this.megaHonkLevel * 50;

    if (particles) particles.spawnHonkWave(this.x, this.y, honkRadius);
    if (window.gameAudio) window.gameAudio.playHonk(1.0);

    const honkRadiusSq = honkRadius * honkRadius;
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const b = enemyBullets[i];
      const dx = b.x - this.x;
      const dy = b.y - this.y;
      if (dx * dx + dy * dy < honkRadiusSq) {
        enemyBullets.splice(i, 1);
        if (particles) particles.spawnSparks(b.x, b.y, b.color, 2, 2);
      }
    }

    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      const dx = e.x - this.x;
      const dy = e.y - this.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < honkRadiusSq) {
        const dist = Math.sqrt(distSq);
        const knock = 18;
        e.x += (dx / Math.max(1, dist)) * knock;
        e.y += (dy / Math.max(1, dist)) * knock;
        const dmg = (60 + this.megaHonkLevel * 30) * this.damageMultiplier;
        e.hp -= dmg;
        e.hitFlash = 0.12;
        if (particles) particles.spawnFloatingText(e.x, e.y - 15, `-${Math.round(dmg)}`, "#FFE600", 14, true);
      }
    }
    return true;
  }

  /**
   * @param input {x, y} analog move vector, magnitude 0..1 (keyboard gives unit vectors)
   */
  update(dt, input, worldW, worldH, particles, weaponsArray, enemies) {
    if (this.dashCooldownTimer > 0) this.dashCooldownTimer -= dt;
    if (this.honkCooldownTimer > 0) this.honkCooldownTimer -= dt;
    if (this.invulnerableTimer > 0) this.invulnerableTimer -= dt;
    if (this.honkAnim > 0) this.honkAnim -= dt;

    if (this.coffeeTimer > 0) this.coffeeTimer -= dt;
    if (this.chiliTimer > 0) {
      this.chiliTimer -= dt;
      this.chiliParticleTimer += dt;
      if (this.chiliParticleTimer >= 0.05 && particles) {
        this.chiliParticleTimer = 0;
        particles.spawnFlame(this.x, this.y);
      }
    }

    const currentSpeed = this.speed * (this.coffeeTimer > 0 ? 1.6 : 1.0);

    let moveX = input.x || 0;
    let moveY = input.y || 0;
    let mag = Math.sqrt(moveX * moveX + moveY * moveY);
    if (mag > 1) { moveX /= mag; moveY /= mag; mag = 1; }

    this.isMoving = mag > 0.05;
    if (this.isMoving) {
      // smooth turning so the goose doesn't snap
      const target = Math.atan2(moveY, moveX);
      let diff = target - this.facingAngle;
      while (diff > Math.PI) diff -= TAU;
      while (diff < -Math.PI) diff += TAU;
      this.facingAngle += diff * Math.min(1, dt * 18);
      this.waddleTime += dt * (this.coffeeTimer > 0 ? 20 : 12) * Math.max(0.5, mag);
    }

    if (this.isDashing) {
      this.dashTimer -= dt;
      const dashAngle = this.isMoving ? Math.atan2(moveY, moveX) : this.facingAngle;
      const dashSpeed = currentSpeed * 2.8;
      this.x += Math.cos(dashAngle) * dashSpeed * dt * 60;
      this.y += Math.sin(dashAngle) * dashSpeed * dt * 60;
      this.trailTimer += dt;
      if (this.trailTimer > 0.025) {
        this.trailTimer = 0;
        this.trail.push({ x: this.x, y: this.y, a: this.facingAngle, life: 0.25 });
      }
      if (this.dashTimer <= 0) this.isDashing = false;
    } else {
      this.x += moveX * currentSpeed * dt * 60;
      this.y += moveY * currentSpeed * dt * 60;
    }

    for (let i = this.trail.length - 1; i >= 0; i--) {
      this.trail[i].life -= dt;
      if (this.trail[i].life <= 0) this.trail.splice(i, 1);
    }

    this.x = Math.max(25, Math.min(worldW - 25, this.x));
    this.y = Math.max(25, Math.min(worldH - 25, this.y));

    // Feather Gatling
    this.featherTimer += dt;
    let featherInterval = Math.max(0.18, 0.45 - (this.featherGatlingLevel * 0.06));
    if (this.coffeeTimer > 0) featherInterval = 0.10;

    if (this.featherTimer >= featherInterval && enemies.length > 0) {
      this.featherTimer = 0;
      const count = this.coffeeTimer > 0 ? 6 : Math.min(4, this.featherGatlingLevel);
      let closest = enemies[0];
      let minDist = Infinity;
      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        const dist = (e.x - this.x) ** 2 + (e.y - this.y) ** 2;
        if (dist < minDist) { minDist = dist; closest = e; }
      }

      for (let i = 0; i < count; i++) {
        const spread = (i - (count - 1) / 2) * 0.12;
        const angle = Math.atan2(closest.y - this.y, closest.x - this.x) + spread;
        weaponsArray.feathers.push(new PlayerFeather(this.x, this.y, angle, 30 * this.damageMultiplier));
      }
      if (window.gameAudio) window.gameAudio.playFeatherShot();
    }

    // Egg Mines
    if (this.eggMineLevel > 0) {
      this.eggTimer += dt;
      const eggInterval = Math.max(0.8, 2.0 - this.eggMineLevel * 0.3);
      if (this.eggTimer >= eggInterval) {
        this.eggTimer = 0;
        weaponsArray.eggs.push(new EggMine(this.x, this.y, 80 * this.damageMultiplier));
      }
    }

    if (this.butterKnifeLevel > 0) {
      this.knifeAngle += dt * (4.5 + this.butterKnifeLevel * 0.8);
    }
  }

  drawGooseBody(ctx, golden, alpha = 1) {
    const w = this.waddleTime;
    const bodyCol = golden ? "#FFE15A" : "#FFFFFF";
    const shadeCol = golden ? "#E0A800" : "#C9D6DF";
    const wingCol = golden ? "#FFD000" : "#E6EEF3";
    const outline = "rgba(20, 30, 40, 0.55)";

    ctx.globalAlpha = alpha;

    // Feet
    const footOffset = this.isMoving ? Math.sin(w) * 5 : 0;
    ctx.fillStyle = "#FF8A1C";
    ctx.beginPath(); ctx.ellipse(-6 + footOffset, -8, 5, 3, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-6 - footOffset, 8, 5, 3, 0, 0, TAU); ctx.fill();

    // Tail feathers
    ctx.fillStyle = shadeCol;
    ctx.beginPath();
    ctx.moveTo(-14, 0); ctx.lineTo(-23, -5); ctx.lineTo(-21, 0); ctx.lineTo(-23, 5); ctx.closePath();
    ctx.fill();

    // Body with shading
    const grd = ctx.createRadialGradient(-2, -4, 2, 0, 0, 17);
    grd.addColorStop(0, bodyCol);
    grd.addColorStop(1, shadeCol);
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.ellipse(0, 0, 16, 12, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = outline; ctx.lineWidth = 1.2; ctx.stroke();

    // Wings (flap faster when dashing)
    const flap = this.isDashing ? 6 : Math.abs(Math.sin(w)) * 3;
    ctx.fillStyle = wingCol;
    ctx.beginPath(); ctx.ellipse(-3, -9 - flap, 10, 4.5, -0.35 - flap * 0.04, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(-3, 9 + flap, 10, 4.5, 0.35 + flap * 0.04, 0, TAU); ctx.fill(); ctx.stroke();

    // Neck + head
    const bob = this.isMoving ? Math.sin(w * 2) * 1.2 : 0;
    ctx.fillStyle = bodyCol;
    ctx.beginPath(); ctx.ellipse(10, 0, 6, 5, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(16 + bob, 0, 8, 7, 0, 0, TAU); ctx.fill(); ctx.stroke();

    // Beak (opens when honking)
    const open = this.honkAnim > 0 ? 3.5 : 0;
    ctx.fillStyle = "#FF8A1C";
    ctx.beginPath();
    ctx.moveTo(22 + bob, -3.5 - open * 0.5); ctx.lineTo(31 + bob, -open); ctx.lineTo(22 + bob, 0); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(22 + bob, 0); ctx.lineTo(31 + bob, open); ctx.lineTo(22 + bob, 3.5 + open * 0.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#C25A00";
    ctx.fillRect(22 + bob, -0.5, 7, 1);

    // Angry eyes
    ctx.fillStyle = "#111";
    ctx.beginPath(); ctx.arc(18 + bob, -3.2, 1.9, 0, TAU); ctx.arc(18 + bob, 3.2, 1.9, 0, TAU); ctx.fill();
    ctx.fillStyle = "#FFF";
    ctx.beginPath(); ctx.arc(18.6 + bob, -3.7, 0.6, 0, TAU); ctx.arc(18.6 + bob, 2.7, 0.6, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#111"; ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(15.5 + bob, -6); ctx.lineTo(20 + bob, -4.3);
    ctx.moveTo(15.5 + bob, 6); ctx.lineTo(20 + bob, 4.3);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  draw(ctx, time) {
    const S = window.Sprites;
    const golden = this.coffeeTimer > 0;

    // Dash afterimages
    for (let i = 0; i < this.trail.length; i++) {
      const t = this.trail[i];
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(t.a);
      ctx.globalCompositeOperation = "lighter";
      S.draw(ctx, S.softGlow("#00F0FF", 22), 0, 0);
      ctx.restore();
    }

    // Shadow
    S.draw(ctx, S.shadow(18), this.x + 2, this.y + 10);

    // Pickup radius hint (very faint)
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.pickupRadius, 0, TAU);
    ctx.strokeStyle = "rgba(255, 230, 0, 0.05)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Chili flame aura
    if (this.chiliTimer > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const pulse = 1 + Math.sin(time * 18) * 0.08;
      S.draw(ctx, S.softGlow("#FF5500", 34), this.x, this.y, 0, pulse);
      ctx.restore();
    }
    if (golden) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      S.draw(ctx, S.softGlow("#FFE600", 30), this.x, this.y, 0, 1 + Math.sin(time * 12) * 0.06);
      ctx.restore();
    }

    ctx.save();
    ctx.translate(this.x, this.y);

    const blinking = (this.isDashing || this.invulnerableTimer > 0) && Math.floor(time * 16) % 2 === 0;
    const wobble = this.isMoving ? Math.sin(this.waddleTime) * 0.16 : 0;
    ctx.rotate(this.facingAngle + wobble);
    this.drawGooseBody(ctx, golden, blinking ? 0.45 : 1);
    ctx.restore();

    // Bubble shield
    if (this.shieldHits > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(this.x, this.y, 27, 0, TAU);
      const grd = ctx.createRadialGradient(this.x - 8, this.y - 10, 2, this.x, this.y, 27);
      grd.addColorStop(0, "rgba(255,255,255,0.35)");
      grd.addColorStop(0.6, "rgba(0,240,255,0.08)");
      grd.addColorStop(1, "rgba(0,240,255,0.32)");
      ctx.fillStyle = grd;
      ctx.fill();
      ctx.strokeStyle = "rgba(0, 240, 255, 0.85)";
      ctx.lineWidth = 1.6;
      ctx.stroke();
      for (let i = 0; i < this.shieldHits; i++) {
        const a = time * 2 + (i * TAU) / 3;
        S.draw(ctx, S.glow("#00F0FF", 2.5), this.x + Math.cos(a) * 27, this.y + Math.sin(a) * 27);
      }
      ctx.restore();
    }

    // Touhou core hitbox
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    S.draw(ctx, S.glow("#00F0FF", this.hitboxRadius), this.x, this.y, 0, 0.9 + Math.sin(time * 10) * 0.1);
    ctx.restore();

    // Orbiting butter knives
    if (this.butterKnifeLevel > 0) {
      const knifeDist = 42;
      const count = Math.min(3, this.butterKnifeLevel);
      const sprite = S.knife();
      for (let i = 0; i < count; i++) {
        const angle = this.knifeAngle + (i * (TAU / count));
        const kx = this.x + Math.cos(angle) * knifeDist;
        const ky = this.y + Math.sin(angle) * knifeDist;
        S.draw(ctx, sprite, kx, ky, angle + Math.PI);
      }
    }
  }
}

class Enemy {
  constructor(x, y, type = "farmer") {
    this.x = x;
    this.y = y;
    this.type = type;
    this.age = 0;
    this.hitFlash = 0;
    this.facing = 0;
    this.seed = Math.random() * 100;

    if (type === "farmer") {
      this.radius = 18; this.speed = 1.2; this.hp = 60; this.maxHp = 60;
      this.color = "#FF8800"; this.shootCooldown = 2.4; this.shootTimer = Math.random() * 2.0; this.expValue = 12;
    } else if (type === "drone") {
      this.radius = 16; this.speed = 1.6; this.hp = 45; this.maxHp = 45;
      this.color = "#00F0FF"; this.shootCooldown = 1.6; this.shootTimer = Math.random() * 1.5; this.expValue = 18;
    } else if (type === "fox") {
      this.radius = 20; this.speed = 2.2; this.hp = 90; this.maxHp = 90;
      this.color = "#FF1B44"; this.shootCooldown = 3.0; this.shootTimer = 1.0; this.expValue = 25;
    } else if (type === "harvester_boss") {
      this.radius = 48; this.speed = 0.55; this.hp = 1800; this.maxHp = 1800;
      this.color = "#FF007A"; this.shootCooldown = 0.8; this.shootTimer = 0; this.spiralAngle = 0; this.expValue = 250;
    }

    this.isDead = false;
  }

  update(dt, playerX, playerY, enemyBullets, isFrozen) {
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (isFrozen) return;
    this.age += dt;

    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const target = Math.atan2(dy, dx);
    let diff = target - this.facing;
    while (diff > Math.PI) diff -= TAU;
    while (diff < -Math.PI) diff += TAU;
    this.facing += diff * Math.min(1, dt * (this.type === "harvester_boss" ? 1.5 : 8));

    if (this.type !== "harvester_boss") {
      if (dist > 120 || this.type === "fox") {
        this.x += (dx / Math.max(1, dist)) * this.speed * dt * 60;
        this.y += (dy / Math.max(1, dist)) * this.speed * dt * 60;
      }
    } else {
      this.x += (dx / Math.max(1, dist)) * this.speed * dt * 60;
      this.y += (dy / Math.max(1, dist)) * this.speed * dt * 60;
    }

    this.shootTimer += dt;
    if (this.shootTimer >= this.shootCooldown) {
      this.shootTimer = 0;
      this.shootBulletPattern(playerX, playerY, enemyBullets);
    }
  }

  shootBulletPattern(playerX, playerY, enemyBullets) {
    const baseAngle = Math.atan2(playerY - this.y, playerX - this.x);

    if (this.type === "farmer") {
      [-0.25, 0, 0.25].forEach(offset => {
        enemyBullets.push(new EnemyBullet(this.x, this.y, baseAngle + offset, 3.2, "#FF8800", 5));
      });
    } else if (this.type === "drone") {
      enemyBullets.push(new EnemyBullet(this.x, this.y, baseAngle, 4.5, "#00F0FF", 5));
    } else if (this.type === "fox") {
      [-0.4, -0.2, 0, 0.2, 0.4].forEach(offset => {
        enemyBullets.push(new EnemyBullet(this.x, this.y, baseAngle + offset, 3.8, "#FF1B44", 6));
      });
    } else if (this.type === "harvester_boss") {
      this.spiralAngle += 0.35;
      const count = 10;
      for (let i = 0; i < count; i++) {
        const angle = this.spiralAngle + (i * (TAU / count));
        enemyBullets.push(new EnemyBullet(this.x, this.y, angle, 2.8, "#FF007A", 6));
      }
    }
  }

  sprite() {
    const S = window.Sprites;
    switch (this.type) {
      case "drone": return ["enemy_drone", S.drone()];
      case "fox": return ["enemy_fox", S.fox()];
      case "harvester_boss": return ["enemy_harvester", S.harvester()];
      default: return ["enemy_farmer", S.farmer()];
    }
  }

  draw(ctx, time) {
    const S = window.Sprites;
    const [key, spr] = this.sprite();
    const spawnScale = Math.min(1, 0.4 + this.age * 3);

    S.draw(ctx, S.shadow(this.radius), this.x + 3, this.y + this.radius * 0.6);

    let bob = 0;
    if (this.type === "drone") bob = Math.sin(time * 5 + this.seed) * 2.5;

    const sprite = this.hitFlash > 0 ? S.flashOf(key, spr) : spr;
    S.draw(ctx, sprite, this.x, this.y + bob - (this.type === "drone" ? 4 : 0), this.facing, spawnScale);

    // animated details
    if (this.type === "drone") {
      ctx.save();
      ctx.strokeStyle = "rgba(220, 250, 255, 0.55)";
      ctx.lineWidth = 1.4;
      const spin = time * 40 + this.seed;
      const cos = Math.cos(this.facing), sin = Math.sin(this.facing);
      [[-15, -15], [15, 15], [-15, 15], [15, -15]].forEach(([ox, oy], i) => {
        const rx = this.x + (ox * cos - oy * sin) * spawnScale;
        const ry = this.y + bob - 4 + (ox * sin + oy * cos) * spawnScale;
        const a = spin * (i % 2 ? 1 : -1);
        ctx.beginPath();
        ctx.moveTo(rx - Math.cos(a) * 7, ry - Math.sin(a) * 7);
        ctx.lineTo(rx + Math.cos(a) * 7, ry + Math.sin(a) * 7);
        ctx.stroke();
      });
      ctx.restore();
    } else if (this.type === "harvester_boss") {
      // spinning reel at the front
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.facing);
      const reelX = 54;
      ctx.fillStyle = "#3A0B22";
      ctx.fillRect(reelX - 5, -60, 10, 120);
      ctx.strokeStyle = "#FFB3D6";
      ctx.lineWidth = 2;
      const phase = (time * 60) % 12;
      for (let y = -60 + phase; y < 60; y += 12) {
        ctx.beginPath(); ctx.moveTo(reelX - 6, y); ctx.lineTo(reelX + 6, y + 5); ctx.stroke();
      }
      ctx.restore();
    }

    // HP bar (not for boss: boss uses the big HUD bar)
    if (this.hp < this.maxHp && this.type !== "harvester_boss") {
      const barW = this.radius * 2;
      const y = this.y - this.radius - 12;
      ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
      ctx.fillRect(this.x - barW / 2 - 1, y - 1, barW + 2, 5);
      const pct = Math.max(0, this.hp / this.maxHp);
      ctx.fillStyle = pct > 0.5 ? "#00FF66" : pct > 0.25 ? "#FFE600" : "#FF1B44";
      ctx.fillRect(this.x - barW / 2, y, barW * pct, 3);
    }
  }
}

class EnemyBullet {
  constructor(x, y, angle, speed, color = "#FF007A", radius = 5) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.color = color;
    this.radius = radius;
    this.isDead = false;
    this.grazed = false;
  }

  update(dt, isFrozen) {
    if (isFrozen) return;
    this.x += this.vx * dt * 60;
    this.y += this.vy * dt * 60;
  }

  draw(ctx) {
    const S = window.Sprites;
    S.draw(ctx, S.glow(this.color, this.radius), this.x, this.y);
  }
}

class PlayerFeather {
  constructor(x, y, angle, damage = 30) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = 14;
    this.vx = Math.cos(angle) * this.speed;
    this.vy = Math.sin(angle) * this.speed;
    this.damage = damage;
    this.isDead = false;
    this.life = 1.0;
  }

  update(dt) {
    this.x += this.vx * dt * 60;
    this.y += this.vy * dt * 60;
    this.life -= dt;
    if (this.life <= 0) this.isDead = true;
  }

  draw(ctx) {
    const S = window.Sprites;
    S.draw(ctx, S.feather(), this.x, this.y, this.angle);
  }
}

class EggMine {
  constructor(x, y, damage = 80) {
    this.x = x;
    this.y = y;
    this.damage = damage;
    this.fuse = 1.6;
    this.maxFuse = 1.6;
    this.radius = 8;
    this.isDead = false;
  }

  update(dt) {
    this.fuse -= dt;
    if (this.fuse <= 0) {
      this.isDead = true;
      return true;
    }
    return false;
  }

  draw(ctx, time) {
    const S = window.Sprites;
    const t = 1 - this.fuse / this.maxFuse;
    // blast radius warning
    ctx.beginPath();
    ctx.arc(this.x, this.y, 90 * Math.min(1, t * 1.3), 0, TAU);
    ctx.strokeStyle = `rgba(255, 136, 0, ${0.08 + t * 0.22})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const wobble = Math.sin(time * (10 + t * 30)) * 0.15 * t;
    S.draw(ctx, S.egg(), this.x, this.y, wobble);

    // blinking fuse light: speeds up as it gets close
    const blinkRate = 4 + t * 20;
    if (Math.sin(time * blinkRate * Math.PI) > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      S.draw(ctx, S.glow("#FF1B44", 2.2), this.x, this.y - 9);
      ctx.restore();
    }
  }
}

class CornGem {
  constructor(x, y, value = 15) {
    this.x = x;
    this.y = y;
    this.value = value;
    this.radius = 4.5;
    this.color = value >= 100 ? "#FF007A" : value >= 50 ? "#00F0FF" : "#FFE600";
    this.isCollected = false;
    this.seed = Math.random() * TAU;
    // little pop-out when dropped
    const a = Math.random() * TAU;
    const s = 1.5 + Math.random() * 2;
    this.popVx = Math.cos(a) * s;
    this.popVy = Math.sin(a) * s;
  }

  update(dt, playerX, playerY, pickupRadius) {
    if (this.popVx || this.popVy) {
      this.x += this.popVx * dt * 60;
      this.y += this.popVy * dt * 60;
      this.popVx *= 0.86; this.popVy *= 0.86;
      if (Math.abs(this.popVx) + Math.abs(this.popVy) < 0.05) { this.popVx = 0; this.popVy = 0; }
    }

    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const distSq = dx * dx + dy * dy;

    if (distSq < 324) {
      this.isCollected = true;
      return true;
    }

    const radiusSq = pickupRadius * pickupRadius;
    if (distSq < radiusSq) {
      const dist = Math.sqrt(distSq);
      const spd = 12 * (1 - dist / pickupRadius) + 4;
      this.x += (dx / dist) * spd * dt * 60;
      this.y += (dy / dist) * spd * dt * 60;
    }
    return false;
  }

  draw(ctx, time) {
    const S = window.Sprites;
    const bob = Math.sin(time * 4 + this.seed) * 1.5;
    S.draw(ctx, S.corn(this.color), this.x, this.y + bob, Math.sin(time * 2 + this.seed) * 0.4);
  }
}

class SpecialItem {
  constructor(x, y, type = "bread") {
    this.x = x;
    this.y = y;
    this.type = type;
    this.radius = type === "crate" ? 12 : 9;
    this.isCollected = false;
    this.seed = Math.random() * TAU;
  }

  update(dt, playerX, playerY, pickupRadius) {
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const distSq = dx * dx + dy * dy;

    if (distSq < 484) {
      this.isCollected = true;
      return true;
    }

    const radiusSq = pickupRadius * pickupRadius;
    if (distSq < radiusSq) {
      const dist = Math.sqrt(distSq);
      const spd = 10 * (1 - dist / pickupRadius) + 3;
      this.x += (dx / dist) * spd * dt * 60;
      this.y += (dy / dist) * spd * dt * 60;
    }
    return false;
  }

  draw(ctx, time) {
    const S = window.Sprites;
    const color = SpecialItem.COLORS[this.type] || "#FFFFFF";
    const icon = SpecialItem.ICONS[this.type] || "⭐";
    const bob = Math.sin(time * 3 + this.seed) * 3;

    S.draw(ctx, S.shadow(10), this.x, this.y + 12);

    // rotating dashed ring
    ctx.save();
    ctx.translate(this.x, this.y + bob);
    ctx.rotate(time * 1.5 + this.seed);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.arc(0, 0, this.radius + 7, 0, TAU);
    ctx.stroke();
    ctx.restore();

    const pulse = 1 + Math.sin(time * 5 + this.seed) * 0.06;
    S.draw(ctx, S.item(this.type, color, icon), this.x, this.y + bob, 0, pulse);
  }
}

SpecialItem.ICONS = {
  bread: "🍞", magnet: "🧲", freeze: "⏱️", nuke: "💣",
  coffee: "☕", shield: "🛡️", chili: "🌶️", crate: "🎁"
};
SpecialItem.COLORS = {
  bread: "#00FF66", magnet: "#B829FF", freeze: "#00F0FF", nuke: "#FF1B44",
  coffee: "#FFE600", shield: "#00F0FF", chili: "#FF5500", crate: "#FFE600"
};

window.GoosePlayer = GoosePlayer;
window.Enemy = Enemy;
window.EnemyBullet = EnemyBullet;
window.PlayerFeather = PlayerFeather;
window.EggMine = EggMine;
window.CornGem = CornGem;
window.SpecialItem = SpecialItem;
