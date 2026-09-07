/**
 * Goose Survivor - Optimized Particle Engine
 * Ultra-lightweight particle calculations (Zero expensive shadowBlur, capped pool for silent fan & low CPU).
 */

class Particle {
  constructor(x, y, vx, vy, color, size, life = 0.6, type = "spark") {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.size = size;
    this.initialSize = size;
    this.life = life;
    this.maxLife = life;
    this.type = type;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotSpeed = (Math.random() - 0.5) * 4;
  }

  update(dt) {
    this.x += this.vx * dt * 60;
    this.y += this.vy * dt * 60;

    if (this.type === "feather") {
      this.vx *= 0.92;
      this.vy += 0.06;
      this.rotation += this.rotSpeed * dt;
    } else if (this.type === "ring") {
      this.size += dt * 160;
    } else {
      this.vx *= 0.94;
      this.vy *= 0.94;
    }

    this.life -= dt;
  }

  draw(ctx) {
    const alpha = Math.max(0, this.life / this.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;

    if (this.type === "feather") {
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.ellipse(0, 0, this.size * 1.8, this.size * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === "ring") {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(this.x, this.y, Math.max(0.5, this.size * alpha), 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.fill();
    }

    ctx.restore();
  }
}

class FloatingText {
  constructor(x, y, text, color = "#FFFFFF", size = 12, isCrit = false) {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.size = size;
    this.isCrit = isCrit;
    this.vy = -1.6;
    this.vx = (Math.random() - 0.5) * 1.2;
    this.life = 0.65;
    this.maxLife = 0.65;
  }

  update(dt) {
    this.x += this.vx * dt * 60;
    this.y += this.vy * dt * 60;
    this.vy *= 0.94;
    this.life -= dt;
  }

  draw(ctx) {
    const alpha = Math.max(0, this.life / this.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `bold ${this.size}px monospace`;
    ctx.fillStyle = this.color;
    ctx.textAlign = "center";
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}

class ParticleSystem {
  constructor() {
    this.particles = [];
    this.floatingTexts = [];
    this.maxParticles = 35; // Strict cap to keep CPU/GPU cold & quiet
    this.maxTexts = 15;
  }

  spawnFeatherPuff(x, y, count = 6) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;
      const angle = Math.random() * Math.PI * 2;
      const spd = 1.2 + Math.random() * 2.5;
      this.particles.push(new Particle(x, y, Math.cos(angle) * spd, Math.sin(angle) * spd, "#FFFFFF", 3 + Math.random() * 2, 0.45 + Math.random() * 0.3, "feather"));
    }
  }

  spawnHonkWave(x, y, radius = 100) {
    this.particles.push(new Particle(x, y, 0, 0, "#00F0FF", 8, 0.3, "ring"));
    this.spawnFloatingText(x, y - 25, "📢 HONK!", "#FFE600", 16, true);
  }

  spawnEggExplosion(x, y, radius = 60) {
    this.particles.push(new Particle(x, y, 0, 0, "#FFB000", 8, 0.3, "ring"));
    const count = 12;
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;
      const angle = Math.random() * Math.PI * 2;
      const spd = 2 + Math.random() * 4.5;
      const color = Math.random() > 0.4 ? "#FFE600" : "#FF5500";
      this.particles.push(new Particle(x, y, Math.cos(angle) * spd, Math.sin(angle) * spd, color, 3 + Math.random() * 2, 0.35, "spark"));
    }
  }

  spawnFloatingText(x, y, text, color = "#FFFFFF", size = 12, isCrit = false) {
    if (this.floatingTexts.length >= this.maxTexts) {
      this.floatingTexts.shift();
    }
    this.floatingTexts.push(new FloatingText(x, y, text, color, size, isCrit));
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.update(dt);
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.update(dt);
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  draw(ctx) {
    for (let i = 0; i < this.particles.length; i++) {
      this.particles[i].draw(ctx);
    }
    for (let i = 0; i < this.floatingTexts.length; i++) {
      this.floatingTexts[i].draw(ctx);
    }
  }
}

window.ParticleSystem = ParticleSystem;
