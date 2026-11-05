const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const screens = {
  title: document.getElementById("titleScreen"),
  game: document.getElementById("gameScreen"),
  result: document.getElementById("resultScreen"),
};

const titleImage = document.getElementById("titleImage");
const startBtn = document.getElementById("startBtn");
const backTitleBtn = document.getElementById("backTitleBtn");
const retryBtn = document.getElementById("retryBtn");
const homeBtn = document.getElementById("homeBtn");

const turnText = document.getElementById("turnText");
const messageText = document.getElementById("messageText");
const tutorialHint = document.getElementById("tutorialHint");
const powerBar = document.getElementById("powerBar");

const resultImage = document.getElementById("resultImage");
const resultTitle = document.getElementById("resultTitle");
const resultComment = document.getElementById("resultComment");

const statusEls = {
  hippo: document.getElementById("statusHippo").parentElement,
  kappa: document.getElementById("statusKappa").parentElement,
  turtle: document.getElementById("statusTurtle").parentElement,
  newt: document.getElementById("statusNewt").parentElement,
};

const resultButtons = document.getElementById("resultButtons");
const shareButton = document.getElementById("shareButton");
const outNotice = document.getElementById("outNotice");
const bgm = new Audio("bgm.mp3");
bgm.loop = true;
bgm.volume = 0.22;
let shareResult = "";
let outNoticeUntil = 0;
const DESK = { left: 0, top: 0, right: canvas.width, bottom: canvas.height };

function hideResultButtons() {
  resultButtons.classList.remove("visible", "ready");
  resultButtons.inert = true;
  resultButtons.querySelectorAll("button").forEach(b => b.disabled = true);
}

function revealResultButtons() {
  hideResultButtons();
  schedule(() => {
    resultButtons.classList.add("visible");
    schedule(() => {
      resultButtons.classList.add("ready");
      resultButtons.inert = false;
      resultButtons.querySelectorAll("button").forEach(b => b.disabled = false);
    }, 350);
  }, 1500);
}

const W = canvas.width;
const H = canvas.height;

/*
  時計回り順：
  左下 カバ → 左上 河童 → 右上 カメ → 右下 うぱ
*/
const order = ["hippo", "kappa", "turtle", "newt"];

let pieces = [];
let turnIndex = 0;
let isDragging = false;
let dragStart = null;
let dragNow = null;
let moving = false;
let gameEnded = false;
let frameId = null;
let turnCount = 0;
let firstPlayerTurn = true;
let gameRunning = false;
let sessionId = 0;
const pendingTimers = new Set();

function schedule(callback, delay) {
  const session = sessionId;
  const timer = setTimeout(() => {
    pendingTimers.delete(timer);
    if (session === sessionId) callback();
  }, delay);
  pendingTimers.add(timer);
}

function stopGame() {
  gameRunning = false;
  bgm.pause();
  bgm.currentTime = 0;
  hideResultButtons();
  outNotice.hidden = true;
  outNoticeUntil = 0;
  sessionId++;
  cancelAnimationFrame(frameId);
  frameId = null;
  pendingTimers.forEach((timer) => clearTimeout(timer));
  pendingTimers.clear();
  isDragging = false;
  dragStart = null;
  dragNow = null;
  moving = false;
}

const images = {
  hippo: new Image(),
  kappa: new Image(),
  turtle: new Image(),
  newt: new Image(),
};

images.hippo.src = "hippo.png";
images.kappa.src = "kappa.png";
images.turtle.src = "turtle.png";
images.newt.src = "axolotl.png";

const data = {
  hippo: { name: "カバ", x: 60, y: H - 60 },
  kappa: { name: "河童", x: 60, y: 60 },
  turtle: { name: "カメ", x: W - 60, y: 60 },
  newt: { name: "うぱ", x: W - 60, y: H - 60 },
};

function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove("active"));
  screens[name].classList.add("active");
}

function resetGame() {
  pieces = order.map((id) => ({
    id,
    name: data[id].name,
    x: data[id].x,
    y: data[id].y,
    vx: 0,
    vy: 0,
    r: 24,
    alive: true,
  }));

  turnIndex = 0;
  isDragging = false;
  dragStart = null;
  dragNow = null;
  moving = false;
  gameEnded = false;
  turnCount = 0;
  firstPlayerTurn = true;

  powerBar.style.width = "0%";

  Object.values(statusEls).forEach((el) => {
    el.classList.remove("eliminated");
    el.classList.remove("current");
  });

  showScreen("game");
  updateTurnText();
  draw();
}

