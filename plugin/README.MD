# YouTube Chat Toys (YTCT) Chat Helper

**YTCT Chat Helper** is a required Chrome extension for enabling communication between **YouTube Live Chat** and the **YouTube Chat Toys (YTCT)** desktop app.

## 🚀 What It Does

This extension acts as a bridge between the YouTube Live Chat in your browser and the YTCT Electron app (if it's running). It listens to messages from the Live Chat and relays them in real-time to YTCT, allowing your main app to power interactive chat overlays, visual effects, and more.

## 🛠️ Setup & Usage

To get started, follow these steps:

1. **Install the Extension**  
   Add the YTCT Chat Helper to your Chrome browser.

2. **Open a YouTube Chat Pop-out**  
   - Go to a YouTube Live stream.
   - Click the **three-dot menu** in the chat box.
   - Select **"Pop-out chat"**.

3. **Enable YTCT Integration**  
   - In the pop-out chat window, you’ll see a new **"Enable YTCT"** button.
   - Click it to start the connection to the YTCT app.

Once enabled, the extension will begin sending chat messages to your running YTCT desktop app.

> **Note:** Make sure the YTCT desktop app is running to receive and respond to chat data.

## 💡 Why You Need This

YouTube Chat Toys relies on live interaction from chat. Without this plugin, YTCT won't be able to receive any chat messages from YouTube streams. Think of it as the glue that makes the magic happen.

## 🧠 Troubleshooting

- **Not seeing the "Enable YTCT" button?**  
  Double-check that you're in a **pop-out chat** window.

- **YTCT isn’t receiving messages?**  
  Make sure:
  - The desktop YTCT app is open and running.
  - You’ve clicked **"Enable YTCT"** in the chat window.
  - You’re using the latest version of the extension.

## 🧰 Dev Info

This extension runs in the context of YouTube's chat page, captures messages, and relays them via a local connection (e.g., WebSocket or HTTP) to the Electron-based YTCT app.
