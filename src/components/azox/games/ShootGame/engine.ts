// AZOX Shooter game engine — single-file HTML5 canvas
// Object-pooled, time-based endless difficulty, drag-to-move.

import shipPlayerUrl from "@/assets/shoot/ship-player.png";
import enemyRedUrl from "@/assets/shoot/enemy-red.png";
import enemyOrangeUrl from "@/assets/shoot/enemy-orange.png";
import enemyPurpleUrl from "@/assets/shoot/enemy-purple.png";
import asteroidUrl from "@/assets/shoot/asteroid.png";
import coinUrl from "@/assets/shoot/coin.png";
import diamondUrl from "@/assets/shoot/diamond.png";
import spaceBgUrl from "@/assets/shoot/space-bg.jpg";

type EnemyKind = "small" | "medium" | "heavy" | "kamikaze" | "boss";
type PickupKind = "coin" | "diamond" | "crystal";

interface Entity {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

interface Enemy extends Entity {
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  w: number;
  h: number;
  fireCd: number;
  fireRate: number;
  drift: number;
  driftT: number;
  score: number;
  spread: number;
}

interface Bullet extends Entity {
  dmg: number;
  life: number;
}

interface Asteroid extends Entity {
  size: number; // radius
  rot: number;
  spin: number;
}

interface Pickup extends Entity {
  kind: PickupKind;
  life: number;
  score: number;
}

interface Particle extends Entity {
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface GameCallbacks {
  onScore: (s: number) => void;
  onTime: (ms: number) => void;
  onGameOver: (payload: {
    finalScore: number;
    durationMs: number;
    enemiesDestroyed: number;
    coinsCollected: number;
  }) => void;
}

const SPRITE_URLS = {
  player: shipPlayerUrl,
  red: enemyRedUrl,
  orange: enemyOrangeUrl,
  purple: enemyPurpleUrl,
  asteroid: asteroidUrl,
  coin: coinUrl,
  diamond: diamondUrl,
  bg: spaceBgUrl,
} as const;

type SpriteKey = keyof typeof SPRITE_URLS;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function preloadSprites(): Promise<Record<SpriteKey, HTMLImageElement>> {
  const entries = await Promise.all(
    (Object.keys(SPRITE_URLS) as SpriteKey[]).map(async (k) => [k, await loadImage(SPRITE_URLS[k])] as const),
  );
  return Object.fromEntries(entries) as Record<SpriteKey, HTMLImageElement>;
}

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private sprites: Record<SpriteKey, HTMLImageElement>;
  private cb: GameCallbacks;

  private W = 0;
  private H = 0;
  private dpr = 1;

  private raf = 0;
  private lastTs = 0;
  private running = false;
  private paused = false;
  private over = false;

  private startTs = 0;
  private elapsedMs = 0;

  // Player
  private px = 0;
  private py = 0;
  private ptx = 0;
  private pty = 0;
  private pFireCd = 0;
  private lives = 3;
  private iFrames = 0;

  // Input
  private dragging = false;
  private dragDx = 0;
  private dragDy = 0;

  // Pools
  private bullets: Bullet[] = [];
  private enemyBullets: Bullet[] = [];
  private enemies: Enemy[] = [];
  private asteroids: Asteroid[] = [];
  private pickups: Pickup[] = [];
  private particles: Particle[] = [];

  // Stars (background parallax)
  private stars: { x: number; y: number; z: number; s: number }[] = [];

  // Spawn timers
  private enemySpawnCd = 0;
  private asteroidSpawnCd = 0;
  private bossCd = 45;

  // Stats
  private score = 0;
  private enemiesDestroyed = 0;
  private coinsCollected = 0;
  private shake = 0;

  private sessionId = "";
  private bgOffset = 0;

  constructor(canvas: HTMLCanvasElement, sprites: Record<SpriteKey, HTMLImageElement>, cb: GameCallbacks) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("no 2d context");
    this.ctx = ctx;
    this.sprites = sprites;
    this.cb = cb;

