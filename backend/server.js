const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const port = 5000; // You can use any port you prefer

app.use(bodyParser.json());
app.use(cors());

// Your JSON data storage
let residents = {};
let industrialists = {};
let board = {
  resetFlag: 0,
  nextFlag: 0,
  flood: { round: 0, level: 0 },
  sediment: 0,
  sediment1: 0,
  sediment2: 0,
  subsidence: 0,
  subsidence1: 0,
  subsidence2: 0,
  govBudget: 0,
  floodProb: 0,
  tax1: 0,
  tax2: 0,
  remainingDredges: 1
}

// Endpoint to get JSON data
app.get('/api/residents', (req, res) => {
  res.json(residents);
});

app.get('/api/industrialists', (req, res) => {
  res.json(industrialists);
});

app.get('/api/board', (req, res) => {
  res.json(board);
});

// Endpoint to add data
app.post('/api/residents', (req, res) => {
  const newData = req.body;
  residents = newData;
  res.json({ message: 'Data added successfully', data: newData });
});

app.post('/api/industrialists', (req, res) => {
  const newData = req.body;
  industrialists = newData;
  res.json({ message: 'Data added successfully', data: newData });
});

app.post('/api/board', (req, res) => {
  const newData = req.body;
  board = newData;
  res.json({ message: 'Data added successfully', data: newData });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});