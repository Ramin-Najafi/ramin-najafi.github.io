# Ramin Najafi - Portfolio

A clean, single-page portfolio website showcasing my journey as an aspiring developer.

## About

This is my personal portfolio, a dynamic showcase of my journey as an aspiring full-stack developer. It documents my learning progress and highlights my evolving skills in web development, currently focusing on a Web and Development Fundamentals program.

## Features

- Single-page design with smooth scrolling navigation
- Responsive hamburger menu for all screen sizes (refined for tighter layout)
- Integrated Linen PWA (Progressive Web Application) for a native-like experience
- Sections: Home, About, Skills, Projects, Contact
- Clean, minimal design with dark theme
- Mobile-first approach

## Tech Stack

**Portfolio:**
- HTML5
- CSS3 (with CSS Grid and Flexbox)
- Vanilla JavaScript
- jQuery
- Google Fonts (Merienda)

**Linen PWA:**
- Vanilla JavaScript (ES6+)
- HTML5 (Semantic markup)
- CSS3 (with animations and gradients)
- IndexedDB (Browser storage)
- Service Workers (Offline functionality)
- Google Gemini API (Optional - for AI conversations)
- Formspree (Analytics)

## Sections

- **Home** - Introduction and overview
- **About** - Background and experience
- **Skills** - Technical competencies and current learning
- **Projects** - Featured work, including the Linen PWA and E-Commerce platform
- **Contact** - Get in touch form and social links

## Featured Projects

### Linen PWA - Personal AI Memory Assistant

A privacy-first Progressive Web Application that combines conversational AI with intelligent memory management. Linen learns about your life, remembers important details, and engages in natural, emotionally-aware conversations.

#### Key Features

**Dual-Mode Operation:**
- **Gemini Mode**: Uses Google's Gemini API for intelligent conversations with memory persistence
- **Local Mode**: Works entirely offline with a sophisticated rule-based conversational system

**Intelligent Conversation:**
- Detects user emotions (positive, anxious, distressed) and responds appropriately
- References past memories naturally in conversations
- Handles complex conversational patterns (gratitude, frustration, references to previous messages)
- Celebrates positive moments with genuine acknowledgment
- Provides emotional support when detecting distress

**Memory System:**
- Intelligently identifies and saves meaningful information from conversations
- Tags memories with relevant keywords
- Stores emotional context for each memory
- Search and filter memories by keyword, date, and tags
- Quick capture feature for quick thoughts and notes

**Privacy & Local Storage:**
- All data stored locally using IndexedDB (no cloud sync)
- Optional API key for enhanced AI features
- Service worker for offline functionality
- Export/import conversation data
- Clear data option for complete privacy control

**Progressive Web App:**
- Installable on mobile and desktop
- Works offline seamlessly
- Typing indicators and natural UI feedback
- Responsive design optimized for mobile-first experience
- Toast notifications for user feedback

#### Technical Architecture

**Frontend:**
- Vanilla JavaScript with class-based design
- IndexedDB for persistent local storage
- Service Worker for offline support
- No external dependencies (pure HTML/CSS/JS)

**AI Integration:**
- Gemini 2.5-Flash and Gemini 2.0-Flash-Lite models
- Automatic fallback to local mode on API errors
- Rate-limit handling with graceful degradation
- System prompts for personalized, memory-aware conversations

**Local Assistant:**
- Intent detection (greetings, questions, mood, topics, references)
- Mood classification (positive, anxious, distressed, neutral)
- 10+ response categories with contextual replies
- Session memory for conversation continuity
- No API calls required

#### Conversation Examples

**Positive Sentiment Recognition:**
```
User: "I'm doing what I love for the first time in my life!"
Linen: "That's awesome! I'm genuinely happy for you."
```

**Simple Status Handling:**
```
User: "im good"
Linen: "I hear you."
```

**Emotional Support:**
```
User: "I'm really stressed about this deadline"
Linen: "That sounds stressful. What's weighing on you the most?"
```

#### Trial Mode

Users can try Linen without an API key using the LocalAssistant with a 3-exchange limit before prompting for API key setup.

### ShopAll - E-Commerce Platform

