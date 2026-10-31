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

// --- ЛОГИРОВАНИЕ ---
const LOG = (tag, ...args) => console.log(`[${new Date().toISOString()}] [${tag}]`, ...args);
const ERR = (tag, ...args) => console.error(`[${new Date().toISOString()}] [${tag}]`, ...args);

// --- ГЛОБАЛЬНАЯ ЗАЩИТА ОТ ПАДЕНИЙ ---
process.on('uncaughtException', (err) => {
    ERR('UNCAUGHT', err.message, err.stack);
});
process.on('unhandledRejection', (reason, promise) => {
    ERR('UNHANDLED', reason);
});

// --- ПОДКЛЮЧЕНИЕ К TURSO ---
const db = createClient({
  url: 'libsql://miksegram-miksek.aws-ap-northeast-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTMzODMzODUsImlkIjoiMDFhMThkZGQtYjcwMS03YTg5LWIxMGEtMjk1MTkxNWVmY2Q2Iiwia2lkIjoiMDY0M3BHaVkteXR5X0t2OC1HbVY5Y2Nlb0RyTVYyVUlnZVRtU2Y5MXQtcyIsInJpZCI6IjgzM2JlNTQyLWViZjEtNGVhZC05MTQ3LTFkY2VhNDYzYmZjNCJ9.GSH-xuW9awXLGLOjssUuqDoXuoouiydQgBL7oc2BkEwRJVpABbEO-2jHW9JFLHDJ5Of_nXGtBApz7uY19k7BDQ'
});

const supabase = createSupabase('https://tvmypcjwrlwiorpmugpb.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2bXlwY2p3cmx3aW9ycG11Z3BiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MzQwODQwOSwiZXhwIjoyMTA4OTg0NDA5fQ.1ChmymKXpkweU7PImFwAfFYY4ufSx525Fotjn4FRtSw');

// --- ИНИЦИАЛИЗАЦИЯ БД С ПОВТОРАМИ ---
async function initDb(attempt = 1) {
  try {
    LOG('DB', `Инициализация БД (попытка ${attempt})...`);
    
    await db.execute(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, login TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL, password TEXT NOT NULL, bio TEXT DEFAULT '', avatar TEXT DEFAULT 'grad-emerald', banner TEXT DEFAULT 'ban-aurora', avatar_frame TEXT DEFAULT 'none', name_effect TEXT DEFAULT 'none', last_seen TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')), created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')));`);
    await db.execute(`CREATE TABLE IF NOT EXISTS chats (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, name TEXT, avatar TEXT DEFAULT 'grad-aurora', creator_id INTEGER, created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')));`);
    await db.execute(`CREATE TABLE IF NOT EXISTS chat_members (chat_id INTEGER NOT NULL, user_id INTEGER NOT NULL, hidden INTEGER DEFAULT 0, last_read_msg_id INTEGER DEFAULT 0, PRIMARY KEY (chat_id, user_id));`);
    await db.execute(`CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, chat_id INTEGER NOT NULL, sender_id INTEGER NOT NULL, text TEXT NOT NULL, file_url TEXT, file_type TEXT, file_name TEXT, reply_to_id INTEGER, created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')));`);
    await db.execute(`CREATE TABLE IF NOT EXISTS read_status (chat_id INTEGER NOT NULL, user_id INTEGER NOT NULL, last_read_id INTEGER DEFAULT 0, PRIMARY KEY (chat_id, user_id));`);
    await db.execute(`CREATE TABLE IF NOT EXISTS reactions (message_id INTEGER NOT NULL, user_id INTEGER NOT NULL, emoji TEXT NOT NULL, PRIMARY KEY (message_id, user_id));`);
    
    LOG('DB', '✅ База данных готова!');
    
    // Проверка что реально работает
    const test = await db.execute('SELECT COUNT(*) as cnt FROM users');
    LOG('DB', `Пользователей в базе: ${test.rows[0].cnt}`);
  } catch (err) {
    ERR('DB', `❌ Ошибка инициализации (попытка ${attempt}):`, err.message);
    if (attempt < 3) {
      LOG('DB', `Повтор через 3 секунды...`);
      setTimeout(() => initDb(attempt + 1), 3000);
    } else {
      ERR('DB', '❌ Все попытки исчерпаны. Проверь токен Turso и подключение к интернету.');
    }
  }
}
initDb();

