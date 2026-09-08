const SESSION_KEY = 'subsidence-game-session'

const makeClientId = () => {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
}

const readSession = () => {
  try {
    return JSON.parse(window.sessionStorage.getItem(SESSION_KEY)) || {}
  } catch {
    return {}
  }
}

let session = readSession()
const writeQueues = {}

const emitStatus = (ok, message = '') => {
  window.dispatchEvent(new CustomEvent('game-api-status', { detail: { ok, message } }))
}

async function request(url, options = {}) {
  const headers = new Headers(options.headers || {})
  if (session.token) headers.set('Authorization', `Bearer ${session.token}`)
  if (session.clientId) headers.set('X-Client-ID', session.clientId)

  try {
    const response = await fetch(url, { ...options, headers, cache: 'no-store' })
    const body = response.status === 204 ? null : await response.json().catch(() => null)
    if (!response.ok) {
      const error = new Error(body?.error || `Request failed (${response.status})`)
      error.status = response.status
      error.code = body?.code
      error.canTakeOver = Boolean(body?.canTakeOver)
      throw error
    }
    emitStatus(true)
    return body
  } catch (error) {
    emitStatus(false, error.message)
    throw error
  }
}

async function authenticate(role, token, takeover = false) {
  const clientId = session.clientId || makeClientId()
  const result = await request('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, token, clientId, takeover }),
  })
  session = { role, token, clientId }
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  return result
}

async function restoreSession() {
  if (!session.role || !session.token) return ''
  await authenticate(session.role, session.token)
  return session.role
}

async function releaseRole() {
  if (!session.role) return
  try {
    await request('/api/release', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: session.role }),
    })
  } finally {
    session = {}
    window.sessionStorage.removeItem(SESSION_KEY)
  }
}

function getGameState(role) {
  return request(`/api/${role}`)
}

function updateGameState(role, data) {
  const previous = writeQueues[role] || Promise.resolve()
  const next = previous.catch(() => undefined).then(() => request(`/api/${role}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }))
  writeQueues[role] = next
  return next
}

function flushPendingWrites(role) {
  return writeQueues[role] || Promise.resolve()
}

async function setRoleReady(role) {
  await flushPendingWrites(role)
  return request(`/api/${role}/ready`, { method: 'POST' })
}

function resetGameState() {
  return request('/api/reset', { method: 'POST' })
}

function advanceRound() {
  return request('/api/advance', { method: 'POST' })
}

function dredgeRiver() {
  return request('/api/dredge', { method: 'POST' })
}

export {
  advanceRound,
  authenticate,
  dredgeRiver,
  getGameState,
  releaseRole,
  resetGameState,
  restoreSession,
  setRoleReady,
  updateGameState,
}
