/**
 * Goose Survivor - Particle & FX Engine v2
 * Additive glow sparks, shockwaves, flames, feathers, pop-in damage numbers.
 * Particle pool size follows the ECO / HIGH quality setting.
 */

class Particle {
  constructor(x, y, vx, vy, color, size, life = 0.6, type = "spark") {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.size = size;
    this.life = life;
    this.maxLife = life;
    this.type = type;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotSpeed = (Math.random() - 0.5) * 6;
    this.maxRadius = 0;
  }

  update(dt) {
    this.x += this.vx * dt * 60;
    this.y += this.vy * dt * 60;

    switch (this.type) {
      case "feather":
        this.vx *= 0.92;
        this.vy = this.vy * 0.92 + 0.05;
        this.rotation += this.rotSpeed * dt;
        break;
      case "ring": {
        // ease-out expansion toward maxRadius
        const t = 1 - this.life / this.maxLife;
        this.size = this.maxRadius * (1 - Math.pow(1 - t, 3));
        break;
      }
      case "flame":
        this.vy -= 0.04;
        this.vx *= 0.95;
        break;
      case "smoke":
        this.vx *= 0.96; this.vy *= 0.96;
        this.size += dt * 14;
        break;
      case "debris":
        this.vx *= 0.9; this.vy *= 0.9;
        this.rotation += this.rotSpeed * dt;
        break;
      default:
        this.vx *= 0.93;
        this.vy *= 0.93;
    }
    this.life -= dt;
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
    this.life = isCrit ? 0.9 : 0.6;
    this.maxLife = this.life;
  }

  update(dt) {
    this.x += this.vx * dt * 60;
    this.y += this.vy * dt * 60;
    this.vy *= 0.93;
    this.life -= dt;
  }

  draw(ctx) {
    const t = 1 - this.life / this.maxLife;
    const alpha = Math.min(1, (this.life / this.maxLife) * 2.2);
    // pop: overshoot then settle
    const pop = t < 0.15 ? 0.6 + (t / 0.15) * 0.65 : 1.25 - Math.min(0.25, (t - 0.15) * 1.5);
    ctx.globalAlpha = alpha;
    ctx.font = `800 ${Math.round(this.size * pop)}px Orbitron, "Fira Code", monospace`;
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(0,0,0,0.75)";
    ctx.strokeText(this.text, this.x, this.y);
    ctx.fillStyle = this.color;
    ctx.fillText(this.text, this.x, this.y);
  }
}

class ParticleSystem {
  constructor() {
    this.particles = [];
    this.floatingTexts = [];
    this.setQuality(true);
  }

  setQuality(isEco) {
    this.isEco = isEco;
    this.maxParticles = isEco ? 90 : 260;
    this.maxTexts = isEco ? 16 : 28;
  }

  _push(p) {
    if (this.particles.length >= this.maxParticles) return false;
    this.particles.push(p);
    return true;
  }

