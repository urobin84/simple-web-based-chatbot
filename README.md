# Gemini AI Multimodal Chatbot

A full-stack web application that provides a feature-rich, multimodal chat interface powered by Google's Gemini 1.5 Flash model. Users can interact with the chatbot using text, voice, and file uploads (images, audio, PDFs).

This project was built with assistance from Gemini Code Assist.

## Features

- **Multimodal Chat:** Interact with the AI using text, voice, images, audio files, and PDFs.
- **Streaming Responses:** Bot responses are streamed in real-time for a dynamic user experience.
- **Conversation History:** Chat history is saved to the browser's local storage, persisting across sessions.
- **Markdown & Syntax Highlighting:** Bot responses are rendered as Markdown with syntax highlighting for code blocks.
- **Voice-to-Text:** Use your microphone to provide input via the Web Speech API.
- **Responsive Design:** A clean interface that works seamlessly on both desktop and mobile devices.
- **File Handling:** Securely handles file uploads on the backend using `multer`.

## Tech Stack

- **Backend:** Node.js, Express.js
- **Frontend:** Vanilla JavaScript, HTML5, CSS3
- **AI Model:** Google Gemini 1.5 Flash
- **Libraries:** `multer`, `marked.js`, `highlight.js`, `DOMPurify`

## Setup and Installation

Follow these steps to get the project running locally.

1.  **Clone the repository:**

    ```bash
    git clone <repository-url>
    cd simple-web-based-chatbot
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Create an environment file:**
    Create a file named `.env` in the root of the project and add your Google Gemini API key:

    ```env
    GEMINI_API_KEY="YOUR_API_KEY_HERE"
    GEMINI_MODEL="gemini-1.5-flash"
    ```

    You can get a free API key from Google AI Studio.

4.  **Run the development server:**
    ```bash
    npm run dev
    ```

## Usage

- Once the server is running, open your browser and navigate to `http://localhost:3000`.
- Type a message, use the microphone, or attach a file to start a conversation.

## Project Structure

```
.
├── public/         # Contains all frontend assets
│   ├── index.html  # Main HTML file
│   ├── script.js   # Frontend JavaScript logic
│   └── style.css   # UI styling
├── index.js        # Main Express server file
├── package.json    # Project dependencies and scripts
└── .env            # Environment variables (API key, etc.)
```