function getCurrentPiece() {
  for (let i = 0; i < order.length; i++) {
    const idx = (turnIndex + i) % order.length;
    const p = pieces.find((x) => x.id === order[idx]);

    if (p && p.alive) {
      turnIndex = idx;
      return p;
    }
  }

  return null;
}

function updateStatusUI(currentId) {
  Object.values(statusEls).forEach((el) => {
    el.classList.remove("current");
  });

  if (currentId && statusEls[currentId]) {
    statusEls[currentId].classList.add("current");
  }
}

function updateTurnText() {
  if (!gameRunning || gameEnded) return;

  const p = getCurrentPiece();
  if (!p) return;

  updateStatusUI(p.id);

  turnText.textContent = `${p.name}のターン`;

  if (p.id === "hippo") {
    messageText.textContent = firstPlayerTurn
      ? "ドラッグで引っ張る！"
      : "狙って引っ張ろう！";

    tutorialHint.style.display = firstPlayerTurn ? "block" : "none";
  } else {
    tutorialHint.style.display = "none";
    messageText.textContent = `${p.name}が狙っている…`;

    schedule(aiShot, 900);
  }
}

function nextTurn() {
  if (!gameRunning || gameEnded) return;

  const alive = pieces.filter((p) => p.alive);

  if (alive.length <= 1) {
    finishGame(alive[0]);
    return;
  }

  turnIndex = (turnIndex + 1) % order.length;
  turnCount++;

  if (turnCount > 0 && turnCount % 3 === 0 && Math.random() < 0.35) {
    teacherEvent();
  } else {
    updateTurnText();
  }
}

function teacherEvent() {
  messageText.textContent = "先生接近！机がゆれた！";
  tutorialHint.style.display = "none";

  pieces.forEach((p) => {
    if (!p.alive) return;

    p.vx += (Math.random() - 0.5) * 4;
    p.vy += (Math.random() - 0.5) * 4;
  });

  moving = true;
}

