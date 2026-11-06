/**
 * Goose Survivor - Input Layer
 * Keyboard state + mobile touch controls (floating virtual joystick, HONK & DASH buttons).
 */

class InputManager {
  constructor() {
    this.keys = {};
    this.joy = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
    this.joyRadius = 56;
    this.isTouch = false;
    this.onDash = null;
    this.onHonk = null;

    this.zone = document.getElementById("joystick-zone");
    this.joyEl = document.getElementById("joystick");
    this.knobEl = this.joyEl ? this.joyEl.querySelector(".joy-knob") : null;
    this.btnHonk = document.getElementById("btn-touch-honk");
    this.btnDash = document.getElementById("btn-touch-dash");

    const coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    if (coarse || "ontouchstart" in window || navigator.maxTouchPoints > 0) {
      this.enableTouch();
    }

    window.addEventListener("keydown", (e) => { this.keys[e.key.toLowerCase()] = true; });
    window.addEventListener("keyup", (e) => { this.keys[e.key.toLowerCase()] = false; });
    window.addEventListener("blur", () => { this.keys = {}; this.releaseJoystick(); });

    // Any real touch switches the UI to touch mode (handles hybrid laptops too)
    window.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "touch" && !this.isTouch) this.enableTouch();
    }, { capture: true });

    this.bindTouch();
  }

  enableTouch() {
    this.isTouch = true;
    document.body.classList.add("is-touch");
  }

  bindTouch() {
    if (!this.zone) return;

    this.zone.addEventListener("pointerdown", (e) => {
      if (this.joy.active) return;
      e.preventDefault();
      this.joy.active = true;
      this.joy.id = e.pointerId;
      this.joy.ox = e.clientX;
      this.joy.oy = e.clientY;
      this.joy.x = 0;
      this.joy.y = 0;
      try { this.zone.setPointerCapture(e.pointerId); } catch (_) { /* older browsers */ }
      if (this.joyEl) {
        this.joyEl.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
        this.joyEl.classList.add("active");
      }
      this.updateKnob(0, 0);
    });

    this.zone.addEventListener("pointermove", (e) => {
      if (!this.joy.active || e.pointerId !== this.joy.id) return;
      e.preventDefault();
      let dx = e.clientX - this.joy.ox;
      let dy = e.clientY - this.joy.oy;
      const dist = Math.hypot(dx, dy);
      const r = this.joyRadius;
      // "follow" joystick: if you drag past the rim, the base slides with your thumb
      if (dist > r * 1.4) {
        const k = (dist - r * 1.4) / dist;
        this.joy.ox += dx * k;
        this.joy.oy += dy * k;
        dx = e.clientX - this.joy.ox;
        dy = e.clientY - this.joy.oy;
        if (this.joyEl) this.joyEl.style.transform = `translate(${this.joy.ox}px, ${this.joy.oy}px)`;
      }
      const d = Math.hypot(dx, dy);
      const clamped = Math.min(d, r);
      const nx = d > 0 ? dx / d : 0;
      const ny = d > 0 ? dy / d : 0;
      // deadzone + slight response curve
      const raw = clamped / r;
      const mag = raw < 0.12 ? 0 : Math.min(1, (raw - 0.12) / 0.7);
      this.joy.x = nx * mag;
      this.joy.y = ny * mag;
      this.updateKnob(nx * clamped, ny * clamped);
    });

    const end = (e) => {
      if (e.pointerId !== this.joy.id) return;
      this.releaseJoystick();
    };
    this.zone.addEventListener("pointerup", end);
    this.zone.addEventListener("pointercancel", end);
    this.zone.addEventListener("lostpointercapture", end);

    const bindBtn = (btn, fn) => {
      if (!btn) return;
      btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        btn.classList.add("pressed");
        const cb = fn();
        if (cb) cb();
      });
      const up = () => btn.classList.remove("pressed");
      btn.addEventListener("pointerup", up);
      btn.addEventListener("pointercancel", up);
      btn.addEventListener("pointerleave", up);
      btn.addEventListener("contextmenu", (e) => e.preventDefault());
    };
    bindBtn(this.btnHonk, () => this.onHonk);
    bindBtn(this.btnDash, () => this.onDash);

    // Block long-press menus / pinch-zoom / double-tap zoom on the play surface
    document.addEventListener("contextmenu", (e) => {
      if (e.target.closest && e.target.closest("#touch-controls, #game-canvas")) e.preventDefault();
    });
    document.addEventListener("gesturestart", (e) => e.preventDefault());
    let lastTouchEnd = 0;
    document.addEventListener("touchend", (e) => {
      const now = Date.now();
      if (now - lastTouchEnd < 300 && !(e.target.closest && e.target.closest("button, .upgrade-card"))) e.preventDefault();
      lastTouchEnd = now;
    }, { passive: false });
  }

  releaseJoystick() {
    this.joy.active = false;
    this.joy.id = null;
    this.joy.x = 0;
    this.joy.y = 0;
    if (this.joyEl) this.joyEl.classList.remove("active");
    this.updateKnob(0, 0);
  }

  updateKnob(x, y) {
    if (this.knobEl) this.knobEl.style.transform = `translate(${x}px, ${y}px)`;
  }

  /** Combined analog move vector (keyboard + joystick), magnitude <= 1 */
  getMoveVector() {
    let x = 0, y = 0;
    const k = this.keys;
    if (k["w"] || k["arrowup"]) y -= 1;
    if (k["s"] || k["arrowdown"]) y += 1;
    if (k["a"] || k["arrowleft"]) x -= 1;
    if (k["d"] || k["arrowright"]) x += 1;
    const kl = Math.hypot(x, y);
    if (kl > 0) { x /= kl; y /= kl; }

    if (this.joy.active) { x += this.joy.x; y += this.joy.y; }
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return { x, y };
  }

  /** Update cooldown rings on the touch buttons (0 = ready, 1 = just used) */
  setCooldowns(honkPct, dashPct) {
    if (!this.isTouch) return;
    if (this.btnHonk) {
      this.btnHonk.style.setProperty("--cd", honkPct.toFixed(3));
      this.btnHonk.classList.toggle("ready", honkPct <= 0);
    }
    if (this.btnDash) {
      this.btnDash.style.setProperty("--cd", dashPct.toFixed(3));
      this.btnDash.classList.toggle("ready", dashPct <= 0);
    }
  }

  vibrate(ms) {
    if (this.isTouch && navigator.vibrate) {
      try { navigator.vibrate(ms); } catch (_) { /* ignore */ }
    }
  }
}

window.InputManager = InputManager;
