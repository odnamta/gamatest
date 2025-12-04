# V10: The Native Experience (PWA)

> Transform Specialize into an installable PWA with native-like mobile gestures, offline safety, and a professional home screen icon.

---

## Feature 1: PWA Transformation (Installable) — Priority: Highest

### 1.1 Manifest & Icons
- [ ] Install `next-pwa` package
- [ ] Update `next.config.ts` to integrate `next-pwa` (disable in dev mode to avoid caching issues)
- [ ] Create `/public/manifest.json` with `name: "Specialize"`, `short_name: "Specialize"`
- [ ] Add placeholder "S" logo icons: `icon-192x192.png`, `icon-512x512.png` in `/public/`
- [ ] Add `apple-touch-icon.png` (180px) for iOS home screen
- [ ] Add meta tags to root layout:
  - `apple-mobile-web-app-capable`
  - `apple-mobile-web-app-status-bar-style`
  - `theme-color`
  - Link to manifest

### 1.2 Install Prompt
- [ ] Create `src/components/pwa/InstallBanner.tsx`
- [ ] Detect if user is on mobile web (not standalone PWA) using `display-mode: standalone` media query
- [ ] Show dismissible banner: "Add to Home Screen for the best experience"
- [ ] iOS-specific instructions: "Tap Share icon → Add to Home Screen"
- [ ] Persist dismissal in localStorage (don't nag repeatedly)

---

## Feature 2: Native Gestures (Tinder Style) — Priority: High

### 2.1 Swipe Navigation
- [ ] Install `@use-gesture/react` and `framer-motion` (if not present)
- [ ] Create `src/components/study/SwipeableCard.tsx` wrapper component
- [ ] Integrate into `GlobalStudySession` card view
- [ ] Swipe Left = "Again" (red visual feedback, card slides left)
- [ ] Swipe Right = "Good" (green visual feedback, card slides right)
- [ ] Card follows finger position during drag (spring physics)
- [ ] Threshold: ~100px drag distance to trigger action
- [ ] Fallback: Keep Again/Hard/Good/Easy buttons visible for desktop users

---

## Feature 3: Mobile Layout Polish — Priority: Medium

### 3.1 Touch Targets
- [ ] Audit study buttons: ensure `min-height: 48px` (WCAG touch target)
- [ ] Add `user-select: none` to study cards (prevent text highlight on swipe)
- [ ] Add `touch-action: pan-y` to swipeable area (allow vertical scroll, capture horizontal)
- [ ] Test on 375px viewport width

---

## Technical Notes

```ts
// next.config.ts — PWA setup (disable in dev)
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
});

module.exports = withPWA({
  // existing config
});
```

```json
// public/manifest.json
{
  "name": "Specialize",
  "short_name": "Specialize",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#000000",
  "icons": [
    { "src": "/icon-192x192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512x512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

---

## Progress

| Feature | Status |
|---------|--------|
| 1.1 Manifest & Icons | ⬜ |
| 1.2 Install Prompt | ⬜ |
| 2.1 Swipe Navigation | ⬜ |
| 3.1 Touch Targets | ⬜ |

Legend: ⬜ Not Started | 🟡 In Progress | ✅ Complete
