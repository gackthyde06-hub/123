import express from 'express';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 靜態目錄優先指向 public，其次根目錄相容
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));
app.use(express.static(__dirname));

// 1. 健檢端點（Railway 部署與保持在線必備）
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime(), timestamp: Date.now() });
});

// 2. 模擬與效能 API（防前端初始化噴錯）
app.get('/api/performance', (req, res) => {
  res.status(200).json({ success: true, timestamp: Date.now(), data: [] });
});

app.get('/api/test-signals', (req, res) => {
  res.status(200).json({ success: true, signals: [] });
});

// 3. 通用 JSON 數據存取介面（相容本地儲存與設定）
app.get('/api/data/:name', (req, res) => {
  const fileName = `${req.params.name}.json`;
  const filePath = path.join(__dirname, fileName);
  const publicFilePath = path.join(publicPath, fileName);

  const target = fs.existsSync(filePath) ? filePath : (fs.existsSync(publicFilePath) ? publicFilePath : null);
  if (target) {
    try {
      const data = JSON.parse(fs.readFileSync(target, 'utf-8'));
      return res.status(200).json(data);
    } catch (e) {
      return res.status(500).json({ error: 'Failed to read data' });
    }
  }
  res.status(404).json({ error: 'File not found' });
});

// 4. 前端 SPA / PWA 入口接通
app.get('*', (req, res) => {
  const publicIndex = path.join(publicPath, 'index.html');
  const rootIndex = path.join(__dirname, 'index.html');
  if (fs.existsSync(publicIndex)) {
    return res.sendFile(publicIndex);
  } else if (fs.existsSync(rootIndex)) {
    return res.sendFile(rootIndex);
  }
  res.status(404).send('index.html not found');
});

// 啟動監聽，綁定 0.0.0.0
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Railway Service] Running on port ${PORT}`);
});
