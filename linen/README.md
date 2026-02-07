# Linen — Progressive Web App

A personal memory app that remembers your life, understands context, and helps you think, recall, and decide.

## Features

✅ **Capture Memories** — Low-friction input with tags and emotion tracking  
✅ **Search & Recall** — Natural language search across all memories  
✅ **Offline First** — Works completely offline, all data stays on your device  
✅ **Installable** — Add to home screen, feels like a native app  
✅ **Privacy** — No tracking, no cloud, no ads  
✅ **IndexedDB Storage** — Durable local database for long-term memory  

## Tech Stack

- **HTML5** — Semantic markup
- **CSS3** — Mobile-first responsive design with CSS variables
- **Vanilla JavaScript** — No dependencies, lightweight
- **IndexedDB** — Local data persistence
- **Service Worker** — Offline functionality
- **PWA Manifest** — Installability

## Project Structure

```
linen/
├── index.html          # Main HTML structure
├── styles.css          # All styling (mobile-first responsive)
├── app.js              # Core application logic
├── service-worker.js   # Offline support & caching
├── manifest.json       # PWA metadata & icons
├── favicon.svg         # App icon
└── README.md          # This file
```

## Getting Started

### Local Development

1. **Clone or download the files:**
   ```bash
   cd linen
   ```

2. **Run a local development server:**
   ```bash
   # Using Python 3
   python -m http.server 8000

   # Or using Node.js (npx)
   npx http-server

   # Or using any other local server
   ```

3. **Open in browser:**
   ```
   http://localhost:8000
   ```

4. **Test on mobile:**
   - Use browser DevTools to simulate mobile (Ctrl+Shift+I → toggle device toolbar)
   - Or connect to your local IP from an actual phone
   - Or use ngrok/localtunnel for HTTPS access

### Installation (Mobile)

1. Open the app in your phone's browser
2. Look for "Add to Home Screen" or "Install App" prompt
3. Tap it to add Linen to your home screen
4. Launch from home screen — it's now a full app!

## Deployment

### Option 1: Netlify (Recommended — Free & Easy)

1. Push files to GitHub
2. Connect repo to Netlify
3. Build command: (leave blank)
4. Publish directory: `.` (root)
5. Deploy

Your app is now live with HTTPS (required for PWA).

### Option 2: Vercel

1. Push to GitHub
2. Import project to Vercel
3. Deploy (no config needed)

### Option 3: Self-Hosted

Use any web server that serves HTTPS:
- AWS S3 + CloudFront
- DigitalOcean App Platform
- Heroku
- Your own server

**Important:** PWA features require HTTPS (except localhost).

## How It Works

### Memory Capture

Users input memories with:
- Free-form text
- Optional tags (searchable)
- Emotion indicator
- Automatic timestamp

All stored in IndexedDB on the device.

### Memory Recall

Search features:
- Full-text search across memory text
- Tag filtering
- Date-based sorting
- Emotion filtering (future)

### Offline Functionality

Service Worker caches:
- App shell (HTML, CSS, JS)
- Manifest and assets
- Database operations work completely offline
- Data syncs automatically when online

## Data Storage

- **IndexedDB** — Unlimited storage (typically 50MB+)
- **Encryption** — Stored locally on device, not transmitted
- **Privacy** — No backend, no cloud, no tracking
- **Backups** — Users can export as JSON via Settings

## Customization

### Change Colors

Edit `styles.css`:
```css
:root {
    --color-accent: #d4a574;        /* Change this */
    --color-text-primary: #2a2a2a;
    --color-bg-primary: #fafafa;
}
```

### Change Fonts

Edit HTML `<head>`:
```html
<link href="https://fonts.googleapis.com/css2?family=YourFont" rel="stylesheet">
```

Then update in CSS:
```css
--font-display: 'YourFont', serif;
```

### Add/Remove Features

All code is vanilla JavaScript in `app.js` — easy to modify:
- Add new views/tabs (copy `capture-view` structure)
- Add new emotion types (add buttons to `.emotion-selector`)
- Customize storage structure (modify `LinenDB` class)

## Browser Support

- ✅ Modern browsers (Chrome, Firefox, Safari, Edge)
- ✅ iOS 13+ (limited PWA support, but works)
- ✅ Android 5+ (full support)
- ✅ Desktop browsers (Chrome, Firefox, Edge)

## Performance

- **First Load:** ~50-100ms (cached after first visit)
- **Interactions:** Instant (all local)
- **Storage:** IndexedDB can hold 1000s of memories
- **Offline:** Works completely without internet

## Future Enhancements

Potential additions (without changing core philosophy):

- **AI-powered insights** — Surface patterns locally (using small models)
- **Spaced repetition** — Remind users of important memories
- **Daily journal prompts** — Help users capture consistently
- **Export options** — PDF, calendar, markdown
- **Themes** — Dark mode, light mode, custom colors
- **Voice notes** — Record instead of typing
- **Sync** — Optional encrypted cloud backup
- **Sharing** — Export specific memories

## Privacy & Security

This app is built with privacy first:

- ✅ All data stored locally on device
- ✅ No backend servers or APIs
- ✅ No tracking or analytics
- ✅ No ads
- ✅ No data selling
- ✅ Users own their data completely
- ✅ Can delete all data anytime

## Troubleshooting

**Service Worker not updating:**
- Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
- Clear browser cache
- Uninstall and reinstall app

**App not saving data:**
- Check browser storage permissions
- Try different browser
- Check IndexedDB in DevTools (F12 → Application → IndexedDB)

**PWA not installing:**
- Must be served over HTTPS (localhost works)
- Check manifest.json is valid (DevTools → Application → Manifest)
- Try in Chrome or Android browser first

## License

This project is open source. Feel free to use, modify, and deploy.

## Support

For issues, improvements, or questions:
1. Check the code — it's well-commented
2. Review browser DevTools Console for errors
3. Test in different browsers

## Made with ❤️

A quiet presence. Always listening.
