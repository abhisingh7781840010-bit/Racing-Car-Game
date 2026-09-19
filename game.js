const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const levelEl = document.getElementById("level");
const bestEl = document.getElementById("best");

const overlay = document.getElementById("overlay");
const title = document.getElementById("title");
const message = document.getElementById("message");
const mainButton = document.getElementById("mainButton");

const W = canvas.width;
const H = canvas.height;

const backgroundMusic = new Audio("game%20sound.mp3");
backgroundMusic.loop = true;
backgroundMusic.volume = 0.45;
backgroundMusic.preload = "auto";

let audioCtx = null;
let soundUnlocked = false;

function ensureAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    audioCtx = new AudioContextClass();
  }

  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }

  return audioCtx;
}

function unlockGameAudio() {
  if (soundUnlocked) return;

  ensureAudioContext();
  soundUnlocked = true;
  startBackgroundMusic();
}

function startBackgroundMusic() {
  if (!backgroundMusic) return;

  if (!soundUnlocked) {
    unlockGameAudio();
    return;
  }

  backgroundMusic.currentTime = 0;
  backgroundMusic.play().catch(() => {});
}

function playCrashSound() {
  const ctx = ensureAudioContext();
  if (!ctx) return;

  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.type = "sawtooth";
  oscillator.frequency.setValueAtTime(190, ctx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(38, ctx.currentTime + 0.24);

  gainNode.gain.setValueAtTime(0.001, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.26, ctx.currentTime + 0.015);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.24);

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.start();
  oscillator.stop(ctx.currentTime + 0.24);
}


const road = {
  x: 190,
  width: 520
};

const carAssets = [
  "racecar.png",
  "racecar(1).png",
  
  "race2.webp"
];

const playerImageSrc = "racecar.png";
const enemyCarImageSources = carAssets.filter(src => src !== playerImageSrc);

let playerImage = new Image();
playerImage.src = playerImageSrc;

const enemyCarImages = [];

for (const src of enemyCarImageSources) {
  const enemyImage = new Image();
  enemyImage.src = src;
  enemyImage.onload = () => {
    enemyCarImages.push(enemyImage);
  };
}

const input = {
  left: false,
  right: false
};

let gameState = "start";
let score = 0;
let lives = 3;
let level = 1;
let best = Number(localStorage.getItem("neonHighwayBest") || 0);
let lastTime = 0;
let roadOffset = 0;
let trafficTimer = 0;
let powerTimer = 0;
let shake = 0;

const player = {
  x: W / 2 - 31,
  y: H - 112,
  width: 72,
  height: 92,
  speed: 410,
  invincible: 0
};

let traffic = [];
let powerups = [];
let particles = [];

bestEl.textContent = best;

function resetGame() {
  score = 0;
  lives = 3;
  level = 1;
  roadOffset = 0;
  trafficTimer = 0.4;
  powerTimer = 3;
  shake = 0;

  traffic = [];
  powerups = [];
  particles = [];

  player.x = W / 2 - player.width / 2;
  player.invincible = 1.2;

  updateHUD();
}

function updateHUD() {
  scoreEl.textContent = Math.floor(score);
  livesEl.textContent = lives;
  levelEl.textContent = level;
  bestEl.textContent = best;
}

function laneCenter(lane) {
  return road.x + lane * (road.width / 3) + road.width / 6;
}

function randomEnemyCarImage() {
  if (enemyCarImages.length === 0) {
    return new Image();
  }

  return enemyCarImages[Math.floor(Math.random() * enemyCarImages.length)];
}

function spawnTraffic() {
  const lane = Math.floor(Math.random() * 3);

  traffic.push({
    x: laneCenter(lane) - 31,
    y: -110,
    width: 72,
    height: 92,
    speed: 200 + level * 22 + Math.random() * 60,
    sprite: randomEnemyCarImage()
  });
}