function aiShot() {
  if (!gameRunning || gameEnded || moving) return;

  const p = getCurrentPiece();
  if (!p || p.id === "hippo" || !p.alive) return;

  const targets = pieces.filter((t) => t.alive && t.id !== p.id);
  if (targets.length === 0) return;

  let target = targets[Math.floor(Math.random() * targets.length)];

  if (p.id === "kappa") {
    target = [...targets].sort((a, b) => dist(p, a) - dist(p, b))[0];
  }

  if (p.id === "turtle") {
    target = targets.find((t) => t.id === "hippo") || targets[0];
  }

  let dx = target.x - p.x;
  let dy = target.y - p.y;

  const len = Math.hypot(dx, dy) || 1;

  dx /= len;
  dy /= len;

  let power = 8;

  if (p.id === "kappa") power = 11;
  if (p.id === "turtle") power = 6.5;

  if (p.id === "newt") {
    power = 5 + Math.random() * 7;
    dx += (Math.random() - 0.5) * 0.9;
    dy += (Math.random() - 0.5) * 0.9;
  }

  p.vx = dx * power;
  p.vy = dy * power;

  messageText.textContent = `${p.name}のショット！`;
  moving = true;
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pointerPos(e) {
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;

  return {
    x: (clientX - rect.left) * (canvas.width / rect.width),
    y: (clientY - rect.top) * (canvas.height / rect.height),
  };
}

function startDrag(e) {
  const p = getCurrentPiece();

  if (!gameRunning || !p || p.id !== "hippo" || moving || gameEnded) return;

  const pos = pointerPos(e);

  if (Math.hypot(pos.x - p.x, pos.y - p.y) > 60) return;

  e.preventDefault();

  isDragging = true;
  dragStart = { x: p.x, y: p.y };
  dragNow = pos;

  tutorialHint.style.display = "none";
}

function moveDrag(e) {
  if (!isDragging) return;

  e.preventDefault();

  dragNow = pointerPos(e);

  const p = getCurrentPiece();
  const pull = Math.min(Math.hypot(dragNow.x - p.x, dragNow.y - p.y), 110);

  powerBar.style.width = `${Math.min(100, pull)}%`;
  messageText.textContent = "離して発射！";
}

function endDrag(e) {
  if (!isDragging) return;

  e.preventDefault();

  const p = getCurrentPiece();

  const dx = dragStart.x - dragNow.x;
  const dy = dragStart.y - dragNow.y;
  const len = Math.min(Math.hypot(dx, dy), 110);

  if (len < 12) {
    isDragging = false;
    powerBar.style.width = "0%";
    messageText.textContent = "もう少し引っ張ろう！";
    return;
  }

  const power = len / 9;
  const angle = Math.atan2(dy, dx);

  p.vx = Math.cos(angle) * power;
  p.vy = Math.sin(angle) * power;

  isDragging = false;
  firstPlayerTurn = false;
  powerBar.style.width = "0%";
  messageText.textContent = "カバのショット！";
  moving = true;
}

canvas.addEventListener("mousedown", startDrag);
canvas.addEventListener("mousemove", moveDrag);
canvas.addEventListener("mouseup", endDrag);
canvas.addEventListener("mouseleave", endDrag);

canvas.addEventListener("touchstart", startDrag, { passive: false });
canvas.addEventListener("touchmove", moveDrag, { passive: false });
canvas.addEventListener("touchend", endDrag, { passive: false });

function update() {
  if (!gameRunning || gameEnded) return;
  let anyMoving = false;
  const fallen = [];
  if (outNoticeUntil && performance.now() >= outNoticeUntil) {
    outNotice.hidden = true;
    outNoticeUntil = 0;
  }

  pieces.forEach((p) => {
    if (!p.alive) return;

    p.x += p.vx;
    p.y += p.vy;

    p.vx *= 0.965;
    p.vy *= 0.965;

    if (Math.abs(p.vx) + Math.abs(p.vy) > 0.12) {
      anyMoving = true;
    } else {
      p.vx = 0;
      p.vy = 0;
    }

    if (p.x < DESK.left || p.x > DESK.right || p.y < DESK.top || p.y > DESK.bottom) {
      p.alive = false;
      p.vx = 0;
      p.vy = 0;

      fallen.push(p.name);
      messageText.textContent = `${p.name} 脱落！`;

      if (statusEls[p.id]) {
        statusEls[p.id].classList.add("eliminated");
        statusEls[p.id].classList.remove("current");
      }
    }
  });

  if (fallen.length) {
    outNotice.textContent = fallen.join("・") + " 脱落！";
    outNotice.hidden = false;
    outNoticeUntil = performance.now() + 1000;
  }
  collisionCheck();

  const alive = pieces.filter((p) => p.alive);

  if (alive.length <= 1 && !gameEnded) {
    finishGame(alive[0]);
    return;
  }

  if (moving && !anyMoving) {
    moving = false;
    schedule(nextTurn, 700);
  }
}

function collisionCheck() {
  for (let i = 0; i < pieces.length; i++) {
    for (let j = i + 1; j < pieces.length; j++) {
      const a = pieces[i];
      const b = pieces[j];

      if (!a.alive || !b.alive) continue;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const minD = a.r + b.r;

      if (d > 0 && d < minD) {
        const nx = dx / d;
        const ny = dy / d;

        const overlap = minD - d;

        a.x -= nx * overlap * 0.5;
        a.y -= ny * overlap * 0.5;
        b.x += nx * overlap * 0.5;
        b.y += ny * overlap * 0.5;

        const av = a.vx * nx + a.vy * ny;
        const bv = b.vx * nx + b.vy * ny;

        const impulse = bv - av;

        a.vx += impulse * nx;
        a.vy += impulse * ny;
        b.vx -= impulse * nx;
        b.vy -= impulse * ny;

        a.vx *= 1.08;
        a.vy *= 1.08;
        b.vx *= 1.08;
        b.vy *= 1.08;
      }
    }
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  drawDesk();
  drawAim();

  pieces.forEach((p) => {
    if (!p.alive) return;

    ctx.save();
    ctx.translate(p.x, p.y);

    const img = images[p.id];

    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -26, -26, 52, 52);
    } else {
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "#333";
      ctx.lineWidth = 3;
      roundRect(ctx, -26, -26, 52, 52, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#333";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(p.name, 0, 0);
    }

    ctx.restore();
  });


}

function drawDesk() {
  ctx.fillStyle = "#d6b37a";
  ctx.fillRect(DESK.left, DESK.top, DESK.right - DESK.left, DESK.bottom - DESK.top);

  ctx.strokeStyle = "rgba(100, 60, 20, 0.35)";
  ctx.lineWidth = 2;

  for (let y = 50; y < H; y += 70) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y + 16);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
  ctx.fillRect(14, 14, W - 28, H - 28);

  ctx.strokeStyle = "#6a4524";
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, W - 8, H - 8);
}

