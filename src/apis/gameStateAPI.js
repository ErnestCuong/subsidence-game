const baseUrl = 'http://localhost:5000'

async function getGameState(role) {
  const url = `${baseUrl}/api/${role}/`
  const res = await fetch(url, {
    method: 'GET',
  })
  const body = await res.json()
  console.log(body)
  return body
}

function updateGameState(role, data) {
  const jsonData = JSON.stringify(data)
  console.log("YUOOOO", jsonData)
  return fetch(`${baseUrl}/api/${role}/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: jsonData,
  })
}

export {getGameState, updateGameState}