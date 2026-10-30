const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@libsql/client');

const SQLiteStore = require('connect-sqlite3')(session);

// ПОДКЛЮЧЕНИЕ К ОБЛАЧНОЙ БАЗЕ TURSO
const db = createClient({
  url: 'libsql://miksegram-miksek.aws-ap-northeast-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTMzODMzODUsImlkIjoiMDFhMThkZGQtYjcwMS03YTg5LWIxMGEtMjk1MTkxNWVmY2Q2Iiwia2lkIjoiMDY0M3BHaVkteXR5X0t2OC1HbVY5Y2Nlb0RyTVYyVUlnZVRtU2Y5MXQtcyIsInJpZCI6IjgzM2JlNTQyLWViZjEtNGVhZC05MTQ3LTFkY2VhNDYzYmZjNCJ9.GSH-xuW9awXLGLOjssUuqDoXuoouiydQgBL7oc2BkEwRJVpABbEO-2jHW9JFLHDJ5Of_nXGtBApz7uY19k7BDQ'
});

// Функция для инициализации таблиц
async function initDb() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      password TEXT NOT NULL,
      bio TEXT DEFAULT '',
      avatar TEXT DEFAULT 'grad-emerald',
      banner TEXT DEFAULT 'ban-aurora',
      last_seen TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS chats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      name TEXT,
      avatar TEXT DEFAULT 'grad-aurora',
      created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS chat_members (
      chat_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      hidden INTEGER DEFAULT 0,
      PRIMARY KEY (chat_id, user_id)
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL,
      sender_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      file_url TEXT,
      file_type TEXT,
      file_name TEXT,
      reply_to_id INTEGER,
      created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS read_status (
      chat_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      last_read_id INTEGER DEFAULT 0,
      PRIMARY KEY (chat_id, user_id)
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS reactions (
      message_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      emoji TEXT NOT NULL,
      PRIMARY KEY (message_id, user_id)
    );
  `);
  console.log('База данных готова!');
}
initDb().catch(console.error);

app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: true, limit: '8mb' }));

const sessionMiddleware = session({
  store: new SQLiteStore({ db: 'sessions.db', dir: './' }),
  secret: 'miksegram-secret-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 30 }
});
app.use(sessionMiddleware);
io.engine.use(sessionMiddleware);

app.post('/api/register', async (req, res) => {
  try {
    let { login, display_name, password } = req.body;
    if (!login || !display_name || !password) return res.json({ ok: false, error: 'Заполни все поля' });
    login = login.trim().toLowerCase().replace(/^@/, '');
    display_name = display_name.trim();
    if (!/^[a-z0-9_]{3,32}$/.test(login)) return res.json({ ok: false, error: 'Логин: 3-32' });
    if (display_name.length < 1 || display_name.length > 40) return res.json({ ok: false, error: 'Имя: 1-40' });
    if (password.length < 4) return res.json({ ok: false, error: 'Пароль: мин. 4' });
    
    const existing = await db.execute({ sql: 'SELECT id FROM users WHERE login = ?', args: [login] });
    if (existing.rows.length > 0) return res.json({ ok: false, error: 'Логин занят' });
    
    const hash = bcrypt.hashSync(password, 10);
    const info = await db.execute({ sql: 'INSERT INTO users (login, display_name, password) VALUES (?, ?, ?)', args: [login, display_name, hash] });
    req.session.userId = Number(info.lastInsertRowid);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.json({ ok: false, error: 'Ошибка сервера' }); }
});

app.post('/api/login', async (req, res) => {
  try {
    let { login, password } = req.body;
    login = (login || '').trim().toLowerCase().replace(/^@/, '');
    const userRes = await db.execute({ sql: 'SELECT * FROM users WHERE login = ?', args: [login] });
    const user = userRes.rows[0];
    
    if (!user || !bcrypt.compareSync(password, user.password)) return res.json({ ok: false, error: 'Неверный логин или пароль' });
    
    req.session.userId = user.id;
    await db.execute({ sql: 'UPDATE users SET last_seen = ? WHERE id = ?', args: [new Date().toISOString(), user.id] });
    res.json({ ok: true });
  } catch (e) { res.json({ ok: false, error: 'Ошибка сервера' }); }
});

app.post('/api/logout', async (req, res) => {
  if (req.session.userId) await db.execute({ sql: 'UPDATE users SET last_seen = ? WHERE id = ?', args: [new Date().toISOString(), req.session.userId] });
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', async (req, res) => {
  if (!req.session.userId) return res.json({ ok: false });
  const uRes = await db.execute({ sql: 'SELECT id, login, display_name, bio, avatar, banner FROM users WHERE id = ?', args: [req.session.userId] });
  if (uRes.rows.length === 0) return res.json({ ok: false });
  res.json({ ok: true, ...uRes.rows[0] });
});

app.post('/api/change-password', async (req, res) => {
  if (!req.session.userId) return res.json({ ok: false });
  const { old_password, new_password } = req.body;
  if (!old_password || !new_password) return res.json({ ok: false, error: 'Заполни все поля' });
  if (new_password.length < 4) return res.json({ ok: false, error: 'Новый пароль слишком короткий' });
  
  const userRes = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [req.session.userId] });
  const user = userRes.rows[0];
  if (!bcrypt.compareSync(old_password, user.password)) return res.json({ ok: false, error: 'Неверный текущий пароль' });
  
  await db.execute({ sql: 'UPDATE users SET password = ? WHERE id = ?', args: [bcrypt.hashSync(new_password, 10), req.session.userId] });
  res.json({ ok: true });
});

app.post('/api/update-profile', async (req, res) => {
  if (!req.session.userId) return res.json({ ok: false });
  const { display_name, bio, avatar, banner } = req.body;
  if (display_name !== undefined) await db.execute({ sql: 'UPDATE users SET display_name = ? WHERE id = ?', args: [String(display_name).trim().slice(0,40), req.session.userId] });
  if (bio !== undefined) await db.execute({ sql: 'UPDATE users SET bio = ? WHERE id = ?', args: [String(bio).slice(0,200), req.session.userId] });
  if (avatar !== undefined) await db.execute({ sql: 'UPDATE users SET avatar = ? WHERE id = ?', args: [avatar, req.session.userId] });
  if (banner !== undefined) await db.execute({ sql: 'UPDATE users SET banner = ? WHERE id = ?', args: [banner, req.session.userId] });
  
  const uRes = await db.execute({ sql: 'SELECT id, login, display_name, bio, avatar, banner FROM users WHERE id = ?', args: [req.session.userId] });
  res.json({ ok: true, user: uRes.rows[0] });
});

app.get('/api/all-users', async (req, res) => {
  if (!req.session.userId) return res.json({ ok: false });
  const uRes = await db.execute({ sql: 'SELECT id, login, display_name, avatar FROM users WHERE id != ? ORDER BY display_name ASC', args: [req.session.userId] });
  res.json({ ok: true, users: uRes.rows });
});

app.get('/api/chats', async (req, res) => {
  if (!req.session.userId) return res.json({ ok: false });
  const myId = req.session.userId;

  const chatsRes = await db.execute({
    sql: `
      SELECT c.id, c.type, c.name, c.avatar,
             (SELECT text FROM messages WHERE chat_id = c.id ORDER BY id DESC LIMIT 1) as last_text,
             (SELECT file_type FROM messages WHERE chat_id = c.id ORDER BY id DESC LIMIT 1) as last_file_type,
             (SELECT sender_id FROM messages WHERE chat_id = c.id ORDER BY id DESC LIMIT 1) as last_sender_id,
             (SELECT created_at FROM messages WHERE chat_id = c.id ORDER BY id DESC LIMIT 1) as last_time,
             (SELECT COUNT(*) FROM messages m 
              WHERE m.chat_id = c.id 
              AND m.id > COALESCE((SELECT last_read_id FROM read_status WHERE chat_id = c.id AND user_id = ?), 0)
              AND m.sender_id != ?) as unread_count
      FROM chats c
      JOIN chat_members cm ON c.id = cm.chat_id
      WHERE cm.user_id = ? AND cm.hidden = 0
      AND (c.type = 'group' OR (SELECT COUNT(*) FROM messages WHERE chat_id = c.id) > 0)
      ORDER BY last_time DESC, c.id DESC
    `,
    args: [myId, myId, myId]
  });

  const result = [];
  for (const c of chatsRes.rows) {
    if (c.type === 'private') {
      const otherRes = await db.execute({
        sql: `SELECT u.id, u.display_name, u.login, u.avatar, u.last_seen FROM users u JOIN chat_members cm ON u.id = cm.user_id WHERE cm.chat_id = ? AND u.id != ?`,
        args: [c.id, myId]
      });
      if (otherRes.rows.length > 0) {
        const other = otherRes.rows[0];
        result.push({ ...c, name: other.display_name, avatar: other.avatar, other_id: other.id, login: other.login, last_seen: other.last_seen });
        continue;
      }
    }
    result.push(c);
  }

  res.json({ ok: true, chats: result });
});

app.get('/api/search-user', async (req, res) => {
  if (!req.session.userId) return res.json({ ok: false });
  const q = (req.query.q || '').trim().toLowerCase().replace(/^@/, '');
  if (!q) return res.json({ ok: true, users: [] });
  const uRes = await db.execute({ sql: 'SELECT id, login, display_name, avatar FROM users WHERE id != ? AND (login LIKE ? OR display_name LIKE ?) LIMIT 10', args: [req.session.userId, `%${q}%`, `%${q}%`] });
  res.json({ ok: true, users: uRes.rows });
});

app.get('/api/user/:id', async (req, res) => {
  if (!req.session.userId) return res.json({ ok: false });
  const uRes = await db.execute({ sql: 'SELECT id, login, display_name, bio, avatar, banner, last_seen FROM users WHERE id = ?', args: [req.params.id] });
  if (uRes.rows.length === 0) return res.json({ ok: false });
  res.json({ ok: true, user: uRes.rows[0] });
});

app.post('/api/create-group', async (req, res) => {
  if (!req.session.userId) return res.json({ ok: false });
  const { name, member_ids } = req.body;
  const myId = req.session.userId;
  if (!name || !name.trim()) return res.json({ ok: false, error: 'Введите название' });
  if (!Array.isArray(member_ids) || member_ids.length === 0) return res.json({ ok: false, error: 'Выберите участников' });

  const info = await db.execute({ sql: 'INSERT INTO chats (type, name) VALUES (?, ?)', args: ['group', name.trim().slice(0, 50)] });
  const chatId = Number(info.lastInsertRowid);
  
  await db.execute({ sql: 'INSERT INTO chat_members (chat_id, user_id) VALUES (?, ?)', args: [chatId, myId] });
  for (const id of member_ids) {
    await db.execute({ sql: 'INSERT INTO chat_members (chat_id, user_id) VALUES (?, ?)', args: [chatId, id] });
    io.to('user_' + id).emit('update_chats');
  }
  io.to('user_' + myId).emit('update_chats');
  res.json({ ok: true, chat_id: chatId });
});

app.post('/api/chats/:id/clear', async (req, res) => {
  if (!req.session.userId) return res.json({ ok: false });
  const chatId = parseInt(req.params.id);
  const myId = req.session.userId;
  
  await db.execute({ sql: 'DELETE FROM messages WHERE chat_id = ? AND sender_id = ?', args: [chatId, myId] });
  await db.execute({ sql: 'DELETE FROM read_status WHERE chat_id = ? AND user_id = ?', args: [chatId, myId] });
  
  io.to('user_' + myId).emit('chat_cleared', { chat_id: chatId });
  io.to('user_' + myId).emit('update_chats');
  res.json({ ok: true });
});

app.post('/api/chats/:id/delete', async (req, res) => {
  if (!req.session.userId) return res.json({ ok: false });
  const chatId = parseInt(req.params.id);
  const myId = req.session.userId;
  
  const chatRes = await db.execute({ sql: 'SELECT * FROM chats WHERE id = ?', args: [chatId] });
  if (chatRes.rows.length === 0) return res.json({ ok: false });
  const chat = chatRes.rows[0];

  if (chat.type === 'group') {
    await db.execute({ sql: 'DELETE FROM chat_members WHERE chat_id = ? AND user_id = ?', args: [chatId, myId] });
    const remaining = await db.execute({ sql: 'SELECT COUNT(*) as c FROM chat_members WHERE chat_id = ?', args: [chatId] });
    if (remaining.rows[0].c === 0) {
      await db.execute({ sql: 'DELETE FROM messages WHERE chat_id = ?', args: [chatId] });
      await db.execute({ sql: 'DELETE FROM chats WHERE id = ?', args: [chatId] });
    }
  } else {
    await db.execute({ sql: 'UPDATE chat_members SET hidden = 1 WHERE chat_id = ? AND user_id = ?', args: [chatId, myId] });
  }
  
  io.to('user_' + myId).emit('update_chats');
  res.json({ ok: true });
});

async function getMsgWithReactions(msgId) {
  const msgRes = await db.execute({
    sql: `SELECT m.id, m.chat_id, m.sender_id, m.text, m.file_url, m.file_type, m.file_name, m.reply_to_id, m.created_at, u.display_name as sender_name, u.avatar as sender_avatar FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.id = ?`,
    args: [msgId]
  });
  if (msgRes.rows.length === 0) return null;
  const msg = msgRes.rows[0];
  
  if (msg.reply_to_id) {
    const rRes = await db.execute({ sql: 'SELECT text, file_type, file_name, sender_id, u.display_name as sender_name FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.id = ?', args: [msg.reply_to_id] });
    if (rRes.rows.length > 0) msg.reply_to = rRes.rows[0];
  }
  
  const reactions = await db.execute({ sql: 'SELECT emoji, COUNT(*) as count, GROUP_CONCAT(user_id) as users FROM reactions WHERE message_id = ? GROUP BY emoji', args: [msgId] });
  msg.reactions = reactions.rows;
  
  const chatRes = await db.execute({ sql: 'SELECT type FROM chats WHERE id = ?', args: [msg.chat_id] });
  msg.chat_type = chatRes.rows[0].type;
  return msg;
}

app.get('/api/messages/:chatId', async (req, res) => {
  if (!req.session.userId) return res.json({ ok: false });
  const myId = req.session.userId;
  const chatId = parseInt(req.params.chatId);
  
  const member = await db.execute({ sql: 'SELECT * FROM chat_members WHERE chat_id = ? AND user_id = ?', args: [chatId, myId] });
  if (member.rows.length === 0) return res.json({ ok: false });

  const rawMsgs = await db.execute({
    sql: `SELECT m.id, m.chat_id, m.sender_id, m.text, m.file_url, m.file_type, m.file_name, m.reply_to_id, m.created_at, u.display_name as sender_name, u.avatar as sender_avatar FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.chat_id = ? ORDER BY m.id ASC`,
    args: [chatId]
  });

  const msgs = [];
  for (const m of rawMsgs.rows) {
    if (m.reply_to_id) {
      const r = await db.execute({ sql: 'SELECT text, file_type, file_name, u.display_name as sender_name FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.id = ?', args: [m.reply_to_id] });
      if (r.rows.length > 0) m.reply_to = r.rows[0];
    }
    const reactions = await db.execute({ sql: 'SELECT emoji, COUNT(*) as count, GROUP_CONCAT(user_id) as users FROM reactions WHERE message_id = ? GROUP BY emoji', args: [m.id] });
    m.reactions = reactions.rows;
    msgs.push(m);
  }

  const lastId = msgs.length ? msgs[msgs.length - 1].id : 0;
  await db.execute({ sql: `INSERT INTO read_status (chat_id, user_id, last_read_id) VALUES (?, ?, ?) ON CONFLICT(chat_id, user_id) DO UPDATE SET last_read_id = excluded.last_read_id`, args: [chatId, myId, lastId] });

  res.json({ ok: true, messages: msgs });
});

const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

app.post('/api/upload', (req, res) => {
  if (!req.session.userId) return res.json({ ok: false });
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.json({ ok: false, error: 'Файл больше 5 МБ' });
      return res.json({ ok: false, error: 'Ошибка загрузки' });
    }
    if (!req.file) return res.json({ ok: false, error: 'Файл не загружен' });
    const fileUrl = '/uploads/' + req.file.filename;
    const isImage = req.file.mimetype.startsWith('image/');
    const isAudio = req.file.mimetype.startsWith('audio/');
    const type = isImage ? 'image' : (isAudio ? 'audio' : 'file');
    res.json({ ok: true, file_url: fileUrl, file_type: type, file_name: req.file.originalname });
  });
});

app.post('/api/messages/:id/delete', async (req, res) => {
  if (!req.session.userId) return res.json({ ok: false });
  const msgId = parseInt(req.params.id);
  const myId = req.session.userId;
  const msgRes = await db.execute({ sql: 'SELECT * FROM messages WHERE id = ?', args: [msgId] });
  if (msgRes.rows.length === 0 || msgRes.rows[0].sender_id !== myId) return res.json({ ok: false });
  const msg = msgRes.rows[0];
  
  await db.execute({ sql: 'DELETE FROM reactions WHERE message_id = ?', args: [msgId] });
  await db.execute({ sql: 'DELETE FROM messages WHERE id = ?', args: [msgId] });
  
  if (msg.file_url) {
    const filePath = path.join(__dirname, 'public', msg.file_url);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  
  const members = await db.execute({ sql: 'SELECT user_id FROM chat_members WHERE chat_id = ?', args: [msg.chat_id] });
  members.rows.forEach(m => {
    io.to('user_' + m.user_id).emit('message_deleted', { id: msgId, chat_id: msg.chat_id });
    io.to('user_' + m.user_id).emit('update_chats');
  });
  res.json({ ok: true });
});

app.get('/', (req, res) => {
  if (!req.session.userId) return res.redirect('/login.html');
  res.sendFile(__dirname + '/public/index.html');
});
app.get('/profile', (req, res) => {
  if (!req.session.userId) return res.redirect('/login.html');
  res.sendFile(__dirname + '/public/profile.html');
});
app.get('/user/:id', (req, res) => {
  if (!req.session.userId) return res.redirect('/login.html');
  res.sendFile(__dirname + '/public/user.html');
});
app.use((req, res, next) => {
  if ((req.path === '/index.html' || req.path === '/profile.html' || req.path.startsWith('/user/')) && !req.session.userId) return res.redirect('/login.html');
  next();
});
app.use(express.static('public'));

const onlineUsers = new Map();

io.on('connection', (socket) => {
  const sess = socket.request.session;
  if (!sess || !sess.userId) { socket.disconnect(); return; }
  const myId = sess.userId;
  socket.join('user_' + myId);
  
  const count = (onlineUsers.get(myId) || 0) + 1;
  onlineUsers.set(myId, count);
  if (count === 1) io.emit('user_online', myId);
  
  socket.emit('online_list', Array.from(onlineUsers.keys()));

  socket.on('typing', async (data) => {
    const members = await db.execute({ sql: 'SELECT user_id FROM chat_members WHERE chat_id = ?', args: [data.chat_id] });
    members.rows.forEach(m => { if (m.user_id !== myId) io.to('user_' + m.user_id).emit('user_typing', { chat_id: data.chat_id, user_id: myId, is_typing: data.is_typing }); });
  });

  socket.on('send_message', async (data) => {
    let { chat_id, text, other_id, file_url, file_type, file_name, reply_to_id } = data;
    if (!text && !file_url) return;
    const clean = (text || '').trim().slice(0, 2000);
    if (!chat_id && other_id) {
      const existing = await db.execute({ sql: `SELECT c.id FROM chats c JOIN chat_members cm1 ON c.id = cm1.chat_id AND cm1.user_id = ? JOIN chat_members cm2 ON c.id = cm2.chat_id AND cm2.user_id = ? WHERE c.type = 'private'`, args: [myId, other_id] });
      if (existing.rows.length > 0) {
        chat_id = existing.rows[0].id;
        await db.execute({ sql: 'UPDATE chat_members SET hidden = 0 WHERE chat_id = ? AND user_id = ?', args: [chat_id, other_id] });
      } else {
        const info = await db.execute({ sql: 'INSERT INTO chats (type) VALUES (?)', args: ['private'] });
        chat_id = Number(info.lastInsertRowid);
        await db.execute({ sql: 'INSERT INTO chat_members (chat_id, user_id) VALUES (?, ?)', args: [chat_id, myId] });
        await db.execute({ sql: 'INSERT INTO chat_members (chat_id, user_id) VALUES (?, ?)', args: [chat_id, other_id] });
      }
    }
    if (!chat_id) return;
    
    await db.execute({ sql: 'UPDATE chat_members SET hidden = 0 WHERE chat_id = ?', args: [chat_id] });
    
    const member = await db.execute({ sql: 'SELECT * FROM chat_members WHERE chat_id = ? AND user_id = ?', args: [chat_id, myId] });
    if (member.rows.length === 0) return;
    
    const info = await db.execute({ sql: 'INSERT INTO messages (chat_id, sender_id, text, file_url, file_type, file_name, reply_to_id) VALUES (?, ?, ?, ?, ?, ?, ?)', args: [chat_id, myId, clean, file_url || null, file_type || null, file_name || null, reply_to_id || null] });
    const msg = await getMsgWithReactions(Number(info.lastInsertRowid));
    
    const members = await db.execute({ sql: 'SELECT user_id FROM chat_members WHERE chat_id = ?', args: [chat_id] });
    members.rows.forEach(m => {
      io.to('user_' + m.user_id).emit('new_message', msg);
      io.to('user_' + m.user_id).emit('update_chats');
    });
  });

  socket.on('add_reaction', async (data) => {
    const { message_id, emoji } = data;
    const existing = await db.execute({ sql: 'SELECT * FROM reactions WHERE message_id = ? AND user_id = ?', args: [message_id, myId] });
    if (existing.rows.length > 0) {
      if (existing.rows[0].emoji === emoji) await db.execute({ sql: 'DELETE FROM reactions WHERE message_id = ? AND user_id = ?', args: [message_id, myId] });
      else await db.execute({ sql: 'UPDATE reactions SET emoji = ? WHERE message_id = ? AND user_id = ?', args: [emoji, message_id, myId] });
    } else {
      await db.execute({ sql: 'INSERT INTO reactions (message_id, user_id, emoji) VALUES (?, ?, ?)', args: [message_id, myId, emoji] });
    }
    const msg = await db.execute({ sql: 'SELECT chat_id FROM messages WHERE id = ?', args: [message_id] });
    if (msg.rows.length === 0) return;
    
    const updatedMsg = await getMsgWithReactions(message_id);
    const members = await db.execute({ sql: 'SELECT user_id FROM chat_members WHERE chat_id = ?', args: [msg.rows[0].chat_id] });
    members.rows.forEach(m => { io.to('user_' + m.user_id).emit('message_updated', updatedMsg); });
  });

  socket.on('mark_read', async (chatId) => {
    const lastMsg = await db.execute({ sql: 'SELECT id FROM messages WHERE chat_id = ? ORDER BY id DESC LIMIT 1', args: [chatId] });
    if (lastMsg.rows.length === 0) return;
    await db.execute({ sql: `INSERT INTO read_status (chat_id, user_id, last_read_id) VALUES (?, ?, ?) ON CONFLICT(chat_id, user_id) DO UPDATE SET last_read_id = excluded.last_read_id`, args: [chatId, myId, lastMsg.rows[0].id] });
    io.to('user_' + myId).emit('update_chats');
  });

  socket.on('disconnect', async () => {
    const c = (onlineUsers.get(myId) || 1) - 1;
    if (c <= 0) { 
      onlineUsers.delete(myId); 
      await db.execute({ sql: 'UPDATE users SET last_seen = ? WHERE id = ?', args: [new Date().toISOString(), myId] });
      io.emit('user_offline', myId); 
    } else { 
      onlineUsers.set(myId, c); 
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`Miksegram запущен на порту ${PORT}`); });