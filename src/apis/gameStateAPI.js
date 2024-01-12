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
  // if (role === 'board') {
  //   console.log(data)
  // }
  const jsonData = JSON.stringify(data)
  return fetch(`${baseUrl}/api/${role}/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: jsonData,
  })
}

export {getGameState, updateGameState}