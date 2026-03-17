import './style.css';

// ─── Constants ───────────────────────────────────────────────────────────────
const COLS = 50, ROWS = 16, TOTAL = COLS * ROWS;
const CW = 12, CH = 8, GAP = 1;
const SW = CW + GAP;   // 13
const SH = CH + GAP;   //  9
// Cell origin offset (grid has 2px padding)
const OX = 2, OY = 2;

// Cell types
const T = Object.freeze({
  FREE:0, USED:1, SYS:2, BAD:3, FLAG:4, BOMB:5, QMARK:6, EXPL:7
});
const CLS = ['free','used','sys','bad','flag','bomb','qmark','expl'];
const LBL = ['','','','','F','B','?','!'];

const EMOJI_POOL = [
  '🍕','🦄','🎸','🐙','🌮','🎃','👾','🦊',
  '🐸','🍄','🌈','💀','🤖','🦋','🔮','🍑',
  '🧲','🎺','🌵','🎯','🥑','🦑','🍔','🤠',
  '🧸','🦞','🌶️','🎲','🕹️','🫀','🐡','🫧'
];

// ─── State ────────────────────────────────────────────────────────────────────
let cells       = [];
let defragHead  = 0;
let defragActive   = false;
let defragComplete = false;
let elapsed     = 0;
let totalUsedInit = 0;
let swapCount   = 0;
let lastDefragTs= 0, lastTimerTs = 0;
let emojis      = [], nextEid = 0;
let pacman      = null;
let rafId       = null;
let dotPool     = [];   // reusable pac-dot positions

// ─── DOM refs ────────────────────────────────────────────────────────────────
let $grid, $entities, $progressBar, $progressPct, $clusterInfo,
    $status, $timer, $doneOverlay;

// ─── HTML scaffold ───────────────────────────────────────────────────────────
function buildApp() {
  document.getElementById('app').innerHTML = `
<div id="screen">
  <div id="titlebar">
    <span>&#9608; MS-DOS DEFRAGMENTATION UTILITY  v6.22 &#9608;<span class="blink-cur">&#9612;</span></span>
    <span>Drive C: &nbsp;[FAT-32]&nbsp; 2,048 MB</span>
  </div>

  <div id="content">
    <div id="grid-wrap">
      <div id="grid"></div>
      <div id="entities"></div>
    </div>

    <div id="legend">
      <span class="li"><span class="lbox used"></span>Used</span>
      <span class="li"><span class="lbox free"></span>Free</span>
      <span class="li"><span class="lbox sys"></span>Unmovable</span>
      <span class="li"><span class="lbox bad"></span>Bad Sector</span>
      <span class="li"><span class="lbox flag">F</span>FLAG &mdash; click &#8594; CHOMPER</span>
      <span class="li"><span class="lbox bomb">B</span>BOMB &mdash; click &#8594; KA-BOOM</span>
      <span class="li"><span class="lbox qmark">?</span>UNKNOWN &mdash; click &#8594; ANOMALIES</span>
    </div>

    <div id="progress-row">
      <span id="progress-label">Progress:</span>
      <span id="progress-bar">[&#9617;&#9617;&#9617;&#9617;&#9617;&#9617;&#9617;&#9617;&#9617;&#9617;&#9617;&#9617;&#9617;&#9617;&#9617;&#9617;&#9617;&#9617;&#9617;&#9617;&#9617;&#9617;&#9617;&#9617;&#9617;&#9617;&#9617;&#9617;&#9617;&#9617;&#9617;&#9617;&#9617;&#9617;&#9617;&#9617;&#9617;&#9617;&#9617;&#9617;]</span>
      <span id="progress-pct">&nbsp;&nbsp;0%</span>
    </div>
    <div id="cluster-info">Clusters: 000000 / ${String(TOTAL).padStart(6,'0')} &nbsp;&nbsp; Swap operations: 0</div>
  </div>

  <div id="controls">
    [P]&nbsp;Pause/Resume &nbsp;&#9553;&nbsp; [R]&nbsp;Restart &nbsp;&#9553;&nbsp;
    Click <b style="color:#FFFF55">FLAG</b> &#8594; deploy CHOMPER &nbsp;&#9553;&nbsp;
    Click <b style="color:#FF6600">BOMB</b> &#8594; detonate &nbsp;&#9553;&nbsp;
    Click <b style="color:#55FFFF">?</b> &#8594; release anomalies
  </div>

  <div id="statusbar">
    <span id="status">Initializing drive C: ...</span>
    <span id="timer">Elapsed: 00:00:00</span>
  </div>

  <div id="done-overlay">
    <div id="done-box">
      <h2>&#9608;&#9608; DEFRAGMENTATION COMPLETE &#9608;&#9608;</h2>
      <p>${TOTAL} clusters verified &nbsp;&bull;&nbsp; Drive C: optimized<br/>Press [R] to run again</p>
    </div>
  </div>
</div>`;

  $grid        = document.getElementById('grid');
  $entities    = document.getElementById('entities');
  $progressBar = document.getElementById('progress-bar');
  $progressPct = document.getElementById('progress-pct');
  $clusterInfo = document.getElementById('cluster-info');
  $status      = document.getElementById('status');
  $timer       = document.getElementById('timer');
  $doneOverlay = document.getElementById('done-overlay');
}