    // Pre-alloc pools
    for (let i = 0; i < 200; i++) this.bullets.push(this.mkBullet());
    for (let i = 0; i < 300; i++) this.enemyBullets.push(this.mkBullet());
    for (let i = 0; i < 60; i++) this.enemies.push(this.mkEnemy());
    for (let i = 0; i < 30; i++) this.asteroids.push(this.mkAsteroid());
    for (let i = 0; i < 40; i++) this.pickups.push(this.mkPickup());
    for (let i = 0; i < 400; i++) this.particles.push(this.mkParticle());
  }

  private mkBullet(): Bullet {
    return { active: false, x: 0, y: 0, vx: 0, vy: 0, r: 4, dmg: 1, life: 0 };
  }
  private mkEnemy(): Enemy {
    return {
      active: false, x: 0, y: 0, vx: 0, vy: 0, r: 20,
      kind: "small", hp: 1, maxHp: 1, w: 40, h: 40,
      fireCd: 0, fireRate: 2, drift: 0, driftT: 0, score: 10, spread: 0,
    };
  }
  private mkAsteroid(): Asteroid {
    return { active: false, x: 0, y: 0, vx: 0, vy: 0, r: 30, size: 30, rot: 0, spin: 0 };
  }
  private mkPickup(): Pickup {
    return { active: false, x: 0, y: 0, vx: 0, vy: 0, r: 14, kind: "coin", life: 12, score: 10 };
  }
  private mkParticle(): Particle {
    return { active: false, x: 0, y: 0, vx: 0, vy: 0, r: 2, life: 0, maxLife: 1, color: "#fff", size: 2 };
  }

  private acquire<T extends { active: boolean }>(pool: T[], factory: () => T): T {
    for (let i = 0; i < pool.length; i++) {
      const item = pool[i];
      if (item && !item.active) return item;
    }
    const n = factory();
    pool.push(n);
    return n;
  }

