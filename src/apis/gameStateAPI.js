import { PlayerType } from "../containers/Board"

const baseUrl = 'http://localhost:5000'

async function getGameState(role) {
  const url = `${baseUrl}/api/${role}/`
  const res = await fetch(url, {
    method: 'GET',
  })
  const body = await res.json()
  return body
}

function updateGameState(role, data) {
  if (role === 'industrialists') {
    console.log('CHECK THIS OUT', data.budget)
  }
  const jsonData = JSON.stringify(data)
  return fetch(`${baseUrl}/api/${role}/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: jsonData,
  })
}

function resetGameState(player) {
  // if (player !== PlayerType.MODERATOR) {
  //   return
  // }
  // return fetch(`${baseUrl}/api/reset/`, {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'application/json',
  //   },
  //   body: JSON.stringify({}),
  // })
}

export {getGameState, updateGameState, resetGameState}