// ─── Cell init ────────────────────────────────────────────────────────────────
function initCells() {
  cells = [];
  for (let i = 0; i < TOTAL; i++) {
    const r = Math.random();
    let type;
    if      (r < 0.033) type = T.FLAG;
    else if (r < 0.066) type = T.BOMB;
    else if (r < 0.10 ) type = T.QMARK;
    else if (r < 0.148) type = T.SYS;
    else if (r < 0.165) type = T.BAD;
    else if (r < 0.640) type = T.USED;
    else                type = T.FREE;
    cells.push({ type, el: null });
  }
  totalUsedInit = cells.filter(c => c.type === T.USED).length;
  swapCount = 0;
}

// ─── Grid render ─────────────────────────────────────────────────────────────
function renderGrid() {
  $grid.innerHTML = '';
  const frag = document.createDocumentFragment();
  cells.forEach((c, i) => {
    const el = document.createElement('div');
    el.className = `cell ${CLS[c.type]}`;
    el.textContent = LBL[c.type];
    el.dataset.i = i;
    c.el = el;
    frag.appendChild(el);
  });
  $grid.appendChild(frag);

  $grid.addEventListener('click', e => {
    const el = e.target.closest('[data-i]');
    if (el) handleClick(+el.dataset.i);
  });
}

function setType(i, type) {
  cells[i].type = type;
  cells[i].el.className = `cell ${CLS[type]}`;
  cells[i].el.textContent = LBL[type];
}

function flashCell(i, color, ms = 180) {
  const el = cells[i].el;
  el.style.background = color;
  setTimeout(() => { if (el) el.style.background = ''; }, ms);
}

// ─── Defrag algorithm ─────────────────────────────────────────────────────────
function defragStep() {
  if (!defragActive || defragComplete) return;

  for (let ops = 0; ops < 5; ops++) {
    // advance head past non-FREE cells
    while (defragHead < TOTAL && cells[defragHead].type !== T.FREE) defragHead++;
    if (defragHead >= TOTAL) { finishDefrag(); return; }

    // find the next USED cell (skip everything else)
    let src = -1;
    for (let j = defragHead + 1; j < TOTAL; j++) {
      if (cells[j].type === T.USED) { src = j; break; }
    }
    if (src === -1) { finishDefrag(); return; }

    // flash read/write, then swap
    const dst = defragHead;
    flashCell(src, '#55FFFF', 170);
    flashCell(dst, '#FF55FF', 170);
    setType(dst, T.USED);
    setType(src, T.FREE);
    defragHead++;
    swapCount++;
  }

  updateProgress();

  if (swapCount % 60 === 0) {
    const clus = String(defragHead).padStart(6,'0');
    setStatus(`Moving cluster ${clus} ... [${swapCount} blocks optimized]`);
  }
}

function finishDefrag() {
  defragComplete = true;
  defragActive   = false;
  updateProgress();
  setStatus(`▓▓ Defragmentation complete. ${swapCount} cluster operations performed. ▓▓`, true);
  setTimeout(() => { $doneOverlay.classList.add('visible'); }, 1200);
}

