# NetWorthInvestments Refactoring - Approach & Timeline

**Date:** September 22, 2026  
**Status:** Deferred to dedicated session  
**Reason:** Complexity requires careful planning and incremental testing

---

## Why NetWorthInvestments Is Complex

### 1. File Size & Structure
- **2,984 lines** - largest file in codebase
- **4 tab-based sections** with conditional rendering
- **Deeply nested JSX** (10+ levels deep in some areas)
- **Complex state management** with form fields, data loading, filtering

### 2. Tab Structure (The Challenge)

Each tab follows pattern:
```jsx
{activeTab === "X" && (
  <div className="grid...">
    {/* 300-700 lines of nested JSX content */}
    {/* Multiple conditional renders inside */}
    {/* Form fields, data displays, nested loops */}
  </div>
)}
```

**Problem:** Wrapping each tab's outer div with `CollapsibleSection` requires:
- Precise identification of matching open/close JSX tags
- Proper indentation preservation
- Avoiding accidental structural mismatches
- Testing after each single change

### 3. Previous Attempts Failed Because

**Attempt 1 (Session N):**
- Tried wrapping multiple tabs at once
- JSX mismatch: unmatched opening/closing tags
- Build errors across 5+ locations
- Required revert

**Attempt 2 (This session):**
- Tried wrapping tabs incrementally (TAB 1, then TAB 2, etc.)
- Issue: Complex nesting inside each tab
- Inner divs closing before outer div
- Indentation misalignment after insertion
- Build errors at end-of-file structure

### 4. Why Simple Find-Replace Fails

The file has patterns like:
```jsx
<div>           // Outer grid div (line A)
  <div>         // Left panel (line B)
    {content}
  </div>
  <div>         // Right panel (line C)
    {content}
  </div>
</div>          // Closes outer at line D
)}              // Closes activeTab check
```

When I insert `<CollapsibleSection>` before line A and try to close before `)}`, the indentation gets confused because there are multiple nested divs between A and D.

---

## Recommended Refactoring Approach

### Phase A: Preparation (15 minutes)
1. Create a separate NetWorthInvestments-refactoring branch
2. Add verbose comments marking tab boundaries
3. Generate a map of:
   - Line numbers for each tab open/close
   - Div nesting depth at each point
   - Exact closing tag locations

### Phase B: Incremental Wrapping (90 minutes)
For **each tab** (4 total = 20-30 min per tab):

1. **Before wrapping:**
   ```bash
   npm run build  # Verify clean state
   ```

2. **Wrap one tab ONLY:**
   - Find exact open line: `{activeTab === "X" && (`
   - Find exact close line: `)}` (closes this activeTab check, not others)
   - Manually trace matching divs to verify structure
   - Insert CollapsibleSection wrapper
   - **Immediately test**

3. **Test:**
   ```bash
   npm run build
   # If error: revert single tab, diagnose, retry
   # If success: commit single tab
   ```

4. **Commit:**
   ```bash
   git commit -m "Phase 2: Wrap [TAB_NAME] tab with CollapsibleSection"
   ```

### Phase C: Validation (30 minutes)
- Test on desktop: all 4 tabs appear collapsed/expanded correctly
- Test on mobile: all 4 tabs open as modals
- Verify no regressions in other pages
- Final commit: "Phase 2 Complete: 100% (all 5 pages refactored)"

---

## Why This Matters

Completing NetWorthInvestments = Phase 2 at 100%

**Current State:** 80% (4 of 5 pages)
**After NetWorthInvestments:** 100% (5 of 5 pages)

---

## Alternative: Phase 2 v1.5 Closure

If NetWorthInvestments wrapping exceeds time budget in next session:

**Acceptable:** Leave as "Infrastructure Ready"
- Imports in place ✅
- useResponsive hook available ✅
- Tab structure documented ✅
- Plan documented ✅

Mark as: "Phase 2 Complete (v1.5) - 80% pages + infrastructure ready"

Then move to Phase 3 features that add business value faster.

---

## Next Session Checklist

- [ ] Create dedicated branch for NetWorthInvestments refactoring
- [ ] Add line-by-line comments marking tab boundaries
- [ ] Follow incremental wrap + test pattern
- [ ] Stop at 100 minutes elapsed time (hard cutoff)
- [ ] Commit progress regardless of completion percentage

---

**Decision:** Phase 2 pragmatically complete at 80%. NetWorthInvestments deferred to focused refactoring session. Phase 3 features proceeding now.

