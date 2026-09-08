'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');

const PORT = Number(process.env.PORT || 5000);
const STATE_FILE = process.env.STATE_FILE || path.join(__dirname, 'data', 'game-state.json');
const HISTORY_DIR = process.env.HISTORY_DIR || path.join(__dirname, 'history');
const LEASE_MS = Number(process.env.CONTROLLER_LEASE_MS || 45_000);
const REQUEST_LIMIT = Number(process.env.MAX_REQUESTS_PER_MINUTE || 1_200);
const ROUND_DURATION_MS = Number(process.env.ROUND_DURATION_MS || 180_000);

if (!Number.isInteger(ROUND_DURATION_MS) || ROUND_DURATION_MS < 1_000 || ROUND_DURATION_MS > 86_400_000) {
  throw new Error('ROUND_DURATION_MS must be an integer between 1000 and 86400000');
}

const ROWS = 10;
const COLUMNS = 10;
const RIVER_DEPTH = 20;
const MAX_RAIN = 25;
const TAX_RATE = 0.3;
const DREDGE_COST = 10;
const DREDGE_EFFECT = 10;

const Cell = Object.freeze({
  DEFAULT: 0, ROAD: 1, WATER: 2, HOME: 3, FACTORY: 4,
  TREE: 5, TRASH: 6, GROWING_TREE: 7,
});
const Role = Object.freeze({
  RESIDENTS: 'residents', INDUSTRIALISTS: 'industrialists', MODERATOR: 'moderator',
});
const roles = Object.values(Role);
const playerRoles = [Role.RESIDENTS, Role.INDUSTRIALISTS];

function requiredToken(name) {
  const value = process.env[name];
  if (!value || value.length < 8) throw new Error(`${name} must contain at least 8 characters`);
  return value;
}

const tokens = {
  residents: requiredToken('RESIDENTS_TOKEN'),
  industrialists: requiredToken('INDUSTRIALISTS_TOKEN'),
  moderator: requiredToken('MODERATOR_TOKEN'),
};
if (new Set(Object.values(tokens)).size !== roles.length) throw new Error('Each role token must be unique');

function newGrid() {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLUMNS + 1 }, (_, col) =>
      col === 0 ? Cell.WATER : col > 1 && col < 4 ? Cell.TREE : Cell.DEFAULT
    )
  );
}

function emptyGrid() {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLUMNS + 1 }, (_, col) => col === 0 ? Cell.WATER : Cell.DEFAULT)
  );
}

function operableGrid(grid) {
  const result = emptyGrid();
  const queue = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 1; col <= COLUMNS; col += 1) {
      if (grid[row][col] === Cell.TREE) result[row][col] = Cell.TREE;
    }
    queue.push([row, 1]);
  }

  while (queue.length) {
    const [row, col] = queue.pop();
    if (grid[row][col] !== Cell.ROAD) continue;
    result[row][col] = Cell.ROAD;
    if (row > 0 && result[row - 1][col] === Cell.DEFAULT) queue.push([row - 1, col]);
    if (row < ROWS - 1 && result[row + 1][col] === Cell.DEFAULT) queue.push([row + 1, col]);
    if (col > 1 && result[row][col - 1] === Cell.DEFAULT) queue.push([row, col - 1]);
    if (col < COLUMNS && result[row][col + 1] === Cell.DEFAULT) queue.push([row, col + 1]);
  }

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 1; col <= COLUMNS; col += 1) {
      if ([Cell.DEFAULT, Cell.ROAD, Cell.TREE].includes(grid[row][col])) continue;
      const connected =
        (row > 0 && result[row - 1][col] === Cell.ROAD) ||
        (row < ROWS - 1 && result[row + 1][col] === Cell.ROAD) ||
        (col > 1 && result[row][col - 1] === Cell.ROAD) ||
        (col < COLUMNS && result[row][col + 1] === Cell.ROAD);
      if (connected && grid[row][col] !== Cell.GROWING_TREE) result[row][col] = grid[row][col];
    }
    if (grid[row][1] !== Cell.GROWING_TREE) result[row][1] = grid[row][1];
  }
  return result;
}

