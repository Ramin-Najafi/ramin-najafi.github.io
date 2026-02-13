# Linen — Your Personal AI Memory Assistant

**A privacy-first Progressive Web App that combines conversational AI with intelligent memory management.**

> *What if your personal assistant never forgot a detail about your life, understood your emotions, and worked completely offline?*

---

## 🎯 What is Linen?

Linen is a sophisticated web application designed to be your digital companion. It learns from your conversations, remembers what matters to you, and provides thoughtful responses when you need them most.

Unlike traditional note-taking apps or journaling tools, Linen is **interactive**. It engages in real conversations, understands context, and helps you work through problems while preserving your memories.

**And the best part?** Everything stays on your device. Your memories never leave your computer or phone.

---

## ✨ Core Features

### 💬 **Conversational AI**
- Talk to Linen like you'd talk to a real companion
- Get thoughtful, contextual responses
- Switch between AI-powered mode (with your API key) or local mode (no API needed)
- Emotional support when you're stressed or celebrating when you're happy

### 🧠 **Intelligent Memory System**
- Linen learns important details from your conversations automatically
- Tag memories for easy searching
- Find memories by keyword, date, or tags
- See emotional context for each memory
- Build a personal knowledge base of your life

### 🗓️ **Calendar & Reminders**
- Create calendar events from natural language
- Set reminders for important dates
- Linen helps you stay organized without friction

### 👤 **Personal Profile**
- Customize your experience with your name, pronouns, timezone
- Automatic birthday greetings
- Personalized responses that feel genuine

### 🔐 **Privacy First**
- All data stored locally (IndexedDB)
- Optional API key integration (you control which AI provider)
- Works completely offline
- No tracking, no ads, no hidden data collection
- Export or delete your data anytime

### 📱 **Progressive Web App**
- Install on your phone, tablet, or desktop
- Feels like a native app
- Works offline seamlessly
- Fast, responsive, beautiful UI

---

## 🚀 Getting Started