function spawnPowerup() {
  const lane = Math.floor(Math.random() * 3);

  powerups.push({
    x: laneCenter(lane),
    y: -24,
    radius: 13,
    speed: 180 + level * 12
  });
}

function rectanglesOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function circleHitsRect(circle, rect) {
  const nearestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
  const nearestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));
  const dx = circle.x - nearestX;
  const dy = circle.y - nearestY;
  const touchPadding = 0;

  return dx * dx + dy * dy <= (circle.radius + touchPadding) ** 2;
}

function createBurst(x, y, count = 22, particleColor = "#59d7ff") {
  for (let i = 0; i < count; i++) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 230,
      vy: (Math.random() - 0.5) * 330,
      life: 0.45 + Math.random() * 0.75,
      size: 2 + Math.random() * 4,
      color: particleColor
    });
  }
}

function loseLife() {
  if (player.invincible > 0) return;
  playCrashSound();

  lives--;
  player.invincible = 1.5;
  shake = 13;

  createBurst(
    player.x + player.width / 2,
    player.y + player.height / 2,
    30,
    "#ff5377"
  );

  if (lives <= 0) {
    endGame();
  }

  updateHUD();
}

function stopAllSounds() {
  backgroundMusic.pause();
  backgroundMusic.currentTime = 0;

  if (audioCtx && audioCtx.state !== "closed") {
    audioCtx.close().catch(() => {});
    audioCtx = null;
  }
}

function endGame() {
  gameState = "gameover";
  playCrashSound();
  stopAllSounds();

  best = Math.max(best, Math.floor(score));
  localStorage.setItem("neonHighwayBest", best);
  updateHUD();

  title.textContent = "GAME OVER";
  message.innerHTML =
    `Final score: <b>${Math.floor(score)}</b><br>` +
    `Best score: <b>${best}</b>`;

  mainButton.textContent = "RACE AGAIN";
  overlay.classList.remove("hidden");
}