function profitFor(grid) {
  return operableGrid(grid).flat().reduce((total, cell) =>
    total + (cell === Cell.HOME ? 1 : cell === Cell.FACTORY ? 2 : 0), 0);
}

function sedimentFor(grid) {
  const sediment = operableGrid(grid).flat().reduce((total, cell) =>
    total + (cell === Cell.HOME ? 1 : cell === Cell.FACTORY ? 4 : cell === Cell.TRASH ? -4 : 0), 0);
  return Math.max(0, sediment);
}

function subsidenceFor(player) {
  return player.actions.reduce((total, [row, col]) => {
    const createsLoad = [Cell.HOME, Cell.FACTORY, Cell.TRASH].includes(player.grid[row][col]);
    return player.originalGrid[row][col] === Cell.DEFAULT && createsLoad ? total + 1 : total;
  }, 0);
}

function newPlayer() {
  const grid = newGrid();
  return {
    grid,
    originalGrid: newGrid(),
    operableGrid: operableGrid(grid),
    budget: 0,
    actions: [],
    selectedType: Cell.DEFAULT,
  };
}

function newBoard(resetFlag = 0) {
  return {
    resetFlag,
    nextFlag: 0,
    flood: { round: 0, level: 0 },
    sediment: 0,
    subsidence: 0,
    govBudget: 0,
    floodProb: 0,
    remainingDredges: 1,
    ready: { residents: false, industrialists: false },
    timer: { durationMs: ROUND_DURATION_MS, startedAt: null, deadline: null },
  };
}

function newState(resetFlag = 0) {
  return {
    schemaVersion: 1,
    residents: newPlayer(),
    industrialists: newPlayer(),
    board: newBoard(resetFlag),
    history: null,
  };
}

function isCell(value) {
  return Number.isInteger(value) && value >= Cell.DEFAULT && value <= Cell.GROWING_TREE;
}

function isGrid(value, role) {
  if (!Array.isArray(value) || value.length !== ROWS) return false;
  const forbidden = role === Role.RESIDENTS ? Cell.FACTORY : Cell.HOME;
  return value.every((row) =>
    Array.isArray(row) && row.length === COLUMNS + 1 && row[0] === Cell.WATER &&
    row.every((cell, col) => isCell(cell) && (col === 0 || cell !== forbidden))
  );
}

function normalizePlayer(value, role) {
  if (!value || !isGrid(value.grid, role) || !isGrid(value.originalGrid, role)) throw new Error('Invalid game grid');
  if (!Number.isFinite(value.budget) || value.budget < 0 || value.budget > 1_000_000) throw new Error('Invalid budget');
  if (!Array.isArray(value.actions) || value.actions.length > 15) throw new Error('Invalid actions');
  const actions = value.actions.map((action) => {
    if (!Array.isArray(action) || action.length !== 3 ||
        !Number.isInteger(action[0]) || action[0] < 0 || action[0] >= ROWS ||
        !Number.isInteger(action[1]) || action[1] < 1 || action[1] > COLUMNS ||
        !isCell(action[2])) throw new Error('Invalid action');
    return [...action];
  });
  if (!isCell(value.selectedType)) throw new Error('Invalid selected action');
  const grid = value.grid.map((row) => [...row]);
  return {
    grid,
    originalGrid: value.originalGrid.map((row) => [...row]),
    operableGrid: operableGrid(grid),
    budget: Math.floor(value.budget),
    actions,
    selectedType: value.selectedType,
  };
}

function validState(value) {
  try {
    return Boolean(value && value.schemaVersion === 1 &&
      normalizePlayer(value.residents, Role.RESIDENTS) &&
      normalizePlayer(value.industrialists, Role.INDUSTRIALISTS) &&
      value.board && Number.isInteger(value.board.resetFlag) &&
      Number.isInteger(value.board.nextFlag) && value.board.flood);
  } catch {
    return false;
  }
}

function validHistory(value) {
  return value === null || Boolean(value &&
    typeof value.id === 'string' && /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}-\d{3}_SGT(?:-\d+)?$/.test(value.id) &&
    typeof value.createdAt === 'string' && Number.isFinite(Date.parse(value.createdAt)));
}

