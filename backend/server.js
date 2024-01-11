const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const port = 5000; // You can use any port you prefer

app.use(bodyParser.json());
app.use(cors());

// Your JSON data storage
let residents = [];
let industrialists = []

// Endpoint to get JSON data
app.get('/api/residents', (req, res) => {
  res.json(residents);
});

app.get('/api/industrialists', (req, res) => {
  res.json(industrialists);
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

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});