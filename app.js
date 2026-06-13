const Koa = require('koa');
const Router = require('@koa/router');
const cors = require('@koa/cors');
const bodyParser = require('koa-bodyparser');
const logger = require('koa-logger');
const serve = require('koa-static');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const multer = require('@koa/multer');

const app = new Koa();
const router = new Router();

// ========== НАСТРОЙКА ЗАГРУЗКИ ФАЙЛОВ ==========
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    const unique = uuidv4() + path.extname(file.originalname);
    cb(null, unique);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB лимит на один файл
});

// ========== ХРАНИЛИЩЕ СООБЩЕНИЙ ==========
const messages = [];
const PAGE_SIZE = 10;

// Демо-сообщения
const demoMessages = [
  { id: uuidv4(), type: 'text', text: '🎉 Добро пожаловать в Chaos Organizer!', timestamp: Date.now() - 86400000, pinned: false },
  { id: uuidv4(), type: 'text', text: 'Сообщение #2', timestamp: Date.now() - 85000000, pinned: false },
  { id: uuidv4(), type: 'text', text: 'Сообщение #3', timestamp: Date.now() - 84000000, pinned: false },
  { id: uuidv4(), type: 'text', text: 'Сообщение #4', timestamp: Date.now() - 83000000, pinned: false },
  { id: uuidv4(), type: 'text', text: 'Сообщение #5', timestamp: Date.now() - 82000000, pinned: false },
  { id: uuidv4(), type: 'text', text: 'Сообщение #6', timestamp: Date.now() - 81000000, pinned: false },
  { id: uuidv4(), type: 'text', text: 'Сообщение #7', timestamp: Date.now() - 80000000, pinned: false },
  { id: uuidv4(), type: 'text', text: 'Сообщение #8', timestamp: Date.now() - 79000000, pinned: false },
  { id: uuidv4(), type: 'text', text: 'Сообщение #9', timestamp: Date.now() - 78000000, pinned: false },
  { id: uuidv4(), type: 'text', text: 'Сообщение #10', timestamp: Date.now() - 77000000, pinned: false },
  { id: uuidv4(), type: 'text', text: 'Сообщение #11', timestamp: Date.now() - 76000000, pinned: false },
  { id: uuidv4(), type: 'text', text: 'Сообщение #12', timestamp: Date.now() - 75000000, pinned: false },
  { id: uuidv4(), type: 'text', text: '🔗 Ссылка: https://github.com/Ksanr/chaos-organizer', timestamp: Date.now() - 7200000, pinned: false },
  { id: uuidv4(), type: 'text', text: '📌 Закрепите это сообщение', timestamp: Date.now() - 3600000, pinned: false },
  { id: uuidv4(), type: 'text', text: '📍 Отправьте геолокацию кнопкой ниже', timestamp: Date.now() - 1800000, pinned: false },
];
messages.push(...demoMessages);

// ========== АВТОМАТИЧЕСКАЯ ОЧИСТКА СТАРЫХ ФАЙЛОВ ==========
const MAX_FILES_IN_UPLOADS = 5; // храним не более 5 файлов
function cleanOldFiles() {
  const uploadsDir = './uploads';
  if (!fs.existsSync(uploadsDir)) return;
  let files = fs.readdirSync(uploadsDir).map(file => ({
    name: file,
    path: path.join(uploadsDir, file),
    birthtime: fs.statSync(path.join(uploadsDir, file)).birthtime,
  }));
  files.sort((a, b) => a.birthtime - b.birthtime);
  while (files.length > MAX_FILES_IN_UPLOADS) {
    const oldest = files.shift();
    fs.unlinkSync(oldest.path);
    console.log(`Deleted old file: ${oldest.name}`);
  }
}

// Вызываем очистку при старте сервера (на случай, если остались лишние файлы)
cleanOldFiles();

// ========== MIDDLEWARE ==========
app.use(logger());
app.use(cors({ origin: '*' }));
app.use(bodyParser());
app.use(serve('./uploads')); // раздаём загруженные файлы

// Обработчик для корневого пути, который всегда отвечает, что всё в порядке.
router.get('/', (ctx) => {
  ctx.status = 200;
  ctx.body = 'OK';
});
// Префикс для всех API-роутов
router.prefix('/api');

// ========== РОУТЫ ==========
// Роут для получения сообщений с пагинацией
router.get('/messages', (ctx) => {
  const { page = 1 } = ctx.query;
  const pageNum = parseInt(page, 10);
  const sorted = [...messages].sort((a, b) => a.timestamp - b.timestamp);
  const total = sorted.length;
  const start = Math.max(0, total - pageNum * PAGE_SIZE);
  const end = total - (pageNum - 1) * PAGE_SIZE;
  const result = sorted.slice(start, end);
  ctx.body = {
    data: result,
    total: total,
    hasMore: start > 0,
  };
});

// Роут для создания текстового сообщения (поддерживает и геолокацию)
router.post('/messages/text', (ctx) => {
  const { text, pinned = false, geo = null } = ctx.request.body;
  const message = {
    id: uuidv4(),
    type: 'text',
    text,
    timestamp: Date.now(),
    pinned,
    geo,
  };
  messages.push(message);
  ctx.body = message;
});

// Роут для поиска сообщений
router.get('/messages/search', (ctx) => {
  const { q } = ctx.query;
  if (!q) {
    ctx.body = [];
    return;
  }
  const lowerQ = q.toLowerCase();
  const results = messages.filter(msg => {
    if (msg.type === 'text') return msg.text.toLowerCase().includes(lowerQ);
    if (msg.originalName) return msg.originalName.toLowerCase().includes(lowerQ);
    return false;
  });
  results.sort((a, b) => b.timestamp - a.timestamp);
  ctx.body = results.slice(-50);
});

// Роут для закрепления сообщения (только одно)
router.post('/messages/pin/:id', (ctx) => {
  const { id } = ctx.params;
  messages.forEach(msg => { msg.pinned = false; });
  const msg = messages.find(m => m.id === id);
  if (msg) {
    msg.pinned = true;
    ctx.body = msg;
  } else {
    ctx.status = 404;
    ctx.body = { error: 'Message not found' };
  }
});

// Роут для удаления закрепления
router.delete('/messages/pin', (ctx) => {
  messages.forEach(msg => { msg.pinned = false; });
  ctx.body = { success: true };
});

// Роут для получения закреплённого сообщения
router.get('/messages/pinned', (ctx) => {
  const pinned = messages.find(m => m.pinned === true);
  ctx.body = pinned || null;
});

// Роут для загрузки файлов (изображения, видео, аудио)
/*
router.post('/messages/file', upload.single('file'), (ctx) => {
  const { pinned = false, geo = null } = ctx.request.body;
  const file = ctx.file;
  if (!file) {
    ctx.status = 400;
    ctx.body = { error: 'No file uploaded' };
    return;
  }
  const ext = path.extname(file.filename).toLowerCase();
  let type = 'file';
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) type = 'image';
  else if (['.mp4', '.webm', '.ogg'].includes(ext)) type = 'video';
  else if (['.mp3', '.wav', '.ogg'].includes(ext)) type = 'audio';

  const message = {
    id: uuidv4(),
    type,
    fileUrl: `/${file.filename}`,
    originalName: file.originalname,
    timestamp: Date.now(),
    pinned,
    geo,
  };
  messages.push(message);
  ctx.body = message;
});
*/

app.use(router.routes()).use(router.allowedMethods());

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});