function updateProgress() {
  const pct   = Math.min(100, Math.round(defragHead / TOTAL * 100));
  const W     = 40;
  const filled = Math.round(pct / 100 * W);
  $progressBar.textContent = '[' + '▓'.repeat(filled) + '░'.repeat(W - filled) + ']';
  $progressPct.textContent = String(pct).padStart(3) + '%';
  $clusterInfo.textContent =
    `Clusters: ${String(defragHead).padStart(6,'0')} / ${String(TOTAL).padStart(6,'0')}` +
    `    Swap operations: ${swapCount}` +
    (emojis.filter(e=>e.alive).length > 0 ? `    Anomalous entities: ${emojis.filter(e=>e.alive).length}` : '');
}

// ─── Click dispatch ───────────────────────────────────────────────────────────
function handleClick(i) {
  switch (cells[i].type) {
    case T.BOMB:  detonateBomb(i);    break;
    case T.QMARK: releaseAnomalies(i); break;
    case T.FLAG:  releaseChomper(i);  break;
  }
}

// ─── BOMB ─────────────────────────────────────────────────────────────────────
function detonateBomb(i) {
  const col = i % COLS, row = Math.floor(i / COLS);

  setType(i, T.EXPL);
  cells[i].el.textContent = '💥';

  setStatus(`⚠ CRITICAL: Sector ${i} explosive decompression! Cluster integrity FAILING!`, true);
  spawnBlast(i);

  // ripple destruction — first ring after 200ms, second after 450ms
  const rings = [1, 2];
  rings.forEach((radius, ri) => {
    setTimeout(() => {
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          if (Math.abs(dr) !== radius && Math.abs(dc) !== radius) continue; // ring only
          const r2 = row + dr, c2 = col + dc;
          if (r2 < 0 || r2 >= ROWS || c2 < 0 || c2 >= COLS) continue;
          const adj = r2 * COLS + c2;
          if (cells[adj].type === T.USED || cells[adj].type === T.FREE) {
            setType(adj, T.BAD);
            flashCell(adj, '#FF2200', 300);
          }
        }
      }
    }, 200 + ri * 220);
  });

  setTimeout(() => {
    if (cells[i].type === T.EXPL) setType(i, T.BAD);
  }, 500);
}

function spawnBlast(srcIdx) {
  const col = srcIdx % COLS, row = Math.floor(srcIdx / COLS);
  const cx = OX + col * SW + CW / 2;
  const cy = OY + row * SH + CH / 2;
  const SYMS = ['💥','🔥','⚡','💨','🌋','🌀','☢️','🔴'];

  for (let k = 0; k < 10; k++) {
    const el = document.createElement('div');
    el.className = 'blast-particle';
    el.textContent = SYMS[k % SYMS.length];
    el.style.left = cx + 'px';
    el.style.top  = cy + 'px';
    const ang  = (k / 10) * Math.PI * 2 + Math.random() * 0.5;
    const dist = 18 + Math.random() * 28;
    el.style.setProperty('--dx', (Math.cos(ang) * dist) + 'px');
    el.style.setProperty('--dy', (Math.sin(ang) * dist) + 'px');
    $entities.appendChild(el);
    setTimeout(() => el.remove(), 800);
  }
}

// ─── QUESTION MARK ────────────────────────────────────────────────────────────
function releaseAnomalies(i) {
  setType(i, T.FREE);
  const col = i % COLS, row = Math.floor(i / COLS);
  const ox = OX + col * SW;
  const oy = OY + row * SH;
  const count = 4 + Math.floor(Math.random() * 5);

  for (let k = 0; k < count; k++) {
    spawnEmoji(ox + Math.random() * 8 - 4, oy + Math.random() * 5 - 2.5);
  }

  setStatus(
    `Unknown entity cluster ${i} breached. ${count} anomalous objects escaped containment.`,
    true
  );
}