  spawnFeatherPuff(x, y, count = 6) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 1.2 + Math.random() * 2.5;
      if (!this._push(new Particle(x, y, Math.cos(angle) * spd, Math.sin(angle) * spd, "#FFFFFF", 3 + Math.random() * 2, 0.5 + Math.random() * 0.4, "feather"))) break;
    }
  }

  spawnSparks(x, y, color, count = 6, speed = 3, life = 0.35) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = speed * (0.4 + Math.random());
      if (!this._push(new Particle(x, y, Math.cos(angle) * spd, Math.sin(angle) * spd, color, 2 + Math.random() * 2, life * (0.7 + Math.random() * 0.6), "spark"))) break;
    }
  }

  spawnShockRing(x, y, color, radius, life = 0.35, width = 3) {
    const p = new Particle(x, y, 0, 0, color, 0, life, "ring");
    p.maxRadius = radius;
    p.width = width;
    // rings are important feedback: always allow them
    this.particles.push(p);
  }

  spawnFlame(x, y) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 10;
    this._push(new Particle(x + Math.cos(a) * r, y + Math.sin(a) * r, (Math.random() - 0.5) * 0.8, -0.3 - Math.random() * 0.6,
      Math.random() > 0.5 ? "#FF5500" : "#FFB000", 4 + Math.random() * 3, 0.4 + Math.random() * 0.2, "flame"));
  }

  spawnHonkWave(x, y, radius = 180) {
    this.spawnShockRing(x, y, "#00F0FF", radius, 0.45, 4);
    this.spawnShockRing(x, y, "#FFE600", radius * 0.7, 0.35, 2);
    this.spawnFloatingText(x, y - 28, "📢 HONK!", "#FFE600", 18, true);
  }

  spawnEggExplosion(x, y, radius = 60) {
    this.spawnShockRing(x, y, "#FFB000", radius * 1.25, 0.35, 4);
    const flash = new Particle(x, y, 0, 0, "#FFF2B0", radius * 0.55, 0.18, "flash");
    this.particles.push(flash);
    const count = this.isEco ? 10 : 22;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 2 + Math.random() * 5;
      const color = Math.random() > 0.4 ? "#FFE600" : "#FF5500";
      if (!this._push(new Particle(x, y, Math.cos(angle) * spd, Math.sin(angle) * spd, color, 2.5 + Math.random() * 2.5, 0.4 + Math.random() * 0.25, "spark"))) break;
    }
    if (!this.isEco) {
      for (let i = 0; i < 5; i++) {
        const angle = Math.random() * Math.PI * 2;
        this._push(new Particle(x, y, Math.cos(angle) * 1.2, Math.sin(angle) * 1.2, "rgba(60,50,40,1)", 8 + Math.random() * 6, 0.7, "smoke"));
      }
    }
  }

  spawnDeathBurst(x, y, color, big = false) {
    this.spawnShockRing(x, y, color, big ? 160 : 34, big ? 0.7 : 0.28, big ? 6 : 2);
    this.spawnSparks(x, y, color, big ? 40 : (this.isEco ? 6 : 12), big ? 7 : 3.5, big ? 0.8 : 0.4);
    const debris = big ? 18 : (this.isEco ? 2 : 5);
    for (let i = 0; i < debris; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 1.5 + Math.random() * (big ? 6 : 3);
      if (!this._push(new Particle(x, y, Math.cos(angle) * spd, Math.sin(angle) * spd, color, 2 + Math.random() * 3, 0.5 + Math.random() * 0.4, "debris"))) break;
    }
    if (big) {
      this.particles.push(new Particle(x, y, 0, 0, "#FFFFFF", 90, 0.3, "flash"));
    }
  }

  spawnFloatingText(x, y, text, color = "#FFFFFF", size = 12, isCrit = false) {
    if (this.floatingTexts.length >= this.maxTexts) this.floatingTexts.shift();
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
    const S = window.Sprites;

    // Pass 1: normal blending (feathers, smoke, debris)
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const alpha = Math.max(0, p.life / p.maxLife);
      if (p.type === "feather") {
        ctx.globalAlpha = alpha;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * 1.8, p.size * 0.65, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(150,170,190,0.8)";
        ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.moveTo(-p.size * 1.8, 0); ctx.lineTo(p.size * 1.8, 0); ctx.stroke();
        ctx.restore();
      } else if (p.type === "smoke") {
        ctx.globalAlpha = alpha * 0.35;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === "debris") {
        ctx.globalAlpha = alpha;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size, -p.size * 0.5, p.size * 2, p.size);
        ctx.restore();
      }
    }

    // Pass 2: additive glow (sparks, flames, rings, flashes)
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const alpha = Math.max(0, p.life / p.maxLife);
      if (p.type === "spark") {
        ctx.globalAlpha = alpha;
        const s = S.softGlow(p.color, 8);
        S.draw(ctx, s, p.x, p.y, 0, Math.max(0.15, (p.size / 4) * alpha + 0.2));
      } else if (p.type === "flame") {
        ctx.globalAlpha = alpha * 0.9;
        S.draw(ctx, S.softGlow(p.color, 10), p.x, p.y, 0, (p.size / 5) * (0.5 + alpha * 0.5));
      } else if (p.type === "ring") {
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1, p.size), 0, Math.PI * 2);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = (p.width || 3) * (0.4 + alpha);
        ctx.stroke();
        ctx.globalAlpha = alpha * 0.25;
        ctx.lineWidth = (p.width || 3) * 4;
        ctx.stroke();
      } else if (p.type === "flash") {
        ctx.globalAlpha = alpha;
        S.draw(ctx, S.softGlow(p.color, 64), p.x, p.y, 0, p.size / 64 * (1 + (1 - alpha)));
      }
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;

    // Floating texts on top
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    for (let i = 0; i < this.floatingTexts.length; i++) {
      this.floatingTexts[i].draw(ctx);
    }
    ctx.globalAlpha = 1;
  }
}

/**
 * Ambient fireflies / pollen drifting over the field (HIGH quality only).
 */
class AmbientField {
  constructor() {
    this.motes = [];
  }

  reset(w, h, count) {
    this.motes = [];
    for (let i = 0; i < count; i++) {
      this.motes.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -0.1 - Math.random() * 0.25,
        phase: Math.random() * Math.PI * 2,
        color: Math.random() > 0.3 ? "#C8FF6A" : "#FFE600"
      });
    }
  }

  update(dt, w, h) {
    for (const m of this.motes) {
      m.x += (m.vx + Math.sin(m.phase) * 0.15) * dt * 60;
      m.y += m.vy * dt * 60;
      m.phase += dt * 1.5;
      if (m.y < -10) { m.y = h + 10; m.x = Math.random() * w; }
      if (m.x < -10) m.x = w + 10;
      if (m.x > w + 10) m.x = -10;
    }
  }

  draw(ctx, time) {
    const S = window.Sprites;
    ctx.globalCompositeOperation = "lighter";
    for (const m of this.motes) {
      ctx.globalAlpha = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(time * 2 + m.phase * 3));
      S.draw(ctx, S.softGlow(m.color, 6), m.x, m.y);
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }
}

window.ParticleSystem = ParticleSystem;
window.AmbientField = AmbientField;
