let currentNumber = "";
const display = document.getElementById('display');

// 1. Додавання цифр
function addNum(val) {
    console.log("Введено число:", val);
    // Якщо на екрані "0" або "Error", замінюємо на нове число
    if (currentNumber === "0" || display.innerText === "Error") {
        currentNumber = val.toString();
    } else {
        currentNumber += val.toString();
    }
    updateDisplay();
}

// 2. Оновлення екрану
function updateDisplay() {
    display.innerText = currentNumber || "0";
}

// 3. Очищення
function clearCalc() {
    currentNumber = "";
    updateDisplay();
}

// 4. Функція для кнопок sin, cos, sqrt
async function sendOp(action) {
    console.log("Натиснуто дію:", action);
    if (!currentNumber) {
        console.warn("Число не введено!");
        return;
    }

    // Формуємо структурований JSON
    const payload = {
        action: action,
        value: currentNumber
    };

    await requestCalculation(payload);
}

// 5. Функція для кнопки "="
async function calculate() {
    if (!currentNumber) return;

    // Якщо це просто вираз (наприклад, 5+5), шлемо як expression
    await requestCalculation({ expression: currentNumber });
}

// 6. САМ ЗАПИТ
async function requestCalculation(payload) {
    console.log("Відправка запиту на сервер:", payload);
    display.innerText = "calculating...";

    try {
        const response = await fetch('/calculate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error("Сервер повернув помилку");

        const data = await response.json();
        console.log("Відповідь сервера:", data);

        // Витягуємо результат (перший ключ об'єкта)
        const result = Object.keys(data)[0];

        if (result === undefined) throw new Error("Результат порожній");

        currentNumber = result.toString();
        updateDisplay();
    } catch (e) {
        console.error("Помилка при запиті:", e);
        display.innerText = "Error";
        currentNumber = "";
    }
}