
const API_BASE_URL = "http://127.0.0.1:8080"; // TODO: замени на свой домен/айпи сервера

let tg = null;
let user = null;

let balance = 0;
let gamesTotal = 0;
let wonTotal = 0;
let lostTotal = 0;

const userChip = document.getElementById("userChip");
const themeToggle = document.getElementById("themeToggle");
const balanceEl = document.getElementById("balance");
const gamesTotalEl = document.getElementById("gamesTotal");
const wonTotalEl = document.getElementById("wonTotal");
const lostTotalEl = document.getElementById("lostTotal");
const bombsSelect = document.getElementById("bombs");
const bombsLabel = document.getElementById("bombsLabel");
const amountInput = document.getElementById("amount");
const playBtn = document.getElementById("playBtn");
const lastWinEl = document.getElementById("lastWin");
const lastMultEl = document.getElementById("lastMult");
const historyCountEl = document.getElementById("historyCount");
const historyListEl = document.getElementById("historyList");
const gridEl = document.getElementById("grid");

let theme = localStorage.getItem("forsov_theme") || "dark";

function applyTheme() {
    if (theme === "light") {
        document.body.classList.add("light");
        themeToggle.textContent = "🌞";
    } else {
        document.body.classList.remove("light");
        themeToggle.textContent = "🌓";
    }
    localStorage.setItem("forsov_theme", theme);
}

themeToggle.addEventListener("click", () => {
    theme = theme === "light" ? "dark" : "light";
    applyTheme();
});

function initTelegram() {
    if (window.Telegram && window.Telegram.WebApp) {
        tg = window.Telegram.WebApp;
        tg.ready();
        tg.expand();

        user = tg.initDataUnsafe.user;
        if (user) {
            userChip.textContent = user.username
                ? "@" + user.username
                : user.first_name || "Игрок";
            registerUser();
            fetchProfile();
            fetchHistory();
        }
    } else {
        // оффлайн / debug режим (запуск в браузере)
        user = { id: 123456, username: "debug_user" };
        userChip.textContent = "@debug_user (debug)";
        registerUser();
        fetchProfile();
        fetchHistory();
    }
}

async function registerUser() {
    if (!user) return;
    try {
        await fetch(API_BASE_URL + "/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                tg_id: user.id,
                username: user.username || null,
            }),
        });
    } catch (e) {
        console.error("register error", e);
    }
}

async function fetchProfile() {
    if (!user) return;
    try {
        const res = await fetch(
            API_BASE_URL + "/balance?tg_id=" + encodeURIComponent(user.id)
        );
        const data = await res.json();
        balance = data.balance || 0;
        gamesTotal = data.games || 0;
        wonTotal = data.won || 0;
        lostTotal = data.lost || 0;
        renderProfile();
    } catch (e) {
        console.error("profile error", e);
    }
}

function renderProfile() {
    balanceEl.textContent = balance.toFixed(2) + " M";
    gamesTotalEl.textContent = gamesTotal + " игр";
    wonTotalEl.textContent = (wonTotal || 0).toFixed(2) + " M";
    lostTotalEl.textContent = (lostTotal || 0).toFixed(2) + " M";
}

async function fetchHistory() {
    if (!user) return;
    try {
        const res = await fetch(
            API_BASE_URL + "/last-bets?tg_id=" + encodeURIComponent(user.id)
        );
        const data = await res.json();
        renderHistory(data.bets || []);
    } catch (e) {
        console.error("history error", e);
    }
}

function renderHistory(bets) {
    historyListEl.innerHTML = "";
    if (!bets.length) {
        historyListEl.innerHTML =
            '<div class="history-empty">Пока нет ставок — сделай первую игру 🚀</div>';
        historyCountEl.textContent = "0 записей";
        return;
    }
    historyCountEl.textContent = bets.length + " записей";

    bets.forEach((b) => {
        const row = document.createElement("div");
        row.className = "history-row";

        const main = document.createElement("div");
        main.className = "history-main";

        const amount = document.createElement("div");
        amount.className = "history-amount";
        amount.textContent = b.amount.toFixed(2) + " M · " + b.bombs + " бомб";

        const meta = document.createElement("div");
        meta.className = "history-meta";
        meta.textContent =
            "x" + b.mult.toFixed(2) + " · " + (b.created_at || "").replace("T", " ");

        main.appendChild(amount);
        main.appendChild(meta);

        const win = document.createElement("div");
        win.className = "history-win " + (b.win > 0 ? "positive" : "negative");
        win.textContent = (b.win > 0 ? "+" : "") + b.win.toFixed(2) + " M";

        row.appendChild(main);
        row.appendChild(win);

        historyListEl.appendChild(row);
    });
}

async function placeBet() {
    if (!user) return;

    const amount = Number(amountInput.value || "0");
    const bombs = Number(bombsSelect.value || "3");

    if (amount <= 0) {
        alert("Введите корректную ставку");
        return;
    }
    if (amount > balance) {
        alert("Недостаточно средств");
        return;
    }

    playBtn.disabled = true;
    playBtn.textContent = "Играем...";

    try {
        const res = await fetch(API_BASE_URL + "/bet", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                tg_id: user.id,
                amount,
                bombs,
            }),
        });
        const data = await res.json();
        if (data.error) {
            alert("Ошибка: " + data.error);
        } else {
            balance = data.new_balance;
            renderProfile();
            lastWinEl.textContent = data.win.toFixed(2) + " M";
            lastMultEl.textContent = data.mult.toFixed(2) + " X";
            revealRandomCells(bombs);
            fetchHistory(); // обновим историю
        }
    } catch (e) {
        console.error("bet error", e);
        alert("Ошибка соединения с сервером");
    } finally {
        playBtn.disabled = false;
        playBtn.textContent = "🚀 Играть";
    }
}

function revealRandomCells(bombsCount) {
    const cells = Array.from(document.querySelectorAll(".cell"));
    cells.forEach((c) => {
        c.classList.remove("open-win", "open-bomb");
        const lbl = c.querySelector(".cell-label");
        if (lbl) c.removeChild(lbl);
    });

    const indices = [...Array(cells.length).keys()];
    shuffle(indices);

    const bombSet = new Set(indices.slice(0, bombsCount));
    cells.forEach((cell, idx) => {
        const lbl = document.createElement("div");
        lbl.className = "cell-label";
        if (bombSet.has(idx)) {
            cell.classList.add("open-bomb");
            lbl.textContent = "💣";
        } else {
            cell.classList.add("open-win");
            lbl.textContent = "💎";
        }
        cell.appendChild(lbl);
    });
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

function buildGrid() {
    gridEl.innerHTML = "";
    for (let i = 0; i < 25; i++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        gridEl.appendChild(cell);
    }
}

function initBetButtons() {
    document.querySelectorAll(".bet-buttons button").forEach((btn) => {
        btn.addEventListener("click", () => {
            const act = btn.dataset.act;
            let current = Number(amountInput.value || "0");

            if (act === "min") current = 1;
            if (act === "x2") current = Math.min(current * 2 || 2, balance);
            if (act === "max") current = balance || 1;

            amountInput.value = Math.max(1, Math.floor(current));
        });
    });
}

document.addEventListener("DOMContentLoaded", () => {
    applyTheme();
    buildGrid();
    initBetButtons();
    bombsLabel.textContent = bombsSelect.value + " бомб";
    bombsSelect.addEventListener("change", () => {
        bombsLabel.textContent = bombsSelect.value + " бомб";
    });
    playBtn.addEventListener("click", placeBet);
    initTelegram();
});
