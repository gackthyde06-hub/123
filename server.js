import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime(), timestamp: Date.now() });
});

app.get('/api/performance', (req, res) => {
  res.status(200).json({ success: true, message: 'Performance ready' });
});

app.get('/api/test-signals', (req, res) => {
  res.status(200).json({ success: true, signals: [] });
});

app.get('*', (req, res) => {
  const indexPath = path.join(publicPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('public/index.html not found');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Railway Service] Running smoothly on port ${PORT}`);
});
