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
const { createClient: createSupabase } = require('@supabase/supabase-js');

const LOG = (tag, ...args) => console.log(`[${new Date().toISOString()}] [${tag}]`, ...args);
const ERR = (tag, ...args) => console.error(`[${new Date().toISOString()}] [${tag}]`, ...args);

process.on('uncaughtException', (err) => ERR('UNCAUGHT', err.message, err.stack));
process.on('unhandledRejection', (reason) => ERR('UNHANDLED', reason));

// --- КЛЮЧИ (позже вынесем в ENV) ---
const db = createClient({
  url: 'libsql://miksegram-miksek.aws-ap-northeast-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTMzODMzODUsImlkIjoiMDFhMThkZGQtYjcwMS03YTg5LWIxMGEtMjk1MTkxNWVmY2Q2Iiwia2lkIjoiMDY0M3BHaVkteXR5X0t2OC1HbVY5Y2Nlb0RyTVYyVUlnZVRtU2Y5MXQtcyIsInJpZCI6IjgzM2JlNTQyLWViZjEtNGVhZC05MTQ3LTFkY2VhNDYzYmZjNCJ9.GSH-xuW9awXLGLOjssUuqDoXuoouiydQgBL7oc2BkEwRJVpABbEO-2jHW9JFLHDJ5Of_nXGtBApz7uY19k7BDQ'
});

const supabase = createSupabase('https://tvmypcjwrlwiorpmugpb.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2bXlwY2p3cmx3aW9ycG11Z3BiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MzQwODQwOSwiZXhwIjoyMTA4OTg0NDA5fQ.1ChmymKXpkweU7PImFwAfFYY4ufSx525Fotjn4FRtSw');

// --- СЕССИИ В БАЗЕ ---
class TursoStore extends session.Store {
  constructor(options) { super(options); this.db = db; }
  async get(sid, cb) {
    try { const r = await this.db.execute({ sql: 'SELECT sess FROM sessions WHERE sid = ?', args: [sid] }); cb(null, r.rows.length ? JSON.parse(r.rows[0].sess) : null); } catch (e) { cb(e); }
  }
  async set(sid, sess, cb) {
    try { await this.db.execute({ sql: 'INSERT INTO sessions (sid, sess) VALUES (?, ?) ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess', args: [sid, JSON.stringify(sess)] }); cb(null); } catch (e) { cb(e); }
  }
  async destroy(sid, cb) {
    try { await this.db.execute({ sql: 'DELETE FROM sessions WHERE sid = ?', args: [sid] }); cb(null); } catch (e) { cb(e); }
  }
}

