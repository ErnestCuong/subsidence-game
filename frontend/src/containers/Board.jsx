import { useCallback, useEffect, useState } from 'react'
import { Toaster, toast } from 'react-hot-toast'
import Table, { Role } from './Table'
import {
  advanceRound,
  authenticate,
  dredgeRiver,
  getGameState,
  releaseRole,
  resetGameState,
  restoreSession,
  setRoleReady,
} from '../apis/gameStateAPI'

const DREDGE_COST = 10

export const PlayerType = {
  RESIDENTS: 'residents',
  INDUSTRIALISTS: 'industrialists',
  MODERATOR: 'moderator',
}

const roleLabels = {
  residents: 'Residents',
  industrialists: 'Industrialists',
  moderator: 'Moderator',
}

const initialBoard = {
  resetFlag: 0,
  nextFlag: 0,
  flood: { round: 0, level: 0 },
  sediment: 0,
  subsidence: 0,
  govBudget: 0,
  floodProb: 0,
  remainingDredges: 1,
  ready: { residents: false, industrialists: false },
}

const Board = () => {
  const [board, setBoard] = useState(initialBoard)
  const [player, setPlayer] = useState('')
  const [pendingRole, setPendingRole] = useState(PlayerType.RESIDENTS)
  const [accessCode, setAccessCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [apiError, setApiError] = useState('')
  const [canTakeOverModerator, setCanTakeOverModerator] = useState(false)

  const fetchBoard = useCallback(async () => {
    const data = await getGameState('board')
    setBoard(data)
    return data
  }, [])

  useEffect(() => {
    const statusListener = (event) => setApiError(event.detail.ok ? '' : event.detail.message)
    window.addEventListener('game-api-status', statusListener)
    return () => window.removeEventListener('game-api-status', statusListener)
  }, [])

  useEffect(() => {
    let active = true
    restoreSession()
      .then((role) => {
        if (active && role) setPlayer(role)
      })
      .catch(() => releaseRole().catch(() => undefined))
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!player) return undefined
    fetchBoard().catch(() => undefined)
    const interval = window.setInterval(() => fetchBoard().catch(() => undefined), 1_000)
    return () => window.clearInterval(interval)
  }, [fetchBoard, player])

  const joinGame = async (event, takeover = false) => {
    if (event) event.preventDefault()
    if (!accessCode.trim()) return
    setBusy(true)
    try {
      await authenticate(pendingRole, accessCode.trim(), takeover)
      setPlayer(pendingRole)
      setAccessCode('')
      setCanTakeOverModerator(false)
      toast.success(`Joined as ${roleLabels[pendingRole]}`)
    } catch (error) {
      setCanTakeOverModerator(pendingRole === PlayerType.MODERATOR && error.canTakeOver)
      toast.error(error.message)
    } finally {
      setBusy(false)
    }
  }

  const leaveGame = async () => {
    setBusy(true)
    try {
      await releaseRole()
      setPlayer('')
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusy(false)
    }
  }

  const runModeratorAction = async (action, successMessage) => {
    setBusy(true)
    try {
      const updatedBoard = await action()
      setBoard(updatedBoard)
      if (successMessage) {
        const notification = successMessage(updatedBoard)
        if (typeof notification === 'string') toast.success(notification)
        else if (notification.type === 'error') toast.error(notification.message)
        else toast.success(notification.message)
      }
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusy(false)
    }
  }

  const markReady = async () => {
    setBusy(true)
    try {
      await setRoleReady(player)
      await fetchBoard()
      toast.success('Your team is ready')
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusy(false)
    }
  }

  if (!player) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
        <form onSubmit={joinGame} className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
          <h1 className="text-3xl font-bold">Subsidence Game</h1>
          <p className="mt-2 text-slate-600">Choose your group and enter its access code.</p>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {Object.values(PlayerType).map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => {
                  setPendingRole(role)
                  setCanTakeOverModerator(false)
                }}
                className={`rounded-md border px-3 py-2 font-semibold ${pendingRole === role ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-300'}`}
              >
                {roleLabels[role]}
              </button>
            ))}
          </div>
          <label className="mt-6 block text-left font-semibold" htmlFor="access-code">Access code</label>
          <input
            id="access-code"
            type="password"
            autoComplete="current-password"
            value={accessCode}
            onChange={(event) => {
              setAccessCode(event.target.value)
              setCanTakeOverModerator(false)
            }}
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
          />
          {apiError && <p className="mt-3 text-sm text-red-700">Server: {apiError}</p>}
          <button type="submit" disabled={busy || !accessCode.trim()} className="btn mt-6 w-full bg-green-300">
            {busy ? 'Joining…' : `Join as ${roleLabels[pendingRole]}`}
          </button>
          {canTakeOverModerator && (
            <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-left">
              <p className="text-sm text-amber-900">Another device controls the Moderator role.</p>
              <button
                type="button"
                disabled={busy}
                onClick={(event) => joinGame(event, true)}
                className="btn mt-3 w-full bg-amber-300"
              >
                {busy ? 'Taking over…' : 'Take over Moderator'}
              </button>
            </div>
          )}
          <Toaster position="bottom-center" />
        </form>
      </main>
    )
  }

  const teamsReady = board.ready?.residents && board.ready?.industrialists
  const isTeam = player === PlayerType.RESIDENTS || player === PlayerType.INDUSTRIALISTS

  return (
    <main className="min-h-screen bg-slate-50 p-4">
      <header className="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-3 rounded-lg bg-white p-4 shadow">
        <div className="text-left">
          <h1 className="text-2xl font-bold">Subsidence Game</h1>
          <p className="text-slate-600">Role: {roleLabels[player]} · Round {board.nextFlag}</p>
        </div>
        <div className="flex items-center gap-3">
          {apiError && <span className="rounded bg-red-100 px-3 py-2 text-sm text-red-800">Disconnected: {apiError}</span>}
          <button className="btn" disabled={busy} onClick={leaveGame}>Leave role</button>
        </div>
      </header>

      <section className="mx-auto mt-4 flex max-w-screen-2xl flex-wrap justify-center gap-4">
        <aside className="w-full rounded-lg bg-white p-5 shadow sm:w-72">
          <h2 className="text-xl font-bold">Game status</h2>
          <dl className="mt-4 space-y-2 text-left">
            <div className="flex justify-between"><dt>Sediment</dt><dd>{board.sediment}</dd></div>
            <div className="flex justify-between"><dt>Subsidence</dt><dd>{board.subsidence}</dd></div>
            <div className="flex justify-between"><dt>Government budget</dt><dd>${board.govBudget}</dd></div>
            <div className="flex justify-between"><dt>Residents ready</dt><dd>{board.ready?.residents ? 'Yes' : 'No'}</dd></div>
            <div className="flex justify-between"><dt>Industrialists ready</dt><dd>{board.ready?.industrialists ? 'Yes' : 'No'}</dd></div>
          </dl>

          {isTeam && (
            <button className="btn mt-5 w-full bg-blue-200" disabled={busy || board.ready?.[player]} onClick={markReady}>
              {board.ready?.[player] ? 'Team ready' : 'Ready for next round'}
            </button>
          )}

          {player === PlayerType.MODERATOR && (
            <div className="mt-5 space-y-3">
              <button className="btn w-full bg-red-200" disabled={busy} onClick={() => runModeratorAction(resetGameState, () => 'New game started')}>Reset game</button>
              <button
                className="btn w-full bg-green-300"
                disabled={busy || !teamsReady}
                onClick={() => runModeratorAction(advanceRound, (data) => data.flood.level > 0
                  ? { type: 'error', message: `Flood level ${data.flood.level}` }
                  : { type: 'success', message: 'No flood' })}
              >
                {teamsReady ? 'Next round' : 'Waiting for teams'}
              </button>
              <button
                className="btn w-full bg-yellow-300"
                disabled={busy || board.govBudget < DREDGE_COST || board.remainingDredges < 1}
                onClick={() => runModeratorAction(dredgeRiver, () => 'River dredged')}
              >
                Dredge
              </button>
            </div>
          )}
        </aside>

        <div className="max-w-full overflow-x-auto rounded-lg bg-white p-4 shadow">
          <div className="flex min-w-max flex-row justify-center">
            <Table isRotated title="Residential Area" role={Role.RESIDENTS} resetFlag={board.resetFlag} nextFlag={board.nextFlag} player={player} />
            <Table isRotated={false} title="Industrial Area" role={Role.COMPANIES} resetFlag={board.resetFlag} nextFlag={board.nextFlag} player={player} />
          </div>
        </div>
      </section>
      <Toaster position="bottom-center" />
    </main>
  )
}

export default Board