A comprehensive tech product e-commerce site featuring 35+ products across 7 categories with full shopping cart functionality, wishlist system, and persistent local storage.

## Getting Started

### Quick Start
1. Clone the repository
2. Open `index.html` in your browser
3. No build process required!

### Using Linen

**Option 1: Try Free (Local Mode)**
- Navigate to `/linen/`
- Click "Try Free" to start in local mode
- Linen works entirely offline with intelligent responses
- Limited to 3 exchanges before prompting for API setup

**Option 2: Full Features (With API Key)**
1. Get a free Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Navigate to `/linen/`
3. Click "Add API Key" and paste your key
4. Unlock unlimited conversations and memory persistence with AI

**Features by Mode:**

| Feature | Local Mode | Gemini Mode |
|---------|-----------|------------|
| Conversations | ✅ | ✅ |
| Memories | ❌ | ✅ |
| Smart context | ❌ | ✅ |
| Works offline | ✅ | ✅ (cached) |
| No API needed | ✅ | ❌ |
| Emotion support | ✅ | ✅ |

## Project Structure

```
portfolio/
├── index.html                          # Main portfolio page
├── css/
│   └── style.css                       # Portfolio styling
├── js/
│   └── app.js                          # Portfolio functionality
├── assets/
│   └── images/
│       ├── logo.png
│       └── headerBkg.jpg
├── linen/                              # Linen PWA - Personal AI Assistant
│   ├── index.html                      # Linen interface
│   ├── app.js                          # Main app logic (LinenDB, GeminiAssistant, LocalAssistant, Linen classes)
│   ├── service-worker.js               # Offline support & caching
│   ├── manifest.json                   # PWA metadata & install config
│   └── styles.css                      # Linen UI styling
├── shopall/                            # E-Commerce platform
│   ├── index.html
│   ├── js/
│   │   └── app.js
│   └── styles/
│       └── style.css
└── README.md
```

## Linen Architecture

### Core Classes

**LinenDB**
- IndexedDB wrapper for memory, conversation, and settings storage
- Methods: addMemory, getAllMemories, deleteMemory, updateMemory
- Methods: addConversation, getConversations, clearConversations
- Methods: getSetting, setSetting, exportData, archiveSession

**GeminiAssistant**
- Interfaces with Google's Gemini API
- Builds memory and conversation context
- Handles API key validation and fallback models
- Detects crisis situations
- Filters inappropriate emoji responses for distressed users

**LocalAssistant**
- Rule-based conversational engine (no API calls)
- Intent detection: greetings, questions, moods, topics, references
- 10+ response categories with contextual variations
- Mood tracking and response rotation to avoid repetition
- Works entirely offline

**Linen** (Main Application Class)
- Orchestrates all components
- Manages UI state and modal interactions
- Handles mode switching (Gemini ↔ Local)
- Memory and conversation management
- Analytics tracking
- PWA installation detection

## Development Notes

### Recent Improvements (Local Assistant)

- **Positive Mood Priority**: Celebrates positive statements instead of problem-solving
- **Improved Mood Detection**: Recognizes nuanced expressions like "doing what i love" and "never been happier"
- **Better Short Message Handling**: Simple status responses ("im good", "going alright", "yep") treated as valid engagement, not confusion
- **Context Awareness**: Detects when users reference previous messages and responds appropriately
- **Frustration Detection**: Recognizes user frustration and responds with validation

### Future Enhancements

- [ ] Memory editing functionality
- [ ] Conversation history export to PDF
- [ ] Multi-device sync (optional cloud backup)
- [ ] Custom system prompts for different assistant personalities
- [ ] Integration with calendar events for memory context
- [ ] Voice input/output support

## Contact

- **Email**: rnajafi.dev@gmail.com
- **GitHub**: [github.com/ramin-najafi](https://github.com/ramin-najafi)
- **LinkedIn**: [linkedin.com/in/ramin-najafi-689110390](https://www.linkedin.com/in/ramin-najafi-689110390/)

## License

© 2025-2026 Ramin Najafi. All Rights Reserved.
See LICENSE file for details.

---

Built with ❤️ and code | Linen - Your AI Memory Companion