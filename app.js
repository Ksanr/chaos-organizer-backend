const Koa = require('koa');
const Router = require('@koa/router');
const cors = require('@koa/cors');
const bodyParser = require('koa-bodyparser');
const logger = require('koa-logger');
const { v4: uuidv4 } = require('uuid');

// multer и serve закомментированы, так как загрузка файлов отключена на сервере
// const multer = require('@koa/multer');
// const serve = require('koa-static');
// const path = require('path');

const app = new Koa();
const router = new Router();

// Хранилище сообщений в памяти
const messages = [];
const PAGE_SIZE = 10;

// Демо-сообщения
const demoMessages = [
  {
    id: uuidv4(),
    type: 'text',
    text: '🎉 Добро пожаловать в Chaos Organizer! Это демо-сообщение.',
    timestamp: Date.now() - 86400000,
    pinned: false,
  },
  {
    id: uuidv4(),
    type: 'text',
    text: 'Вы можете отправлять ссылки: https://github.com/Ksanr/chaos-organizer',
    timestamp: Date.now() - 7200000,
    pinned: false,
  },
  {
    id: uuidv4(),
    type: 'text',
    text: 'Попробуйте закрепить сообщение (иконка 📌) или отправить геолокацию (📍).',
    timestamp: Date.now() - 3600000,
    pinned: false,
  },
];
messages.push(...demoMessages);

// Middleware
app.use(logger());
app.use(cors({ origin: '*' }));
app.use(bodyParser());

// Префикс для всех API-роутов
router.prefix('/api');

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
    // Для файлов поиск по originalName — но файлы отключены, поэтому только текст
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

/* =================================================================
   Роут для загрузки файлов (изображения, видео, аудио)
   ЗАКОММЕНТИРОВАН, так как на бесплатном тарифе Pxxl возникает
   ошибка Disk quota exceeded. При локальном запуске
   эта функция полностью работоспособна.
   =================================================================
router.post('/messages/file', upload.single('file'), (ctx) => {
  const { pinned = false, geo = null } = ctx.request.body;
  const file = ctx.file;
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
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});