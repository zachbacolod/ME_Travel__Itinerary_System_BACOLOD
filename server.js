const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function readData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (err) {
    return [];
  }
}
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime());
const isTime = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

// sort by date first, then by start time
function sortItinerary(list) {
  return [...list].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.start_time !== b.start_time) return a.start_time < b.start_time ? -1 : 1;
    return a.id - b.id;
  });
}

// GET all activities (sorted by date, then start_time)
app.get('/api/activities', (req, res) => {
  res.status(200).json(sortItinerary(readData()));
});

// GET one activity by ID
app.get('/api/activities/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const item = readData().find((a) => a.id === id);
  if (!item) return res.status(404).json({ error: 'Activity not found' });
  res.status(200).json(item);
});

// POST a new activity
app.post('/api/activities', (req, res) => {
  const { activity, location, date, start_time, category } = req.body || {};

  for (const [k, v] of Object.entries({ activity, location, date, start_time, category })) {
    if (typeof v !== 'string' || v.trim() === '') {
      return res.status(400).json({ error: `${k} is required` });
    }
  }
  if (!isDate(date)) return res.status(400).json({ error: 'date must be in YYYY-MM-DD format' });
  if (!isTime(start_time)) return res.status(400).json({ error: 'start_time must be in HH:MM format' });

  const data = readData();

  // two activities cannot share the same date and start_time
  const conflict = data.find((a) => a.date === date && a.start_time === start_time);
  if (conflict) {
    return res.status(409).json({
      error: `Another activity ("${conflict.activity}") already starts on ${date} at ${start_time}`
    });
  }

  const newItem = {
    id: data.length ? Math.max(...data.map((a) => a.id)) + 1 : 1,
    activity: activity.trim(),
    location: location.trim(),
    date,
    start_time,
    category: category.trim()
  };
  data.push(newItem);
  writeData(data);
  res.status(201).json(newItem);
});

// DELETE an activity by ID
app.delete('/api/activities/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const data = readData();
  const index = data.findIndex((a) => a.id === id);
  if (index === -1) return res.status(404).json({ error: 'Activity not found' });
  const [removed] = data.splice(index, 1);
  writeData(data);
  res.status(200).json({ message: 'Activity deleted', deleted: removed });
});

// UPDATE / PUT / PATCH intentionally not implemented

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