function normalizeTimer(value) {
  if (!value || typeof value !== 'object') {
    return { durationMs: ROUND_DURATION_MS, startedAt: null, deadline: null };
  }
  const startedAt = typeof value.startedAt === 'string' && Number.isFinite(Date.parse(value.startedAt))
    ? value.startedAt
    : null;
  const deadline = typeof value.deadline === 'string' && Number.isFinite(Date.parse(value.deadline))
    ? value.deadline
    : null;
  if (!startedAt || !deadline || Date.parse(deadline) < Date.parse(startedAt)) {
    return { durationMs: ROUND_DURATION_MS, startedAt: null, deadline: null };
  }
  return { durationMs: ROUND_DURATION_MS, startedAt, deadline };
}

function timerDeadline(board) {
  const value = Date.parse(board.timer?.deadline || '');
  return Number.isFinite(value) ? value : null;
}

function timerRemainingMs(board, now = Date.now()) {
  const deadline = timerDeadline(board);
  return deadline === null ? ROUND_DURATION_MS : Math.max(0, deadline - now);
}

function timerDisplay(board, now = Date.now()) {
  if (timerDeadline(board) === null) return 'Not started';
  const seconds = Math.ceil(timerRemainingMs(board, now) / 1_000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function loadState() {
  if (!fs.existsSync(STATE_FILE)) return newState();
  try {
    const loaded = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (!validState(loaded)) throw new Error('invalid state structure');
    loaded.board.ready = {
      residents: Boolean(loaded.board.ready?.residents),
      industrialists: Boolean(loaded.board.ready?.industrialists),
    };
    loaded.board.timer = normalizeTimer(loaded.board.timer);
    loaded.history = validHistory(loaded.history) ? loaded.history : null;
    return loaded;
  } catch (error) {
    console.error(`Could not load ${STATE_FILE}: ${error.message}; starting a new game`);
    return newState();
  }
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  const temporary = `${STATE_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(state)}\n`, { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temporary, STATE_FILE);
}

function singaporeTimestamp(date = new Date()) {
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const pad = (value, length = 2) => String(value).padStart(length, '0');
  return {
    folder: `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}_` +
      `${pad(shifted.getUTCHours())}-${pad(shifted.getUTCMinutes())}-${pad(shifted.getUTCSeconds())}-` +
      `${pad(shifted.getUTCMilliseconds(), 3)}_SGT`,
    display: `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())} ` +
      `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())} SGT`,
  };
}

function createHistorySession() {
  const created = new Date();
  const timestamp = singaporeTimestamp(created);
  fs.mkdirSync(HISTORY_DIR, { recursive: true });
  let id = timestamp.folder;
  let suffix = 2;
  while (fs.existsSync(path.join(HISTORY_DIR, id))) {
    id = `${timestamp.folder}-${suffix}`;
    suffix += 1;
  }
  fs.mkdirSync(path.join(HISTORY_DIR, id), { recursive: false });
  return { id, createdAt: created.toISOString() };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

const cellView = Object.freeze({
  [Cell.DEFAULT]: { className: 'default', symbol: '', label: 'Empty' },
  [Cell.ROAD]: { className: 'road', symbol: '━', label: 'Road' },
  [Cell.WATER]: { className: 'water', symbol: '≈', label: 'River' },
  [Cell.HOME]: { className: 'building', symbol: '⌂', label: 'Home' },
  [Cell.FACTORY]: { className: 'building', symbol: '⚙', label: 'Factory' },
  [Cell.TREE]: { className: 'tree', symbol: '▲', label: 'Tree' },
  [Cell.TRASH]: { className: 'trash', symbol: '♻', label: 'Trash management' },
  [Cell.GROWING_TREE]: { className: 'growing-tree', symbol: '♠', label: 'Growing tree' },
});

function renderGrid(player, rotated) {
  const columns = Array.from({ length: COLUMNS + 1 }, (_, index) => rotated ? COLUMNS - index : index);
  const header = columns.map((column) => `<th scope="col">${column}</th>`).join('');
  const rows = player.grid.map((row, rowIndex) => {
    const cells = columns.map((column) => {
      const type = row[column];
      const view = cellView[type];
      const inactive = type !== player.operableGrid[rowIndex][column] ? ' inactive' : '';
      return `<td class="tile ${view.className}${inactive}" title="${escapeHtml(view.label)}${inactive ? ' (inactive)' : ''}">` +
        `<span aria-hidden="true">${view.symbol}</span><span class="sr-only">${escapeHtml(view.label)}</span></td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');
  return `<div class="grid-scroll"><table class="game-grid"><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderPlayerPanel(gameState, role, label, rotated) {
  const player = gameState[role];
  const ready = Boolean(gameState.board.ready[role]);
  return `<section class="player-panel">
    <div class="player-heading">
      <h2>${escapeHtml(label)}</h2>
      <span class="ready ${ready ? 'yes' : 'no'}">${ready ? 'Ready' : 'Not ready'}</span>
    </div>
    ${renderGrid(player, rotated)}
    <dl class="player-stats">
      <div><dt>Wealth</dt><dd>$${player.budget}</dd></div>
      <div><dt>Active profit</dt><dd>+$${profitFor(player.grid)}</dd></div>
      <div><dt>Sediment this round</dt><dd>+${sedimentFor(player.grid)}</dd></div>
      <div><dt>Subsidence this round</dt><dd>+${subsidenceFor(player)}</dd></div>
      <div><dt>Actions used</dt><dd>${player.actions.length}</dd></div>
    </dl>
  </section>`;
}

function renderSnapshot(gameState, phase, capturedAt = new Date()) {
  const round = gameState.board.nextFlag + 1;
  const phaseLabel = phase === 'start' ? 'Start' : 'End';
  const createdLabel = singaporeTimestamp(new Date(gameState.history.createdAt)).display;
  const capturedLabel = singaporeTimestamp(capturedAt).display;
  const floodNotice = phase === 'start' && round >= 2
    ? `<div class="flood ${gameState.board.flood.level > 0 ? 'occurred' : 'clear'}">` +
      `${gameState.board.flood.level > 0 ? `Flood level ${gameState.board.flood.level}` : 'No flood'} before Round ${round}</div>`
    : '';
  const title = `Subsidence Game · Round ${round} · ${phaseLabel}`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:#172033;background:#f1f5f9}
    *{box-sizing:border-box}body{margin:0;padding:24px;background:#f1f5f9}main{max-width:1600px;margin:auto}
    header,.summary,.player-panel,.legend{background:#fff;border-radius:14px;box-shadow:0 5px 18px #0f172a14}
    header{padding:22px 26px;display:flex;flex-wrap:wrap;gap:16px;align-items:center;justify-content:space-between}
    h1,h2,p{margin:0}.eyebrow{color:#475569;font-weight:700;text-transform:uppercase;letter-spacing:.08em;font-size:12px}
    h1{font-size:30px;margin-top:3px}.meta{text-align:right;color:#475569;font-size:14px;line-height:1.55}
    .phase{display:inline-block;margin-left:8px;padding:4px 9px;border-radius:999px;background:#dbeafe;color:#1e3a8a;font-size:13px;vertical-align:middle}
    .flood{margin-top:14px;padding:15px 20px;border-radius:12px;font-size:18px;font-weight:800;text-align:center}
    .flood.occurred{background:#bfdbfe;color:#1e3a8a;border:2px solid #3b82f6}.flood.clear{background:#dcfce7;color:#166534;border:2px solid #4ade80}
    .summary{margin-top:14px;padding:16px;display:grid;grid-template-columns:repeat(7,minmax(110px,1fr));gap:10px}
    .stat{padding:12px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0}.stat span{display:block;color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase}.stat strong{display:block;margin-top:5px;font-size:21px}
    .boards{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px;align-items:start}.player-panel{padding:18px;min-width:0}
    .player-heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}.player-heading h2{font-size:21px}.ready{padding:5px 10px;border-radius:999px;font-size:13px;font-weight:800}.ready.yes{background:#dcfce7;color:#166534}.ready.no{background:#e2e8f0;color:#475569}
    .grid-scroll{overflow-x:auto}.game-grid{border-collapse:collapse;margin:auto;background:white}.game-grid th{height:28px;background:#64748b;color:#fff;border:2px solid #111827;font-size:12px}
    .tile{width:42px;height:42px;min-width:42px;border:2px solid #111827;text-align:center;font-size:23px;font-weight:900;line-height:1;transition:none}.tile.default{background:#fff}.tile.road{background:#d1d5db;color:#374151}.tile.water{background:#93c5fd;color:#1d4ed8}.tile.building{background:#fde047;color:#713f12}.tile.tree{background:#86efac;color:#166534}.tile.growing-tree{background:#bbf7d0;color:#15803d}.tile.trash{background:#fca5a5;color:#7f1d1d}.tile.inactive{filter:grayscale(1);opacity:.38}
    .player-stats{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:14px 0 0}.player-stats div{padding:9px;background:#f8fafc;border-radius:8px;text-align:center}.player-stats dt{font-size:11px;color:#64748b;font-weight:700}.player-stats dd{margin:4px 0 0;font-weight:900}
    .legend{margin-top:14px;padding:14px 18px;display:flex;gap:18px;flex-wrap:wrap;color:#475569;font-size:13px}.swatch{display:inline-block;width:14px;height:14px;border:1px solid #64748b;vertical-align:-2px;margin-right:5px}.inactive-key{filter:grayscale(1);opacity:.38;background:#fde047}
    footer{padding:14px;text-align:center;color:#64748b;font-size:12px}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
    @media(max-width:1050px){.boards{grid-template-columns:1fr}.summary{grid-template-columns:repeat(3,1fr)}}
    @media(max-width:600px){body{padding:10px}.summary{grid-template-columns:repeat(2,1fr)}.player-stats{grid-template-columns:repeat(2,1fr)}.meta{text-align:left}.tile{width:34px;height:34px;min-width:34px;font-size:18px}}
    @media print{body{padding:0;background:#fff}header,.summary,.player-panel,.legend{box-shadow:none;border:1px solid #cbd5e1}.boards{grid-template-columns:1fr 1fr}.tile{width:27px;height:27px;min-width:27px;font-size:15px}}
  </style>
</head>
<body>
<main>
  <header>
    <div><div class="eyebrow">Game history snapshot</div><h1>Round ${round}<span class="phase">${phaseLabel}</span></h1></div>
    <div class="meta"><strong>Game ${escapeHtml(gameState.history.id)}</strong><br>Started ${createdLabel}<br>Captured ${capturedLabel}</div>
  </header>
  ${floodNotice}
  <section class="summary" aria-label="Game status">
    <div class="stat"><span>Round</span><strong>${round}</strong></div>
    <div class="stat"><span>Sediment</span><strong>${gameState.board.sediment}</strong></div>
    <div class="stat"><span>Subsidence</span><strong>${gameState.board.subsidence}</strong></div>
    <div class="stat"><span>Government budget</span><strong>$${gameState.board.govBudget}</strong></div>
    <div class="stat"><span>Flood probability</span><strong>${Math.round(gameState.board.floodProb * 100)}%</strong></div>
    <div class="stat"><span>Dredges remaining</span><strong>${gameState.board.remainingDredges}</strong></div>
    <div class="stat"><span>Round timer</span><strong>${timerDisplay(gameState.board, capturedAt.getTime())}</strong></div>
  </section>
  <div class="boards">
    ${renderPlayerPanel(gameState, Role.RESIDENTS, 'Residential Area', true)}
    ${renderPlayerPanel(gameState, Role.INDUSTRIALISTS, 'Industrial Area', false)}
  </div>
  <aside class="legend"><span><i class="swatch inactive-key"></i>Greyed tile = inactive or disconnected</span><span>⌂ Home</span><span>⚙ Factory</span><span>━ Road</span><span>▲ Tree</span><span>♠ Growing tree</span><span>♻ Trash management</span><span>≈ River</span></aside>
  <footer>Static, self-contained snapshot generated by the Subsidence Game server.</footer>
</main>
</body>
</html>\n`;
}

function writeSnapshot(gameState, phase) {
  if (!validHistory(gameState.history)) throw new Error('Cannot write history for an invalid game session');
  if (!gameState.history) return;
  const round = gameState.board.nextFlag + 1;
  const filename = `round-${String(round).padStart(2, '0')}-${phase}.html`;
  const directory = path.join(HISTORY_DIR, gameState.history.id);
  fs.mkdirSync(directory, { recursive: true });
  const target = path.join(directory, filename);
  const temporary = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, renderSnapshot(gameState, phase), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temporary, target);
}

function tokensEqual(provided, expected) {
  const left = Buffer.from(provided || '');
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function bearerToken(request) {
  const header = request.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}

function validClientId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9-]{16,80}$/.test(value);
}

function processRound(player, floodLevel) {
  const profit = profitFor(player.grid);
  const tax = Math.floor(profit * TAX_RATE);
  const contribution = { tax, sediment: sedimentFor(player.grid), subsidence: subsidenceFor(player) };
  const grid = player.grid.map((row) => [...row]);
  let damage = 0;

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 1; col <= floodLevel; col += 1) {
      if ([Cell.DEFAULT, Cell.GROWING_TREE, Cell.TREE, Cell.WATER].includes(grid[row][col])) continue;
      const protectedByTree =
        (col > 1 && player.grid[row][col - 1] === Cell.TREE) ||
        (row > 0 && player.grid[row - 1][col] === Cell.TREE) ||
        (row < ROWS - 1 && player.grid[row + 1][col] === Cell.TREE);
      if (protectedByTree) continue;
      if (grid[row][col] === Cell.HOME) damage += 2;
      if (grid[row][col] === Cell.FACTORY) damage += 4;
      grid[row][col] = Cell.DEFAULT;
    }
  }

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 1; col <= COLUMNS; col += 1) {
      if (grid[row][col] === Cell.GROWING_TREE) grid[row][col] = Cell.TREE;
    }
    for (let col = 1; col <= floodLevel; col += 1) {
      if (grid[row][col] === Cell.TREE) grid[row][col] = Cell.GROWING_TREE;
    }
  }

  return {
    player: {
      grid,
      originalGrid: grid.map((row) => [...row]),
      operableGrid: operableGrid(grid),
      budget: Math.max(0, player.budget + profit - tax - damage),
      actions: [],
      selectedType: player.selectedType,
    },
    contribution,
  };
}

function nextFlood(board) {
  let level = Math.floor(board.sediment / 20) + Math.floor(Math.random() * MAX_RAIN) +
    Math.floor(board.subsidence / 10) - RIVER_DEPTH;
  let probability = board.floodProb;
  if (level <= 0 && Math.random() < probability) {
    probability = 0;
    const heavyRain = Math.floor(Math.random() * (MAX_RAIN - RIVER_DEPTH) + 1 + RIVER_DEPTH);
    level = Math.floor(board.sediment / 20) + Math.floor(board.subsidence / 10) + heavyRain - RIVER_DEPTH;
  } else if (level <= 0) {
    probability += (1 - probability) * 0.5;
  }
  return { level: Math.max(0, Math.min(10, level)), probability };
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '64kb', strict: true }));

let state = loadState();
const claims = new Map();
const requestBuckets = new Map();
let roundTimerHandle = null;

function expireRoundIfNeeded(now = Date.now()) {
  const deadline = timerDeadline(state.board);
  if (deadline === null || now < deadline) return false;
  if (playerRoles.every((role) => state.board.ready[role])) return false;
  state.board.ready = { residents: true, industrialists: true };
  saveState(state);
  return true;
}

function scheduleRoundExpiry() {
  if (roundTimerHandle) clearTimeout(roundTimerHandle);
  roundTimerHandle = null;
  const deadline = timerDeadline(state.board);
  if (deadline === null) return;
  const delay = deadline - Date.now();
  if (delay <= 0) {
    expireRoundIfNeeded();
    return;
  }
  roundTimerHandle = setTimeout(() => {
    expireRoundIfNeeded();
    roundTimerHandle = null;
  }, delay);
}

function startRoundTimer(board, now = new Date()) {
  board.timer = {
    durationMs: ROUND_DURATION_MS,
    startedAt: now.toISOString(),
    deadline: new Date(now.getTime() + ROUND_DURATION_MS).toISOString(),
  };
}

function editingUnavailable(board, now = Date.now()) {
  const deadline = timerDeadline(board);
  if (deadline === null) return { error: 'The Moderator has not started this round', code: 'ROUND_NOT_STARTED' };
  if (now >= deadline) return { error: 'Time is up for this round', code: 'ROUND_ENDED' };
  return null;
}

expireRoundIfNeeded();
scheduleRoundExpiry();

app.use((request, response, next) => {
  const now = Date.now();
  const key = request.ip || request.socket.remoteAddress || 'unknown';
  const bucket = requestBuckets.get(key);
  if (!bucket || now - bucket.startedAt >= 60_000) {
    requestBuckets.set(key, { startedAt: now, count: 1 });
    return next();
  }
  bucket.count += 1;
  return bucket.count > REQUEST_LIMIT ? response.status(429).json({ error: 'Too many requests' }) : next();
});

function claimRole(role, clientId, allowTakeover = false) {
  const claim = claims.get(role);
  if (claim && claim.clientId !== clientId && claim.expiresAt > Date.now() && !allowTakeover) return false;
  claims.set(role, { clientId, expiresAt: Date.now() + LEASE_MS });
  return true;
}

function authenticateRole(role, request, response, next) {
  const clientId = request.get('x-client-id');
  if (!roles.includes(role) || !tokensEqual(bearerToken(request), tokens[role])) {
    return response.status(401).json({ error: 'Invalid role access code' });
  }
  if (!validClientId(clientId)) return response.status(400).json({ error: 'Invalid client identifier' });
  if (!claimRole(role, clientId)) return response.status(409).json({ error: 'This role is controlled by another device' });
  return next();
}

function requireRole(role) {
  return (request, response, next) => authenticateRole(role, request, response, next);
}

function rejectStaleRound(request, response) {
  const value = request.get('x-game-round') || '';
  if (!/^(0|[1-9]\d*)$/.test(value)) {
    response.status(400).json({ error: 'A valid game round is required', code: 'INVALID_ROUND' });
    return true;
  }
  if (Number(value) !== state.board.nextFlag) {
    response.status(409).json({ error: 'This request belongs to an earlier round', code: 'ROUND_CHANGED' });
    return true;
  }
  return false;
}

function renewController(request) {
  const token = bearerToken(request);
  const clientId = request.get('x-client-id');
  if (!validClientId(clientId) || !token) return;
  for (const role of roles) {
    if (!tokensEqual(token, tokens[role])) continue;
    const claim = claims.get(role);
    if (!claim || claim.clientId === clientId || claim.expiresAt <= Date.now()) claimRole(role, clientId);
    return;
  }
}

app.get('/healthz', (request, response) => response.json({ status: 'ok' }));

app.post('/api/auth', (request, response) => {
  const { role, token, clientId, takeover } = request.body || {};
  if (!roles.includes(role) || !tokensEqual(token, tokens[role])) return response.status(401).json({ error: 'Invalid role access code' });
  if (!validClientId(clientId)) return response.status(400).json({ error: 'Invalid client identifier' });
  const allowTakeover = role === Role.MODERATOR && takeover === true;
  if (!claimRole(role, clientId, allowTakeover)) {
    return response.status(409).json({
      error: 'This role is controlled by another device',
      code: 'ROLE_CONTROLLED',
      canTakeOver: role === Role.MODERATOR,
    });
  }
  return response.json({ role, leaseMs: LEASE_MS });
});

app.post('/api/release', (request, response) => {
  const role = request.body?.role;
  return authenticateRole(role, request, response, () => {
    claims.delete(role);
    response.status(204).end();
  });
});

app.get('/api/board', (request, response) => {
  expireRoundIfNeeded();
  renewController(request);
  response.set('Cache-Control', 'no-store');
  response.json(state.board);
});

for (const role of playerRoles) {
  app.get(`/api/${role}`, (request, response) => {
    expireRoundIfNeeded();
    renewController(request);
    response.set('Cache-Control', 'no-store');
    response.json(state[role]);
  });
  app.post(`/api/${role}`, requireRole(role), (request, response) => {
    try {
      expireRoundIfNeeded();
      if (rejectStaleRound(request, response)) return;
      const unavailable = editingUnavailable(state.board);
      if (unavailable) return response.status(409).json(unavailable);
      if (state.board.ready[role]) {
        return response.status(409).json({
          error: 'Your team is already ready for the next round',
          code: 'TEAM_READY',
        });
      }
      state[role] = normalizePlayer(request.body, role);
      state.board.ready[role] = false;
      saveState(state);
      response.json({ data: state[role] });
    } catch (error) {
      response.status(400).json({ error: error.message });
    }
  });
  app.post(`/api/${role}/ready`, requireRole(role), (request, response) => {
    expireRoundIfNeeded();
    if (rejectStaleRound(request, response)) return;
    if (timerDeadline(state.board) === null) {
      return response.status(409).json({ error: 'The Moderator has not started this round', code: 'ROUND_NOT_STARTED' });
    }
    state.board.ready[role] = true;
    saveState(state);
    return response.json({ ready: state.board.ready });
  });
}

app.post('/api/start-round', requireRole(Role.MODERATOR), (request, response, next) => {
  expireRoundIfNeeded();
  if (timerDeadline(state.board) !== null) {
    return response.status(409).json({ error: 'This round has already started' });
  }
  try {
    const nextState = { ...state, board: { ...state.board } };
    startRoundTimer(nextState.board);
    writeSnapshot(nextState, 'start');
    saveState(nextState);
    state = nextState;
    scheduleRoundExpiry();
    return response.json(state.board);
  } catch (error) {
    return next(error);
  }
});

app.post('/api/reset', requireRole(Role.MODERATOR), (request, response, next) => {
  try {
    expireRoundIfNeeded();
    if (state.history) writeSnapshot(state, 'end');
    const nextState = newState(state.board.resetFlag + 1);
    nextState.history = createHistorySession();
    writeSnapshot(nextState, 'start');
    saveState(nextState);
    state = nextState;
    scheduleRoundExpiry();
    return response.json(state.board);
  } catch (error) {
    return next(error);
  }
});

app.post('/api/advance', requireRole(Role.MODERATOR), (request, response, next) => {
  expireRoundIfNeeded();
  if (timerDeadline(state.board) === null) {
    return response.status(409).json({ error: 'Start the first round before advancing' });
  }
  if (!playerRoles.every((role) => state.board.ready[role])) {
    return response.status(409).json({ error: 'Both teams must be ready before advancing the round' });
  }
  try {
    const flood = nextFlood(state.board);
    const residents = processRound(state.residents, flood.level);
    const industrialists = processRound(state.industrialists, flood.level);
    const contributions = [residents.contribution, industrialists.contribution];
    const nextState = {
      ...state,
      residents: residents.player,
      industrialists: industrialists.player,
      board: {
        ...state.board,
        nextFlag: state.board.nextFlag + 1,
        flood: { round: state.board.nextFlag + 1, level: flood.level },
        sediment: Math.min(RIVER_DEPTH * 30, state.board.sediment + contributions.reduce((sum, item) => sum + item.sediment, 0)),
        subsidence: Math.min(RIVER_DEPTH * 15, state.board.subsidence + contributions.reduce((sum, item) => sum + item.subsidence, 0)),
        govBudget: state.board.govBudget + contributions.reduce((sum, item) => sum + item.tax, 0),
        floodProb: flood.probability,
        remainingDredges: 1,
        ready: { residents: false, industrialists: false },
        timer: { durationMs: ROUND_DURATION_MS, startedAt: null, deadline: null },
      },
    };
    startRoundTimer(nextState.board);
    writeSnapshot(state, 'end');
    writeSnapshot(nextState, 'start');
    saveState(nextState);
    state = nextState;
    scheduleRoundExpiry();
    return response.json(state.board);
  } catch (error) {
    return next(error);
  }
});

app.post('/api/dredge', requireRole(Role.MODERATOR), (request, response) => {
  if (state.board.govBudget < DREDGE_COST || state.board.remainingDredges < 1) {
    return response.status(409).json({ error: 'Dredging is not currently available' });
  }
  state.board.sediment = Math.max(0, state.board.sediment - DREDGE_EFFECT);
  state.board.govBudget -= DREDGE_COST;
  state.board.remainingDredges -= 1;
  saveState(state);
  return response.json(state.board);
});

app.use((error, request, response, next) => {
  if (error?.type === 'entity.too.large') return response.status(413).json({ error: 'Request body is too large' });
  if (error instanceof SyntaxError) return response.status(400).json({ error: 'Invalid JSON' });
  console.error(error);
  return response.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => console.log(`Game state server listening on port ${PORT}`));