function startGame() {
  unlockGameAudio();
  resetGame();
  gameState = "playing";
  overlay.classList.add("hidden");
  startBackgroundMusic();
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

function pauseGame() {
  if (gameState === "playing") {
    gameState = "paused";
    title.textContent = "PAUSED";
    message.textContent = "Press P or Resume to continue.";
    mainButton.textContent = "RESUME";
    overlay.classList.remove("hidden");
  } else if (gameState === "paused") {
    gameState = "playing";
    overlay.classList.add("hidden");
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
  }
}

function drawBackground() {
  ctx.fillStyle = "#05070b";
  ctx.fillRect(0, 0, W, H);

  // Road only, no grass or extra environment.
  ctx.fillStyle = "#2a2e36";
  ctx.fillRect(road.x, 0, road.width, H);

  ctx.fillStyle = "#1a1d24";
  ctx.fillRect(road.x + 10, 0, road.width - 20, H);

  // Road edges.
  ctx.fillStyle = "#f2f0d8";
  ctx.fillRect(road.x + 10, 0, 5, H);
  ctx.fillRect(road.x + road.width - 15, 0, 5, H);

  // Lane markings.
  ctx.fillStyle = "#e7ebf0";

  for (let lane = 1; lane < 3; lane++) {
    const x = road.x + lane * road.width / 3 - 3;

    for (let y = -80 + (roadOffset % 92); y < H; y += 92) {
      ctx.fillRect(x, y, 6, 48);
    }
  }
}

function drawCar(image, car) {
  ctx.save();

  ctx.globalAlpha = 1;

  ctx.drawImage(
    image,
    car.x,
    car.y,
    car.width,
    car.height
  );

  ctx.restore();
}

function drawPowerup(powerup) {
  ctx.save();

  ctx.fillStyle = "#59d7ff";
  ctx.beginPath();
  ctx.arc(powerup.x, powerup.y, powerup.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 17px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("⚡", powerup.x, powerup.y + 1);
  ctx.restore();
}

function update(dt) {
  const highwaySpeed = 300 + level * 35;

  roadOffset += highwaySpeed * dt;
  score += dt * (12 + level * 3);

  level = 1 + Math.floor(score / 500);

  player.invincible = Math.max(0, player.invincible - dt);

  const direction =
    (input.right ? 1 : 0) -
    (input.left ? 1 : 0);

  player.x += direction * player.speed * dt;

  player.x = Math.max(
    road.x + 18,
    Math.min(
      road.x + road.width - player.width - 18,
      player.x
    )
  );

  trafficTimer -= dt;

  if (trafficTimer <= 0) {
    spawnTraffic();
    trafficTimer = Math.max(0.28, 0.86 - level * 0.035);
  }

  powerTimer -= dt;

  if (powerTimer <= 0) {
    if (Math.random() < 0.65) spawnPowerup();
    powerTimer = 4.5 + Math.random() * 3.5;
  }

  for (const car of traffic) {
    car.y += car.speed * dt;
  }

  for (const car of traffic) {
    if (rectanglesOverlap(player, car)) {
      loseLife();
    }
  }

  traffic = traffic.filter(car => car.y < H + 120);

  for (const powerup of powerups) {
    powerup.y += powerup.speed * dt;
  }

  for (let i = powerups.length - 1; i >= 0; i--) {
    if (circleHitsRect(powerups[i], player)) {
      score += 120;
      player.invincible = 2;
      createBurst(powerups[i].x, powerups[i].y, 18, "#59d7ff");
      powerups.splice(i, 1);
    }
  }

  powerups = powerups.filter(p => p.y < H + 40);

  for (const particle of particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 360 * dt;
    particle.life -= dt;
  }
  
}

function setInputState(key, pressed) {
  const normalizedKey = key.toLowerCase();

  if (["arrowleft", "a", "left"].includes(normalizedKey)) {
    input.left = pressed;
  }

  if (["arrowright", "d", "right"].includes(normalizedKey)) {
    input.right = pressed;
  }
}

function render() {
  ctx.save();

  

  drawBackground();

  for (const powerup of powerups) {
    drawPowerup(powerup);
  }

  for (const car of traffic) {
    drawCar(car.sprite || new Image(), car);
  }

  drawCar(playerImage, player);

  for (const particle of particles) {
    ctx.globalAlpha = Math.max(0, particle.life);
    ctx.fillStyle = particle.color;
    ctx.fillRect(
      particle.x,
      particle.y,
      particle.size,
      particle.size
    );
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

function gameLoop(time) {
  if (gameState !== "playing") return;

  const dt = Math.min(0.033, (time - lastTime) / 1000);
  lastTime = time;

  update(dt);
  render();

  requestAnimationFrame(gameLoop);
}

// Keyboard controls.
window.addEventListener("keydown", event => {
  if (
    ["ArrowLeft", "ArrowRight", "a", "A", "d", "D", "p", "P", "r", "R", " "]
      .includes(event.key)
  ) {
    event.preventDefault();
  }

  setInputState(event.key, true);

  if (event.key === "p" || event.key === "P") {
    pauseGame();
  }

  if (event.key === "r" || event.key === "R") {
    startGame();
  }

  if (event.key === " " && gameState === "start") {
    startGame();
  }
});

window.addEventListener("keyup", event => {
  setInputState(event.key, false);
});

// Mobile controls.
document.querySelectorAll(".touch-controls button").forEach(button => {
  const key = button.dataset.key;

  const press = event => {
    event.preventDefault();
    setInputState(key, true);
  };

  const release = () => {
    setInputState(key, false);
  };

  button.addEventListener("pointerdown", press);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("pointerleave", release);
});

mainButton.addEventListener("click", () => {
  unlockGameAudio();

  if (gameState === "paused") {
    pauseGame();
  } else {
    startGame();
  }
});

window.addEventListener("pointerdown", unlockGameAudio, { once: true });
window.addEventListener("keydown", unlockGameAudio, { once: true });

// Initial screen.
render();
