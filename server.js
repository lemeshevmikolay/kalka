const express = require('express');
const { evaluate } = require('mathjs');
const app = express();

app.use(express.json());
app.use(express.static('public'));

app.post('/calculate', (req, res) => {
    const { action, value, expression } = req.body;
    let finalExpression = "";

    // Якщо прийшла конкретна дія (sqrt, sin тощо)
    if (action && value) {
        finalExpression = `${action}(${value})`;
    } else {
        // Якщо прийшов звичайний вираз (наприклад, з кнопки "=")
        finalExpression = expression || value;
    }

    try {
        console.log(`exec: ${finalExpression}`);
        const result = evaluate(finalExpression);

        // Повертаємо у твоєму форматі
        res.json({
            [result]: {
                input: finalExpression,
                save: false
            }
        });
    } catch (error) {
        res.status(400).json({ error: "Calculation Error" });
    }
});

app.listen(3000, () => console.log("Server on http://localhost:3000/"));