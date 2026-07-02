// ===================================================
// AVOID THE BLOCKS — game logic
// ===================================================

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const shakeWrap = document.getElementById('shake-wrap');

const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('high-score');
const finalScoreEl = document.getElementById('final-score');
const newBestEl = document.getElementById('new-best');

const startScreen = document.getElementById('start-screen');
const countdownScreen = document.getElementById('countdown-screen');
const countdownNumber = document.getElementById('countdown-number');
const pauseScreen = document.getElementById('pause-screen');
const gameoverScreen = document.getElementById('gameover-screen');

const playBtn = document.getElementById('play-btn');
const restartBtn = document.getElementById('restart-btn');
const btnLeft = document.getElementById('btn-left');
const btnRight = document.getElementById('btn-right');

// ---------- Canvas sizing ----------
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * devicePixelRatio;
  canvas.height = rect.height * devicePixelRatio;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}
window.addEventListener('resize', resizeCanvas);

// ---------- Game state ----------
const STATE = { START: 'start', COUNTDOWN: 'countdown', PLAYING: 'playing', PAUSED: 'paused', GAMEOVER: 'gameover' };
let state = STATE.START;

let highScore = Number(localStorage.getItem('avoidTheBlocksHighScore') || 0);
highScoreEl.textContent = highScore;

const PLAYER_SIZE = 30;
const player = { x: 0, y: 0, w: PLAYER_SIZE, h: PLAYER_SIZE, speed: 340, vx: 0 };

let blocks = [];
let coins = [];
let particles = [];

let elapsed = 0;          // seconds survived this run
let score = 0;
let lastDisplayedScore = -1;

let spawnTimer = 0;
let coinTimer = 0;
let lastFrameTime = 0;

let keys = { left: false, right: false };

// ---------- Difficulty scaling ----------
function getDifficulty(t) {
  let fallSpeed = 110;
  let spawnInterval = 1.1;
  let blockCount = 1;

  if (t >= 45) { fallSpeed = 340; spawnInterval = 0.35; blockCount = 3; }
  else if (t >= 30) { fallSpeed = 280; spawnInterval = 0.45; blockCount = 2; }
  else if (t >= 20) { fallSpeed = 230; spawnInterval = 0.55; blockCount = 2; }
  else if (t >= 10) { fallSpeed = 170; spawnInterval = 0.75; blockCount = 1; }

  return { fallSpeed, spawnInterval, blockCount };
}

// ---------- Helpers ----------
function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function rand(min, max) { return Math.random() * (max - min) + min; }

function spawnBlock() {
  const size = rand(24, 44);
  const diff = getDifficulty(elapsed);
  const colors = ['#ff3864', '#ff6b6b', '#ff2ea6'];
  blocks.push({
    x: rand(0, canvas.width / devicePixelRatio - size),
    y: -size,
    w: size,
    h: size,
    speed: diff.fallSpeed * rand(0.85, 1.2),
    color: colors[Math.floor(Math.random() * colors.length)]
  });
}

function spawnCoin() {
  const size = 16;
  coins.push({
    x: rand(0, canvas.width / devicePixelRatio - size),
    y: -size,
    w: size,
    h: size,
    speed: 150,
    spin: 0
  });
}

function spawnParticles(x, y, color, count = 18) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y,
      vx: rand(-220, 220),
      vy: rand(-220, 220),
      life: rand(0.4, 0.8),
      age: 0,
      color
    });
  }
}

function triggerShake() {
  shakeWrap.classList.remove('shake');
  void shakeWrap.offsetWidth;
  shakeWrap.classList.add('shake');
}

// ---------- Reset / start ----------
function resetGame() {
  const w = canvas.width / devicePixelRatio;
  const h = canvas.height / devicePixelRatio;
  player.x = w / 2 - PLAYER_SIZE / 2;
  player.y = h - PLAYER_SIZE - 16;
  blocks = [];
  coins = [];
  particles = [];
  elapsed = 0;
  score = 0;
  spawnTimer = 0;
  coinTimer = rand(3, 6);
  lastDisplayedScore = -1;
  scoreEl.textContent = '0';
}

function showScreen(el) {
  [startScreen, countdownScreen, pauseScreen, gameoverScreen].forEach(s => s.classList.add('hidden'));
  if (el) el.classList.remove('hidden');
}

function startCountdown() {
  resizeCanvas();
  resetGame();
  state = STATE.COUNTDOWN;
  showScreen(countdownScreen);
  let count = 3;
  countdownNumber.textContent = count;
  countdownNumber.style.animation = 'none';
  void countdownNumber.offsetWidth;
  countdownNumber.style.animation = '';

  const interval = setInterval(() => {
    count -= 1;
    if (count > 0) {
      countdownNumber.textContent = count;
      countdownNumber.style.animation = 'none';
      void countdownNumber.offsetWidth;
      countdownNumber.style.animation = '';
    } else if (count === 0) {
      countdownNumber.textContent = 'GO!';
      countdownNumber.style.animation = 'none';
      void countdownNumber.offsetWidth;
      countdownNumber.style.animation = '';
    } else {
      clearInterval(interval);
      showScreen(null);
      state = STATE.PLAYING;
      lastFrameTime = performance.now();
      requestAnimationFrame(loop);
    }
  }, 700);
}

