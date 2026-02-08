# Linen PWA – Smart Personal Memory Assistant

**Linen** is a privacy-focused Progressive Web Application (PWA) designed to help you **capture, organize, and recall your personal memories** while acting as a smart, supportive companion. Linen is more than a journal—it’s a **personal assistant** that listens, remembers, helps with reminders, and provides guidance during stressful moments.

---

## Features

- **Memory Capture:** Record thoughts, events, and feelings with associated emotions and tags.  
- **Smart AI Assistant (powered by Google Gemini API):**  
  - Helps recall important details and patterns from your memories.  
  - Provides gentle support for mental health challenges (stress, anxiety, overwhelm).  
  - Offers reminders, follow-ups, and context-aware suggestions based on your past inputs.  
  - Acts as a consistent companion, remembering key details about your life.  
- **Offline-First:** Fully functional without internet, thanks to Service Workers and IndexedDB.  
- **Secure Local Data:** Everything is stored **locally on your device**—your memories never leave your device.  
- **Cross-Platform PWA:** Installable on mobile or desktop with a native-app-like experience.  
- **Intuitive UI:** Minimal and accessible design for smooth interaction.

---

## Tech Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript  
- **Storage:** IndexedDB for local persistence  
- **Offline Support:** Service Workers  
- **AI Assistant:** Google Gemini API integration  
- **Deployment:** GitHub Pages (supports `/linen/` subdirectory)

---

## Installation & Usage

1. **Access the app** via `https://ramin-najafi.github.io/linen/`.  
2. **Install as PWA:** Add to home screen or desktop for offline, native-like use.  
3. **Start capturing memories** and interact with your AI assistant for guidance and reminders.  

---

## Deployment on GitHub Pages

To deploy Linen under `/linen/` in your GitHub Pages site:

ramin-najafi.github.io/
└── linen/
├── index.html
├── styles.css
├── app.js
├── service-worker.js
├── manifest.json
└── favicon.svg

1. Commit the `/linen/` folder to your GitHub repository.  
2. Push to GitHub:
   ```bash
   git add linen/
   git commit -m "Add Linen PWA"
   git push origin main

	3.	Visit https://ramin-najafi.github.io/linen/ to verify it works.
	4.	Test PWA install and offline functionality.

⸻

Privacy & Security
	•	Local Storage Only: All data remains on your device.
	•	Anonymous AI Calls: AI assistance calls Google Gemini only if configured; no personal data is stored externally.
	•	Offline Support: You can access memories and assistant features without internet.

⸻

Contribution & Development
	•	Designed for: Personal memory assistance, mental health support, and reminders.
	•	Built with modern web standards and PWA best practices.
	•	Open to improvements: Add features, improve AI prompts, or enhance offline caching.
