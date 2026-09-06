'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');

const PORT = Number(process.env.PORT || 5000);
const STATE_FILE = process.env.STATE_FILE || path.join(__dirname, 'data', 'game-state.json');
const LEASE_MS = Number(process.env.CONTROLLER_LEASE_MS || 45_000);
const REQUEST_LIMIT = Number(process.env.MAX_REQUESTS_PER_MINUTE || 1_200);

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
  };
}

function newState(resetFlag = 0) {
  return {
    schemaVersion: 1,
    residents: newPlayer(),
    industrialists: newPlayer(),
    board: newBoard(resetFlag),
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

function loadState() {
  if (!fs.existsSync(STATE_FILE)) return newState();
  try {
    const loaded = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (!validState(loaded)) throw new Error('invalid state structure');
    loaded.board.ready = {
      residents: Boolean(loaded.board.ready?.residents),
      industrialists: Boolean(loaded.board.ready?.industrialists),
    };
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

function claimRole(role, clientId) {
  const claim = claims.get(role);
  if (claim && claim.clientId !== clientId && claim.expiresAt > Date.now()) return false;
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
  const { role, token, clientId } = request.body || {};
  if (!roles.includes(role) || !tokensEqual(token, tokens[role])) return response.status(401).json({ error: 'Invalid role access code' });
  if (!validClientId(clientId)) return response.status(400).json({ error: 'Invalid client identifier' });
  if (!claimRole(role, clientId)) return response.status(409).json({ error: 'This role is controlled by another device' });
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
  renewController(request);
  response.set('Cache-Control', 'no-store');
  response.json(state.board);
});

for (const role of playerRoles) {
  app.get(`/api/${role}`, (request, response) => {
    renewController(request);
    response.set('Cache-Control', 'no-store');
    response.json(state[role]);
  });
  app.post(`/api/${role}`, requireRole(role), (request, response) => {
    try {
      state[role] = normalizePlayer(request.body, role);
      state.board.ready[role] = false;
      saveState(state);
      response.json({ data: state[role] });
    } catch (error) {
      response.status(400).json({ error: error.message });
    }
  });
  app.post(`/api/${role}/ready`, requireRole(role), (request, response) => {
    state.board.ready[role] = true;
    saveState(state);
    response.json({ ready: state.board.ready });
  });
}

app.post('/api/reset', requireRole(Role.MODERATOR), (request, response) => {
  state = newState(state.board.resetFlag + 1);
  saveState(state);
  response.json(state.board);
});

app.post('/api/advance', requireRole(Role.MODERATOR), (request, response) => {
  if (!playerRoles.every((role) => state.board.ready[role])) {
    return response.status(409).json({ error: 'Both teams must be ready before advancing the round' });
  }
  const flood = nextFlood(state.board);
  const residents = processRound(state.residents, flood.level);
  const industrialists = processRound(state.industrialists, flood.level);
  const contributions = [residents.contribution, industrialists.contribution];
  state.residents = residents.player;
  state.industrialists = industrialists.player;
  state.board = {
    ...state.board,
    nextFlag: state.board.nextFlag + 1,
    flood: { round: state.board.nextFlag + 1, level: flood.level },
    sediment: Math.min(RIVER_DEPTH * 30, state.board.sediment + contributions.reduce((sum, item) => sum + item.sediment, 0)),
    subsidence: Math.min(RIVER_DEPTH * 15, state.board.subsidence + contributions.reduce((sum, item) => sum + item.subsidence, 0)),
    govBudget: state.board.govBudget + contributions.reduce((sum, item) => sum + item.tax, 0),
    floodProb: flood.probability,
    remainingDredges: 1,
    ready: { residents: false, industrialists: false },
  };
  saveState(state);
  return response.json(state.board);
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
