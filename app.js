/**
 * Backend Server for Terminal Breach
 * Features: REST API, SQLite, Admin Commands (Purge/Reset)
 */

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000; // 支援 Render 的 PORT 環境變數

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// 資料庫初始化
const db = new sqlite3.Database('./students.db', (err) => {
    if (err) console.error(err.message);
    console.log('Connected to SQLite database.');
});

db.serialize(() => {
    // 建立資料表
    db.run(`CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER,
        score INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(student_id) REFERENCES students(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message TEXT,
        type TEXT, 
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

// 寫入日誌工具
function addLog(msg, type="INFO") {
    const timestamp = new Date().toLocaleTimeString();
    db.run(`INSERT INTO logs (message, type) VALUES (?, ?)`, [`[${timestamp}] ${msg}`, type]);
}

// --- API 路由 ---

// 1. 註冊玩家
app.post('/players', (req, res) => {
    const { name } = req.body;
    db.run(`INSERT INTO students (name) VALUES (?)`, [name], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        addLog(`New hacker detected: ${name}`, "INFO");
        res.json({ id: this.lastID });
    });
});

// 2. 儲存分數
app.post('/scores', (req, res) => {
    const { student_id, score } = req.body;
    db.run(`INSERT INTO scores (student_id, score) VALUES (?, ?)`, [student_id, score], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (score > 1000) addLog(`Data breach: ${score} TB stolen!`, "ALERT");
        res.json({ message: "Score saved" });
    });
});

// 3. 排行榜 (Top 10)
app.get('/scores/top', (req, res) => {
    const sql = `SELECT students.name, scores.score FROM scores 
                 JOIN students ON scores.student_id = students.id 
                 ORDER BY scores.score DESC LIMIT 10`;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 4. 全球統計與日誌
app.get('/stats', (req, res) => {
    db.get(`SELECT SUM(score) as totalData FROM scores`, [], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        const total = row.totalData || 0;

        db.all(`SELECT message, type FROM logs ORDER BY id DESC LIMIT 5`, [], (err, logs) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ totalData: total, recentLogs: logs });
        });
    });
});

// 5. 指令驗證 (管理員功能)
app.post('/command', (req, res) => {
    const { cmd } = req.body;
    
    // 刪除指定玩家: PURGE <名字>
    if (cmd.startsWith("PURGE ")) {
        const targetName = cmd.split(" ")[1];
        if (!targetName) return res.json({ success: false, msg: "Name missing" });

        db.get(`SELECT id FROM students WHERE name = ?`, [targetName], (err, row) => {
            if (err || !row) return res.json({ success: false, msg: `User [${targetName}] not found.` });
            const targetId = row.id;

            db.serialize(() => {
                db.run(`DELETE FROM scores WHERE student_id = ?`, [targetId]);
                db.run(`DELETE FROM students WHERE id = ?`, [targetId], (err) => {
                    if (err) return res.json({ success: false, msg: "Delete failed" });
                    addLog(`Target [${targetName}] eliminated by Admin.`, "ALERT");
                    res.json({ success: true, msg: `TARGET [${targetName}] DELETED.` });
                });
            });
        });
        return;
    }

    // 清空系統: RESET_SYSTEM_DATA
    if (cmd === "RESET_SYSTEM_DATA") {
        db.serialize(() => {
            db.run(`DELETE FROM scores`);
            db.run(`DELETE FROM students`);
            db.run(`DELETE FROM logs`);
        });
        addLog(`System Factory Reset Executed.`, "ALERT");
        return res.json({ success: true, msg: "SYSTEM DATA WIPED CLEAN." });
    }

    // 作弊指令
    if (cmd === "SUDO_ROOT") {
        res.json({ success: true, effect: "GOD_MODE", msg: "Access Granted: Root Privileges" });
        addLog(`Admin entered God Mode.`, "SUCCESS");
    } else if (cmd === "COLOR_HACK") {
        res.json({ success: true, effect: "RAINBOW", msg: "Display Driver Overridden" });
    } else {
        res.json({ success: false, msg: "Access Denied" });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});