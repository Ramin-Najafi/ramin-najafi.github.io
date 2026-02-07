# Linen PWA on GitHub Pages — Setup Guide

You're self-hosting Linen at `https://ramin-najafi.github.io/linen/`

## Folder Structure

Add this to your `ramin-najafi.github.io` repo:

```
ramin-najafi.github.io/
├── index.html (your portfolio homepage)
├── linen/
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   ├── service-worker.js
│   ├── manifest.json
│   └── favicon.svg
├── projects/
│   └── ... (your existing projects)
└── ... (other portfolio stuff)
```

## Step 1: Clone Your Repo Locally

```bash
git clone https://github.com/YOUR_USERNAME/ramin-najafi.github.io.git
cd ramin-najafi.github.io
```

## Step 2: Create the /linen/ Folder

```bash
mkdir linen
cd linen
```

## Step 3: Add Linen Files

Copy these files into the `linen/` folder:
- `index.html`
- `styles.css`
- `app.js`
- `service-worker.js` (already modified for /linen/ paths)
- `manifest.json` (already modified for /linen/ paths)
- `favicon.svg`

**All files are already pre-configured for the `/linen/` subdirectory.**

## Step 4: Add Link to Portfolio Homepage

In your main `index.html` (portfolio homepage), add a link to Linen:

```html
<!-- Add this somewhere in your portfolio, maybe in a projects section -->
<a href="/linen/">
    <h3>Linen</h3>
    <p>Personal memory app — remembers your life, understands context</p>
</a>
```

Or if you want a styled button:

```html
<div class="project">
    <h3>Linen</h3>
    <p>A personal memory app that captures moments, searches memories, and works completely offline.</p>
    <a href="/linen/" class="btn">Open Linen →</a>
</div>
```

## Step 5: Push to GitHub

```bash
# From your repo root directory
git add linen/
git commit -m "Add Linen PWA to portfolio"
git push origin main
```

## Step 6: Verify It Works

1. Go to `https://ramin-najafi.github.io/linen/`
2. You should see the Linen app load
3. Try capturing a memory
4. Check that it saves in IndexedDB

## Step 7: Test PWA Installation

### On Mobile:
1. Open `https://ramin-najafi.github.io/linen/` on your phone
2. Tap browser menu (⋯) 
3. Tap "Add to Home Screen" (Android) or "Add to Home Screen" (iOS)
4. Name it "Linen" and add it
5. Launch from home screen — should work like a native app

### On Desktop:
1. Open the page in Chrome
2. Click address bar icon → "Install Linen"
3. Or right-click → "Install app"

## Step 8: Verify Service Worker

Check that offline mode works:

1. Open DevTools (F12)
2. Go to Application → Service Workers
3. You should see a registered Service Worker at `/linen/`
4. Toggle "Offline" in DevTools
5. Refresh page — should still work
6. Try using the app offline (capture, search, etc.)

## Troubleshooting

**App won't install/PWA prompt doesn't appear:**
- Make sure you're on HTTPS (GitHub Pages is automatic)
- Check DevTools → Application → Manifest for errors
- Try a different browser (Chrome/Edge best for PWA)

**Service Worker not working:**
- Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- Check DevTools → Application → Cache Storage
- Look for "linen-v1" cache

**Data not saving:**
- Check DevTools → Application → IndexedDB
- You should see "linen-db" database
- Try different browser if stuck

**App won't load at all:**
- Check DevTools → Console for errors
- Verify all files are in `/linen/` folder
- Check that paths in service-worker.js are correct

## File Modifications Already Done

These files are **pre-configured** for `/linen/`:

✅ `service-worker.js` — Updated to use `/linen/` paths
✅ `manifest.json` — Set scope and start_url to `/linen/`
✅ `app.js` — No changes needed (uses relative paths)
✅ `index.html` — No changes needed (uses relative paths)
✅ `styles.css` — No changes needed (uses relative paths)

You don't need to modify anything — just copy and push.

## Optional: Add a Back Link

In your Linen app, you might want to add a back link to your portfolio. Edit `linen/index.html` sidebar:

```html
<div class="sidebar-footer">
    <a href="/" class="back-link">← Back to Portfolio</a>
    <div class="memory-count">
        <span class="count-label">Memories</span>
        <span class="count-number" id="memory-count">0</span>
    </div>
</div>
```

Then add this to `linen/styles.css`:

```css
.back-link {
    display: block;
    padding: var(--spacing-md);
    color: var(--color-text-secondary);
    text-decoration: none;
    font-size: 0.9rem;
    margin-bottom: var(--spacing-md);
    text-align: center;
    transition: color var(--transition-base);
}

.back-link:hover {
    color: var(--color-accent);
}
```

## Performance Notes

- App loads from cache (after first visit) — very fast
- Service Worker caches only `/linen/` requests — doesn't interfere with portfolio
- IndexedDB stores all memories locally — no server calls
- Works completely offline after first load

## Next Steps

1. Push to GitHub ✓
2. Test on mobile ✓
3. Add to home screen ✓
4. Use it for a week and gather feedback
5. Based on feedback, add features (voice notes, AI insights, etc.)

---

**Questions?**
- Check the README.md for general features and info
- Check DEPLOYMENT.md for other hosting options
- Troubleshooting section above covers PWA issues

Good luck! Your Linen app is live at `https://ramin-najafi.github.io/linen/` 🎉
