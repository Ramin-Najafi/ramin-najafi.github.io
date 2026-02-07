# Gemini Automation Prompt: Set Up Linen PWA on GitHub Pages

Copy and paste this entire prompt into Gemini (or Claude, or any capable LLM). It will generate a comprehensive guide and code setup for integrating Linen into your GitHub Pages portfolio site.

---

## PROMPT

I have a GitHub Pages portfolio site at `https://ramin-najafi.github.io/` built with HTML/CSS/JavaScript. I want to add the Linen PWA (a personal memory app) as a subsection at `/linen/` on the same domain.

Here are the Linen app files I have:
- index.html
- styles.css
- app.js
- service-worker.js
- manifest.json
- favicon.svg

I need you to:

1. **Modify all Linen files for the /linen/ subdirectory path:**
   - Update service-worker.js to handle the `/linen/` base path correctly
   - Update manifest.json to have correct start_url and scope for `/linen/`
   - Update app.js if any paths need adjustment
   - Ensure the Service Worker caches files from the correct location

2. **Create a folder structure guide** showing where to place files in my GitHub Pages repo:
   ```
   ramin-najafi.github.io/
   └── linen/
       ├── index.html
       ├── styles.css
       ├── app.js
       ├── service-worker.js
       ├── manifest.json
       └── favicon.svg
   ```

3. **Create a link/navigation option** I can add to my main portfolio index.html to link to the Linen app at `/linen/`

4. **Provide step-by-step instructions** to:
   - Add the files to my repo
   - Push to GitHub
   - Verify it works (including PWA installation)
   - Test the Service Worker

5. **Troubleshooting section** for common issues with PWA in subdirectories on GitHub Pages

6. **Complete modified version of each file** (service-worker.js, manifest.json, etc.) that accounts for the `/linen/` path

Key requirements:
- All data must stay local (IndexedDB)
- Service Worker must work offline
- PWA must be installable from the /linen/ page
- No breaking changes to functionality

---

## AFTER GEMINI RESPONDS:

Once Gemini gives you the files and instructions, follow them step-by-step. The key parts it will provide:
1. Modified service-worker.js with correct path handling
2. Modified manifest.json with `/linen/` scope
3. Folder structure diagram
4. Exact git commands to push to your repo
5. Testing checklist

Then come back with any issues and I can help debug.

---

**Note:** If Gemini's response is long, ask it to create separate responses for:
- Part 1: File modifications (service-worker.js, manifest.json)
- Part 2: Folder structure and git instructions
- Part 3: Navigation/portfolio integration code

This will make it easier to follow.