function gameOver() {
  state = STATE.GAMEOVER;
  const finalScore = Math.floor(score);
  finalScoreEl.textContent = `Score: ${finalScore}`;
  if (finalScore > highScore) {
    highScore = finalScore;
    localStorage.setItem('avoidTheBlocksHighScore', String(highScore));
    highScoreEl.textContent = highScore;
    newBestEl.classList.remove('hidden');
  } else {
    newBestEl.classList.add('hidden');
  }
  showScreen(gameoverScreen);
  triggerShake();
  spawnParticles(player.x + player.w / 2, player.y + player.h / 2, '#7ef9ff', 26);
}

function togglePause() {
  if (state === STATE.PLAYING) {
    state = STATE.PAUSED;
    showScreen(pauseScreen);
  } else if (state === STATE.PAUSED) {
    state = STATE.PLAYING;
    showScreen(null);
    lastFrameTime = performance.now();
    requestAnimationFrame(loop);
  }
}

// ---------- Input ----------
window.addEventListener('keydown', (e) => {
  if (['ArrowLeft', 'a', 'A'].includes(e.key)) keys.left = true;
  if (['ArrowRight', 'd', 'D'].includes(e.key)) keys.right = true;
  if (e.key === 'p' || e.key === 'P') togglePause();
  if (e.key === ' ') {
    e.preventDefault();
    if (state === STATE.START || state === STATE.GAMEOVER) startCountdown();
  }
});
window.addEventListener('keyup', (e) => {
  if (['ArrowLeft', 'a', 'A'].includes(e.key)) keys.left = false;
  if (['ArrowRight', 'd', 'D'].includes(e.key)) keys.right = false;
});

playBtn.addEventListener('click', startCountdown);
restartBtn.addEventListener('click', startCountdown);

function bindHold(btn, onDown, onUp) {
  btn.addEventListener('touchstart', (e) => { e.preventDefault(); onDown(); }, { passive: false });
  btn.addEventListener('touchend', (e) => { e.preventDefault(); onUp(); });
  btn.addEventListener('mousedown', onDown);
  btn.addEventListener('mouseup', onUp);
  btn.addEventListener('mouseleave', onUp);
}
bindHold(btnLeft, () => keys.left = true, () => keys.left = false);
bindHold(btnRight, () => keys.right = true, () => keys.right = false);

// ---------- Main loop ----------
function loop(now) {
  if (state !== STATE.PLAYING) return;
  const dt = Math.min((now - lastFrameTime) / 1000, 0.05);
  lastFrameTime = now;

  update(dt);
  render();

  requestAnimationFrame(loop);
}

function update(dt) {
  const w = canvas.width / devicePixelRatio;
  const h = canvas.height / devicePixelRatio;

  elapsed += dt;
  score += dt * 10;

  const displayScore = Math.floor(score);
  if (displayScore !== lastDisplayedScore) {
    lastDisplayedScore = displayScore;
    scoreEl.textContent = displayScore;
    scoreEl.classList.remove('bump');
    void scoreEl.offsetWidth;
    scoreEl.classList.add('bump');
  }

  // player movement
  player.vx = 0;
  if (keys.left) player.vx -= player.speed;
  if (keys.right) player.vx += player.speed;
  player.x += player.vx * dt;
  player.x = Math.max(0, Math.min(w - player.w, player.x));

  // spawn blocks
  const diff = getDifficulty(elapsed);
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    for (let i = 0; i < diff.blockCount; i++) spawnBlock();
    spawnTimer = diff.spawnInterval;
  }

  // spawn coins
  coinTimer -= dt;
  if (coinTimer <= 0) {
    spawnCoin();
    coinTimer = rand(4, 7);
  }

  // update blocks
  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i];
    b.y += b.speed * dt;
    if (b.y > h) { blocks.splice(i, 1); continue; }
    if (rectsOverlap(player, b)) {
      gameOver();
      return;
    }
  }

  // update coins
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i];
    c.y += c.speed * dt;
    c.spin += dt * 6;
    if (c.y > h) { coins.splice(i, 1); continue; }
    if (rectsOverlap(player, c)) {
      score += 50;
      spawnParticles(c.x + c.w / 2, c.y + c.h / 2, '#ffd166', 12);
      coins.splice(i, 1);
    }
  }

  // update particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.age += dt;
    if (p.age >= p.life) { particles.splice(i, 1); continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 400 * dt;
  }
}

function drawRoundedRect(x, y, w, h, r, fill, glow) {
  ctx.save();
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = 14;
  }
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.restore();
}

function render() {
  const w = canvas.width / devicePixelRatio;
  const h = canvas.height / devicePixelRatio;
  ctx.clearRect(0, 0, w, h);

  // subtle grid floor
  ctx.strokeStyle = 'rgba(126,249,255,0.05)';
  ctx.lineWidth = 1;
  for (let gy = h - 20; gy > 0; gy -= 40) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(w, gy);
    ctx.stroke();
  }

  // blocks
  blocks.forEach(b => drawRoundedRect(b.x, b.y, b.w, b.h, 6, b.color, b.color));

  // coins
  coins.forEach(c => {
    ctx.save();
    ctx.translate(c.x + c.w / 2, c.y + c.h / 2);
    ctx.scale(Math.cos(c.spin), 1);
    ctx.fillStyle = '#ffd166';
    ctx.shadowColor = '#ffd166';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(0, 0, c.w / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // player
  drawRoundedRect(player.x, player.y, player.w, player.h, 7, '#7ef9ff', '#7ef9ff');

  // particles
  particles.forEach(p => {
    const alpha = 1 - p.age / p.life;
    ctx.save();
    ctx.globalAlpha = Math.max(alpha, 0);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    ctx.restore();
  });
}

// ---------- Init ----------
resizeCanvas();
showScreen(startScreen);