// --- MIDDLEWARE ---
app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: true, limit: '8mb' }));

const sessionMiddleware = session({
  secret: 'miksegram-secret-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 30 }
});
app.use(sessionMiddleware);
io.engine.use(sessionMiddleware);

// ==================== АВТОРИЗАЦИЯ ====================
app.post('/api/register', async (req, res) => {
  try {
    let { login, display_name, password } = req.body;
    if (!login || !display_name || !password) return res.json({ ok: false, error: 'Заполни все поля' });
    login = login.trim().toLowerCase().replace(/^@/, '');
    display_name = display_name.trim();
    
    if (!/^[a-z0-9_]{3,32}$/.test(login)) return res.json({ ok: false, error: 'Логин: 3-32 символа, только a-z, 0-9, _' });
    if (display_name.length < 1 || display_name.length > 40) return res.json({ ok: false, error: 'Имя: от 1 до 40 символов' });
    if (password.length < 4) return res.json({ ok: false, error: 'Пароль: минимум 4 символа' });
    
    const existing = await db.execute({ sql: 'SELECT id FROM users WHERE login = ?', args: [login] });
    if (existing.rows.length > 0) return res.json({ ok: false, error: 'Этот логин уже занят' });
    
    const hash = bcrypt.hashSync(password, 10);
    const info = await db.execute({ sql: 'INSERT INTO users (login, display_name, password) VALUES (?, ?, ?)', args: [login, display_name, hash] });
    
    req.session.userId = Number(info.lastInsertRowid);
    LOG('API', `Новый пользователь: @${login} (id=${req.session.userId})`);
    res.json({ ok: true });
  } catch (e) { 
    ERR('API', 'Ошибка регистрации:', e.message); 
    res.json({ ok: false, error: 'Ошибка сервера при регистрации' }); 
  }
});

app.post('/api/login', async (req, res) => {
  try {
    let { login, password } = req.body;
    login = (login || '').trim().toLowerCase().replace(/^@/, '');
    if (!login || !password) return res.json({ ok: false, error: 'Введите логин и пароль' });
    
    const userRes = await db.execute({ sql: 'SELECT * FROM users WHERE login = ?', args: [login] });
    const user = userRes.rows[0];
    
    if (!user) return res.json({ ok: false, error: 'Пользователь с таким логином не найден' });
    if (!bcrypt.compareSync(password, user.password)) return res.json({ ok: false, error: 'Неверный пароль' });
    
    req.session.userId = user.id;
    await db.execute({ sql: 'UPDATE users SET last_seen = ? WHERE id = ?', args: [new Date().toISOString(), user.id] });
    
    LOG('API', `Логин: @${user.login} (id=${user.id})`);
    res.json({ ok: true, user: { id: user.id, login: user.login, display_name: user.display_name, avatar: user.avatar } });
  } catch (e) { 
    ERR('API', 'Ошибка входа:', e.message); 
    res.json({ ok: false, error: 'Ошибка сервера при входе' }); 
  }
});

app.post('/api/logout', async (req, res) => {
  try {
    if (req.session.userId) await db.execute({ sql: 'UPDATE users SET last_seen = ? WHERE id = ?', args: [new Date().toISOString(), req.session.userId] });
    req.session.destroy(() => res.json({ ok: true }));
  } catch (e) {
    ERR('API', 'Ошибка выхода:', e.message);
    req.session.destroy(() => res.json({ ok: true }));
  }
});

