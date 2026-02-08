const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const hpValue = document.getElementById('hpValue');
const scoreValue = document.getElementById('scoreValue');
const superValue = document.getElementById('superValue');
const enemyValue = document.getElementById('enemyValue');
const restartButton = document.getElementById('restartButton');

const W = canvas.width;
const H = canvas.height;
const keys = new Set();

const state = {
  gameOver: false,
  mouse: { x: W / 2, y: H / 2 },
  player: null,
  enemies: [],
  bullets: [],
  particles: [],
  crates: [],
  score: 0,
  spawnTimer: 0,
  crateTimer: 0,
};

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

function resetGame() {
  state.gameOver = false;
  state.player = {
    x: W / 2,
    y: H / 2,
    r: 18,
    speed: 230,
    hp: 100,
    maxHp: 100,
    fireCd: 0,
    superCharge: 0,
    flash: 0,
  };
  state.enemies = [];
  state.bullets = [];
  state.particles = [];
  state.crates = [];
  state.score = 0;
  state.spawnTimer = 0;
  state.crateTimer = 1;
  restartButton.hidden = true;
}

function spawnEnemy() {
  const edge = Math.floor(Math.random() * 4);
  let x = 0;
  let y = 0;
  if (edge === 0) {
    x = Math.random() * W;
    y = -30;
  } else if (edge === 1) {
    x = W + 30;
    y = Math.random() * H;
  } else if (edge === 2) {
    x = Math.random() * W;
    y = H + 30;
  } else {
    x = -30;
    y = Math.random() * H;
  }

  state.enemies.push({
    x,
    y,
    r: 16,
    hp: 32 + Math.random() * 18,
    speed: 65 + Math.random() * 45,
    push: 0,
  });
}

function spawnCrate() {
  state.crates.push({
    x: 45 + Math.random() * (W - 90),
    y: 45 + Math.random() * (H - 90),
    r: 11,
    t: 8,
  });
}

function fireBullet(angle, power = 1) {
  const speed = 430 + 80 * power;
  state.bullets.push({
    x: state.player.x,
    y: state.player.y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    r: 5 + power,
    dmg: 12 + 6 * power,
    ttl: 0.9,
  });
}

function update(dt) {
  if (state.gameOver) return;

  const p = state.player;
  p.fireCd = Math.max(0, p.fireCd - dt);
  p.flash = Math.max(0, p.flash - dt);
  state.spawnTimer -= dt;
  state.crateTimer -= dt;

  if (state.spawnTimer <= 0) {
    spawnEnemy();
    const difficulty = 1 + state.score / 70;
    state.spawnTimer = clamp(1.15 / difficulty, 0.25, 1.15);
  }

  if (state.crateTimer <= 0) {
    spawnCrate();
    state.crateTimer = 7 + Math.random() * 4;
  }

  let mx = 0;
  let my = 0;
  if (keys.has('w')) my -= 1;
  if (keys.has('s')) my += 1;
  if (keys.has('a')) mx -= 1;
  if (keys.has('d')) mx += 1;
  if (mx || my) {
    const len = Math.hypot(mx, my);
    p.x += (mx / len) * p.speed * dt;
    p.y += (my / len) * p.speed * dt;
  }

  p.x = clamp(p.x, p.r, W - p.r);
  p.y = clamp(p.y, p.r, H - p.r);

  for (const crate of state.crates) {
    crate.t -= dt;
  }
  state.crates = state.crates.filter((crate) => crate.t > 0);

  state.crates = state.crates.filter((crate) => {
    if (dist(crate.x, crate.y, p.x, p.y) < crate.r + p.r) {
      p.hp = clamp(p.hp + 18, 0, p.maxHp);
      p.superCharge = clamp(p.superCharge + 16, 0, 100);
      state.score += 6;
      for (let i = 0; i < 8; i++) {
        state.particles.push({
          x: crate.x,
          y: crate.y,
          vx: (Math.random() - 0.5) * 140,
          vy: (Math.random() - 0.5) * 140,
          ttl: 0.45,
          c: '#8dff8d',
        });
      }
      return false;
    }
    return true;
  });

  for (const enemy of state.enemies) {
    const dx = p.x - enemy.x;
    const dy = p.y - enemy.y;
    const l = Math.hypot(dx, dy);
    enemy.x += (dx / l) * enemy.speed * dt;
    enemy.y += (dy / l) * enemy.speed * dt;
    enemy.push = Math.max(0, enemy.push - dt);

    if (dist(enemy.x, enemy.y, p.x, p.y) < enemy.r + p.r) {
      p.hp -= 24 * dt;
      p.flash = 0.1;
    }
  }

  state.bullets = state.bullets.filter((b) => {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.ttl -= dt;

    let alive = b.ttl > 0 && b.x > -20 && b.x < W + 20 && b.y > -20 && b.y < H + 20;
    if (!alive) return false;

    for (const enemy of state.enemies) {
      if (dist(b.x, b.y, enemy.x, enemy.y) < b.r + enemy.r) {
        enemy.hp -= b.dmg;
        enemy.push = 0.2;
        alive = false;
        state.particles.push({
          x: b.x,
          y: b.y,
          vx: (Math.random() - 0.5) * 110,
          vy: (Math.random() - 0.5) * 110,
          ttl: 0.2,
          c: '#ffcc73',
        });
        p.superCharge = clamp(p.superCharge + 8, 0, 100);
        break;
      }
    }

    return alive;
  });

  const before = state.enemies.length;
  state.enemies = state.enemies.filter((e) => e.hp > 0);
  const defeated = before - state.enemies.length;
  if (defeated > 0) {
    state.score += defeated * 10;
  }

  for (const pt of state.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.ttl -= dt;
  }
  state.particles = state.particles.filter((pt) => pt.ttl > 0);

  if (p.hp <= 0) {
    state.gameOver = true;
    restartButton.hidden = false;
  }

  hpValue.textContent = Math.max(0, Math.round(p.hp));
  scoreValue.textContent = state.score;
  superValue.textContent = `${Math.round(p.superCharge)}%`;
  enemyValue.textContent = state.enemies.length;
}