function drawAim() {
  if (!isDragging || !dragNow) return;

  const p = getCurrentPiece();
  if (!p) return;

  const dx = p.x - dragNow.x;
  const dy = p.y - dragNow.y;

  const len = Math.min(Math.hypot(dx, dy), 110);
  const angle = Math.atan2(dy, dx);

  ctx.strokeStyle = "#ff3b30";
  ctx.lineWidth = 5;

  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(
    p.x + Math.cos(angle) * len,
    p.y + Math.sin(angle) * len
  );
  ctx.stroke();

  ctx.fillStyle = "#ff3b30";

  ctx.beginPath();
  ctx.arc(
    p.x + Math.cos(angle) * len,
    p.y + Math.sin(angle) * len,
    7,
    0,
    Math.PI * 2
  );
  ctx.fill();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();

  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);

  ctx.closePath();
}

function loop() {
  frameId = null;
  if (!gameRunning || gameEnded) return;
  update();
  draw();
  if (gameRunning && !gameEnded) {
    frameId = requestAnimationFrame(loop);
  }
}

function finishGame(winner) {
  if (!gameRunning || gameEnded) return;

  gameEnded = true;
  stopGame();
  tutorialHint.style.display = "none";
  powerBar.style.width = "0%";

  Object.values(statusEls).forEach((el) => el.classList.remove("current"));

  cancelAnimationFrame(frameId);

  if (winner && winner.id === "hippo") {
    resultImage.src = "result_win.png";
    resultTitle.textContent = "優勝！";
    resultComment.innerHTML = "放課後の王者！<br>最後まで机に残った！";
  } else {
    resultImage.src = "result_lose.png";
    resultTitle.textContent = "負けてしまった…";

    resultComment.innerHTML = winner
      ? `${winner.name}が優勝！<br>また挑戦しよう！`
      : "全員落下！<br>机の上は大混乱！";
  }

  shareResult = winner && winner.id === "hippo"
    ? "最後まで机に残った！✏️\n結果：優勝！"
    : winner ? `机から落ちちゃった！✏️\n結果：負け（${winner.name}が優勝）`
    : "机の上は大混乱！✏️\n結果：全員落下";
  outNotice.textContent = "決着！";
  outNotice.hidden = false;
  schedule(() => {
    outNotice.hidden = true;
    showScreen("result");
    revealResultButtons();
  }, 1000);
}

function startGame() {
  stopGame();
  gameRunning = true;
  resetGame();
  bgm.currentTime = 0;
  bgm.play().catch(() => {});
  frameId = requestAnimationFrame(loop);
}

titleImage.addEventListener("click", startGame);
startBtn.addEventListener("click", startGame);
function returnToTitle() {
  stopGame();
  showScreen("title");
}
retryBtn.addEventListener("click", returnToTitle);
shareButton.addEventListener("click", () => {
  if (shareButton.disabled) return;
  const gameURL = new URL(".", location.href).href;
  const text = shareResult + '\n無料ブラウザゲーム「放課後消しピンバトル」\n'
    + gameURL + '\n#放課後消しピンバトル\n#カバゲーセン';
  window.open("https://twitter.com/intent/tweet?text=" + encodeURIComponent(text),
    "_blank", "noopener,noreferrer");
});

backTitleBtn.addEventListener("click", () => {
  stopGame();
  showScreen("title");
});

homeBtn.addEventListener("click", () => {
  location.href = "https://afoolhippo.github.io/home/?skipTitle=1";
});

showScreen("title");
