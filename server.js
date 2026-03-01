const express = require('express');
const bcrypt = require('bcrypt');
const { evaluate } = require('mathjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// --- 1. ПІДГОТОВКА СЕРЕДОВИЩА ТА БД ---
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

const dbPath = path.join(dataDir, 'kalka.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error("❌ Помилка підключення до БД:", err.message);
    else console.log("✅ База даних підключена: " + dbPath);
});

// Ініціалізація таблиць з перевірками
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
                                                 id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                 username TEXT UNIQUE,
                                                 password_hash TEXT,
                                                 phone TEXT UNIQUE,
                                                 status INTEGER DEFAULT 1,
                                                 ops INTEGER DEFAULT 0,
                                                 registered TEXT
            )`, (err) => { if (err) console.error("Помилка ініціалізації users:", err.message); });

    db.run(`CREATE TABLE IF NOT EXISTS history (
                                                   id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                   user_id INTEGER,
                                                   expression TEXT,
                                                   result TEXT,
                                                   created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                                   FOREIGN KEY(user_id) REFERENCES users(id)
        )`, (err) => { if (err) console.error("Помилка ініціалізації history:", err.message); });
});

// --- 2. ДОПОМІЖНІ ВАЛІДАТОРИ ---
const isValidPhone = (phone) => /^(?:\+38|38)?0\d{9}$/.test(phone);

// --- 3. РЕЄСТРАЦІЯ (З ПОВНИМИ ПЕРЕВІРКАМИ) ---
app.post('/register', async (req, res) => {
    const { username, password, phone } = req.body;
    console.log(`[AUTH] Реєстрація: ${username} (${phone})`);

    // Перевірка на пусті поля
    if (!username || !password || !phone) {
        return res.status(400).json({ error: "Усі поля (логін, пароль, телефон) обов'язкові" });
    }

    // Перевірка формату телефону
    if (!isValidPhone(phone)) {
        return res.status(400).json({ error: "Невірний формат українського номера (+380...)" });
    }

    try {
        const hash = await bcrypt.hash(password, 10);
        const date = new Date().toLocaleString('uk-UA');

        const sql = "INSERT INTO users (username, password_hash, phone, registered) VALUES (?, ?, ?, ?)";
        db.run(sql, [username, hash, phone, date], function(err) {
            if (err) {
                console.error("[SQL Error]:", err.message);
                if (err.message.includes("users.username")) return res.status(400).json({ error: "Цей логін уже зайнятий" });
                if (err.message.includes("users.phone")) return res.status(400).json({ error: "Цей телефон уже зареєстрований" });
                return res.status(400).json({ error: "Помилка бази даних при реєстрації" });
            }

            // Після реєстрації повертаємо об'єкт користувача для автоматичного входу
            res.status(201).json({
                success: true,
                user: { username, status: 1 }
            });
        });
    } catch (e) {
        res.status(500).json({ error: "Внутрішня помилка сервера при хешуванні" });
    }
});

// --- 4. АВТОРИЗАЦІЯ ---
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: "Введіть логін та пароль" });
    }

    db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
        if (err) return res.status(500).json({ error: "Помилка БД" });
        if (!user) return res.status(400).json({ error: "Користувача не знайдено" });

        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) return res.status(401).json({ error: "Невірний пароль" });

        console.log(`[AUTH] Успішний вхід: ${username}`);
        res.json({ success: true, user: { username: user.username, status: user.status } });
    });
});

// --- 5. ОБЧИСЛЕННЯ (З ПЕРЕВІРКОЮ СТАТУСУ) ---
app.post('/calculate', (req, res) => {
    const { action, value, expression, username } = req.body;

    if (!username) return res.status(401).json({ error: "Необхідна авторизація" });

    // Перевірка існування та СТАТУСУ (блокування)
    db.get("SELECT id, status FROM users WHERE username = ?", [username], (err, user) => {
        if (err || !user) return res.status(401).json({ error: "Користувача не знайдено" });

        // Перевірка статусу (1 - активний, 0 - заблокований)
        if (user.status !== 1) {
            return res.status(403).json({ error: "Ваш аккаунт заблоковано" });
        }

        let finalExpr = action && value ? `${action}(${value})` : expression;

        try {
            const result = evaluate(finalExpr).toString();

            // Атомарне оновлення статистики та історії
            db.serialize(() => {
                db.run("UPDATE users SET ops = ops + 1 WHERE id = ?", [user.id]);
                db.run("INSERT INTO history (user_id, expression, result) VALUES (?, ?, ?)",
                    [user.id, finalExpr, result]);
            });

            // Відповідь у форматі { "результат": { об'єкт } }
            res.json({
                [result]: {
                    user: username,
                    status: user.status,
                    input: finalExpr
                }
            });
        } catch (e) {
            res.status(400).json({ error: "Помилка обчислення: перевірте синтаксис" });
        }
    });
});

// --- 6. ІСТОРІЯ ТА ПРОФІЛЬ ---
app.get('/history', (req, res) => {
    const username = req.query.user;
    if (!username) return res.status(400).json({ error: "Користувач не вказаний" });

    db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
        if (err || !user) return res.status(404).json({ error: "Профіль не знайдено" });

        db.all("SELECT expression, result, created_at FROM history WHERE user_id = ? ORDER BY id DESC LIMIT 50",
            [user.id], (err, rows) => {
                if (err) return res.status(500).json({ error: "Помилка завантаження історії" });

                res.json({
                    stats: {
                        username: user.username,
                        phone: user.phone,
                        registered: user.registered,
                        ops: user.ops
                    },
                    history: rows || []
                });
            });
    });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 Сервер запущено: http://localhost:${PORT}`));