app.get('/api/me', async (req, res) => {
  if (!req.session.userId) return res.json({ ok: false });
  try {
    const uRes = await db.execute({ sql: 'SELECT id, login, display_name, bio, avatar, banner, avatar_frame, name_effect FROM users WHERE id = ?', args: [req.session.userId] });
    if (uRes.rows.length === 0) return res.json({ ok: false });
    res.json({ ok: true, ...uRes.rows[0] });
  } catch (e) {
    ERR('API', 'Ошибка /api/me:', e.message);
    res.json({ ok: false });
  }
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
  } catch (e) {
    ERR('API', 'Ошибка смены пароля:', e.message);
    res.json({ ok: false, error: 'Ошибка сервера' });
  }
});

app.post('/api/delete-account', async (req, res) => {
  if (!req.session.userId) return res.json({ ok: false });
  const { password } = req.body;
  if (!password) return res.json({ ok: false, error: 'Введите пароль для подтверждения' });

  try {
    const userRes = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [req.session.userId] });
    const user = userRes.rows[0];
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.json({ ok: false, error: 'Неверный пароль' });
    }

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
    LOG('API', `Удалён аккаунт id=${myId}`);
    res.json({ ok: true });
  } catch (e) {
    ERR('API', 'Ошибка удаления аккаунта:', e.message);
    res.json({ ok: false, error: 'Ошибка сервера при удалении' });
  }
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
    
    const uRes = await db.execute({ sql: 'SELECT id, login, display_name, bio, avatar, banner, avatar_frame, name_effect FROM users WHERE id = ?', args: [req.session.userId] });
    res.json({ ok: true, user: uRes.rows[0] });
  } catch (e) {
    ERR('API', 'Ошибка обновления профиля:', e.message);
    res.json({ ok: false, error: 'Ошибка сервера' });
  }
});

app.get('/api/all-users', async (req, res) => {
  if (!req.session.userId) return res.json({ ok: false });
  try {
    const uRes = await db.execute({ sql: 'SELECT id, login, display_name, avatar, avatar_frame, name_effect FROM users WHERE id != ? ORDER BY display_name ASC', args: [req.session.userId] });
    res.json({ ok: true, users: uRes.rows });
  } catch (e) {
    ERR('API', 'Ошибка /api/all-users:', e.message);
    res.json({ ok: false, users: [] });
  }
});

// ==================== ЧАТЫ ====================
app.get('/api/chats', async (req, res) => {
  if (!req.session.userId) return res.json({ ok: false });
  const myId = req.session.userId;

  try {
    const chatsRes = await db.execute({
      sql: `
        SELECT c.id, c.type, c.name, c.avatar, c.creator_id,
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
        ORDER BY last_time DESC, c.id DESC
      `,
      args: [myId, myId, myId]
    });

    const result = [];
    for (const c of chatsRes.rows) {
      if (c.type === 'private') {
        const otherRes = await db.execute({
          sql: `SELECT u.id, u.display_name, u.login, u.avatar, u.avatar_frame, u.name_effect, u.last_seen, cm.last_read_msg_id FROM users u JOIN chat_members cm ON u.id = cm.user_id WHERE cm.chat_id = ? AND u.id != ?`,
          args: [c.id, myId]
        });
        if (otherRes.rows.length > 0) {
          const other = otherRes.rows[0];
          result.push({ 
            ...c, name: other.display_name, avatar: other.avatar, avatar_frame: other.avatar_frame, name_effect: other.name_effect, 
            other_id: other.id, login: other.login, last_seen: other.last_seen, other_last_read: other.last_read_msg_id 
          });
          continue;
        }
      }
      result.push(c);
    }
    LOG('API', `/api/chats → пользователю ${myId} отдано ${result.length} чатов`);
    res.json({ ok: true, chats: result });
  } catch (error) {
    ERR('API', 'Ошибка получения чатов:', error.message);
    res.json({ ok: false, chats: [] });
  }
});

app.get('/api/search-user', async (req, res) => {
  if (!req.session.userId) return res.json({ ok: false });
  try {
    const q = (req.query.q || '').trim().toLowerCase().replace(/^@/, '');
    if (!q) return res.json({ ok: true, users: [] });
    const uRes = await db.execute({ sql: 'SELECT id, login, display_name, avatar, avatar_frame, name_effect FROM users WHERE id != ? AND (login LIKE ? OR display_name LIKE ?) LIMIT 10', args: [req.session.userId, `%${q}%`, `%${q}%`] });
    res.json({ ok: true, users: uRes.rows });
  } catch (e) {
    ERR('API', 'Ошибка поиска:', e.message);
    res.json({ ok: false, users: [] });
  }
});