// ─── FLAG ─────────────────────────────────────────────────────────────────────
function releaseChomper(i) {
  setType(i, T.FREE);
  const col = i % COLS, row = Math.floor(i / COLS);
  spawnPacman(col, row);
  setStatus(`⚑ FLAG cluster ${i}: CHOMPER protocol activated. Anomaly containment in progress.`, true);
}

// ─── Emoji entities ───────────────────────────────────────────────────────────
function spawnEmoji(x, y) {
  const char  = EMOJI_POOL[Math.floor(Math.random() * EMOJI_POOL.length)];
  const el    = document.createElement('div');
  el.className = 'ent-emoji';
  el.textContent = char;
  $entities.appendChild(el);

  const angle = Math.random() * Math.PI * 2;
  const speed = 0.7 + Math.random() * 1.6;
  const e = {
    id: nextEid++, x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    el, alive: true
  };
  el.style.left = Math.round(x) + 'px';
  el.style.top  = Math.round(y) + 'px';
  emojis.push(e);
}

function updateEmojis() {
  const maxX = OX + COLS * SW - 14;
  const maxY = OY + ROWS * SH - 14;
  const minX = OX;
  const minY = OY;

  for (const e of emojis) {
    if (!e.alive) continue;
    e.x += e.vx;
    e.y += e.vy;

    if (e.x < minX) { e.x = minX; e.vx =  Math.abs(e.vx); }
    if (e.x > maxX) { e.x = maxX; e.vx = -Math.abs(e.vx); }
    if (e.y < minY) { e.y = minY; e.vy =  Math.abs(e.vy); }
    if (e.y > maxY) { e.y = maxY; e.vy = -Math.abs(e.vy); }

    e.el.style.left = Math.round(e.x) + 'px';
    e.el.style.top  = Math.round(e.y) + 'px';
  }

  // prune fully gone entries
  emojis = emojis.filter(e => e.alive || (e.el && e.el.parentNode));
}

// ─── Pac-Man (CHOMPER) ────────────────────────────────────────────────────────
function spawnPacman(col, row) {
  const startX = OX + col * SW;
  const startY = OY + row * SH;

  if (pacman) {
    // teleport to new flag location
    pacman.x = startX;
    pacman.y = startY;
    pacman.el.style.left = startX + 'px';
    pacman.el.style.top  = startY + 'px';
    return;
  }

  const el = document.createElement('div');
  el.className  = 'ent-pac mouth-open';
  el.dataset.dir = '0';
  $entities.appendChild(el);
  el.style.left = startX + 'px';
  el.style.top  = startY + 'px';

  pacman = { x: startX, y: startY, dir: 0, step: 0, mouthOpen: true, el };
}

function updatePacman() {
  if (!pacman) return;
  const alive = emojis.filter(e => e.alive);
  if (!alive.length) return;

  // nearest emoji target
  let target = null, minD = Infinity;
  for (const e of alive) {
    const d = (e.x - pacman.x) ** 2 + (e.y - pacman.y) ** 2;
    if (d < minD) { minD = d; target = e; }
  }
  if (!target) return;

  const spd = 2.0;
  const dx = target.x - pacman.x;
  const dy = target.y - pacman.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    pacman.x += Math.sign(dx) * spd;
    pacman.dir = dx > 0 ? 0 : 2;
  } else {
    pacman.y += Math.sign(dy) * spd;
    pacman.dir = dy > 0 ? 1 : 3;
  }

  // clamp to grid area
  const maxX = OX + COLS * SW - 14;
  const maxY = OY + ROWS * SH - 14;
  pacman.x = Math.max(OX, Math.min(maxX, pacman.x));
  pacman.y = Math.max(OY, Math.min(maxY, pacman.y));

  pacman.el.style.left  = Math.round(pacman.x) + 'px';
  pacman.el.style.top   = Math.round(pacman.y) + 'px';
  pacman.el.dataset.dir = pacman.dir;

  // mouth chomp
  pacman.step++;
  if (pacman.step % 7 === 0) {
    pacman.mouthOpen = !pacman.mouthOpen;
    pacman.el.classList.toggle('mouth-open', pacman.mouthOpen);

    // leave a dot trail
    if (pacman.mouthOpen && dotPool.length < 60) {
      spawnDot(pacman.x + 5, pacman.y + 5);
    }
  }

  // collision check
  for (const e of alive) {
    if (Math.hypot(e.x - pacman.x, e.y - pacman.y) < 14) {
      eatEmoji(e);
    }
  }
}

