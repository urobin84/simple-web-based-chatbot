import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// ES Module equivalent for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
// Increase payload size limit for base64 images
app.use(express.json({ limit: '10mb' })); // Keep for history loading
app.use(express.static(path.join(__dirname, 'public')));

// Explicitly serve index.html for the root route to fix 404 errors
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Handle favicon requests to prevent 404 errors in logs
app.get('/favicon.ico', (req, res) => res.status(204).end());

//Gemini setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fieldSize: 10 * 1024 * 1024, // 10MB, to match JSON limit
  },
});

app.post('/api/chat', upload.single('file'), async (req, res) => {
  try {
    // History and message are now in req.body, file is in req.file
    const userMessage = req.body.message || '';
    let history = [];
    try {
      history = JSON.parse(req.body.history || '[]');
    } catch (e) {
      console.error("Failed to parse history JSON:", e);
      // Safely default to an empty history array
    }
    const file = req.file;

    if (!userMessage.trim() && !file) {
      return res.status(400).json({ error: 'Message or file is required' });
    }
    if (!Array.isArray(history)) {
      return res.status(400).json({ error: 'Invalid history format' });
    }

    // Construct the prompt for the current turn with text and/or image
    const latestUserPrompt = [];
    if (userMessage.trim()) {
      latestUserPrompt.push({ text: userMessage });
    }
    if (file) {
      latestUserPrompt.push({
        inlineData: {
          // Use buffer from memory storage
          data: file.buffer.toString("base64"),
          mimeType: file.mimetype,
        },
      });
    }

    // Use streaming for a better user experience
    const chat = model.startChat({ history });
    const result = await chat.sendMessageStream(latestUserPrompt);

    // Set headers for a streaming text response
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Transfer-Encoding', 'chunked');

    for await (const chunk of result.stream) {
      // Safety feedback is now on the stream, check it here if needed
      const chunkText = chunk.text();
      if (chunkText) {
        res.write(chunkText);
      }
    }
    res.end();
  } catch (error) {
    console.error(error);
    // If headers are already sent, we can't send a new JSON error response.
    // The stream will have been closed by the error, so we just log it.
    if (!res.headersSent) {
      res.status(500).json({ error: 'An unexpected error occurred while communicating with the AI.' });
    }
  }
});

app.listen(port, () => {
  console.log(`Gemini Chatbot running on http://localhost:${port}`);
});
