require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

function readJSON(filename) {
    const filepath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filepath)) return null;
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

function writeJSON(filename, data) {
    const filepath = path.join(DATA_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
}

// ─── Gemini AI Bill Explanation ──────────────────────────────
async function generateBillExplanation(billData) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');

    const ai = new GoogleGenAI({ apiKey });
    const prompt = `You are a helpful Store Assistant. 
Analyze this bill and provide a friendly explanation of the purchase.
Bill Data: ${JSON.stringify(billData)}

STRICT OUTPUT FORMAT:
Provide the output in JSON format with these keys:
1. "english": { "summary": "...", "explanation": "..." },
2. "kannada": { "summary": "...", "explanation": "..." },
3. "whatsappMessage": "A professional formatted bill receipt with emojis, item list, total amount, and a friendly thank you note in both English and Kannada."

Ensure the Kannada translation is warm and natural. 
Return ONLY the JSON. No markdown.`;

    try {
        console.log('📡 Calling Gemini AI for Bill Explanation...');
        const response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: prompt
        });

        let text = response.text;
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(text);
    } catch (error) {
        console.error('❌ Gemini AI error:', error.message);
        throw error;
    }
}

// ─── API Endpoints ──────────────────────────────────────────────
app.post('/api/generate-bill', async (req, res) => {
    try {
        const { items, customerName } = req.body;
        const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const tax = subtotal * 0.18; // 18% GST
        const total = subtotal + tax;

        const billInfo = {
            billId: 'INV-' + Date.now(),
            customerName,
            items,
            subtotal,
            tax,
            total,
            date: new Date().toISOString()
        };

        const aiResponse = await generateBillExplanation(billInfo);
        const record = { id: uuidv4(), bill: billInfo, ai: aiResponse, timestamp: new Date().toISOString() };
        
        let history = readJSON('history.json') || [];
        history.push(record);
        writeJSON('history.json', history);

        // Send WhatsApp directly via TextMeBot (no n8n)
        let whatsapp = { sent: false, detail: 'not configured' };
        const recipient = process.env.WHATSAPP_PHONE;
        const apikey = process.env.TEXTMEBOT_API_KEY;
        if (recipient && apikey) {
            const url = `http://api.textmebot.com/send.php?recipient=${encodeURIComponent(recipient)}` +
                `&apikey=${encodeURIComponent(apikey)}` +
                `&text=${encodeURIComponent(aiResponse.whatsappMessage || '')}&json=yes`;
            try {
                const r = await fetch(url);
                const body = await r.text();
                console.log('📲 TextMeBot response:', body);
                let ok = r.ok;
                try {
                    const parsed = JSON.parse(body);
                    if (parsed.status) ok = parsed.status === 'success';
                } catch { /* non-JSON response */ }
                whatsapp = { sent: ok, detail: body };
            } catch (err) {
                console.error('⚠️ TextMeBot failed:', err.message);
                whatsapp = { sent: false, detail: err.message };
            }
        }

        res.json({ success: true, bill: billInfo, ai: aiResponse, whatsapp });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/history', (req, res) => {
    res.json(readJSON('history.json') || []);
});

app.listen(PORT, () => {
    console.log(`🧾 Bill Generation Agent running on http://localhost:${PORT}`);
});