// --- ИНИЦИАЛИЗАЦИЯ БД ---
async function initDb(attempt = 1) {
  try {
    LOG('DB', `Инициализация БД (попытка ${attempt})...`);
    await db.execute(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, login TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL, password TEXT NOT NULL, bio TEXT DEFAULT '', avatar TEXT DEFAULT 'grad-emerald', banner TEXT DEFAULT 'ban-aurora', avatar_frame TEXT DEFAULT 'none', name_effect TEXT DEFAULT 'none', last_seen TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')), created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')));`);
    await db.execute(`CREATE TABLE IF NOT EXISTS chats (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, name TEXT, avatar TEXT DEFAULT 'grad-aurora', creator_id INTEGER, created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')));`);
    await db.execute(`CREATE TABLE IF NOT EXISTS chat_members (chat_id INTEGER NOT NULL, user_id INTEGER NOT NULL, hidden INTEGER DEFAULT 0, last_read_msg_id INTEGER DEFAULT 0, PRIMARY KEY (chat_id, user_id));`);
    await db.execute(`CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, chat_id INTEGER NOT NULL, sender_id INTEGER NOT NULL, text TEXT NOT NULL, file_url TEXT, file_type TEXT, file_name TEXT, reply_to_id INTEGER, created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')));`);
    await db.execute(`CREATE TABLE IF NOT EXISTS read_status (chat_id INTEGER NOT NULL, user_id INTEGER NOT NULL, last_read_id INTEGER DEFAULT 0, PRIMARY KEY (chat_id, user_id));`);
    await db.execute(`CREATE TABLE IF NOT EXISTS reactions (message_id INTEGER NOT NULL, user_id INTEGER NOT NULL, emoji TEXT NOT NULL, PRIMARY KEY (message_id, user_id));`);
    await db.execute(`CREATE TABLE IF NOT EXISTS sessions (sid TEXT PRIMARY KEY, sess TEXT NOT NULL);`);

    try { await db.execute(`ALTER TABLE users ADD COLUMN is_banned INTEGER DEFAULT 0;`); } catch (e) {}
    try { await db.execute(`ALTER TABLE users ADD COLUMN badge TEXT DEFAULT 'none';`); } catch (e) {}

    await db.execute(`CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_chat_members_user_id ON chat_members(user_id);`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_chat_members_chat_id ON chat_members(chat_id);`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_read_status_user_id ON read_status(user_id);`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_reactions_message_id ON reactions(message_id);`);

    LOG('DB', '✅ База данных готова (с колонками ban/badge).');
  } catch (err) {
    ERR('DB', `❌ Ошибка инициализации (попытка ${attempt}):`, err.message);
    if (attempt < 3) setTimeout(() => initDb(attempt + 1), 3000);
  }
}
initDb();

app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: true, limit: '8mb' }));

const sessionMiddleware = session({
  store: new TursoStore(),
  secret: 'miksegram-secret-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 30 }
});
app.use(sessionMiddleware);
io.engine.use(sessionMiddleware);

async function ensureSavedChat(userId) {
  try {
    const existing = await db.execute({ sql: `SELECT c.id FROM chats c JOIN chat_members cm ON c.id = cm.chat_id WHERE cm.user_id = ? AND c.type = 'saved' LIMIT 1`, args: [userId] });
    if (existing.rows.length > 0) return existing.rows[0].id;
    const info = await db.execute({ sql: `INSERT INTO chats (type, name, creator_id) VALUES ('saved', 'Избранное', ?)`, args: [userId] });
    const chatId = Number(info.lastInsertRowid);
    await db.execute({ sql: `INSERT INTO chat_members (chat_id, user_id) VALUES (?, ?)`, args: [chatId, userId] });
    return chatId;
  } catch (e) { return null; }
}

async function isChatMember(chatId, userId) {
  const res = await db.execute({ sql: 'SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?', args: [chatId, userId] });
  return res.rows.length > 0;
}

async function isAdmin(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ ok: false, error: 'Не авторизован' });
  try {
    const uRes = await db.execute({ sql: 'SELECT login FROM users WHERE id = ?', args: [req.session.userId] });
    if (uRes.rows.length === 0 || uRes.rows[0].login !== 'admin') return res.status(403).json({ ok: false, error: 'Доступ запрещен' });
    next();
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
}

// ==================== АВТОРИЗАЦИЯ ====================
app.post('/api/register', async (req, res) => {
  try {
    let { login, display_name, password } = req.body;
    if (!login || !display_name || !password) return res.json({ ok: false, error: 'Заполни все поля' });
    login = login.trim().toLowerCase().replace(/^@/, '');
    display_name = display_name.trim();
    if (!/^[a-z0-9_]{3,32}$/.test(login)) return res.json({ ok: false, error: 'Логин: 3-32 символа' });
    if (display_name.length < 1 || display_name.length > 40) return res.json({ ok: false, error: 'Имя: от 1 до 40 символов' });
    if (password.length < 4) return res.json({ ok: false, error: 'Пароль: минимум 4 символа' });
    const existing = await db.execute({ sql: 'SELECT id FROM users WHERE login = ?', args: [login] });
    if (existing.rows.length > 0) return res.json({ ok: false, error: 'Этот логин уже занят' });
    const hash = bcrypt.hashSync(password, 10);
    const info = await db.execute({ sql: 'INSERT INTO users (login, display_name, password) VALUES (?, ?, ?)', args: [login, display_name, hash] });
    req.session.userId = Number(info.lastInsertRowid);
    await ensureSavedChat(req.session.userId);
    res.json({ ok: true });
  } catch (e) { res.json({ ok: false, error: 'Ошибка сервера' }); }
});

app.post('/api/login', async (req, res) => {
  try {
    let { login, password } = req.body;
    login = (login || '').trim().toLowerCase().replace(/^@/, '');
    if (!login || !password) return res.json({ ok: false, error: 'Введите логин и пароль' });
    const userRes = await db.execute({ sql: 'SELECT * FROM users WHERE login = ?', args: [login] });
    const user = userRes.rows[0];
    if (!user) return res.json({ ok: false, error: 'Пользователь не найден' });
    if (!bcrypt.compareSync(password, user.password)) return res.json({ ok: false, error: 'Неверный пароль' });
    
    if (user.is_banned) return res.json({ ok: false, error: '❌ Ваш аккаунт заблокирован администратором' });
    
    req.session.userId = user.id;
    await db.execute({ sql: 'UPDATE users SET last_seen = ? WHERE id = ?', args: [new Date().toISOString(), user.id] });
    await ensureSavedChat(user.id);
    res.json({ ok: true, user: { id: user.id, login: user.login, display_name: user.display_name, avatar: user.avatar } });
  } catch (e) { res.json({ ok: false, error: 'Ошибка сервера' }); }
});

app.post('/api/logout', async (req, res) => {
  try {
    if (req.session.userId) await db.execute({ sql: 'UPDATE users SET last_seen = ? WHERE id = ?', args: [new Date().toISOString(), req.session.userId] });
    req.session.destroy(() => res.json({ ok: true }));
  } catch (e) { req.session.destroy(() => res.json({ ok: true })); }
});

app.get('/api/me', async (req, res) => {
  if (!req.session.userId) return res.json({ ok: false });
  try {
    const uRes = await db.execute({ sql: 'SELECT id, login, display_name, bio, avatar, banner, avatar_frame, name_effect, badge, is_banned FROM users WHERE id = ?', args: [req.session.userId] });
    if (uRes.rows.length === 0 || uRes.rows[0].is_banned) {
      req.session.destroy();
      return res.json({ ok: false, error: 'Аккаунт заблокирован' });
    }
    res.json({ ok: true, ...uRes.rows[0] });
  } catch (e) { res.json({ ok: false }); }
});

app.post('/api/change-password', async (req, res) => {
  if (!req.session.userId) return res.json({ ok: false });
  const { old_password, new_password } = req.body;
  if (!old_password || !new_password) return res.json({ ok: false, error: 'Заполни все поля' });
  if (new_password.length < 4) return res.json({ ok: false, error: 'Новый пароль слишком короткий' });
  try {
    const userRes = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [req.session.userId] });
    const user = userRes.rows[0];
    if (!bcrypt.compareSync(old_password, user.password)) return res.json({ ok: false, error: 'Неверный текущий пароль' });
    await db.execute({ sql: 'UPDATE users SET password = ? WHERE id = ?', args: [bcrypt.hashSync(new_password, 10), req.session.userId] });
    res.json({ ok: true });
  } catch (e) { res.json({ ok: false, error: 'Ошибка сервера' }); }
});

app.post('/api/delete-account', async (req, res) => {
  if (!req.session.userId) return res.json({ ok: false });
  const { password } = req.body;
  if (!password) return res.json({ ok: false, error: 'Введите пароль' });
  try {
    const userRes = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [req.session.userId] });
    const user = userRes.rows[0];
    if (!user || !bcrypt.compareSync(password, user.password)) return res.json({ ok: false, error: 'Неверный пароль' });
    const myId = req.session.userId;
    await db.execute({ sql: 'DELETE FROM reactions WHERE user_id = ?', args: [myId] });
    await db.execute({ sql: 'DELETE FROM messages WHERE sender_id = ?', args: [myId] });
    await db.execute({ sql: 'DELETE FROM chat_members WHERE user_id = ?', args: [myId] });
    await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [myId] });
    const emptyChats = await db.execute({ sql: 'SELECT c.id FROM chats c LEFT JOIN chat_members cm ON c.id = cm.chat_id WHERE cm.chat_id IS NULL', args: [] });
    for (const c of emptyChats.rows) {
      await db.execute({ sql: 'DELETE FROM chats WHERE id = ?', args: [c.id] });
      await db.execute({ sql: 'DELETE FROM messages WHERE chat_id = ?', args: [c.id] });
    }
    io.emit('update_chats'); 
    req.session.destroy();
    res.json({ ok: true });
  } catch (e) { res.json({ ok: false, error: 'Ошибка сервера' }); }
});

app.post('/api/update-profile', async (req, res) => {
  if (!req.session.userId) return res.json({ ok: false });
  try {
    const { display_name, bio, avatar, banner, avatar_frame, name_effect } = req.body;
    if (display_name !== undefined) await db.execute({ sql: 'UPDATE users SET display_name = ? WHERE id = ?', args: [String(display_name).trim().slice(0,40), req.session.userId] });
    if (bio !== undefined) await db.execute({ sql: 'UPDATE users SET bio = ? WHERE id = ?', args: [String(bio).slice(0,200), req.session.userId] });
    if (avatar !== undefined) await db.execute({ sql: 'UPDATE users SET avatar = ? WHERE id = ?', args: [avatar, req.session.userId] });
    if (banner !== undefined) await db.execute({ sql: 'UPDATE users SET banner = ? WHERE id = ?', args: [banner, req.session.userId] });
    if (avatar_frame !== undefined) await db.execute({ sql: 'UPDATE users SET avatar_frame = ? WHERE id = ?', args: [avatar_frame, req.session.userId] });
    if (name_effect !== undefined) await db.execute({ sql: 'UPDATE users SET name_effect = ? WHERE id = ?', args: [name_effect, req.session.userId] });
    const uRes = await db.execute({ sql: 'SELECT id, login, display_name, bio, avatar, banner, avatar_frame, name_effect, badge FROM users WHERE id = ?', args: [req.session.userId] });
    res.json({ ok: true, user: uRes.rows[0] });
  } catch (e) { res.json({ ok: false, error: 'Ошибка сервера' }); }
});

app.get('/api/all-users', async (req, res) => {
  if (!req.session.userId) return res.json({ ok: false });
  try {
    const uRes = await db.execute({ sql: 'SELECT id, login, display_name, avatar, avatar_frame, name_effect, badge FROM users WHERE id != ? ORDER BY display_name ASC', args: [req.session.userId] });
    res.json({ ok: true, users: uRes.rows });
  } catch (e) { res.json({ ok: false, users: [] }); }
});

// ==================== АДМИН API ====================
app.get('/api/admin/stats', isAdmin, async (req, res) => {
  try {
    const uCount = await db.execute('SELECT COUNT(*) as c FROM users');
    const mCount = await db.execute('SELECT COUNT(*) as c FROM messages');
    res.json({ ok: true, users: uCount.rows[0].c, messages: mCount.rows[0].c, online: onlineUsers.size });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

app.get('/api/admin/users', isAdmin, async (req, res) => {
  try {
    const uRes = await db.execute('SELECT id, login, display_name, avatar, badge, is_banned FROM users ORDER BY id ASC');
    res.json({ ok: true, users: uRes.rows });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

app.post('/api/admin/ban', isAdmin, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.json({ ok: false, error: 'Не указан userId' });
    const target = await db.execute({ sql: 'SELECT login FROM users WHERE id = ?', args: [userId] });
    if (target.rows.length === 0 || target.rows[0].login === 'admin') return res.json({ ok: false, error: 'Нельзя забанить админа' });
    await db.execute({ sql: 'UPDATE users SET is_banned = 1 WHERE id = ?', args: [userId] });
    io.to('user_' + userId).emit('force_logout');
    res.json({ ok: true });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

app.post('/api/admin/unban', isAdmin, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.json({ ok: false, error: 'Не указан userId' });
    await db.execute({ sql: 'UPDATE users SET is_banned = 0 WHERE id = ?', args: [userId] });
    res.json({ ok: true });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

app.post('/api/admin/set-badge', isAdmin, async (req, res) => {
  try {
    const { userId, badge } = req.body;
    if (!userId || !badge) return res.json({ ok: false, error: 'Не хватает параметров' });
    const allowed = ['none', 'crown', 'check', 'star', 'smile'];
    if (!allowed.includes(badge)) return res.json({ ok: false, error: 'Неверный бейдж' });
    await db.execute({ sql: 'UPDATE users SET badge = ? WHERE id = ?', args: [badge, userId] });
    io.emit('update_chats');
    res.json({ ok: true });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

app.post('/api/admin/clear-avatars', isAdmin, async (req, res) => {
  try {
    await db.execute(`UPDATE users SET avatar = 'grad-emerald', banner = 'ban-aurora' WHERE avatar LIKE 'https://%' OR banner LIKE 'https://%'`);
    io.emit('update_chats');
    res.json({ ok: true });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

app.post('/api/admin/clear-messages', isAdmin, async (req, res) => {
  try {
    await db.execute('DELETE FROM messages');
    await db.execute('DELETE FROM reactions');
    await db.execute('DELETE FROM read_status');
    io.emit('update_chats');
    res.json({ ok: true });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

app.post('/api/admin/clear-chats', isAdmin, async (req, res) => {
  try {
    await db.execute('DELETE FROM messages');
    await db.execute('DELETE FROM reactions');
    await db.execute('DELETE FROM read_status');
    await db.execute('DELETE FROM chat_members');
    await db.execute('DELETE FROM chats');
    io.emit('update_chats');
    res.json({ ok: true });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

app.post('/api/admin/clear-storage', isAdmin, async (req, res) => {
  try {
    const { data: files, error } = await supabase.storage.from('uploads').list();
    if (error) throw error;
    if (files && files.length > 0) {
      const fileNames = files.map(f => f.name);
      await supabase.storage.from('uploads').remove(fileNames);
    }
    res.json({ ok: true, count: files ? files.length : 0 });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

// ==================== ЧАТЫ ====================
app.get('/api/chats', async (req, res) => {
  if (!req.session.userId) return res.json({ ok: false });
  const myId = req.session.userId;
  try {
    await ensureSavedChat(myId);
    const chatsRes = await db.execute({
      sql: `
        SELECT c.id, c.type, c.name, c.avatar, c.creator_id, c.created_at,
               (SELECT text FROM messages WHERE chat_id = c.id ORDER BY id DESC LIMIT 1) as last_text,
               (SELECT file_type FROM messages WHERE chat_id = c.id ORDER BY id DESC LIMIT 1) as last_file_type,
               (SELECT sender_id FROM messages WHERE chat_id = c.id ORDER BY id DESC LIMIT 1) as last_sender_id,
               (SELECT created_at FROM messages WHERE chat_id = c.id ORDER BY id DESC LIMIT 1) as last_time,
               (SELECT COUNT(*) FROM messages m WHERE m.chat_id = c.id AND m.id > COALESCE((SELECT last_read_id FROM read_status WHERE chat_id = c.id AND user_id = ?), 0) AND m.sender_id != ?) as unread_count
        FROM chats c
        JOIN chat_members cm ON c.id = cm.chat_id
        WHERE cm.user_id = ? AND cm.hidden = 0
        ORDER BY COALESCE(last_time, c.created_at) DESC, c.id DESC
      `,
      args: [myId, myId, myId]
    });

    const result = [];
    for (const c of chatsRes.rows) {
      if (c.type === 'private') {
        const otherRes = await db.execute({
          sql: `SELECT u.id, u.display_name, u.login, u.avatar, u.avatar_frame, u.name_effect, u.last_seen, u.badge, cm.last_read_msg_id FROM users u JOIN chat_members cm ON u.id = cm.user_id WHERE cm.chat_id = ? AND u.id != ?`,
          args: [c.id, myId]
        });
        if (otherRes.rows.length > 0) {
          const other = otherRes.rows[0];
          result.push({ ...c, name: other.display_name, avatar: other.avatar, avatar_frame: other.avatar_frame, name_effect: other.name_effect, badge: other.badge, other_id: other.id, login: other.login, last_seen: other.last_seen, other_last_read: other.last_read_msg_id });
          continue;
        }
      }
      if (c.type === 'saved') {
        result.push({ ...c, name: 'Избранное', avatar: 'grad-amber', other_id: null, login: '', last_seen: null, other_last_read: 0, badge: 'none' });
        continue;
      }
      result.push(c);
    }
    res.json({ ok: true, chats: result });
  } catch (error) { res.json({ ok: false, chats: [] }); }
});

app.get('/api/search-user', async (req, res) => {
  if (!req.session.userId) return res.json({ ok: false });
  try {
    const q = (req.query.q || '').trim().toLowerCase().replace(/^@/, '');
    if (!q) return res.json({ ok: true, users: [] });
    const uRes = await db.execute({ sql: 'SELECT id, login, display_name, avatar, avatar_frame, name_effect, badge FROM users WHERE id != ? AND (login LIKE ? OR display_name LIKE ?) LIMIT 10', args: [req.session.userId, `%${q}%`, `%${q}%`] });
    res.json({ ok: true, users: uRes.rows });
  } catch (e) { res.json({ ok: false, users: [] }); }
});

app.get('/api/user/:id', async (req, res) => {
  if (!req.session.userId) return res.json({ ok: false });
  try {
    const uRes = await db.execute({ sql: 'SELECT id, login, display_name, bio, avatar, banner, avatar_frame, name_effect, last_seen, badge FROM users WHERE id = ?', args: [req.params.id] });
    if (uRes.rows.length === 0) return res.json({ ok: false });
    res.json({ ok: true, user: uRes.rows[0] });
  } catch (e) { res.json({ ok: false }); }
});

// ==================== ГРУППЫ ====================
app.post('/api/create-group', async (req, res) => {
  if (!req.session.userId) return res.json({ ok: false });
  try {
    const { name, member_ids } = req.body;
    const myId = req.session.userId;
    if (!name || !name.trim()) return res.json({ ok: false, error: 'Введите название' });
    if (!Array.isArray(member_ids) || member_ids.length === 0) return res.json({ ok: false, error: 'Выберите участников' });
    const info = await db.execute({ sql: 'INSERT INTO chats (type, name, creator_id) VALUES (?, ?, ?)', args: ['group', name.trim().slice(0, 50), myId] });
    const chatId = Number(info.lastInsertRowid);
    await db.execute({ sql: 'INSERT INTO chat_members (chat_id, user_id) VALUES (?, ?)', args: [chatId, myId] });
    for (const id of member_ids) {
      await db.execute({ sql: 'INSERT INTO chat_members (chat_id, user_id) VALUES (?, ?)', args: [chatId, id] });
      io.to('user_' + id).emit('update_chats');
    }
    io.to('user_' + myId).emit('update_chats');
    res.json({ ok: true, chat_id: chatId });
  } catch (e) { res.json({ ok: false, error: 'Ошибка' }); }
});

app.get('/api/groups/:id', async (req, res) => {
  if (!req.session.userId) return res.json({ ok: false });
  try {
    const chatId = parseInt(req.params.id);
    const myId = req.session.userId;
    if (!(await isChatMember(chatId, myId))) return res.json({ ok: false });
    const chatRes = await db.execute({ sql: 'SELECT * FROM chats WHERE id = ?', args: [chatId] });
    const membersRes = await db.execute({ sql: `SELECT u.id, u.login, u.display_name, u.avatar, u.avatar_frame, u.name_effect, u.badge FROM users u JOIN chat_members cm ON u.id = cm.user_id WHERE cm.chat_id = ? ORDER BY u.display_name ASC`, args: [chatId] });
    res.json({ ok: true, group: chatRes.rows[0], members: membersRes.rows });
  } catch (e) { res.json({ ok: false }); }
});

app.post('/api/groups/:id/update', async (req, res) => {
  if (!req.session.userId) return res.json({ ok: false });
  try {
    const chatId = parseInt(req.params.id);
    const { name } = req.body;
    const myId = req.session.userId;
    const chatRes = await db.execute({ sql: 'SELECT * FROM chats WHERE id = ?', args: [chatId] });
    if (!chatRes.rows[0] || chatRes.rows[0].creator_id !== myId) return res.json({ ok: false });
    await db.execute({ sql: 'UPDATE chats SET name = ? WHERE id = ?', args: [String(name).trim().slice(0, 50), chatId] });
    const members = await db.execute({ sql: 'SELECT user_id FROM chat_members WHERE chat_id = ?', args: [chatId] });
    members.rows.forEach(m => io.to('user_' + m.user_id).emit('update_chats'));
    res.json({ ok: true });
  } catch (e) { res.json({ ok: false }); }
});

app.post('/api/groups/:id/add-members', async (req, res) => {
  if (!req.session.userId) return res.json({ ok: false });
  try {
    const chatId = parseInt(req.params.id);
    const { member_ids } = req.body;
    const myId = req.session.userId;
    const chatRes = await db.execute({ sql: 'SELECT * FROM chats WHERE id = ?', args: [chatId] });
    if (!chatRes.rows[0] || chatRes.rows[0].creator_id !== myId) return res.json({ ok: false });
    for (const id of member_ids) {
      try { await db.execute({ sql: 'INSERT INTO chat_members (chat_id, user_id) VALUES (?, ?)', args: [chatId, id] }); io.to('user_' + id).emit('update_chats'); } catch(e) { }
    }
    const members = await db.execute({ sql: 'SELECT user_id FROM chat_members WHERE chat_id = ?', args: [chatId] });
    members.rows.forEach(m => io.to('user_' + m.user_id).emit('update_chats'));
    res.json({ ok: true });
  } catch (e) { res.json({ ok: false }); }
});

app.post('/api/groups/:id/remove-member', async (req, res) => {
  if (!req.session.userId) return res.json({ ok: false });
  try {
    const chatId = parseInt(req.params.id);
    const { user_id } = req.body;
    const myId = req.session.userId;
    const chatRes = await db.execute({ sql: 'SELECT * FROM chats WHERE id = ?', args: [chatId] });
    if (!chatRes.rows[0] || chatRes.rows[0].creator_id !== myId) return res.json({ ok: false });
    if (user_id === myId) return res.json({ ok: false });
    await db.execute({ sql: 'DELETE FROM chat_members WHERE chat_id = ? AND user_id = ?', args: [chatId, user_id] });
    const members = await db.execute({ sql: 'SELECT user_id FROM chat_members WHERE chat_id = ?', args: [chatId] });
    members.rows.forEach(m => io.to('user_' + m.user_id).emit('update_chats'));
    io.to('user_' + user_id).emit('update_chats');
    res.json({ ok: true });
  } catch (e) { res.json({ ok: false }); }
});

app.post('/api/chats/:id/clear', async (req, res) => {
  if (!req.session.userId) return res.json({ ok: false });
  try {
    const chatId = parseInt(req.params.id);
    const myId = req.session.userId;
    if (!(await isChatMember(chatId, myId))) return res.json({ ok: false });
    await db.execute({ sql: 'DELETE FROM messages WHERE chat_id = ? AND sender_id = ?', args: [chatId, myId] });
    await db.execute({ sql: 'DELETE FROM read_status WHERE chat_id = ? AND user_id = ?', args: [chatId, myId] });
    io.to('user_' + myId).emit('chat_cleared', { chat_id: chatId });
    io.to('user_' + myId).emit('update_chats');
    res.json({ ok: true });
  } catch (e) { res.json({ ok: false }); }
});

app.post('/api/chats/:id/delete', async (req, res) => {
  if (!req.session.userId) return res.json({ ok: false });
  try {
    const chatId = parseInt(req.params.id);
    const myId = req.session.userId;
    const chatRes = await db.execute({ sql: 'SELECT * FROM chats WHERE id = ?', args: [chatId] });
    if (chatRes.rows.length === 0) return res.json({ ok: false });
    const chat = chatRes.rows[0];
    if (chat.type === 'saved') return res.json({ ok: false });
    if (chat.type === 'group') {
      await db.execute({ sql: 'DELETE FROM chat_members WHERE chat_id = ? AND user_id = ?', args: [chatId, myId] });
      const remaining = await db.execute({ sql: 'SELECT COUNT(*) as c FROM chat_members WHERE chat_id = ?', args: [chatId] });
      if (remaining.rows[0].c === 0) { await db.execute({ sql: 'DELETE FROM messages WHERE chat_id = ?', args: [chatId] }); await db.execute({ sql: 'DELETE FROM chats WHERE id = ?', args: [chatId] }); }
    } else {
      await db.execute({ sql: 'UPDATE chat_members SET hidden = 1 WHERE chat_id = ? AND user_id = ?', args: [chatId, myId] });
    }
    io.to('user_' + myId).emit('update_chats');
    res.json({ ok: true });
  } catch (e) { res.json({ ok: false }); }
});

// ==================== СООБЩЕНИЯ ====================
async function getMsgWithDetails(msgId) {
  const msgRes = await db.execute({ sql: `SELECT m.id, m.chat_id, m.sender_id, m.text, m.file_url, m.file_type, m.file_name, m.reply_to_id, m.created_at, u.display_name as sender_name, u.avatar as sender_avatar, u.avatar_frame, u.name_effect, u.badge as sender_badge FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.id = ?`, args: [msgId] });
  if (msgRes.rows.length === 0) return null;
  const msg = msgRes.rows[0];
  if (msg.reply_to_id) {
    const rRes = await db.execute({ sql: 'SELECT text, file_type, file_name, sender_id, u.display_name as sender_name FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.id = ?', args: [msg.reply_to_id] });
    if (rRes.rows.length > 0) msg.reply_to = rRes.rows[0];
  }
  const reactions = await db.execute({ sql: 'SELECT emoji, COUNT(*) as count, GROUP_CONCAT(user_id) as users FROM reactions WHERE message_id = ? GROUP BY emoji', args: [msgId] });
  msg.reactions = reactions.rows;
  const reads = await db.execute({ sql: `SELECT u.display_name FROM users u JOIN chat_members cm ON u.id = cm.user_id WHERE cm.chat_id = ? AND cm.last_read_msg_id >= ? AND u.id != ?`, args: [msg.chat_id, msgId, msg.sender_id] });
  msg.read_by = reads.rows.map(r => r.display_name);
  return msg;
}

app.get('/api/messages/:chatId', async (req, res) => {
  if (!req.session.userId) return res.json({ ok: false });
  const myId = req.session.userId;
  const chatId = parseInt(req.params.chatId);
  try {
    if (!(await isChatMember(chatId, myId))) return res.json({ ok: false });
    const rawMsgs = await db.execute({ sql: `SELECT m.*, u.display_name as sender_name, u.avatar as sender_avatar, u.avatar_frame, u.name_effect, u.badge as sender_badge FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.chat_id = ? ORDER BY m.id ASC`, args: [chatId] });
    const allReactions = await db.execute({ sql: `SELECT r.message_id, r.emoji, COUNT(*) as count, GROUP_CONCAT(r.user_id) as users FROM reactions r JOIN messages m ON r.message_id = m.id WHERE m.chat_id = ? GROUP BY r.message_id, r.emoji`, args: [chatId] });
    const allReads = await db.execute({ sql: `SELECT cm.last_read_msg_id, u.display_name FROM chat_members cm JOIN users u ON cm.user_id = u.id WHERE cm.chat_id = ? AND cm.user_id != ?`, args: [chatId, myId] });
    const msgs = rawMsgs.rows.map(m => { m.reactions = allReactions.rows.filter(r => r.message_id === m.id); m.read_by = allReads.rows.filter(r => r.last_read_msg_id >= m.id).map(r => r.display_name); return m; });
    const lastId = msgs.length ? msgs[msgs.length - 1].id : 0;
    if (lastId > 0) {
      await db.execute({ sql: `INSERT INTO read_status (chat_id, user_id, last_read_id) VALUES (?, ?, ?) ON CONFLICT(chat_id, user_id) DO UPDATE SET last_read_id = excluded.last_read_id`, args: [chatId, myId, lastId] });
      await db.execute({ sql: 'UPDATE chat_members SET last_read_msg_id = ? WHERE chat_id = ? AND user_id = ?', args: [lastId, chatId, myId] });
      io.to('user_' + myId).emit('chats_read_update', { chat_id: chatId, last_read: lastId });
    }
    res.json({ ok: true, messages: msgs });
  } catch (error) { res.json({ ok: false, messages: [] }); }
});

// ==================== ФАЙЛЫ ====================
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } });

app.post('/api/upload', (req, res) => {
  if (!req.session.userId) return res.json({ ok: false });
  upload.single('file')(req, res, async (err) => {
    if (err) return res.json({ ok: false, error: 'Файл слишком большой' });
    if (!req.file) return res.json({ ok: false, error: 'Файл не загружен' });
    try {
      const fileExt = path.extname(req.file.originalname);
      const fileName = Date.now() + '-' + Math.round(Math.random() * 1E9) + fileExt;
      const { data, error } = await supabase.storage.from('uploads').upload(fileName, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
      if (error) throw error;
      const { data: publicUrlData } = supabase.storage.from('uploads').getPublicUrl(fileName);
      const isImage = req.file.mimetype.startsWith('image/');
      const isAudio = req.file.mimetype.startsWith('audio/');
      const type = isImage ? 'image' : (isAudio ? 'audio' : 'file');
      res.json({ ok: true, file_url: publicUrlData.publicUrl, file_type: type, file_name: req.file.originalname });
    } catch (error) { res.json({ ok: false, error: 'Ошибка сервера' }); }
  });
});

app.post('/api/upload-avatar', (req, res) => {
  if (!req.session.userId) return res.json({ ok: false });
  upload.single('file')(req, res, async (err) => {
    if (err) return res.json({ ok: false, error: 'Файл слишком большой' });
    if (!req.file) return res.json({ ok: false, error: 'Файл не загружен' });
    try {
      const fileExt = path.extname(req.file.originalname) || '.jpg';
      const fileName = Date.now() + '-' + Math.round(Math.random() * 1E9) + fileExt;
      const { data, error } = await supabase.storage.from('uploads').upload(fileName, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
      if (error) throw error;
      const { data: publicUrlData } = supabase.storage.from('uploads').getPublicUrl(fileName);
      res.json({ ok: true, url: publicUrlData.publicUrl });
    } catch (error) { res.json({ ok: false, error: 'Ошибка' }); }
  });
});

app.post('/api/messages/:id/delete', async (req, res) => {
  if (!req.session.userId) return res.json({ ok: false });
  try {
    const msgId = parseInt(req.params.id);
    const myId = req.session.userId;
    const msgRes = await db.execute({ sql: 'SELECT * FROM messages WHERE id = ?', args: [msgId] });
    if (msgRes.rows.length === 0 || msgRes.rows[0].sender_id !== myId) return res.json({ ok: false });
    const msg = msgRes.rows[0];
    if (msg.file_url && msg.file_url.includes('supabase.co')) {
      try { const fileName = msg.file_url.split('/').pop(); await supabase.storage.from('uploads').remove([fileName]); } catch (e) { }
    }
    await db.execute({ sql: 'DELETE FROM reactions WHERE message_id = ?', args: [msgId] });
    await db.execute({ sql: 'DELETE FROM messages WHERE id = ?', args: [msgId] });
    const members = await db.execute({ sql: 'SELECT user_id FROM chat_members WHERE chat_id = ?', args: [msg.chat_id] });
    members.rows.forEach(m => { io.to('user_' + m.user_id).emit('message_deleted', { id: msgId, chat_id: msg.chat_id }); io.to('user_' + m.user_id).emit('update_chats'); });
    res.json({ ok: true });
  } catch (e) { res.json({ ok: false }); }
});

// ==================== СТАТИКА ====================
app.get('/admin', isAdmin, (req, res) => res.sendFile(__dirname + '/public/admin.html'));
app.get('/admin.html', isAdmin, (req, res) => res.sendFile(__dirname + '/public/admin.html'));
app.get('/', (req, res) => { if (!req.session.userId) return res.redirect('/login.html'); res.sendFile(__dirname + '/public/index.html'); });
app.get('/profile', (req, res) => { if (!req.session.userId) return res.redirect('/login.html'); res.sendFile(__dirname + '/public/profile.html'); });
app.get('/user/:id', (req, res) => { if (!req.session.userId) return res.redirect('/login.html'); res.sendFile(__dirname + '/public/user.html'); });
app.use((req, res, next) => { if ((req.path === '/index.html' || req.path === '/profile.html' || req.path.startsWith('/user/')) && !req.session.userId) return res.redirect('/login.html'); next(); });
app.use(express.static('public'));

// ==================== SOCKET.IO ====================
const onlineUsers = new Map();
io.on('connection', async (socket) => {
  const sess = socket.request.session;
  if (!sess || !sess.userId) { socket.disconnect(); return; }
  const myId = sess.userId;
  
  try {
    const uRes = await db.execute({ sql: 'SELECT is_banned FROM users WHERE id = ?', args: [myId] });
    if (uRes.rows[0]?.is_banned) { socket.emit('force_logout'); socket.disconnect(); return; }
  } catch (e) {}
  
  socket.join('user_' + myId);
  const count = (onlineUsers.get(myId) || 0) + 1;
  onlineUsers.set(myId, count);
  if (count === 1) io.emit('user_online', myId);
  socket.emit('online_list', Array.from(onlineUsers.keys()));

  socket.on('typing', async (data) => {
    try {
      if (!(await isChatMember(data.chat_id, myId))) return;
      const members = await db.execute({ sql: 'SELECT user_id FROM chat_members WHERE chat_id = ?', args: [data.chat_id] });
      members.rows.forEach(m => { if (m.user_id !== myId) io.to('user_' + m.user_id).emit('user_typing', { chat_id: data.chat_id, user_id: myId, is_typing: data.is_typing }); });
    } catch(e) { }
  });

  socket.on('send_message', async (data, callback) => {
    let { chat_id, text, other_id, file_url, file_type, file_name, reply_to_id, temp_id } = data;
    if (!text && !file_url) { if (callback) callback({ error: 'Пустое сообщение' }); return; }
    const clean = (text || '').trim().slice(0, 2000);
    try {
      if (!chat_id && other_id === myId) { chat_id = await ensureSavedChat(myId); }
      else if (!chat_id && other_id) {
        const existing = await db.execute({ sql: `SELECT c.id FROM chats c JOIN chat_members cm1 ON c.id = cm1.chat_id AND cm1.user_id = ? JOIN chat_members cm2 ON c.id = cm2.chat_id AND cm2.user_id = ? WHERE c.type = 'private'`, args: [myId, other_id] });
        if (existing.rows.length > 0) { chat_id = existing.rows[0].id; await db.execute({ sql: 'UPDATE chat_members SET hidden = 0 WHERE chat_id = ?', args: [chat_id] }); }
        else {
          const info = await db.execute({ sql: 'INSERT INTO chats (type) VALUES (?)', args: ['private'] });
          chat_id = Number(info.lastInsertRowid);
          await db.execute({ sql: 'INSERT INTO chat_members (chat_id, user_id) VALUES (?, ?)', args: [chat_id, myId] });
          await db.execute({ sql: 'INSERT INTO chat_members (chat_id, user_id) VALUES (?, ?)', args: [chat_id, other_id] });
        }
      }
      if (!chat_id) { if (callback) callback({ error: 'Не указан чат' }); return; }
      if (!(await isChatMember(chat_id, myId))) { if (callback) callback({ error: 'Вы не участник чата' }); return; }
      await db.execute({ sql: 'UPDATE chat_members SET hidden = 0 WHERE chat_id = ?', args: [chat_id] });
      const info = await db.execute({ sql: 'INSERT INTO messages (chat_id, sender_id, text, file_url, file_type, file_name, reply_to_id) VALUES (?, ?, ?, ?, ?, ?, ?)', args: [chat_id, myId, clean, file_url || null, file_type || null, file_name || null, reply_to_id || null] });
      const msgId = Number(info.lastInsertRowid);
      const msg = await getMsgWithDetails(msgId);
      if (callback) callback({ temp_id, msg });
      const members = await db.execute({ sql: 'SELECT user_id FROM chat_members WHERE chat_id = ?', args: [chat_id] });
      members.rows.forEach(m => { io.to('user_' + m.user_id).emit('new_message', msg); io.to('user_' + m.user_id).emit('update_chats'); });
    } catch (error) { if (callback) callback({ error: 'Ошибка сервера' }); }
  });

  socket.on('add_reaction', async (data) => {
    const { message_id, emoji } = data;
    try {
      const msgInfo = await db.execute({ sql: 'SELECT chat_id FROM messages WHERE id = ?', args: [message_id] });
      if (msgInfo.rows.length === 0) return;
      const chatId = msgInfo.rows[0].chat_id;
      if (!(await isChatMember(chatId, myId))) return;
      const existing = await db.execute({ sql: 'SELECT * FROM reactions WHERE message_id = ? AND user_id = ?', args: [message_id, myId] });
      if (existing.rows.length > 0) {
        if (existing.rows[0].emoji === emoji) await db.execute({ sql: 'DELETE FROM reactions WHERE message_id = ? AND user_id = ?', args: [message_id, myId] });
        else await db.execute({ sql: 'UPDATE reactions SET emoji = ? WHERE message_id = ? AND user_id = ?', args: [emoji, message_id, myId] });
      } else { await db.execute({ sql: 'INSERT INTO reactions (message_id, user_id, emoji) VALUES (?, ?, ?)', args: [message_id, myId, emoji] }); }
      const updatedMsg = await getMsgWithDetails(message_id);
      const members = await db.execute({ sql: 'SELECT user_id FROM chat_members WHERE chat_id = ?', args: [chatId] });
      members.rows.forEach(m => { io.to('user_' + m.user_id).emit('message_updated', updatedMsg); });
    } catch (e) { }
  });

  socket.on('mark_read', async (chatId) => {
    try {
      if (!(await isChatMember(chatId, myId))) return;
      const lastMsg = await db.execute({ sql: 'SELECT id FROM messages WHERE chat_id = ? ORDER BY id DESC LIMIT 1', args: [chatId] });
      if (lastMsg.rows.length === 0) return;
      const lastId = lastMsg.rows[0].id;
      await db.execute({ sql: `INSERT INTO read_status (chat_id, user_id, last_read_id) VALUES (?, ?, ?) ON CONFLICT(chat_id, user_id) DO UPDATE SET last_read_id = excluded.last_read_id`, args: [chatId, myId, lastId] });
      await db.execute({ sql: 'UPDATE chat_members SET last_read_msg_id = ? WHERE chat_id = ? AND user_id = ?', args: [lastId, chatId, myId] });
      io.to('user_' + myId).emit('update_chats');
      const members = await db.execute({ sql: 'SELECT user_id FROM chat_members WHERE chat_id = ?', args: [chatId] });
      members.rows.forEach(m => { io.to('user_' + m.user_id).emit('chats_read_update', { chat_id: chatId, last_read: lastId, reader_id: myId }); });
    } catch (e) { }
  });

  socket.on('disconnect', async () => {
    try {
      const c = (onlineUsers.get(myId) || 1) - 1;
      if (c <= 0) { onlineUsers.delete(myId); await db.execute({ sql: 'UPDATE users SET last_seen = ? WHERE id = ?', args: [new Date().toISOString(), myId] }); io.emit('user_offline', myId); }
      else { onlineUsers.set(myId, c); }
    } catch (e) { }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { LOG('SERVER', `🚀 Miksegram запущен на порту ${PORT}`); });
process.on('SIGTERM', () => { server.close(() => process.exit(0)); });
process.on('SIGINT', () => { server.close(() => process.exit(0)); });