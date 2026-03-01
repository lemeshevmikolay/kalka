let currentNumber = "";
let currentUsername = localStorage.getItem('kalka_user') || "";
let authMode = "login"; // "login" або "register"

const getDisplay = () => document.getElementById('display');

window.onload = () => {
    if (currentUsername) showCalculator();
};

// --- АВТОРИЗАЦІЯ ТА ВАЛІДАЦІЯ ---

function switchAuthMode(mode) {
    authMode = mode;
    const title = document.getElementById('auth-title');
    const phoneInput = document.getElementById('phone-input');
    const submitBtn = document.getElementById('auth-submit-btn');
    const tabs = document.querySelectorAll('.auth-tabs button');

    tabs.forEach(btn => btn.classList.remove('active'));

    if (mode === 'register') {
        title.innerText = "Створити аккаунт";
        phoneInput.classList.remove('hidden');
        submitBtn.innerText = "Зареєструватися";
        document.getElementById('tab-register').classList.add('active');
    } else {
        title.innerText = "З поверненням!";
        phoneInput.classList.add('hidden');
        submitBtn.innerText = "Ввійти";
        document.getElementById('tab-login').classList.add('active');
    }
}

async function handleAuthSubmit() {
    const username = document.getElementById('username-input').value.trim();
    const password = document.getElementById('password-input').value;
    const phone = document.getElementById('phone-input').value.trim();
    const errorMsg = document.getElementById('error-msg');
    const authBox = document.getElementById('auth-container');

    errorMsg.classList.add('hidden');

    // Базова перевірка (НЕ СКОРОЧЕНО)
    if (!username || !password) {
        showAuthError("Заповніть усі поля");
        return;
    }

    // Валідація телефону для реєстрації (Regex на українських операторів)
    if (authMode === 'register') {
        const phoneRegex = /^(?:\+38|38)?0\d{9}$/;
        if (!phoneRegex.test(phone)) {
            showAuthError("Невірний формат номера (+380...)");
            return;
        }
    }

    const url = authMode === 'register' ? '/register' : '/login';
    const body = authMode === 'register'
        ? { username, password, phone }
        : { username, password };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (!response.ok) throw new Error(data.error || "Помилка доступу");

        // --- ДОДАНО АВТО-ВХІД (БЕЗ ВИДАЛЕННЯ ІНШИХ ПЕРЕВІРОК) ---
        if (authMode === 'register') {
            // Одразу встановлюємо юзера після успішної реєстрації
            currentUsername = username;
            localStorage.setItem('kalka_user', currentUsername);
            showCalculator();
        } else {
            // Звичайний вхід
            currentUsername = data.user.username;
            localStorage.setItem('kalka_user', currentUsername);
            showCalculator();
        }
    } catch (e) {
        showAuthError(e.message);
    }
}

function showAuthError(text) {
    const errorMsg = document.getElementById('error-msg');
    const authBox = document.getElementById('auth-container');
    errorMsg.innerText = text;
    errorMsg.classList.remove('hidden');
    authBox.classList.add('shake');
    setTimeout(() => authBox.classList.remove('shake'), 400);
}

function showCalculator() {
    document.getElementById('auth-container').classList.add('hidden');
    document.getElementById('calc-container').classList.remove('hidden');
    document.getElementById('user-label').innerText = currentUsername;
}

function logout() {
    localStorage.removeItem('kalka_user');
    window.location.reload();
}

// --- КАЛЬКУЛЯТОР ---

function addNum(val) {
    const display = getDisplay();
    if (currentNumber === "0" || display.innerText === "Error" || display.innerText === "⏳") {
        currentNumber = val.toString();
    } else {
        currentNumber += val.toString();
    }
    display.innerText = currentNumber;
}

function clearCalc() {
    currentNumber = "";
    getDisplay().innerText = "0";
}

async function sendOp(action) {
    if (!currentNumber) return;
    await requestCalculation({ action, value: currentNumber });
}

async function calculate() {
    if (!currentNumber) return;
    await requestCalculation({ expression: currentNumber });
}

async function requestCalculation(payload) {
    payload.username = currentUsername;
    const display = getDisplay();
    display.innerText = "⏳";

    try {
        const response = await fetch('/calculate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            if (response.status === 403) {
                document.getElementById('status-badge').classList.remove('hidden');
            }
            throw new Error(data.error);
        }

        const resultValue = Object.keys(data)[0];
        currentNumber = resultValue.toString();
        display.innerText = currentNumber;

        document.getElementById('status-badge').classList.add('hidden');

    } catch (e) {
        display.innerText = "Error";
        currentNumber = "";
        console.error(e.message);
    }
}

// --- ІСТОРІЯ ТА ПРОФІЛЬ ---

async function toggleHistory() {
    const panel = document.getElementById('history-panel');
    const isActive = panel.classList.toggle('active');

    if (isActive) {
        document.getElementById('history-content').innerHTML = "<p style='text-align:center'>Завантаження...</p>";
        try {
            const res = await fetch(`/history?user=${currentUsername}`);
            const data = await res.json();

            document.getElementById('stat-name').innerText = data.stats.username;
            document.getElementById('stat-phone').innerText = data.stats.phone;
            document.getElementById('stat-date').innerText = data.stats.registered;
            document.getElementById('stat-ops').innerText = data.stats.ops;

            const list = document.getElementById('history-content');
            if (!data.history || data.history.length === 0) {
                list.innerHTML = "<p style='text-align:center; opacity:0.5'>Історія порожня</p>";
            } else {
                list.innerHTML = data.history.map(h => `
                    <div class="h-item">
                        <div class="expr">${h.expression}</div>
                        <div class="res">= ${h.result}</div>
                        <div class="time">${new Date(h.created_at).toLocaleString('uk-UA')}</div>
                    </div>
                `).join('');
            }
        } catch (e) {
            document.getElementById('history-content').innerHTML = "<p style='color:#ff3b30'>Помилка завантаження</p>";
        }
    }
}