app.get('/api/user/:id', async (req, res) => {
  if (!req.session.userId) return res.json({ ok: false });
  try {
    const uRes = await db.execute({ sql: 'SELECT id, login, display_name, bio, avatar, banner, avatar_frame, name_effect, last_seen FROM users WHERE id = ?', args: [req.params.id] });
    if (uRes.rows.length === 0) return res.json({ ok: false });
    res.json({ ok: true, user: uRes.rows[0] });
  } catch (e) {
    ERR('API', 'Ошибка /api/user/:id:', e.message);
    res.json({ ok: false });
  }
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
    LOG('API', `Создана группа "${name}" (id=${chatId}) создателем ${myId}`);
    res.json({ ok: true, chat_id: chatId });
  } catch (e) {
    ERR('API', 'Ошибка создания группы:', e.message);
    res.json({ ok: false, error: 'Ошибка сервера' });
  }
});

app.get('/api/groups/:id', async (req, res) => {
  if (!req.session.userId) return res.json({ ok: false });
  try {
    const chatId = parseInt(req.params.id);
    const myId = req.session.userId;

    const member = await db.execute({ sql: 'SELECT * FROM chat_members WHERE chat_id = ? AND user_id = ?', args: [chatId, myId] });
    if (member.rows.length === 0) return res.json({ ok: false, error: 'Вы не в этой группе' });

    const chatRes = await db.execute({ sql: 'SELECT * FROM chats WHERE id = ?', args: [chatId] });
    if (chatRes.rows.length === 0) return res.json({ ok: false });
    const chat = chatRes.rows[0];

    const membersRes = await db.execute({
      sql: `SELECT u.id, u.login, u.display_name, u.avatar, u.avatar_frame, u.name_effect 
            FROM users u JOIN chat_members cm ON u.id = cm.user_id WHERE cm.chat_id = ? ORDER BY u.display_name ASC`,
      args: [chatId]
    });

    res.json({ ok: true, group: chat, members: membersRes.rows });
  } catch (e) {
    ERR('API', 'Ошибка /api/groups/:id:', e.message);
    res.json({ ok: false });
  }
});

app.post('/api/groups/:id/update', async (req, res) => {
  if (!req.session.userId) return res.json({ ok: false });
  try {
    const chatId = parseInt(req.params.id);
    const { name } = req.body;
    const myId = req.session.userId;

    const chatRes = await db.execute({ sql: 'SELECT * FROM chats WHERE id = ?', args: [chatId] });
    const chat = chatRes.rows[0];
    if (!chat || chat.creator_id !== myId) return res.json({ ok: false, error: 'Только создатель может менять группу' });

    await db.execute({ sql: 'UPDATE chats SET name = ? WHERE id = ?', args: [String(name).trim().slice(0, 50), chatId] });
    
    const members = await db.execute({ sql: 'SELECT user_id FROM chat_members WHERE chat_id = ?', args: [chatId] });
    members.rows.forEach(m => io.to('user_' + m.user_id).emit('update_chats'));

    res.json({ ok: true });
  } catch (e) {
    ERR('API', 'Ошибка обновления группы:', e.message);
    res.json({ ok: false, error: 'Ошибка сервера' });
  }
});