  attach() {
    window.addEventListener("resize", this.onResize);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointercancel", this.onPointerUp);
    this.onResize();
    this.initStars();
  }
  detach() {
    window.removeEventListener("resize", this.onResize);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerUp);
    cancelAnimationFrame(this.raf);
    this.running = false;
  }

  private onVisibility = () => {
    if (document.hidden) this.paused = true;
  };

  private onResize = () => {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = rect.width;
    this.H = rect.height;
    this.canvas.width = Math.floor(rect.width * this.dpr);
    this.canvas.height = Math.floor(rect.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.px === 0 && this.py === 0) {
      this.px = this.W / 2;
      this.py = this.H - 100;
      this.ptx = this.px;
      this.pty = this.py;
    }
  };

  private initStars() {
    this.stars.length = 0;
    for (let i = 0; i < 90; i++) {
      this.stars.push({
        x: Math.random() * this.W,
        y: Math.random() * this.H,
        z: 0.3 + Math.random() * 1.5,
        s: 0.5 + Math.random() * 1.5,
      });
    }
  }

  private onPointerDown = (e: PointerEvent) => {
    if (this.over) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    this.dragging = true;
    this.dragDx = this.px - x;
    this.dragDy = this.py - y;
  };
  private onPointerMove = (e: PointerEvent) => {
    if (!this.dragging || this.over) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    this.ptx = x + this.dragDx;
    this.pty = y + this.dragDy;
  };
  private onPointerUp = () => {
    this.dragging = false;
  };

  start() {
    this.reset();
    this.running = true;
    this.paused = false;
    this.startTs = performance.now();
    this.lastTs = this.startTs;
    this.raf = requestAnimationFrame(this.loop);
  }
  pause() {
    this.paused = true;
  }
  resume() {
    if (!this.running || this.over) return;
    this.paused = false;
    this.lastTs = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }
  restart() {
    this.start();
  }

  private reset() {
    this.bullets.forEach((b) => (b.active = false));
    this.enemyBullets.forEach((b) => (b.active = false));
    this.enemies.forEach((b) => (b.active = false));
    this.asteroids.forEach((b) => (b.active = false));
    this.pickups.forEach((b) => (b.active = false));
    this.particles.forEach((b) => (b.active = false));
    this.px = this.W / 2;
    this.py = this.H - 100;
    this.ptx = this.px;
    this.pty = this.py;
    this.pFireCd = 0;
    this.lives = 3;
    this.iFrames = 1.5;
    this.enemySpawnCd = 0.5;
    this.asteroidSpawnCd = 2;
    this.bossCd = 90;
    this.score = 0;
    this.enemiesDestroyed = 0;
    this.coinsCollected = 0;
    this.shake = 0;
    this.elapsedMs = 0;
    this.over = false;
    this.sessionId =
      "s_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
    this.cb.onScore(0);
    this.cb.onTime(0);
  }

  private loop = (ts: number) => {
    if (!this.running) return;
    if (this.paused) {
      this.raf = requestAnimationFrame(this.loop);
      return;
    }
    let dt = (ts - this.lastTs) / 1000;
    if (dt > 0.05) dt = 0.05;
    this.lastTs = ts;
    this.elapsedMs = ts - this.startTs;
    this.update(dt);
    this.render();
    if (!this.over) this.raf = requestAnimationFrame(this.loop);
  };

  // Difficulty scalar increases forever.
  private difficulty(): number {
    const t = this.elapsedMs / 1000;
    return 1 + t / 25; // grows without bound
  }

  private update(dt: number) {
    const d = this.difficulty();

    // Player movement (smooth follow)
    const smooth = 1 - Math.pow(0.001, dt);
    this.px += (this.ptx - this.px) * smooth;
    this.py += (this.pty - this.py) * smooth;
    this.px = Math.max(24, Math.min(this.W - 24, this.px));
    this.py = Math.max(60, Math.min(this.H - 40, this.py));

    if (this.iFrames > 0) this.iFrames -= dt;

    // Auto fire
    this.pFireCd -= dt;
    const fireInterval = 0.12;
    if (this.pFireCd <= 0) {
      this.pFireCd = fireInterval;
      const spread = Math.min(2, Math.floor(d / 3));
      for (let i = -spread; i <= spread; i++) {
        const b = this.acquire(this.bullets, () => this.mkBullet());
        b.active = true;
        b.x = this.px + i * 10;
        b.y = this.py - 24;
        b.vx = i * 40;
        b.vy = -780;
        b.r = 6;
        b.dmg = 1;
        b.life = 2;
      }
    }

    // Background scroll
    this.bgOffset = (this.bgOffset + dt * 20) % this.H;

    // Stars
    for (const s of this.stars) {
      s.y += s.z * 60 * dt;
      if (s.y > this.H) {
        s.y = 0;
        s.x = Math.random() * this.W;
      }
    }

    // Spawn enemies
    this.enemySpawnCd -= dt;
    if (this.enemySpawnCd <= 0) {
      this.enemySpawnCd = Math.max(0.25, 1.4 - d * 0.05);
      this.spawnEnemyWave(d);
    }

    // Spawn asteroids
    this.asteroidSpawnCd -= dt;
    if (this.asteroidSpawnCd <= 0) {
      this.asteroidSpawnCd = Math.max(0.5, 2.5 - d * 0.08);
      this.spawnAsteroid(d);
    }

    // Boss
    this.bossCd -= dt;
    if (this.bossCd <= 0 && this.elapsedMs > 90_000) {
      this.bossCd = 60 + Math.random() * 30;
      this.spawnBoss(d);
    }

    // Bullets (player)
    for (const b of this.bullets) {
      if (!b.active) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.y < -20 || b.life <= 0) b.active = false;
    }
    // Enemy bullets
    for (const b of this.enemyBullets) {
      if (!b.active) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.y > this.H + 20 || b.y < -20 || b.x < -20 || b.x > this.W + 20 || b.life <= 0) {
        b.active = false;
      }
    }

    // Enemies
    for (const e of this.enemies) {
      if (!e.active) continue;
      e.driftT += dt;
      e.x += e.vx * dt + Math.sin(e.driftT * 2) * e.drift * dt;
      e.y += e.vy * dt;
      if (e.kind === "kamikaze") {
        // Home toward player
        const dx = this.px - e.x;
        const dy = this.py - e.y;
        const m = Math.hypot(dx, dy) || 1;
        e.vx += (dx / m) * 200 * dt;
        e.vy += (dy / m) * 200 * dt;
        e.vx = Math.max(-380, Math.min(380, e.vx));
        e.vy = Math.max(-100, Math.min(500, e.vy));
      }
      e.fireCd -= dt;
      if (e.fireCd <= 0 && e.kind !== "kamikaze" && e.y > 0 && e.y < this.H - 100) {
        e.fireCd = Math.max(0.4, e.fireRate - d * 0.05);
        this.enemyFire(e, d);
      }
      if (e.y > this.H + 60 || e.x < -80 || e.x > this.W + 80) e.active = false;
    }

    // Asteroids
    for (const a of this.asteroids) {
      if (!a.active) continue;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.rot += a.spin * dt;
      if (a.y > this.H + 60) a.active = false;
    }

    // Pickups
    for (const p of this.pickups) {
      if (!p.active) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy = Math.min(p.vy + 60 * dt, 200);
      p.life -= dt;
      if (p.life <= 0 || p.y > this.H + 40) p.active = false;
    }

    // Particles
    for (const p of this.particles) {
      if (!p.active) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life -= dt;
      if (p.life <= 0) p.active = false;
    }

    // Collisions: player bullets vs enemies & asteroids
    for (const b of this.bullets) {
      if (!b.active) continue;
      for (const e of this.enemies) {
        if (!e.active) continue;
        const dx = b.x - e.x;
        const dy = b.y - e.y;
        if (dx * dx + dy * dy < (e.r + b.r) * (e.r + b.r)) {
          b.active = false;
          e.hp -= b.dmg;
          this.spawnHit(e.x, e.y, "#7fff5a");
          if (e.hp <= 0) {
            e.active = false;
            this.score += e.score;
            this.enemiesDestroyed++;
            this.cb.onScore(this.score);
            this.explosion(e.x, e.y, e.kind === "boss" ? 60 : 24);
            this.maybeDropPickup(e);
            if (e.kind === "boss") this.shake = Math.max(this.shake, 0.6);
          }
          break;
        }
      }
      if (!b.active) continue;
      for (const a of this.asteroids) {
        if (!a.active) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        if (dx * dx + dy * dy < (a.r + b.r) * (a.r + b.r)) {
          b.active = false;
          this.spawnHit(b.x, b.y, "#c9c9c9");
          break;
        }
      }
    }

    // Enemy bullets vs player
    if (this.iFrames <= 0) {
      for (const b of this.enemyBullets) {
        if (!b.active) continue;
        const dx = b.x - this.px;
        const dy = b.y - this.py;
        if (dx * dx + dy * dy < (20 + b.r) * (20 + b.r)) {
          b.active = false;
          this.hitPlayer();
          break;
        }
      }
      // Enemies collide with player
      for (const e of this.enemies) {
        if (!e.active) continue;
        const dx = e.x - this.px;
        const dy = e.y - this.py;
        if (dx * dx + dy * dy < (e.r + 20) * (e.r + 20)) {
          this.explosion(e.x, e.y, 30);
          e.active = false;
          this.hitPlayer();
          break;
        }
      }
      // Asteroids collide with player
      for (const a of this.asteroids) {
        if (!a.active) continue;
        const dx = a.x - this.px;
        const dy = a.y - this.py;
        if (dx * dx + dy * dy < (a.r + 18) * (a.r + 18)) {
          this.explosion(a.x, a.y, 40);
          a.active = false;
          this.hitPlayer();
          break;
        }
      }
    }

    // Player picks up
    for (const p of this.pickups) {
      if (!p.active) continue;
      const dx = p.x - this.px;
      const dy = p.y - this.py;
      const rr = 34;
      if (dx * dx + dy * dy < rr * rr) {
        p.active = false;
        this.score += p.score;
        if (p.kind === "coin") this.coinsCollected++;
        this.cb.onScore(this.score);
        this.spawnHit(p.x, p.y, p.kind === "coin" ? "#ffb020" : p.kind === "diamond" ? "#b975ff" : "#7fe6ff");
      }
    }

    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 2);
    this.cb.onTime(this.elapsedMs);
  }

  private hitPlayer() {
    this.lives--;
    this.iFrames = 1.2;
    this.shake = 0.5;
    this.explosion(this.px, this.py, 26);
    if (this.lives <= 0) this.endGame();
  }

  private endGame() {
    this.over = true;
    this.running = false;
    this.cb.onGameOver({
      finalScore: this.score,
      durationMs: this.elapsedMs,
      enemiesDestroyed: this.enemiesDestroyed,
      coinsCollected: this.coinsCollected,
    });
  }

  getSessionId() {
    return this.sessionId;
  }

  private spawnEnemyWave(d: number) {
    const roll = Math.random();
    if (d > 3 && roll < 0.25) {
      // formation row
      const count = 3 + Math.min(4, Math.floor(d / 2));
      const y = -40;
      const startX = this.W * 0.15;
      const step = (this.W * 0.7) / (count - 1);
      const kind: EnemyKind = roll < 0.08 ? "heavy" : roll < 0.16 ? "medium" : "small";
      for (let i = 0; i < count; i++) this.spawnEnemy(kind, startX + step * i, y, d);
    } else if (d > 4 && roll < 0.35) {
      this.spawnEnemy("kamikaze", 40 + Math.random() * (this.W - 80), -40, d);
    } else {
      const kind: EnemyKind =
        roll < 0.55 ? "small" : roll < 0.85 ? "medium" : "heavy";
      this.spawnEnemy(kind, 40 + Math.random() * (this.W - 80), -40, d);
    }
  }

  private spawnEnemy(kind: EnemyKind, x: number, y: number, d: number) {
    const e = this.acquire(this.enemies, () => this.mkEnemy());
    e.active = true;
    e.kind = kind;
    e.x = x;
    e.y = y;
    e.vx = (Math.random() - 0.5) * 40;
    e.driftT = Math.random() * 5;
    e.drift = 40 + Math.random() * 40;
    e.fireCd = 0.5 + Math.random() * 1.5;
    switch (kind) {
      case "small":
        e.vy = 90 + d * 6;
        e.hp = 1; e.maxHp = 1; e.r = 22; e.w = 44; e.h = 44;
        e.fireRate = 2.2; e.spread = 0; e.score = 5;
        break;
      case "medium":
        e.vy = 70 + d * 5;
        e.hp = 2 + Math.floor(d / 4); e.maxHp = e.hp; e.r = 26; e.w = 52; e.h = 52;
        e.fireRate = 1.6; e.spread = 0; e.score = 10;
        break;
      case "heavy":
        e.vy = 50 + d * 3;
        e.hp = 4 + Math.floor(d / 2); e.maxHp = e.hp; e.r = 32; e.w = 64; e.h = 64;
        e.fireRate = 1.4; e.spread = 2; e.score = 15;
        break;
      case "kamikaze":
        e.vy = 120 + d * 8; e.vx = 0;
        e.hp = 1; e.maxHp = 1; e.r = 18; e.w = 40; e.h = 40;
        e.fireRate = 999; e.score = 25;
        break;
      case "boss":
        e.vy = 40; e.vx = 30;
        e.hp = 40 + Math.floor(d * 4); e.maxHp = e.hp;
        e.r = 60; e.w = 140; e.h = 140;
        e.fireRate = 0.8; e.spread = 3; e.score = 50;
        e.drift = 120;
        break;
    }
  }

  private spawnBoss(d: number) {
    this.spawnEnemy("boss", this.W / 2, -80, d);
  }

  private spawnAsteroid(d: number) {
    const a = this.acquire(this.asteroids, () => this.mkAsteroid());
    a.active = true;
    a.size = 20 + Math.random() * (20 + d * 3);
    a.r = a.size;
    a.x = Math.random() * this.W;
    a.y = -a.size;
    a.vx = (Math.random() - 0.5) * 60;
    a.vy = 60 + Math.random() * (60 + d * 6);
    a.rot = Math.random() * Math.PI * 2;
    a.spin = (Math.random() - 0.5) * 2;
  }

  private enemyFire(e: Enemy, d: number) {
    const speed = 260 + d * 12;
    const shots = 1 + (e.spread || 0);
    const spreadAng = 0.25;
    for (let i = 0; i < shots; i++) {
      const t = shots === 1 ? 0 : i / (shots - 1) - 0.5;
      const ang = Math.PI / 2 + t * spreadAng * 2;
      const b = this.acquire(this.enemyBullets, () => this.mkBullet());
      b.active = true;
      b.x = e.x;
      b.y = e.y + 12;
      b.vx = Math.cos(ang) * speed;
      b.vy = Math.sin(ang) * speed;
      b.r = 5;
      b.life = 3;
    }
  }

  private maybeDropPickup(e: Enemy) {
    const roll = Math.random();
    const p = this.acquire(this.pickups, () => this.mkPickup());
    if (e.kind === "boss") {
      p.kind = "crystal"; p.score = 100;
    } else if (roll < 0.06) {
      p.kind = "diamond"; p.score = 50;
    } else if (roll < 0.3) {
      p.kind = "coin"; p.score = 10;
    } else {
      return; // nothing
    }
    p.active = true;
    p.x = e.x; p.y = e.y;
    p.vx = (Math.random() - 0.5) * 40;
    p.vy = -60 + Math.random() * -20;
    p.r = 16;
    p.life = 10;
  }

  private spawnHit(x: number, y: number, color: string) {
    for (let i = 0; i < 6; i++) {
      const p = this.acquire(this.particles, () => this.mkParticle());
      p.active = true;
      p.x = x; p.y = y;
      const a = Math.random() * Math.PI * 2;
      const s = 60 + Math.random() * 120;
      p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
      p.life = 0.4; p.maxLife = 0.4;
      p.color = color; p.size = 2 + Math.random() * 2;
    }
  }

  private explosion(x: number, y: number, power: number) {
    for (let i = 0; i < power; i++) {
      const p = this.acquire(this.particles, () => this.mkParticle());
      p.active = true;
      p.x = x; p.y = y;
      const a = Math.random() * Math.PI * 2;
      const s = 80 + Math.random() * 280;
      p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
      p.life = 0.5 + Math.random() * 0.5;
      p.maxLife = p.life;
      const c = Math.random();
      p.color = c < 0.4 ? "#ffcc55" : c < 0.75 ? "#ff7a30" : "#ffffff";
      p.size = 2 + Math.random() * 3;
    }
    this.shake = Math.max(this.shake, Math.min(0.4, power / 100));
  }

  private render() {
    const ctx = this.ctx;
    const shakeX = (Math.random() - 0.5) * this.shake * 14;
    const shakeY = (Math.random() - 0.5) * this.shake * 14;
    ctx.save();
    ctx.translate(shakeX, shakeY);

    // Background image (scrolling)
    const bg = this.sprites.bg;
    const bgH = this.W * (bg.height / bg.width);
    let y = -((this.bgOffset) % bgH);
    ctx.drawImage(bg, 0, y, this.W, bgH);
    ctx.drawImage(bg, 0, y + bgH, this.W, bgH);

    // Stars
    ctx.fillStyle = "#ffffff";
    for (const s of this.stars) {
      ctx.globalAlpha = 0.4 + s.z * 0.3;
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }
    ctx.globalAlpha = 1;

    // Asteroids
    const ast = this.sprites.asteroid;
    for (const a of this.asteroids) {
      if (!a.active) continue;
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.rot);
      const s = a.size * 2;
      ctx.drawImage(ast, -s / 2, -s / 2, s, s);
      ctx.restore();
    }

    // Enemies
    for (const e of this.enemies) {
      if (!e.active) continue;
      const img =
        e.kind === "small" ? this.sprites.red :
        e.kind === "medium" ? this.sprites.orange :
        e.kind === "heavy" ? this.sprites.purple :
        e.kind === "kamikaze" ? this.sprites.red :
        this.sprites.purple;
      ctx.drawImage(img, e.x - e.w / 2, e.y - e.h / 2, e.w, e.h);
      if (e.kind === "boss" || e.maxHp > 3) {
        const w = e.w;
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(e.x - w / 2, e.y - e.h / 2 - 8, w, 4);
        ctx.fillStyle = "#ff5555";
        ctx.fillRect(e.x - w / 2, e.y - e.h / 2 - 8, w * (e.hp / e.maxHp), 4);
      }
    }

    // Pickups
    for (const p of this.pickups) {
      if (!p.active) continue;
      const img = p.kind === "coin" ? this.sprites.coin : this.sprites.diamond;
      const s = p.kind === "crystal" ? 40 : 32;
      ctx.save();
      const pulse = 1 + Math.sin(this.elapsedMs / 200 + p.x) * 0.1;
      ctx.globalAlpha = p.life < 2 ? Math.max(0, p.life / 2) : 1;
      ctx.drawImage(img, p.x - (s * pulse) / 2, p.y - (s * pulse) / 2, s * pulse, s * pulse);
      ctx.restore();
    }

    // Bullets (player) — glowing green arrows
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const b of this.bullets) {
      if (!b.active) continue;
      ctx.fillStyle = "#8fff4a";
      ctx.beginPath();
      ctx.moveTo(b.x, b.y - 10);
      ctx.lineTo(b.x - 4, b.y + 6);
      ctx.lineTo(b.x + 4, b.y + 6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(120,255,80,0.35)";
      ctx.beginPath();
      ctx.arc(b.x, b.y, 10, 0, Math.PI * 2);
      ctx.fill();
    }
    // Enemy bullets — red glowing
    for (const b of this.enemyBullets) {
      if (!b.active) continue;
      ctx.fillStyle = "#ff5533";
      ctx.beginPath();
      ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,80,60,0.35)";
      ctx.beginPath();
      ctx.arc(b.x, b.y, 9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Player
    const flash = this.iFrames > 0 && Math.floor(this.elapsedMs / 80) % 2 === 0;
    if (!flash) {
      const s = 72;
      ctx.drawImage(this.sprites.player, this.px - s / 2, this.py - s / 2, s, s);
      // engine glow
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const grad = ctx.createRadialGradient(this.px, this.py + 30, 4, this.px, this.py + 30, 40);
      grad.addColorStop(0, "rgba(140,255,90,0.7)");
      grad.addColorStop(1, "rgba(140,255,90,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(this.px - 40, this.py + 10, 80, 60);
      ctx.restore();
    }

    // Particles
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const p of this.particles) {
      if (!p.active) continue;
      const a = p.life / p.maxLife;
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Lives (top-right of canvas)
    ctx.globalAlpha = 1;
    for (let i = 0; i < this.lives; i++) {
      ctx.fillStyle = "#8fff4a";
      ctx.beginPath();
      ctx.moveTo(10 + i * 18, 16);
      ctx.lineTo(4 + i * 18, 28);
      ctx.lineTo(16 + i * 18, 28);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }
}