function draw() {
  const p = state.player;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#182147';
  ctx.fillRect(0, 0, W, H);

  for (let i = 0; i < 24; i++) {
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.07)';
    ctx.fillRect(i * 40, 0, 1, H);
  }

  for (const crate of state.crates) {
    ctx.fillStyle = '#7df585';
    ctx.beginPath();
    ctx.arc(crate.x, crate.y, crate.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0d3f17';
    ctx.fillRect(crate.x - 6, crate.y - 2, 12, 4);
  }

  for (const bullet of state.bullets) {
    ctx.fillStyle = '#ffd26b';
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const enemy of state.enemies) {
    ctx.fillStyle = '#ff6578';
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.r, 0, Math.PI * 2);
    ctx.fill();

    const w = 28;
    ctx.fillStyle = '#2d1020';
    ctx.fillRect(enemy.x - w / 2, enemy.y - enemy.r - 9, w, 4);
    ctx.fillStyle = '#84ffae';
    ctx.fillRect(enemy.x - w / 2, enemy.y - enemy.r - 9, w * clamp(enemy.hp / 50, 0, 1), 4);
  }

  for (const pt of state.particles) {
    ctx.globalAlpha = clamp(pt.ttl * 2, 0, 1);
    ctx.fillStyle = pt.c;
    ctx.fillRect(pt.x, pt.y, 3, 3);
    ctx.globalAlpha = 1;
  }

  const angle = Math.atan2(state.mouse.y - p.y, state.mouse.x - p.x);

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(angle);

  ctx.fillStyle = p.flash > 0 ? '#ffe3e3' : '#5bb0ff';
  ctx.beginPath();
  ctx.arc(0, 0, p.r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#104071';
  ctx.fillRect(8, -4, 18, 8);
  ctx.restore();

  const hpRatio = p.hp / p.maxHp;
  ctx.fillStyle = '#2d1020';
  ctx.fillRect(p.x - 24, p.y - 28, 48, 5);
  ctx.fillStyle = '#8dff8d';
  ctx.fillRect(p.x - 24, p.y - 28, 48 * hpRatio, 5);

  if (state.gameOver) {
    ctx.fillStyle = 'rgba(3,6,14,0.68)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 56px Segoe UI';
    ctx.fillText('GAME OVER', W / 2, H / 2 - 14);
    ctx.font = '26px Segoe UI';
    ctx.fillStyle = '#ffd26b';
    ctx.fillText(`Счёт: ${state.score}`, W / 2, H / 2 + 34);
  }
}

let lastTime = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

window.addEventListener('keydown', (e) => {
  keys.add(e.key.toLowerCase());

  if (e.code === 'Space' && !state.gameOver && state.player.superCharge >= 100) {
    const waves = 16;
    for (let i = 0; i < waves; i++) {
      fireBullet((Math.PI * 2 * i) / waves, 1.2);
    }
    state.player.superCharge = 0;
  }
});

window.addEventListener('keyup', (e) => {
  keys.delete(e.key.toLowerCase());
});

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const sx = canvas.width / rect.width;
  const sy = canvas.height / rect.height;
  state.mouse.x = (e.clientX - rect.left) * sx;
  state.mouse.y = (e.clientY - rect.top) * sy;
});

canvas.addEventListener('mousedown', () => {
  const p = state.player;
  if (state.gameOver || p.fireCd > 0) return;

  const angle = Math.atan2(state.mouse.y - p.y, state.mouse.x - p.x);
  fireBullet(angle, 0);
  p.fireCd = 0.16;
});

restartButton.addEventListener('click', resetGame);

resetGame();
requestAnimationFrame(loop);
