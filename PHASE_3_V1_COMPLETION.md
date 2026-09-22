# Phase 3 v1: Implementation & Verification Checklist

**Date:** September 22, 2026  
**Status:** 🚀 Starting Implementation  
**Phase 2 Prerequisite:** ✅ 100% Complete (All 5 pages refactored)

---

## Phase 3 v1 Goals

1. ✅ Verify Money Game feature end-to-end
2. ✅ Verify Activity Monitoring dashboard
3. ✅ Implement accessibility improvements (WCAG AA)
4. ✅ Performance optimization (Core Web Vitals)
5. ✅ Test on real devices (iOS/Android)

---

## 1. Money Game Verification Checklist

### Feature Flag Status
- [ ] Check if `money_game_feature` flag exists in admin panel
- [ ] Enable flag globally for testing
- [ ] Verify flag appears in admin UI

### Game Flow Testing
- [ ] Navigate to "Game" tab in main app
- [ ] Tab visible when flag enabled
- [ ] Can select scenario (Cash Flow Management)
- [ ] Questions display correctly
- [ ] Can answer questions and submit
- [ ] Score calculates correctly
- [ ] Results persist on reload
- [ ] Tab hidden when flag disabled

### Database Verification
- [ ] game_sessions table has records
- [ ] game_scores table tracking points
- [ ] Timestamps accurate
- [ ] User ID linked correctly

### Status: ⬜ Pending

---

## 2. Activity Monitoring Verification Checklist

### Admin Panel Access
- [ ] Navigate to admin dashboard
- [ ] Activity Monitoring tab visible
- [ ] Graceful message shown (no business selected)
- [ ] Panel doesn't throw errors

### Future Integration
- [ ] Ready for activity_logs backend middleware
- [ ] Database tables exist
- [ ] API endpoints planned

### Status: ⬜ Pending

---

## 3. Accessibility Improvements (WCAG AA)

### Interactive Elements
- [ ] Add ARIA labels to CollapsibleSection toggle buttons
- [ ] Add ARIA labels to MobileModal close button
- [ ] Add role="region" to modal content
- [ ] Add aria-expanded to section toggles

### Keyboard Navigation
- [ ] Tab key navigates all interactive elements
- [ ] Escape key closes modals
- [ ] Enter/Space activates buttons
- [ ] Focus indicator visible on all controls

### Color & Contrast
- [ ] Lighthouse accessibility score 90+
- [ ] No color-only information
- [ ] Text contrast WCAG AA (4.5:1 normal, 3:1 large)

### Screen Reader Testing
- [ ] VoiceOver announces sections
- [ ] NVDA announces all elements
- [ ] Proper heading hierarchy
- [ ] Alt text on images

### Files to Modify
- `src/components/CollapsibleSection.tsx` - Add ARIA attributes
- `src/components/MobileModal.tsx` - Keyboard handlers, role
- `src/styles/mobile-modal.css` - Focus indicators
- All pages using components

### Status: ⬜ Pending

---

## 4. Performance Optimization

### Measurements (Before)
- [ ] Run Lighthouse audit
- [ ] Core Web Vitals:
  - LCP: _____ ms (target < 2500ms)
  - FID: _____ ms (target < 100ms)
  - CLS: _____ (target < 0.1)
- [ ] Bundle size: _____ KB (target < 500KB gzipped)

### Optimization Tasks
- [ ] Code split Money Game component (lazy load)
- [ ] Lazy load reporting pages
- [ ] Optimize images (compress)
- [ ] Minify CSS/JS
- [ ] Remove unused dependencies
- [ ] Check bundle analysis

### Measurements (After)
- [ ] LCP: _____ ms
- [ ] FID: _____ ms
- [ ] CLS: _____
- [ ] Bundle size: _____ KB

### Status: ⬜ Pending

---

## 5. Real Device Testing

### iOS Testing
**Device:** iPhone 12/13/14/15 or similar
- [ ] Download app in Safari or TestFlight
- [ ] Settings page opens properly
- [ ] Sections collapse/expand smoothly
- [ ] Swipe-down dismisses modal
- [ ] Keyboard doesn't overlap form fields
- [ ] Safe area padding works (notch visible)
- [ ] Dark mode renders correctly

### Android Testing
**Device:** Pixel 6/7/8 or Samsung S22+
- [ ] Download app (APK or Play Store beta)
- [ ] Settings page opens properly
- [ ] Sections collapse/expand smoothly
- [ ] Back gesture dismisses modal
- [ ] Keyboard handling smooth
- [ ] System navigation buttons work
- [ ] Dark mode renders correctly

### Observations to Log
- [ ] Smooth animations on devices
- [ ] No jank or stuttering
- [ ] Forms work in modals
- [ ] Images load quickly
- [ ] Accessibility works (screen reader)

### Status: ⬜ Pending

---

## Testing Results Summary

### Money Game
```
Feature Flag: _____ (working/broken)
Game Flow: _____ (working/broken)
Database: _____ (working/broken)
Overall: _____ (PASS/FAIL)
```

### Activity Monitoring
```
Panel Access: _____ (working/broken)
UI Display: _____ (working/broken)
Overall: _____ (PASS/FAIL)
```

### Accessibility
```
ARIA Labels: _____ (added/pending)
Keyboard Nav: _____ (working/broken)
Contrast: _____ (PASS/FAIL)
Screen Reader: _____ (working/broken)
Lighthouse Score: _____ (target 90+)
```

### Performance
```
LCP: _____ → _____ ms (target 2500ms)
FID: _____ → _____ ms (target 100ms)
CLS: _____ → _____ (target 0.1)
Bundle: _____ → _____ KB (target 500KB)
Overall: _____ (PASS/FAIL)
```

### Real Devices
```
iOS: _____ (working/issues)
Android: _____ (working/issues)
Overall: _____ (PASS/FAIL)
```

---

## Commit Strategy

As features are verified/implemented:

1. `Phase 3: Verify Money Game feature end-to-end`
2. `Phase 3: Verify Activity Monitoring integration`
3. `Phase 3: Implement accessibility improvements (WCAG AA)`
4. `Phase 3: Optimize performance (Core Web Vitals)`
5. `Phase 3 v1: Complete - All features verified`

---

## Success Criteria (Phase 3 v1)

**Must Have:**
- [ ] Money Game working end-to-end
- [ ] Activity Monitoring accessible
- [ ] No regressions from Phase 2
- [ ] Build clean

**Should Have:**
- [ ] Accessibility audit passed (90+ Lighthouse score)
- [ ] Performance targets met
- [ ] Real device testing on 2+ devices
- [ ] All features documented

**Nice to Have:**
- [ ] Performance improved by 20%+
- [ ] Bundle size < 500KB
- [ ] Lighthouse score 95+

---

## Next Immediate Actions

1. **Now:** Enable Money Game flag in admin, test game flow
2. **Next:** Run accessibility audit and implement fixes
3. **Then:** Performance testing and optimization
4. **Finally:** Real device testing and sign-off

---

**Status:** Ready to begin Phase 3 v1 implementation

