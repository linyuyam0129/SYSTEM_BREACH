/**
 * 網頁遊戲專題 - Final Ultimate Version (Mobile Responsive Fix)
 * Fixes: BSOD Layout on Mobile, Touch-to-Restart
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- 視窗調整與 Matrix 背景 ---
let drops = [];
const fontSize = 14;
let columns = 0;

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    initMatrix();
}

function initMatrix() {
    columns = canvas.width / fontSize;
    drops = [];
    for (let i = 0; i < columns; i++) drops[i] = 1;
}

window.addEventListener('resize', resize);
resize();

// --- 遊戲變數 ---
let player = { 
    x: 0, y: 0, 
    text: "<VIRUS>", angle: 0, 
    speed: 4, baseSpeed: 4, boostSpeed: 10, radius: 20, 
    color: "#0f0", stage: "KB" 
};
let foods = [], enemies = [], particles = [];
let score = 0;
const TARGET_SCORE = 10000; // 勝利目標

let gameRunning = false, isBoosting = false;
let isOnline = true; 
let pID = null;
let godMode = false, rainbowMode = false;
let input = { x: 0, y: 0 };

// --- 操作監聽：移動 ---
const moveHandler = (x, y) => { input.x = x; input.y = y; };

window.addEventListener('mousemove', e => moveHandler(e.clientX, e.clientY));

// 手機觸控移動
window.addEventListener('touchmove', e => { 
    e.preventDefault(); 
    moveHandler(e.touches[0].clientX, e.touches[0].clientY); 
}, { passive: false });

window.addEventListener('touchstart', e => {
    moveHandler(e.touches[0].clientX, e.touches[0].clientY); 
}, { passive: false });

// --- 操作監聽：加速 ---
const startBoost = () => isBoosting = true;
const endBoost = () => isBoosting = false;

window.addEventListener('mousedown', startBoost);
window.addEventListener('mouseup', endBoost);
window.addEventListener('keydown', (e) => { if(e.code === 'Space') startBoost(); });
window.addEventListener('keyup', (e) => { if(e.code === 'Space') endBoost(); });

// 手機版加速按鈕
document.addEventListener("DOMContentLoaded", () => {
    const boostBtn = document.getElementById('boostBtn');
    if (boostBtn) {
        boostBtn.addEventListener('touchstart', (e) => { 
            e.preventDefault(); e.stopPropagation(); startBoost(); 
        });
        boostBtn.addEventListener('touchend', (e) => { 
            e.preventDefault(); endBoost(); 
        });
        boostBtn.addEventListener('mousedown', startBoost);
        boostBtn.addEventListener('mouseup', endBoost);
    }
});

// --- API 核心 ---
async function api(url, method = 'GET', body = null) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1000);
        
        const opts = { method, headers: { 'Content-Type': 'application/json' }, signal: controller.signal };
        if (body) opts.body = JSON.stringify(body);
        
        const res = await fetch(url, opts);
        clearTimeout(timeoutId);

        if (!res.ok) throw new Error();
        isOnline = true;
        return await res.json();
    } catch (e) { 
        isOnline = false; 
        return mockApi(url, method, body); 
    }
}

function mockApi(url, method, body) {
    if (url === '/command') {
        const cmd = body.cmd.toUpperCase();
        if (cmd === 'SUDO_ROOT') return { success: true, effect: 'GOD_MODE', msg: '[DEMO] God Mode Enabled' };
        if (cmd === 'COLOR_HACK') return { success: true, effect: 'RAINBOW', msg: '[DEMO] Rainbow Mode On' };
        if (cmd.startsWith('PURGE') || cmd === 'RESET_SYSTEM_DATA') return { success: true, msg: '[DEMO] Target Deleted (Local Sim)' };
        return { success: false, msg: 'Unknown Command' };
    }
    if (url === '/stats') {
        return { 
            totalData: Math.floor(Math.random() * 5000000 + 100000), 
            recentLogs: [{ type: 'INFO', message: 'System initialized (Demo Mode)' }] 
        };
    }
    if (url === '/scores/top') {
        return [
            { name: "Neo", score: 9999 },
            { name: "Morpheus", score: 8000 },
            { name: "You (Local)", score: 0 }
        ];
    }
    return { success: true };
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 KB';
    const k = 1024; 
    const sizes = ['KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    if (i < 0) return bytes + ' KB';
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// --- 繪圖工具 ---
function drawMatrixRain() {
    ctx.fillStyle = "rgba(0, 0, 0, 0.1)"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = (player.stage === "TB") ? "#330000" : "#003300"; ctx.font = fontSize + "px monospace";
    for (let i = 0; i < drops.length; i++) {
        ctx.fillText(String.fromCharCode(0x30A0 + Math.random() * 96), i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
    }
}

function drawRotatedText(text, x, y, angle, color, size = 20) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.fillStyle = color; ctx.font = `bold ${size}px 'VT323', monospace`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.shadowBlur = 15; ctx.shadowColor = color; ctx.fillText(text, 0, 0);
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, size * 1.2, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
}

// --- 遊戲邏輯 ---
function initGame() {
    player.x = canvas.width / 2; player.y = canvas.height / 2;
    input.x = player.x; input.y = player.y; score = 0;
    updateProgress(); checkLevel();
    foods = []; for (let i = 0; i < 40; i++) spawnFood();
    enemies = []; spawnEnemy(); spawnEnemy();
}

function checkLevel() {
    if (score >= 5000) { player.stage = "TB"; player.text = "< SYSTEM_ROOT >"; player.color = "#ff0000"; player.radius = 40; } 
    else if (score >= 2000) { player.stage = "GB"; player.text = "< TROJAN >"; player.color = "#ffaa00"; player.radius = 30; } 
    else if (score >= 500) { player.stage = "MB"; player.text = "< MALWARE >"; player.color = "#00f3ff"; player.radius = 25; } 
    else { player.stage = "KB"; player.text = "< VIRUS >"; player.color = "#0f0"; player.radius = 20; }
}

function updateProgress() {
    const pct = Math.min(100, (score / TARGET_SCORE) * 100);
    const bar = document.getElementById('progressBar');
    if(bar) bar.style.width = `${pct}%`;
}

function spawnFood() { foods.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, text: Math.random() > 0.5 ? "1" : "0", size: 14 + Math.random() * 5 }); }
function spawnEnemy() {
    let ex, ey;
    if (Math.random() < 0.5) { ex = Math.random() < 0.5 ? -50 : canvas.width + 50; ey = Math.random() * canvas.height; } 
    else { ex = Math.random() * canvas.width; ey = Math.random() < 0.5 ? -50 : canvas.height + 50; }
    enemies.push({ x: ex, y: ey, text: "[ERR]", speed: 1.5 + Math.random() * 2, angle: 0 });
}

// --- 開始遊戲 ---
async function startGame() {
    const randomNames = ["GHOST", "UNKNOWN", "GLITCH", "CIPHER", "SHADOW", "PROXY", "DAEMON", "USER_X", "NO_NAME", "SPECTRE"];
    let nameInput = document.getElementById('playerName').value.trim();
    const name = nameInput || randomNames[Math.floor(Math.random() * randomNames.length)];

    const rawCmd = document.getElementById('adminCmd').value.trim();
    const cmdUpper = rawCmd.toUpperCase();

    // 1. 管理員指令
    if (rawCmd && (cmdUpper.startsWith("PURGE") || cmdUpper === "RESET_SYSTEM_DATA")) {
        let finalCmd = rawCmd;
        if (cmdUpper.startsWith("PURGE")) {
            const parts = rawCmd.split(" ");
            if (parts.length >= 2) finalCmd = "PURGE " + parts.slice(1).join(" ");
            else { alert("Format: PURGE <name>"); return; }
        }
        
        const cmdRes = await api('/command', 'POST', { cmd: finalCmd });
        if (cmdRes) {
            alert(`ADMIN LOG: ${cmdRes.msg}`);
            if (cmdRes.success) location.reload();
        }
        return; 
    }

    // 2. 正常遊戲
    const data = await api('/players', 'POST', { name });
    if (data) pID = data.id;

    // 3. 作弊碼
    if (rawCmd) {
        if (cmdUpper === "SUDO_ROOT" || cmdUpper === "COLOR_HACK") {
             const cmdRes = await api('/command', 'POST', { cmd: cmdUpper });
             if (cmdRes && cmdRes.success) {
                alert(`SYSTEM MSG: ${cmdRes.msg}`);
                if (cmdRes.effect === "GOD_MODE") godMode = true;
                if (cmdRes.effect === "RAINBOW") rainbowMode = true;
            }
        }
    }

    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('uiOverlay').style.display = 'block';
    
    initGame(); gameRunning = true;
    setInterval(() => { if(gameRunning) spawnEnemy(); }, 4000); 
    animate();
}

async function abortGame() {
    gameRunning = false;
    const confirmAbort = confirm("DISCONNECTING... SAVE DATA?");
    if (confirmAbort) {
        if (isOnline && pID) await api('/scores', 'POST', { student_id: pID, score: Math.floor(score) });
        alert(`SESSION ABORTED.\nDATA SAVED: ${Math.floor(score)}`);
        location.reload();
    } else {
        gameRunning = true; animate();
    }
}

// --- [修正] 勝利結局 (BSOD) - 手機版適配 ---
async function gameWin() {
    gameRunning = false;
    
    // 上傳分數
    if (isOnline && pID) await api('/scores', 'POST', { student_id: pID, score: Math.floor(score) });

    // 藍屏背景
    ctx.fillStyle = "#0000aa"; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 設定響應式字體大小 (根據螢幕寬度調整)
    const baseSize = Math.max(16, canvas.width / 25); 
    ctx.font = `${baseSize}px monospace`;
    ctx.textAlign = "center"; // 文字置中
    ctx.fillStyle = "#fff";

    const cx = canvas.width / 2;
    let cy = canvas.height * 0.2; // 從螢幕 20% 高度開始

    const lines = [
        ":(",
        "",
        "A problem has been detected.",
        "System has been shut down.",
        "",
        "SYSTEM_HACKED_SUCCESSFULLY",
        `TOTAL DATA: ${Math.floor(score)} TB`,
        "",
        "",
        "[ TAP SCREEN TO RESTART ]" // 手機版提示
    ];

    // 逐行繪製
    lines.forEach(line => {
        ctx.fillText(line, cx, cy);
        cy += baseSize * 1.5;
    });

    // 點擊螢幕重新開始
    const restartHandler = () => location.reload();
    canvas.addEventListener('touchstart', restartHandler);
    canvas.addEventListener('click', restartHandler);
}

// --- 失敗結局 ---
async function gameOver() {
    gameRunning = false;
    alert(`SYSTEM CRASHED!\nFINAL SIZE: ${Math.floor(score)} ${player.stage}`);
    if (isOnline && pID) await api('/scores', 'POST', { student_id: pID, score: Math.floor(score) });
    location.reload();
}

// --- 動畫迴圈 ---
function animate() {
    if (!gameRunning) return;
    requestAnimationFrame(animate);

    drawMatrixRain(); checkLevel(); updateProgress();

    if (score >= TARGET_SCORE) { gameWin(); return; }

    const angle = Math.atan2(input.y - player.y, input.x - player.x);
    const dist = Math.hypot(input.x - player.x, input.y - player.y);
    player.angle = angle;

    let currentSpeed = player.baseSpeed;
    if (isBoosting && score > 0) {
        currentSpeed = player.boostSpeed; score -= 0.2; if (score < 0) score = 0;
        particles.push({ x: player.x, y: player.y, text: String.fromCharCode(0x30A0 + Math.random() * 96), vx: (Math.random()-0.5)*3, vy: (Math.random()-0.5)*3, life: 20, size: 10 + Math.random()*10, color: player.color });
    }

    if (dist > 5) { player.x += Math.cos(angle) * currentSpeed; player.y += Math.sin(angle) * currentSpeed; }
    document.getElementById('scoreDisplay').innerHTML = `${Math.floor(score)} <span style="font-size:12px">${player.stage}</span>`;

    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i]; p.x -= Math.cos(angle) * 5; p.y -= Math.sin(angle) * 5; p.life--;
        ctx.fillStyle = p.color || "#0f0"; ctx.globalAlpha = p.life / 20; ctx.font = `${p.size}px monospace`; ctx.fillText(p.text, p.x, p.y); ctx.globalAlpha = 1;
        if (p.life <= 0) particles.splice(i, 1);
    }

    let displayColor = rainbowMode ? `hsl(${Math.random() * 360}, 100%, 50%)` : player.color;
    drawRotatedText(player.text, player.x, player.y, player.angle, displayColor, player.radius);

    foods.forEach((f, i) => {
        f.x += (Math.random() - 0.5); f.y += (Math.random() - 0.5);
        ctx.fillStyle = "#fff"; ctx.font = "bold 16px monospace"; ctx.fillText(f.text, f.x, f.y);
        if (Math.hypot(player.x - f.x, player.y - f.y) < player.radius + 10) {
            foods.splice(i, 1); score += 10; spawnFood();
            if (Math.random() > 0.5) particles.push({ x: f.x, y: f.y, text: "1", vx: 0, vy: -2, life: 10, size: 12, color: "#fff" });
        }
    });

    enemies.forEach((e, i) => {
        const chaseAngle = Math.atan2(player.y - e.y, player.x - e.x);
        e.x += Math.cos(chaseAngle) * e.speed; e.y += Math.sin(chaseAngle) * e.speed;
        let enemyColor = (player.stage === "TB") ? "#550000" : "#f00";
        drawRotatedText(e.text, e.x, e.y, chaseAngle, enemyColor, 18);
        if (Math.hypot(player.x - e.x, player.y - e.y) < player.radius + 15) {
            if (player.stage === "TB" || godMode) {
                enemies.splice(i, 1); score += 100;
                for(let k=0; k<5; k++) particles.push({ x: e.x, y: e.y, text: "ERR", vx: (Math.random()-0.5)*5, vy: (Math.random()-0.5)*5, life: 30, size: 15, color: "#f00" });
            } else { gameOver(); }
        }
    });
}

// 頁面載入初始化
window.onload = async () => {
    // 綁定加速按鈕事件
    const boostBtn = document.getElementById('boostBtn');
    if (boostBtn) {
        boostBtn.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); startBoost(); });
        boostBtn.addEventListener('touchend', (e) => { e.preventDefault(); endBoost(); });
        boostBtn.addEventListener('mousedown', startBoost);
        boostBtn.addEventListener('mouseup', endBoost);
    }

    // 載入排行榜
    try {
        const topData = await api('/scores/top');
        const list = document.getElementById('scoreList'); 
        if(list) {
            list.innerHTML = "";
            if (topData) topData.forEach(r => list.innerHTML += `<li>> ${r.name} : ${r.score}</li>`);
        }
    } catch (e) { 
        if(document.getElementById('scoreList')) document.getElementById('scoreList').innerHTML = "> OFFLINE MODE"; 
        isOnline = false; 
    }

    // 載入全球統計
    if (isOnline) {
        try {
            const stats = await api('/stats');
            if (stats) {
                const totalText = document.getElementById('globalTotal');
                if(totalText) {
                    totalText.innerText = formatBytes(stats.totalData);
                    totalText.style.textShadow = "0 0 10px #ff0000";
                }
                const logList = document.getElementById('serverLogs'); 
                if(logList) {
                    logList.innerHTML = "";
                    stats.recentLogs.forEach(log => {
                        let color = "#00aa00";
                        if (log.type === 'ALERT') color = "#ffaa00";
                        if (log.type === 'SUCCESS') color = "#00f3ff";
                        logList.innerHTML += `<li style="color:${color}">> ${log.message}</li>`;
                    });
                }
            }
        } catch (e) { console.log("Stats fetch failed"); }
    }
};