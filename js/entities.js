/**
 * Goose Survivor - Entities with Special Items, Power-Ups, and Buff States
 */

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
    this.facingAngle = 0;
    this.waddleTime = 0;

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
    this.coffeeTimer = 0;      // ☕ Espresso Hyper Speed & 3x Gatling
    this.chiliTimer = 0;       // 🌶️ Flaming Goose
    this.shieldHits = 0;       // 🛡️ Bubble Shield charges
    this.chiliParticleTimer = 0;
  }

  takeDamage(amount, particles) {
    if (this.isDashing || this.invulnerableTimer > 0) return false;

    // Shield Bubble absorbs hit!
    if (this.shieldHits > 0) {
      this.shieldHits--;
      this.invulnerableTimer = 0.5;
      if (particles) particles.spawnFeatherPuff(this.x, this.y, 8);
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
    if (particles) particles.spawnFeatherPuff(this.x, this.y, 10);
    if (window.gameAudio) window.gameAudio.playDash();
    return true;
  }

  triggerHonk(particles, enemies, enemyBullets) {
    if (this.honkCooldownTimer > 0) return false;
    this.honkCooldownTimer = this.honkCooldown * (this.megaHonkLevel > 0 ? 0.75 : 1.0);
    const honkRadius = 180 + this.megaHonkLevel * 50;

    if (particles) particles.spawnHonkWave(this.x, this.y, honkRadius);
    if (window.gameAudio) window.gameAudio.playHonk(1.0);

    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const b = enemyBullets[i];
      const dx = b.x - this.x;
      const dy = b.y - this.y;
      if (dx * dx + dy * dy < honkRadius * honkRadius) {
        enemyBullets.splice(i, 1);
        if (particles) particles.spawnFeatherPuff(b.x, b.y, 2);
      }
    }

    const honkRadiusSq = honkRadius * honkRadius;
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
        e.hp -= (60 + this.megaHonkLevel * 30) * this.damageMultiplier;
        if (particles) particles.spawnFloatingText(e.x, e.y - 15, `-${Math.round((60 + this.megaHonkLevel * 30) * this.damageMultiplier)}`, "#FFE600", 14, true);
      }
    }
    return true;
  }

  update(dt, inputKeys, canvasW, canvasH, particles, weaponsArray, enemies) {
    if (this.dashCooldownTimer > 0) this.dashCooldownTimer -= dt;
    if (this.honkCooldownTimer > 0) this.honkCooldownTimer -= dt;
    if (this.invulnerableTimer > 0) this.invulnerableTimer -= dt;

    // Power-up Timers
    if (this.coffeeTimer > 0) this.coffeeTimer -= dt;
    if (this.chiliTimer > 0) {
      this.chiliTimer -= dt;
      this.chiliParticleTimer += dt;
      if (this.chiliParticleTimer >= 0.08 && particles) {
        this.chiliParticleTimer = 0;
        particles.spawnEggExplosion(this.x, this.y, 15);
      }
    }

    // Movement speed (Doubled during Coffee Boost!)
    let currentSpeed = this.speed * (this.coffeeTimer > 0 ? 1.6 : 1.0);

    let moveX = 0;
    let moveY = 0;
    if (inputKeys["w"] || inputKeys["arrowup"]) moveY -= 1;
    if (inputKeys["s"] || inputKeys["arrowdown"]) moveY += 1;
    if (inputKeys["a"] || inputKeys["arrowleft"]) moveX -= 1;
    if (inputKeys["d"] || inputKeys["arrowright"]) moveX += 1;

    const len = Math.sqrt(moveX * moveX + moveY * moveY);
    if (len > 0) {
      moveX /= len;
      moveY /= len;
      this.facingAngle = Math.atan2(moveY, moveX);
      this.waddleTime += dt * (this.coffeeTimer > 0 ? 20 : 12);
    }

    if (this.isDashing) {
      this.dashTimer -= dt;
      const dashSpeed = currentSpeed * 2.8;
      this.x += Math.cos(this.facingAngle) * dashSpeed * dt * 60;
      this.y += Math.sin(this.facingAngle) * dashSpeed * dt * 60;
      if (this.dashTimer <= 0) {
        this.isDashing = false;
      }
    } else {
      this.x += moveX * currentSpeed * dt * 60;
      this.y += moveY * currentSpeed * dt * 60;
    }

    this.x = Math.max(25, Math.min(canvasW - 25, this.x));
    this.y = Math.max(25, Math.min(canvasH - 25, this.y));

    // Feather Gatling (3x rate during Coffee Boost!)
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
        if (dist < minDist) {
          minDist = dist;
          closest = e;
        }
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

    // Butter Knife
    if (this.butterKnifeLevel > 0) {
      this.knifeAngle += dt * (4.5 + this.butterKnifeLevel * 0.8);
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    if ((this.isDashing || this.invulnerableTimer > 0) && Math.floor(Date.now() / 60) % 2 === 0) {
      ctx.globalAlpha = 0.45;
    }

    // Flaming Chili Aura
    if (this.chiliTimer > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 68, 0, 0.35)";
      ctx.fill();
    }

    // Bubble Shield
    if (this.shieldHits > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.strokeStyle = "#00F0FF";
      ctx.lineWidth = 2;
      ctx.fillStyle = "rgba(0, 240, 255, 0.18)";
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 9px monospace";
      ctx.fillText(`🛡️${this.shieldHits}`, -8, -20);
    }

    const wobble = Math.sin(this.waddleTime) * 0.2;
    ctx.rotate(this.facingAngle + wobble);

    // Feet
    const footOffset = Math.sin(this.waddleTime) * 5;
    ctx.fillStyle = "#FF7700";
    ctx.beginPath();
    ctx.ellipse(-8, -12 + footOffset, 4.5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-8, 12 - footOffset, 4.5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = this.coffeeTimer > 0 ? "#FFE600" : "#FFFFFF";
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wings
    const wingFlap = Math.abs(Math.sin(this.waddleTime)) * 3;
    ctx.fillStyle = this.coffeeTimer > 0 ? "#FFD700" : "#EDEDED";
    ctx.beginPath();
    ctx.ellipse(-2, -10 - wingFlap, 9, 5, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-2, 10 + wingFlap, 9, 5, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = this.coffeeTimer > 0 ? "#FFE600" : "#FFFFFF";
    ctx.beginPath();
    ctx.ellipse(14, 0, 9, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = "#FF7700";
    ctx.beginPath();
    ctx.moveTo(21, -4);
    ctx.lineTo(29, 0);
    ctx.lineTo(21, 4);
    ctx.closePath();
    ctx.fill();

    // Eyes
    ctx.fillStyle = "#111111";
    ctx.beginPath();
    ctx.arc(16, -3, 2, 0, Math.PI * 2);
    ctx.arc(16, 3, 2, 0, Math.PI * 2);
    ctx.fill();

    // Core Hitbox Dot
    ctx.beginPath();
    ctx.arc(0, 0, this.hitboxRadius, 0, Math.PI * 2);
    ctx.fillStyle = "#00F0FF";
    ctx.fill();

    ctx.restore();

    // Orbiting Butter Knife
    if (this.butterKnifeLevel > 0) {
      const knifeDist = 42;
      const count = Math.min(3, this.butterKnifeLevel);
      for (let i = 0; i < count; i++) {
        const angle = this.knifeAngle + (i * (Math.PI * 2 / count));
        const kx = this.x + Math.cos(angle) * knifeDist;
        const ky = this.y + Math.sin(angle) * knifeDist;

        ctx.save();
        ctx.translate(kx, ky);
        ctx.rotate(angle + Math.PI / 2);
        ctx.fillStyle = "#E0F4FF";
        ctx.fillRect(-2, -14, 4, 20);
        ctx.fillStyle = "#8B4513";
        ctx.fillRect(-3, 6, 6, 8);
        ctx.restore();
      }
    }
  }
}

class Enemy {
  constructor(x, y, type = "farmer") {
    this.x = x;
    this.y = y;
    this.type = type;

    if (type === "farmer") {
      this.radius = 18;
      this.speed = 1.2;
      this.hp = 60;
      this.maxHp = 60;
      this.color = "#FF8800";
      this.shootCooldown = 2.4;
      this.shootTimer = Math.random() * 2.0;
      this.expValue = 12;
    } else if (type === "drone") {
      this.radius = 16;
      this.speed = 1.6;
      this.hp = 45;
      this.maxHp = 45;
      this.color = "#00F0FF";
      this.shootCooldown = 1.6;
      this.shootTimer = Math.random() * 1.5;
      this.expValue = 18;
    } else if (type === "fox") {
      this.radius = 20;
      this.speed = 2.2;
      this.hp = 90;
      this.maxHp = 90;
      this.color = "#FF1B44";
      this.shootCooldown = 3.0;
      this.shootTimer = 1.0;
      this.expValue = 25;
    } else if (type === "harvester_boss") {
      this.radius = 48;
      this.speed = 0.55;
      this.hp = 1800;
      this.maxHp = 1800;
      this.color = "#FF007A";
      this.shootCooldown = 0.8;
      this.shootTimer = 0;
      this.spiralAngle = 0;
      this.expValue = 250;
    }

    this.isDead = false;
  }

  update(dt, playerX, playerY, enemyBullets, isFrozen) {
    if (isFrozen) return; // Time Freeze active!

    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

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
        const angle = this.spiralAngle + (i * (Math.PI * 2 / count));
        enemyBullets.push(new EnemyBullet(this.x, this.y, angle, 2.8, "#FF007A", 6));
      }
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();

    if (this.hp < this.maxHp) {
      const barW = this.radius * 2;
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.fillRect(-barW / 2, -this.radius - 10, barW, 4);
      ctx.fillStyle = "#00FF66";
      ctx.fillRect(-barW / 2, -this.radius - 10, barW * (this.hp / this.maxHp), 4);
    }

    ctx.restore();
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
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.restore();
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
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.ellipse(0, 0, 9, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class EggMine {
  constructor(x, y, damage = 80) {
    this.x = x;
    this.y = y;
    this.damage = damage;
    this.fuse = 1.6;
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

  draw(ctx) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, this.radius, this.radius + 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#FFE600";
    ctx.fill();
    ctx.restore();
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
  }

  update(dt, playerX, playerY, pickupRadius) {
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

  draw(ctx) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.restore();
  }
}

/**
 * Universal Special Field Items / Power-Ups
 */
class SpecialItem {
  constructor(x, y, type = "bread") {
    this.x = x;
    this.y = y;
    this.type = type; // "bread", "magnet", "freeze", "nuke", "coffee", "shield", "chili", "crate"
    this.radius = type === "crate" ? 12 : 9;
    this.isCollected = false;

    this.icons = {
      bread: "🍞",
      magnet: "🧲",
      freeze: "⏱️",
      nuke: "💣",
      coffee: "☕",
      shield: "🛡️",
      chili: "🌶️",
      crate: "🎁"
    };

    this.colors = {
      bread: "#00FF66",
      magnet: "#B829FF",
      freeze: "#00F0FF",
      nuke: "#FF1B44",
      coffee: "#FFE600",
      shield: "#00F0FF",
      chili: "#FF5500",
      crate: "#FFE600"
    };
  }

  update(dt, playerX, playerY, pickupRadius) {
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const distSq = dx * dx + dy * dy;

    if (distSq < 484) { // 22^2
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

  draw(ctx) {
    ctx.save();
    const color = this.colors[this.type] || "#FFFFFF";
    const icon = this.icons[this.type] || "⭐";

    // Aura ring
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius + 3, 0, Math.PI * 2);
    ctx.fillStyle = color + "44";
    ctx.fill();

    // Box / Circle
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = "#091910";
    ctx.fill();
    ctx.stroke();

    // Emoji
    ctx.font = `bold ${this.radius + 1}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(icon, this.x, this.y + 1);

    ctx.restore();
  }
}

window.GoosePlayer = GoosePlayer;
window.Enemy = Enemy;
window.EnemyBullet = EnemyBullet;
window.PlayerFeather = PlayerFeather;
window.EggMine = EggMine;
window.CornGem = CornGem;
window.SpecialItem = SpecialItem;