function spawnDot(x, y) {
  const el = document.createElement('div');
  el.className = 'pac-dot';
  el.style.left = Math.round(x) + 'px';
  el.style.top  = Math.round(y) + 'px';
  $entities.appendChild(el);
  dotPool.push(el);
  setTimeout(() => {
    el.remove();
    dotPool = dotPool.filter(d => d !== el);
  }, 1200);
}

function eatEmoji(e) {
  e.alive = false;
  e.el.classList.add('eaten');

  // score pop
  const pop = document.createElement('div');
  pop.className = 'score-pop';
  pop.textContent = '+100';
  pop.style.left = Math.round(e.x) + 'px';
  pop.style.top  = Math.round(e.y - 4) + 'px';
  $entities.appendChild(pop);
  setTimeout(() => pop.remove(), 750);

  setTimeout(() => { if (e.el?.parentNode) e.el.remove(); }, 400);

  const rem = emojis.filter(e2 => e2.alive).length;
  if (rem === 0) {
    setStatus('All anomalous entities neutralised. Drive C: stability restored. CHOMPER satisfied.', false);
  }
}

// ─── Status & timer ───────────────────────────────────────────────────────────
function setStatus(msg, blink = false) {
  $status.textContent = msg;
  if (blink) {
    $status.classList.remove('alert');
    void $status.offsetWidth; // reflow to restart animation
    $status.classList.add('alert');
    setTimeout(() => $status.classList.remove('alert'), 2200);
  }
}

function updateTimer() {
  elapsed++;
  const h = String(Math.floor(elapsed / 3600)).padStart(2,'0');
  const m = String(Math.floor(elapsed % 3600 / 60)).padStart(2,'0');
  const s = String(elapsed % 60).padStart(2,'0');
  $timer.textContent = `Elapsed: ${h}:${m}:${s}`;
}

// ─── Keyboard ─────────────────────────────────────────────────────────────────
function initKeys() {
  document.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k === 'p') {
      if (defragComplete) return;
      defragActive = !defragActive;
      setStatus(defragActive
        ? 'Defragmentation resumed.'
        : '⏸ Defragmentation paused.  Press [P] to resume.'
      );
    }
    if (k === 'r') restart();
  });
}

// ─── Restart ──────────────────────────────────────────────────────────────────
function restart() {
  cancelAnimationFrame(rafId);

  // purge entities
  emojis.forEach(e => e.el?.remove());
  emojis = []; nextEid = 0;
  if (pacman) { pacman.el?.remove(); pacman = null; }
  dotPool.forEach(d => d?.remove());
  dotPool = [];
  $entities.innerHTML = '';

  // reset state
  defragHead = 0;
  defragActive   = false;
  defragComplete = false;
  elapsed  = 0;
  lastDefragTs = 0;
  lastTimerTs  = 0;
  $doneOverlay.classList.remove('visible');

  initCells();
  renderGrid();
  updateProgress();
  updateTimer();
  setStatus('Re-initializing drive C: ...');

  setTimeout(() => {
    defragActive = true;
    setStatus('Defragmenting drive C: ... Click special sectors to interact.');
  }, 1000);

  rafId = requestAnimationFrame(loop);
}

// ─── Main loop ────────────────────────────────────────────────────────────────
function loop(ts) {
  if (ts - lastDefragTs >= 72) {
    defragStep();
    lastDefragTs = ts;
  }
  if (ts - lastTimerTs >= 1000) {
    updateTimer();
    lastTimerTs = ts;
  }
  updateEmojis();
  updatePacman();
  rafId = requestAnimationFrame(loop);
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
buildApp();
initCells();
renderGrid();
initKeys();
updateProgress();
setStatus('Analyzing drive C: ...');

setTimeout(() => {
  defragActive = true;
  setStatus('Defragmenting drive C: ... Click yellow F blocks, orange B blocks, or cyan ? blocks to interact.');
}, 1100);

rafId = requestAnimationFrame(loop);
