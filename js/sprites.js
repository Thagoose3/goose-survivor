/**
 * Goose Survivor - Pre-rendered Sprite Cache
 * Every glow, gradient and detailed body is painted ONCE to an offscreen canvas
 * and then stamped with drawImage. Rich visuals, zero per-frame shadowBlur.
 */

const SPRITE_RES = 2; // internal oversampling so sprites stay crisp on retina / phones

const Sprites = {
  cache: new Map(),

  /** Create (or fetch) a square sprite of logical size `size`, origin at its centre. */
  make(key, size, paint) {
    let s = this.cache.get(key);
    if (s) return s;
    const c = document.createElement("canvas");
    c.width = Math.ceil(size * SPRITE_RES);
    c.height = Math.ceil(size * SPRITE_RES);
    const g = c.getContext("2d");
    g.scale(SPRITE_RES, SPRITE_RES);
    g.translate(size / 2, size / 2);
    paint(g, size);
    s = { canvas: c, size, half: size / 2 };
    this.cache.set(key, s);
    return s;
  },

  /** White silhouette of a sprite, used for hit-flash. */
  flashOf(key, sprite) {
    const fk = key + "__flash";
    let s = this.cache.get(fk);
    if (s) return s;
    const c = document.createElement("canvas");
    c.width = sprite.canvas.width;
    c.height = sprite.canvas.height;
    const g = c.getContext("2d");
    g.drawImage(sprite.canvas, 0, 0);
    g.globalCompositeOperation = "source-in";
    g.fillStyle = "#FFFFFF";
    g.fillRect(0, 0, c.width, c.height);
    s = { canvas: c, size: sprite.size, half: sprite.half };
    this.cache.set(fk, s);
    return s;
  },

  draw(ctx, sprite, x, y, rotation = 0, scale = 1) {
    const sz = sprite.size * scale;
    if (rotation === 0) {
      ctx.drawImage(sprite.canvas, x - sz / 2, y - sz / 2, sz, sz);
    } else {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.drawImage(sprite.canvas, -sz / 2, -sz / 2, sz, sz);
      ctx.restore();
    }
  },

  // ---------------------------------------------------------------- generic

  glow(color, radius, coreColor = "#FFFFFF", coreRatio = 0.45) {
    const size = radius * 4;
    return this.make(`glow_${color}_${radius}_${coreColor}_${coreRatio}`, size, (g) => {
      const outer = g.createRadialGradient(0, 0, 0, 0, 0, size / 2);
      outer.addColorStop(0, hexA(color, 0.85));
      outer.addColorStop(0.28, hexA(color, 0.55));
      outer.addColorStop(0.55, hexA(color, 0.14));
      outer.addColorStop(1, hexA(color, 0));
      g.fillStyle = outer;
      g.fillRect(-size / 2, -size / 2, size, size);
      g.beginPath();
      g.arc(0, 0, radius, 0, Math.PI * 2);
      g.fillStyle = color;
      g.fill();
      g.beginPath();
      g.arc(0, 0, radius * coreRatio, 0, Math.PI * 2);
      g.fillStyle = coreColor;
      g.fill();
    });
  },

  softGlow(color, radius) {
    const size = radius * 2;
    return this.make(`soft_${color}_${radius}`, size, (g) => {
      const grd = g.createRadialGradient(0, 0, 0, 0, 0, radius);
      grd.addColorStop(0, hexA(color, 0.9));
      grd.addColorStop(0.4, hexA(color, 0.35));
      grd.addColorStop(1, hexA(color, 0));
      g.fillStyle = grd;
      g.fillRect(-radius, -radius, size, size);
    });
  },

  shadow(radius) {
    const size = Math.ceil(radius * 2.6);
    return this.make(`shadow_${radius}`, size, (g) => {
      g.scale(1, 0.45);
      const grd = g.createRadialGradient(0, 0, 0, 0, 0, radius * 1.2);
      grd.addColorStop(0, "rgba(0,0,0,0.55)");
      grd.addColorStop(0.7, "rgba(0,0,0,0.25)");
      grd.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grd;
      g.beginPath();
      g.arc(0, 0, radius * 1.2, 0, Math.PI * 2);
      g.fill();
    });
  },

  // ---------------------------------------------------------------- enemies

  farmer() {
    return this.make("enemy_farmer", 72, (g) => {
      haloRing(g, "#FF8800", 24);
      // pitchfork (pointing right = facing)
      g.strokeStyle = "#8B5A2B";
      g.lineWidth = 3;
      g.lineCap = "round";
      g.beginPath(); g.moveTo(-4, 14); g.lineTo(30, 14); g.stroke();
      g.strokeStyle = "#D8E4EC";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(28, 8); g.lineTo(28, 20);
      g.moveTo(28, 8); g.lineTo(35, 8);
      g.moveTo(28, 14); g.lineTo(36, 14);
      g.moveTo(28, 20); g.lineTo(35, 20);
      g.stroke();
      // arms
      g.fillStyle = "#F2C29B";
      g.beginPath(); g.arc(8, 14, 4, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(8, -13, 4, 0, Math.PI * 2); g.fill();
      // overalls body
      g.fillStyle = "#2E6FD8";
      g.beginPath(); g.ellipse(0, 0, 13, 16, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#C83A2C"; // plaid shirt shoulders
      g.beginPath(); g.ellipse(-2, 0, 8, 15, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "rgba(255,255,255,0.25)"; g.lineWidth = 1;
      for (let i = -12; i <= 12; i += 4) { g.beginPath(); g.moveTo(-10, i); g.lineTo(6, i); g.stroke(); }
      // straw hat (top-down)
      const hat = g.createRadialGradient(-2, -2, 1, 0, 0, 15);
      hat.addColorStop(0, "#FFE7A0");
      hat.addColorStop(1, "#D9A23B");
      g.fillStyle = hat;
      g.beginPath(); g.arc(0, 0, 14, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#A86F1E"; g.lineWidth = 1.2;
      g.beginPath(); g.arc(0, 0, 14, 0, Math.PI * 2); g.stroke();
      g.fillStyle = "#E9B856";
      g.beginPath(); g.arc(0, 0, 8, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#C0392B"; g.lineWidth = 2;
      g.beginPath(); g.arc(0, 0, 8, 0, Math.PI * 2); g.stroke();
    });
  },

  drone() {
    return this.make("enemy_drone", 72, (g) => {
      haloRing(g, "#00F0FF", 24);
      // arms
      g.strokeStyle = "#3A4A5C"; g.lineWidth = 4; g.lineCap = "round";
      g.beginPath();
      g.moveTo(-14, -14); g.lineTo(14, 14);
      g.moveTo(-14, 14); g.lineTo(14, -14);
      g.stroke();
      // rotor hubs
      [[-15, -15], [15, 15], [-15, 15], [15, -15]].forEach(([x, y]) => {
        g.beginPath(); g.arc(x, y, 8, 0, Math.PI * 2);
        g.fillStyle = "rgba(160, 230, 255, 0.18)"; g.fill();
        g.strokeStyle = "rgba(0, 240, 255, 0.55)"; g.lineWidth = 1; g.stroke();
        g.beginPath(); g.arc(x, y, 2.2, 0, Math.PI * 2); g.fillStyle = "#9FB3C8"; g.fill();
      });
      // hex body
      const body = g.createLinearGradient(-10, -10, 10, 10);
      body.addColorStop(0, "#5E7389"); body.addColorStop(1, "#1C2733");
      g.fillStyle = body;
      polygon(g, 0, 0, 11, 6, Math.PI / 6); g.fill();
      g.strokeStyle = "#00F0FF"; g.lineWidth = 1.5;
      polygon(g, 0, 0, 11, 6, Math.PI / 6); g.stroke();
      // eye lens (facing right)
      g.beginPath(); g.arc(4, 0, 4.5, 0, Math.PI * 2); g.fillStyle = "#001820"; g.fill();
      const lens = g.createRadialGradient(5, -1, 0, 4, 0, 4.5);
      lens.addColorStop(0, "#FFFFFF"); lens.addColorStop(0.35, "#00F0FF"); lens.addColorStop(1, "#004858");
      g.fillStyle = lens;
      g.beginPath(); g.arc(4, 0, 3.5, 0, Math.PI * 2); g.fill();
    });
  },

  fox() {
    return this.make("enemy_fox", 80, (g) => {
      haloRing(g, "#FF1B44", 27);
      // tail (behind, to the left)
      const tail = g.createLinearGradient(-36, 0, -10, 0);
      tail.addColorStop(0, "#FFFFFF"); tail.addColorStop(0.25, "#FFFFFF");
      tail.addColorStop(0.3, "#E8551E"); tail.addColorStop(1, "#C93A12");
      g.fillStyle = tail;
      g.beginPath(); g.ellipse(-22, 0, 15, 7, 0, 0, Math.PI * 2); g.fill();
      // body
      const body = g.createLinearGradient(0, -12, 0, 12);
      body.addColorStop(0, "#C93A12"); body.addColorStop(0.5, "#FF6A2B"); body.addColorStop(1, "#C93A12");
      g.fillStyle = body;
      g.beginPath(); g.ellipse(-2, 0, 15, 11, 0, 0, Math.PI * 2); g.fill();
      // head
      g.fillStyle = "#FF6A2B";
      g.beginPath(); g.ellipse(13, 0, 9, 9, 0, 0, Math.PI * 2); g.fill();
      // snout
      g.fillStyle = "#FFF1E6";
      g.beginPath(); g.moveTo(14, -5); g.lineTo(26, 0); g.lineTo(14, 5); g.closePath(); g.fill();
      g.fillStyle = "#1A0A06";
      g.beginPath(); g.arc(25, 0, 1.8, 0, Math.PI * 2); g.fill();
      // ears
      g.fillStyle = "#2A0F08";
      g.beginPath(); g.moveTo(9, -6); g.lineTo(6, -15); g.lineTo(15, -8); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(9, 6); g.lineTo(6, 15); g.lineTo(15, 8); g.closePath(); g.fill();
      // cyber visor eyes
      g.fillStyle = "#FF1B44";
      g.fillRect(14, -5, 4, 2.4);
      g.fillRect(14, 2.6, 4, 2.4);
      g.fillStyle = "#FFD0D8";
      g.fillRect(16, -4.5, 1.2, 1.2);
      g.fillRect(16, 3.1, 1.2, 1.2);
    });
  },

  harvester() {
    return this.make("enemy_harvester", 150, (g) => {
      haloRing(g, "#FF007A", 50);
      // rear wheels
      g.fillStyle = "#15151A";
      [[-30, -40], [-30, 40], [16, -42], [16, 42]].forEach(([x, y]) => {
        roundRect(g, x - 11, y - 7, 22, 14, 4); g.fill();
      });
      // chassis
      const ch = g.createLinearGradient(0, -36, 0, 36);
      ch.addColorStop(0, "#8E0E4A"); ch.addColorStop(0.5, "#E0186E"); ch.addColorStop(1, "#8E0E4A");
      g.fillStyle = ch;
      roundRect(g, -44, -34, 74, 68, 10); g.fill();
      g.strokeStyle = "#FF6FB5"; g.lineWidth = 2;
      roundRect(g, -44, -34, 74, 68, 10); g.stroke();
      // grain tank grill
      g.strokeStyle = "rgba(0,0,0,0.35)"; g.lineWidth = 2;
      for (let x = -38; x < -6; x += 6) { g.beginPath(); g.moveTo(x, -26); g.lineTo(x, 26); g.stroke(); }
      // cab
      g.fillStyle = "#2B0A1C";
      roundRect(g, 0, -16, 26, 32, 6); g.fill();
      const glass = g.createLinearGradient(4, -12, 22, 12);
      glass.addColorStop(0, "#9BF6FF"); glass.addColorStop(1, "#1D6C80");
      g.fillStyle = glass;
      roundRect(g, 5, -12, 17, 24, 4); g.fill();
      // hazard stripe header bar
      g.save();
      roundRect(g, 32, -62, 14, 124, 4); g.clip();
      g.fillStyle = "#FFE600"; g.fillRect(32, -62, 14, 124);
      g.fillStyle = "#111";
      for (let y = -70; y < 70; y += 12) {
        g.beginPath(); g.moveTo(32, y); g.lineTo(46, y + 7); g.lineTo(46, y + 13); g.lineTo(32, y + 6); g.closePath(); g.fill();
      }
      g.restore();
      // headlights
      [-24, 24].forEach((y) => {
        const hl = g.createRadialGradient(30, y, 0, 30, y, 8);
        hl.addColorStop(0, "#FFFFFF"); hl.addColorStop(0.4, "#FFF6A0"); hl.addColorStop(1, "rgba(255,240,120,0)");
        g.fillStyle = hl;
        g.beginPath(); g.arc(30, y, 8, 0, Math.PI * 2); g.fill();
      });
    });
  },

  // ---------------------------------------------------------------- pickups & weapons

  corn(color) {
    return this.make(`corn_${color}`, 26, (g) => {
      const grd = g.createRadialGradient(0, 0, 0, 0, 0, 13);
      grd.addColorStop(0, hexA(color, 0.6)); grd.addColorStop(1, hexA(color, 0));
      g.fillStyle = grd; g.fillRect(-13, -13, 26, 26);
      // kernel teardrop
      g.beginPath();
      g.moveTo(0, -6.5);
      g.bezierCurveTo(5, -4, 5, 4, 0, 6);
      g.bezierCurveTo(-5, 4, -5, -4, 0, -6.5);
      const k = g.createLinearGradient(-4, -6, 4, 6);
      k.addColorStop(0, "#FFFFFF"); k.addColorStop(0.35, color); k.addColorStop(1, shade(color, -0.35));
      g.fillStyle = k; g.fill();
      g.strokeStyle = "rgba(0,0,0,0.35)"; g.lineWidth = 0.8; g.stroke();
    });
  },

  feather() {
    return this.make("feather_shot", 40, (g) => {
      const trail = g.createLinearGradient(-20, 0, 8, 0);
      trail.addColorStop(0, "rgba(0,240,255,0)"); trail.addColorStop(1, "rgba(0,240,255,0.55)");
      g.fillStyle = trail;
      g.beginPath(); g.ellipse(-5, 0, 15, 4.5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#FFFFFF";
      g.beginPath();
      g.moveTo(11, 0);
      g.quadraticCurveTo(2, -5, -9, -1.5);
      g.lineTo(-9, 1.5);
      g.quadraticCurveTo(2, 5, 11, 0);
      g.fill();
      g.strokeStyle = "#7FDFFF"; g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(-11, 0); g.lineTo(10, 0); g.stroke();
    });
  },

  egg() {
    return this.make("egg_mine", 40, (g) => {
      const halo = g.createRadialGradient(0, 0, 0, 0, 0, 20);
      halo.addColorStop(0, "rgba(255,200,0,0.45)"); halo.addColorStop(1, "rgba(255,200,0,0)");
      g.fillStyle = halo; g.fillRect(-20, -20, 40, 40);
      const egg = g.createRadialGradient(-3, -4, 1, 0, 0, 12);
      egg.addColorStop(0, "#FFFBE0"); egg.addColorStop(0.35, "#FFD84A"); egg.addColorStop(1, "#C98A00");
      g.fillStyle = egg;
      g.beginPath(); g.ellipse(0, 1, 8, 10.5, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#8A5A00"; g.lineWidth = 1; g.stroke();
      g.fillStyle = "rgba(255,255,255,0.75)";
      g.beginPath(); g.ellipse(-3, -4, 2, 3.5, -0.4, 0, Math.PI * 2); g.fill();
    });
  },

  knife() {
    return this.make("butter_knife", 44, (g) => {
      const glow = g.createRadialGradient(0, -4, 0, 0, -4, 20);
      glow.addColorStop(0, "rgba(255,0,122,0.45)"); glow.addColorStop(1, "rgba(255,0,122,0)");
      g.fillStyle = glow; g.fillRect(-22, -22, 44, 44);
      const blade = g.createLinearGradient(-3, 0, 3, 0);
      blade.addColorStop(0, "#FFFFFF"); blade.addColorStop(1, "#9FB6C6");
      g.fillStyle = blade;
      g.beginPath();
      g.moveTo(-3, 6); g.lineTo(-3, -12); g.quadraticCurveTo(0, -18, 3.5, -12); g.lineTo(3, 6); g.closePath();
      g.fill();
      g.fillStyle = "#6B3A1E";
      roundRect(g, -3.5, 6, 7, 11, 2); g.fill();
      g.fillStyle = "#C9A06B"; g.fillRect(-3.5, 6, 7, 1.5);
    });
  },

  item(type, color, icon) {
    return this.make(`item_${type}`, 54, (g) => {
      const halo = g.createRadialGradient(0, 0, 4, 0, 0, 27);
      halo.addColorStop(0, hexA(color, 0.55)); halo.addColorStop(1, hexA(color, 0));
      g.fillStyle = halo; g.fillRect(-27, -27, 54, 54);
      if (type === "crate") {
        const wood = g.createLinearGradient(0, -12, 0, 12);
        wood.addColorStop(0, "#FFB547"); wood.addColorStop(1, "#B5641A");
        g.fillStyle = wood;
        roundRect(g, -13, -13, 26, 26, 4); g.fill();
        g.strokeStyle = "#FFE600"; g.lineWidth = 2;
        roundRect(g, -13, -13, 26, 26, 4); g.stroke();
        g.fillStyle = "#FF007A";
        g.fillRect(-2.5, -13, 5, 26); g.fillRect(-13, -2.5, 26, 5);
      } else {
        const disc = g.createRadialGradient(-3, -4, 1, 0, 0, 12);
        disc.addColorStop(0, "#1F3A2C"); disc.addColorStop(1, "#06120B");
        g.fillStyle = disc;
        g.beginPath(); g.arc(0, 0, 12, 0, Math.PI * 2); g.fill();
        g.strokeStyle = color; g.lineWidth = 2;
        g.beginPath(); g.arc(0, 0, 12, 0, Math.PI * 2); g.stroke();
        g.font = "13px 'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif";
        g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText(icon, 0, 1);
      }
    });
  },

  vignette(w, h) {
    const key = `vignette_${w}x${h}`;
    if (this._vig && this._vig.key === key) return this._vig.canvas;
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w / 4));
    c.height = Math.max(1, Math.round(h / 4));
    const g = c.getContext("2d");
    const r = Math.hypot(c.width, c.height) / 2;
    const grd = g.createRadialGradient(c.width / 2, c.height / 2, r * 0.45, c.width / 2, c.height / 2, r);
    grd.addColorStop(0, "rgba(0,0,0,0)");
    grd.addColorStop(1, "rgba(0,0,0,1)");
    g.fillStyle = grd;
    g.fillRect(0, 0, c.width, c.height);
    this._vig = { key, canvas: c };
    return c;
  }
};

// ---------------------------------------------------------------- helpers

function hexA(hex, a) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function shade(hex, amt) {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + (amt < 0 ? v * amt : (255 - v) * amt))));
  const r = f((n >> 16) & 255), gg = f((n >> 8) & 255), b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (gg << 8) | b).toString(16).slice(1)}`;
}

function polygon(g, x, y, r, sides, rot = 0) {
  g.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
  }
  g.closePath();
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function haloRing(g, color, r) {
  const grd = g.createRadialGradient(0, 0, r * 0.55, 0, 0, r * 1.45);
  grd.addColorStop(0, hexA(color, 0));
  grd.addColorStop(0.45, hexA(color, 0.28));
  grd.addColorStop(1, hexA(color, 0));
  g.fillStyle = grd;
  g.beginPath(); g.arc(0, 0, r * 1.45, 0, Math.PI * 2); g.fill();
}

window.Sprites = Sprites;
window.hexA = hexA;