app.post('/api/groups/:id/add-members', async (req, res) => {
  if (!req.session.userId) return res.json({ ok: false });
  try {
    const chatId = parseInt(req.params.id);
    const { member_ids } = req.body;
    const myId = req.session.userId;

    const chatRes = await db.execute({ sql: 'SELECT * FROM chats WHERE id = ?', args: [chatId] });
    const chat = chatRes.rows[0];
    if (!chat || chat.creator_id !== myId) return res.json({ ok: false, error: 'Только создатель может добавлять участников' });

    for (const id of member_ids) {
      try {
        await db.execute({ sql: 'INSERT INTO chat_members (chat_id, user_id) VALUES (?, ?)', args: [chatId, id] });
        io.to('user_' + id).emit('update_chats');
      } catch(e) { }
    }
    
    const members = await db.execute({ sql: 'SELECT user_id FROM chat_members WHERE chat_id = ?', args: [chatId] });
    members.rows.forEach(m => io.to('user_' + m.user_id).emit('update_chats'));

    res.json({ ok: true });
  } catch (e) {
    ERR('API', 'Ошибка добавления участников:', e.message);
    res.json({ ok: false, error: 'Ошибка сервера' });
  }
});

app.post('/api/groups/:id/remove-member', async (req, res) => {
  if (!req.session.userId) return res.json({ ok: false });
  try {
    const chatId = parseInt(req.params.id);
    const { user_id } = req.body;
    const myId = req.session.userId;

    const chatRes = await db.execute({ sql: 'SELECT * FROM chats WHERE id = ?', args: [chatId] });
    const chat = chatRes.rows[0];
    if (!chat || chat.creator_id !== myId) return res.json({ ok: false, error: 'Только создатель может исключать участников' });
    
    if (user_id === myId) return res.json({ ok: false, error: 'Создатель не может исключить сам себя' });

    await db.execute({ sql: 'DELETE FROM chat_members WHERE chat_id = ? AND user_id = ?', args: [chatId, user_id] });
    
    const members = await db.execute({ sql: 'SELECT user_id FROM chat_members WHERE chat_id = ?', args: [chatId] });
    members.rows.forEach(m => io.to('user_' + m.user_id).emit('update_chats'));
    io.to('user_' + user_id).emit('update_chats');

    res.json({ ok: true });
  } catch (e) {
    ERR('API', 'Ошибка исключения:', e.message);
    res.json({ ok: false, error: 'Ошибка сервера' });
  }
});

app.post('/api/chats/:id/clear', async (req, res) => {
  if (!req.session.userId) return res.json({ ok: false });
  try {
    const chatId = parseInt(req.params.id);
    const myId = req.session.userId;
    
    await db.execute({ sql: 'DELETE FROM messages WHERE chat_id = ? AND sender_id = ?', args: [chatId, myId] });
    await db.execute({ sql: 'DELETE FROM read_status WHERE chat_id = ? AND user_id = ?', args: [chatId, myId] });
    
    io.to('user_' + myId).emit('chat_cleared', { chat_id: chatId });
    io.to('user_' + myId).emit('update_chats');
    res.json({ ok: true });
  } catch (e) {
    ERR('API', 'Ошибка очистки:', e.message);
    res.json({ ok: false, error: 'Ошибка сервера' });
  }
});

app.post('/api/chats/:id/delete', async (req, res) => {
  if (!req.session.userId) return res.json({ ok: false });
  try {
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
  } catch (e) {
    ERR('API', 'Ошибка удаления чата:', e.message);
    res.json({ ok: false, error: 'Ошибка сервера' });
  }
});

