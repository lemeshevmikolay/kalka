const express = require('express');
const { evaluate } = require('mathjs');
const app = express();

app.use(express.json());
app.use(express.static('public'));

app.post('/calculate', (req, res) => {
    const { action, value, expression } = req.body;
    let finalExpression = "";

    if (action && value) {
        finalExpression = `${action}(${value})`;
    } else {
        finalExpression = expression || value;
    }

    try {
        console.log(`exec calculation: ${finalExpression}`);
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