### **Try it Right Now**
Visit [https://ramin-najafi.github.io/linen/](https://ramin-najafi.github.io/linen/) and click **Get Started**

You can:
- Chat with Linen using the built-in Local Assistant (no sign-up, no API key needed)
- Create memories and organize your thoughts
- Set up calendar events and reminders
- Explore all features offline

### **Unlock Full Power (Optional)**
Want unlimited conversations and AI-powered responses?

1. Get a free API key from one of these AI providers:
   - **Google Gemini** (free tier available): [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
   - **OpenAI ChatGPT** (paid, but very capable): [platform.openai.com/api/keys](https://platform.openai.com/api/keys)
   - **Anthropic Claude** (powerful and thoughtful): [platform.claude.com](https://platform.claude.com)
   - **DeepSeek** (fast and affordable): [platform.deepseek.com](https://platform.deepseek.com)

2. In Linen, go to **Settings → Add New Agent**
3. Select your provider and paste your API key
4. Start chatting with unlimited conversations

**That's it.** No sign-up, no account creation, no surveillance.

---

## 🛠️ Tech Stack

**Frontend:**
- Pure Vanilla JavaScript (ES6+) — no frameworks
- HTML5 & CSS3 with modern features
- Responsive design (mobile-first)

**Storage & Offline:**
- IndexedDB for persistent local storage
- Service Workers for offline functionality
- Automatic caching strategies

**AI Integration:**
- Support for multiple AI providers (Gemini, ChatGPT, Claude, DeepSeek)
- Automatic fallback to local assistant if API fails
- Graceful error handling

**Deployment:**
- GitHub Pages
- Zero server backend needed
- Instant updates, no build pipeline

---

## 💡 Why Linen is Different

| Feature | Linen | Google Keep | Notion | ChatGPT |
|---------|-------|-------------|--------|---------|
| **Conversational** | ✅ Interactive AI | ❌ Text only | ✅ Database | ✅ Chat only |
| **Memory System** | ✅ Intelligent tagging | ✅ Notes | ✅ Pages | ❌ No persistence |
| **Offline** | ✅ Full offline | ✅ Limited | ❌ Cloud only | ❌ Cloud only |
| **Private** | ✅ 100% local | ⚠️ Google cloud | ⚠️ Cloud | ⚠️ Cloud |
| **Calendar/Reminders** | ✅ Yes | ❌ No | ✅ Advanced | ❌ No |
| **Multi-provider AI** | ✅ Yes | ❌ Google only | ✅ Paid plugins | ❌ OpenAI only |
| **Free** | ✅ 100% free | ✅ Free | ⚠️ Freemium | ⚠️ Freemium |

---

## 🎓 For Developers: Why This Project is Cool

If you're a developer reading this, here's what makes Linen interesting from a technical perspective:

### **Pure Vanilla JavaScript**
- 2,000+ lines of well-organized, modular code
- No React, Vue, Angular, or any framework
- Shows you CAN build sophisticated apps with just HTML/CSS/JS
- Great reference for vanilla JS best practices

### **Advanced JavaScript Patterns**
- Class-based architecture with multiple specialized classes
- Event-driven design patterns
- Async/await for API integration
- IndexedDB abstraction layer

### **Service Worker & Offline-First Design**
- Complete offline functionality
- Smart caching strategies
- Automatic fallback when API fails
- Service worker synchronization

### **Progressive Web App**
- Installable on any device
- Native-like UI without native code
- Web manifest configuration
- App icons and splash screens

### **AI Integration**
- Multi-provider support (swap AI providers easily)
- Prompt engineering examples
- API key validation and error handling
- Local fallback when API is unavailable

### **IndexedDB in Production**
- Real-world database abstraction
- Transaction handling
- Data export/import functionality
- Backup and restore mechanisms

### **Responsive Design Without Frameworks**
- CSS Grid and Flexbox mastery
- Mobile-first design
- Touch-friendly UI
- Accessibility considerations (WCAG)

---

## 🔍 How Linen Works

### **Three Core Systems:**

**1. Conversation Engine**
- Local Assistant: Rule-based responses (works offline)
- AI Assistant: API-powered intelligent responses
- Automatic switching based on availability
- Memory-aware context injection

**2. Memory System**
- Auto-detects important information from conversations
- Tags and categorizes memories
- Stores emotional context
- Enables natural reference to past conversations

**3. Storage Layer**
- IndexedDB for structured data
- localStorage for settings
- Service Worker caching
- Data persistence across browser sessions

---

## 📊 App Architecture

```
Linen/
├── index.html           # UI structure
├── styles.css           # Responsive design
├── app.js               # Main application (2000+ lines)
│   ├── Linen class      # App orchestrator
│   ├── Database class   # IndexedDB wrapper
│   ├── AIAssistant      # API integration
│   ├── LocalAssistant   # Offline responses
│   ├── ProfileManager   # User preferences
│   └── [More modules]
├── service-worker.js    # Offline & caching
└── manifest.json        # PWA configuration
```

---

## 🎯 Real Use Cases

**Students:**
- Remember key concepts from learning sessions
- Have a study buddy that quizzes you on past material
- Keep a structured learning journal

**Professionals:**
- Capture meeting notes conversationally
- Build a personal knowledge base
- Get reminders for follow-ups

**Mental Health & Wellness:**
- Journal and reflect with AI support
- Track mood patterns over time
- Get gentle encouragement when you're struggling

**Creatives:**
- Brainstorm ideas with an engaged listener
- Keep an inspiration log
- Review past creative work for patterns

**Anyone Curious:**
- Explore what a modern web app can do
- Learn how AI integrates with web apps
- See PWA technology in action

---

## 🌟 What Makes Linen Stand Out

✅ **Zero cost** — Completely free, no ads, no tracking
✅ **Works offline** — Full functionality without internet
✅ **Your data is yours** — Everything stays on your device
✅ **Beautiful design** — Thoughtful, minimal UI
✅ **Easy to use** — Intuitive without a learning curve
✅ **Production-ready code** — Well-structured, maintainable JavaScript
✅ **Innovative** — Combines multiple technologies in a useful way
✅ **Accessible** — Designed for everyone

---

## 🚀 Try It Now

**Visit:** [https://ramin-najafi.github.io/linen/](https://ramin-najafi.github.io/linen/)

1. Click **Get Started**
2. Say hello to Linen
3. Try creating a memory
4. Explore the settings

No sign-up. No email. No tracking. Just open the app and start.

---

## 💬 Questions?

**How private is it really?**
Everything stored locally on your device. No data sent anywhere unless you add an API key (which you control).

**What if I don't have an API key?**
No problem! The Local Assistant works completely offline. You won't have memory persistence, but you get core functionality.

**Can I use multiple AI providers?**
Yes! Add as many API keys as you want and switch between them anytime.

**Will my data transfer between devices?**
Currently, no. Data is device-specific. (Future enhancement: optional encrypted cloud sync)

**Is the code open source?**
The app is deployed at [https://github.com/ramin-najafi/ramin-najafi.github.io](https://github.com/ramin-najafi/ramin-najafi.github.io). Feel free to fork, learn, and build on it.

---

## 📚 Learn More

- **GitHub Repository:** [github.com/ramin-najafi](https://github.com/ramin-najafi)
- **Email:** rnajafi.dev@gmail.com
- **Portfolio:** [ramin-najafi.github.io](https://ramin-najafi.github.io/)

---

## 🎉 Built with Passion

Linen is a labor of love, built to explore what's possible with modern web technologies. It's not trying to replace specialized tools, but to be that one app you actually want to use every day.

**Start chatting. Start remembering. Start living better.**

---

**Version 1.2.0 [beta]** | © 2026 Ramin Najafi