// ==================== СООБЩЕНИЯ ====================
async function getMsgWithDetails(msgId) {
  const msgRes = await db.execute({
    sql: `SELECT m.id, m.chat_id, m.sender_id, m.text, m.file_url, m.file_type, m.file_name, m.reply_to_id, m.created_at, u.display_name as sender_name, u.avatar as sender_avatar, u.avatar_frame, u.name_effect FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.id = ?`,
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
  msg.chat_type = chatRes.rows[0]?.type;

  const reads = await db.execute({ 
    sql: `SELECT u.display_name FROM users u 
          JOIN chat_members cm ON u.id = cm.user_id 
          WHERE cm.chat_id = ? AND cm.last_read_msg_id >= ? AND u.id != ?`, 
    args: [msg.chat_id, msgId, msg.sender_id] 
  });
  msg.read_by = reads.rows.map(r => r.display_name);
  
  return msg;
}

app.get('/api/messages/:chatId', async (req, res) => {
  if (!req.session.userId) return res.json({ ok: false });
  const myId = req.session.userId;
  const chatId = parseInt(req.params.chatId);
  
  try {
    const member = await db.execute({ sql: 'SELECT * FROM chat_members WHERE chat_id = ? AND user_id = ?', args: [chatId, myId] });
    if (member.rows.length === 0) return res.json({ ok: false });

    const rawMsgs = await db.execute({
      sql: `SELECT m.*, u.display_name as sender_name, u.avatar as sender_avatar, u.avatar_frame, u.name_effect 
            FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.chat_id = ? ORDER BY m.id ASC`,
      args: [chatId]
    });

    const allReactions = await db.execute({
      sql: `SELECT r.message_id, r.emoji, COUNT(*) as count, GROUP_CONCAT(r.user_id) as users 
            FROM reactions r JOIN messages m ON r.message_id = m.id 
            WHERE m.chat_id = ? GROUP BY r.message_id, r.emoji`,
      args: [chatId]
    });

    const allReads = await db.execute({
      sql: `SELECT cm.last_read_msg_id, u.display_name FROM chat_members cm 
            JOIN users u ON cm.user_id = u.id
            WHERE cm.chat_id = ? AND cm.user_id != ?`,
      args: [chatId, myId]
    });

    const msgs = rawMsgs.rows.map(m => {
      m.reactions = allReactions.rows.filter(r => r.message_id === m.id);
      m.read_by = allReads.rows.filter(r => r.last_read_msg_id >= m.id).map(r => r.display_name);
      return m;
    });

    const lastId = msgs.length ? msgs[msgs.length - 1].id : 0;
    if (lastId > 0) {
      await db.execute({ sql: `INSERT INTO read_status (chat_id, user_id, last_read_id) VALUES (?, ?, ?) ON CONFLICT(chat_id, user_id) DO UPDATE SET last_read_id = excluded.last_read_id`, args: [chatId, myId, lastId] });
      await db.execute({ sql: 'UPDATE chat_members SET last_read_msg_id = ? WHERE chat_id = ? AND user_id = ?', args: [lastId, chatId, myId] });
      io.to('user_' + myId).emit('chats_read_update', { chat_id: chatId, last_read: lastId });
    }

    res.json({ ok: true, messages: msgs });
  } catch (error) {
    ERR('API', 'Ошибка загрузки истории:', error.message);
    res.json({ ok: false, messages: [] });
  }
});

// ==================== ФАЙЛЫ ====================
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

app.post('/api/upload', (req, res) => {
  if (!req.session.userId) return res.json({ ok: false });
  upload.single('file')(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.json({ ok: false, error: 'Файл больше 5 МБ' });
      return res.json({ ok: false, error: 'Ошибка загрузки' });
    }
    if (!req.file) return res.json({ ok: false, error: 'Файл не загружен' });

    try {
      const fileExt = path.extname(req.file.originalname);
      const fileName = Date.now() + '-' + Math.round(Math.random() * 1E9) + fileExt;
      const { data, error } = await supabase.storage.from('uploads').upload(fileName, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
      if (error) throw error;
      const { data: publicUrlData } = supabase.storage.from('uploads').getPublicUrl(fileName);
      const fileUrl = publicUrlData.publicUrl;
      const isImage = req.file.mimetype.startsWith('image/');
      const isAudio = req.file.mimetype.startsWith('audio/');
      const type = isImage ? 'image' : (isAudio ? 'audio' : 'file');
      res.json({ ok: true, file_url: fileUrl, file_type: type, file_name: req.file.originalname });
    } catch (error) {
      ERR('UPLOAD', 'Ошибка загрузки файла:', error.message);
      res.json({ ok: false, error: 'Ошибка сервера при загрузке файла' });
    }
  });
});

app.post('/api/upload-avatar', (req, res) => {
  if (!req.session.userId) return res.json({ ok: false });
  upload.single('file')(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.json({ ok: false, error: 'Файл больше 5 МБ' });
      return res.json({ ok: false, error: 'Ошибка загрузки' });
    }
    if (!req.file) return res.json({ ok: false, error: 'Файл не загружен' });

    try {
      const fileExt = path.extname(req.file.originalname) || '.jpg';
      const fileName = Date.now() + '-' + Math.round(Math.random() * 1E9) + fileExt;
      const { data, error } = await supabase.storage.from('uploads').upload(fileName, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
      if (error) throw error;
      const { data: publicUrlData } = supabase.storage.from('uploads').getPublicUrl(fileName);
      res.json({ ok: true, url: publicUrlData.publicUrl });
    } catch (error) {
      ERR('UPLOAD', 'Ошибка загрузки аватара:', error.message);
      res.json({ ok: false, error: 'Ошибка сервера' });
    }
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
      try {
        const fileName = msg.file_url.split('/').pop();
        await supabase.storage.from('uploads').remove([fileName]);
      } catch (e) { }
    }
    
    await db.execute({ sql: 'DELETE FROM reactions WHERE message_id = ?', args: [msgId] });
    await db.execute({ sql: 'DELETE FROM messages WHERE id = ?', args: [msgId] });
    
    const members = await db.execute({ sql: 'SELECT user_id FROM chat_members WHERE chat_id = ?', args: [msg.chat_id] });
    members.rows.forEach(m => {
      io.to('user_' + m.user_id).emit('message_deleted', { id: msgId, chat_id: msg.chat_id });
      io.to('user_' + m.user_id).emit('update_chats');
    });
    res.json({ ok: true });
  } catch (e) {
    ERR('API', 'Ошибка удаления сообщения:', e.message);
    res.json({ ok: false, error: 'Ошибка сервера' });
  }
});

// ==================== СТАТИКА ====================
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

// ==================== SOCKET.IO ====================
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
  LOG('SOCKET', `Подключён пользователь ${myId} (соединений: ${count})`);

  socket.on('typing', async (data) => {
    try {
      const members = await db.execute({ sql: 'SELECT user_id FROM chat_members WHERE chat_id = ?', args: [data.chat_id] });
      members.rows.forEach(m => { if (m.user_id !== myId) io.to('user_' + m.user_id).emit('user_typing', { chat_id: data.chat_id, user_id: myId, is_typing: data.is_typing }); });
    } catch(e) { ERR('SOCKET', 'typing:', e.message); }
  });

  socket.on('send_message', async (data, callback) => {
    let { chat_id, text, other_id, file_url, file_type, file_name, reply_to_id, temp_id } = data;
    if (!text && !file_url) {
      if (callback) callback({ error: 'Пустое сообщение' });
      return;
    }
    const clean = (text || '').trim().slice(0, 2000);
    
    try {
      // Создание нового чата, если его нет
      if (!chat_id && other_id) {
        LOG('SOCKET', `Пользователь ${myId} создаёт новый чат с ${other_id}`);
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
      if (!chat_id) {
        if (callback) callback({ error: 'Не указан чат' });
        return;
      }
      
      // Показать чат у всех участников
      await db.execute({ sql: 'UPDATE chat_members SET hidden = 0 WHERE chat_id = ?', args: [chat_id] });
      
      // Вставка сообщения
      const info = await db.execute({ sql: 'INSERT INTO messages (chat_id, sender_id, text, file_url, file_type, file_name, reply_to_id) VALUES (?, ?, ?, ?, ?, ?, ?)', args: [chat_id, myId, clean, file_url || null, file_type || null, file_name || null, reply_to_id || null] });
      const msgId = Number(info.lastInsertRowid);
      LOG('SOCKET', `Сообщение ${msgId} сохранено в чат ${chat_id}`);
      
      const msg = await getMsgWithDetails(msgId);
      
      // Отвечаем клиенту СРАЗУ, чтобы убрать "часики"
      if (callback) callback({ temp_id, msg });

      // Рассылка всем участникам
      const members = await db.execute({ sql: 'SELECT user_id FROM chat_members WHERE chat_id = ?', args: [chat_id] });
      members.rows.forEach(m => {
        io.to('user_' + m.user_id).emit('new_message', msg);
        io.to('user_' + m.user_id).emit('update_chats');
      });
    } catch (error) {
      ERR('SOCKET', 'Ошибка отправки сообщения:', error.message, error.stack);
      if (callback) callback({ error: 'Ошибка сервера: ' + error.message });
    }
  });

  socket.on('add_reaction', async (data) => {
    const { message_id, emoji } = data;
    try {
      const existing = await db.execute({ sql: 'SELECT * FROM reactions WHERE message_id = ? AND user_id = ?', args: [message_id, myId] });
      if (existing.rows.length > 0) {
        if (existing.rows[0].emoji === emoji) await db.execute({ sql: 'DELETE FROM reactions WHERE message_id = ? AND user_id = ?', args: [message_id, myId] });
        else await db.execute({ sql: 'UPDATE reactions SET emoji = ? WHERE message_id = ? AND user_id = ?', args: [emoji, message_id, myId] });
      } else {
        await db.execute({ sql: 'INSERT INTO reactions (message_id, user_id, emoji) VALUES (?, ?, ?)', args: [message_id, myId, emoji] });
      }
      const msg = await db.execute({ sql: 'SELECT chat_id FROM messages WHERE id = ?', args: [message_id] });
      if (msg.rows.length === 0) return;
      
      const updatedMsg = await getMsgWithDetails(message_id);
      const members = await db.execute({ sql: 'SELECT user_id FROM chat_members WHERE chat_id = ?', args: [msg.rows[0].chat_id] });
      members.rows.forEach(m => { io.to('user_' + m.user_id).emit('message_updated', updatedMsg); });
    } catch (e) { 
      ERR('SOCKET', 'add_reaction:', e.message); 
    }
  });

  socket.on('mark_read', async (chatId) => {
    try {
      const lastMsg = await db.execute({ sql: 'SELECT id FROM messages WHERE chat_id = ? ORDER BY id DESC LIMIT 1', args: [chatId] });
      if (lastMsg.rows.length === 0) return;
      const lastId = lastMsg.rows[0].id;

      await db.execute({ sql: `INSERT INTO read_status (chat_id, user_id, last_read_id) VALUES (?, ?, ?) ON CONFLICT(chat_id, user_id) DO UPDATE SET last_read_id = excluded.last_read_id`, args: [chatId, myId, lastId] });
      await db.execute({ sql: 'UPDATE chat_members SET last_read_msg_id = ? WHERE chat_id = ? AND user_id = ?', args: [lastId, chatId, myId] });

      io.to('user_' + myId).emit('update_chats');
      
      const members = await db.execute({ sql: 'SELECT user_id FROM chat_members WHERE chat_id = ?', args: [chatId] });
      members.rows.forEach(m => {
        io.to('user_' + m.user_id).emit('chats_read_update', { chat_id: chatId, last_read: lastId, reader_id: myId });
      });
    } catch (e) { 
      ERR('SOCKET', 'mark_read:', e.message); 
    }
  });

  socket.on('disconnect', async () => {
    try {
      const c = (onlineUsers.get(myId) || 1) - 1;
      if (c <= 0) { 
        onlineUsers.delete(myId); 
        await db.execute({ sql: 'UPDATE users SET last_seen = ? WHERE id = ?', args: [new Date().toISOString(), myId] });
        io.emit('user_offline', myId); 
      } else { 
        onlineUsers.set(myId, c); 
      }
      LOG('SOCKET', `Отключён пользователь ${myId}`);
    } catch (e) {
      ERR('SOCKET', 'disconnect:', e.message);
    }
  });
});

// ==================== ЗАПУСК ====================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { 
  LOG('SERVER', `🚀 Miksegram запущен на порту ${PORT}`);
});

// Корректное завершение
process.on('SIGTERM', () => {
  LOG('SERVER', 'Получен SIGTERM, завершаемся...');
  server.close(() => process.exit(0));
});
process.on('SIGINT', () => {
  LOG('SERVER', 'Получен SIGINT, завершаемся...');
  server.close(() => process.exit(0));
});