# Code Reuse Review: Dilli Wissel App Diff

**Reviewed:** Drag & drop player reordering (SetupView) + dynamic interval calculation (useMatchState)  
**Date:** 2026-03-27  
**Status:** 3 issues found, 2 medium priority, 1 low priority

---

## Issue 1: Duplicate Keeper Swap Logic (Medium Priority)

**Location:** `/src/hooks/useMatchState.js` lines 109–134  
**Pattern:** Two nearly identical `if (bench.includes(...))` blocks

### Block 1 (Current halfKeeper):
```javascript
if (bench.includes(halfKeeper)) {
  bench = bench.filter(p => p !== halfKeeper);
  field = [...field, halfKeeper];
  const canGoBench = field.filter(p => p !== halfKeeper && p !== prevHalfKeeper);
  if (canGoBench.length > field.length - F) {
    canGoBench.sort((a, b) => (projected[b] || 0) - (projected[a] || 0));
    const toLeaveCnt = field.length - F;
    const leaving = canGoBench.slice(0, toLeaveCnt);
    field = field.filter(p => !leaving.includes(p));
    bench = [...bench, ...leaving];
  }
}
```

### Block 2 (Previous halfKeeper):
```javascript
if (bench.includes(prevHalfKeeper)) {
  bench = bench.filter(p => p !== prevHalfKeeper);
  field = [...field, prevHalfKeeper];
  const canGoBench = field.filter(p => p !== halfKeeper && p !== prevHalfKeeper);
  if (field.length > F && canGoBench.length > 0) {
    canGoBench.sort((a, b) => (projected[b] || 0) - (projected[a] || 0));
    const leaving = canGoBench.slice(0, field.length - F);
    field = field.filter(p => !leaving.includes(p));
    bench = [...bench, ...leaving];
  }
}
```

### Core Logic:
1. If player is on bench, move to field
2. Always exclude current keeper + previous keeper from candidates to balance
3. Sort by play time (projected), remove highest-time players to bench to maintain field size

### Recommendation:
Extract to a helper function that handles both cases:

```javascript
function promoteKeeperAndBalance(keeper, bench, field, projected, F, excludeFromBalance) {
  if (!bench.includes(keeper)) return { bench, field };
  
  const newBench = bench.filter(p => p !== keeper);
  const newField = [...field, keeper];
  
  const canGoBench = newField.filter(p => !excludeFromBalance.includes(p));
  if (newField.length > F && canGoBench.length > 0) {
    canGoBench.sort((a, b) => (projected[b] || 0) - (projected[a] || 0));
    const toLeaveCnt = newField.length - F;
    const leaving = canGoBench.slice(0, toLeaveCnt);
    
    return {
      bench: [...newBench, ...leaving],
      field: newField.filter(p => !leaving.includes(p)),
    };
  }
  
  return { bench: newBench, field: newField };
}
```

Then call once for each keeper:
```javascript
const exclude1 = [halfKeeper, prevHalfKeeper];
({ bench, field } = promoteKeeperAndBalance(halfKeeper, bench, field, projected, F, exclude1));

const exclude2 = [halfKeeper, prevHalfKeeper];
({ bench, field } = promoteKeeperAndBalance(prevHalfKeeper, bench, field, projected, F, exclude2));
```

---

## Issue 2: Duplicate Drag & Drop Handlers (Medium Priority)

**Pattern:** Nearly identical touch-based reorder logic implemented separately in two components

### SetupView.jsx (NEW):
```javascript
const [dragIdx, setDragIdx] = useState(null);
const [dragOverIdx, setDragOverIdx] = useState(null);
const dragStartY = useRef(0);
const dragItemHeight = useRef(0);

const handleDragStart = (e, index) => {
  const itemHeight = listRef.current?.children[index]?.offsetHeight || 0;
  dragItemHeight.current = itemHeight;
  dragStartY.current = e.touches?.[0]?.clientY || e.clientY;
  setDragIdx(index);
};

const handleDragMove = (e) => {
  const currentY = e.touches?.[0]?.clientY || e.clientY;
  const offset = Math.floor((currentY - dragStartY.current) / dragItemHeight.current);
  setDragOverIdx(dragIdx + offset);
};

const handleDragEnd = () => {
  if (dragOverIdx !== null && dragIdx !== dragOverIdx) {
    const newOrder = [...substitutes];
    const [movedItem] = newOrder.splice(dragIdx, 1);
    newOrder.splice(dragOverIdx, 0, movedItem);
    setSubstitutes(newOrder);
  }
  setDragIdx(null);
  setDragOverIdx(null);
};
```

### FieldView.jsx (EXISTING):
```javascript
const handleTouchStart = useCallback((e, player) => {
  const touch = e.touches[0];
  const svg = svgRef.current;
  setDraggingPlayer(player);
  setDragStart([touch.clientX, touch.clientY]);
}, []);

const handleTouchMove = useCallback((e) => {
  if (!draggingPlayer || !dragStart) return;
  const touch = e.touches[0];
  const svg = svgRef.current;
  const point = getSvgPoint(svg, touch.clientX, touch.clientY);
  setDragOffset([point.x - dragStart[0], point.y - dragStart[1]]);
}, [draggingPlayer, dragStart]);

const handleTouchEnd = useCallback(() => {
  setDraggingPlayer(null);
  setDragStart(null);
  setDragOffset(null);
}, []);
```

### Similarities:
- Both capture initial touch/mouse position (clientX, clientY)
- Both calculate offset from starting position
- Both use ref to store geometry (dragItemHeight vs. implicit via getSvgPoint)
- Both store state during drag (dragIdx/dragOverIdx vs. dragOffset)
- Both reset state on drag end

### Differences:
- FieldView converts client → SVG coordinates (field positioning)
- SetupView calculates index offset (list reordering)

### Recommendation:
Create a custom hook `useDragReorder()` that handles common drag logic:

```javascript
// hooks/useDragReorder.js
export function useDragReorder(listLength, onReorder) {
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const dragStartY = useRef(0);
  const dragItemHeight = useRef(0);
  const listRef = useRef(null);

  const handleDragStart = useCallback((e, index) => {
    const itemHeight = listRef.current?.children[index]?.offsetHeight || 50;
    dragItemHeight.current = itemHeight;
    dragStartY.current = e.touches?.[0]?.clientY || e.clientY;
    setDragIdx(index);
  }, []);

  const handleDragMove = useCallback((e) => {
    if (dragIdx === null) return;
    const currentY = e.touches?.[0]?.clientY || e.clientY;
    const offset = Math.floor((currentY - dragStartY.current) / dragItemHeight.current);
    setDragOverIdx(Math.max(0, Math.min(dragIdx + offset, listLength - 1)));
  }, [dragIdx, listLength]);

  const handleDragEnd = useCallback(() => {
    if (dragIdx !== null && dragOverIdx !== null && dragIdx !== dragOverIdx) {
      onReorder(dragIdx, dragOverIdx);
    }
    setDragIdx(null);
    setDragOverIdx(null);
  }, [dragIdx, dragOverIdx, onReorder]);

  return { dragIdx, dragOverIdx, listRef, handleDragStart, handleDragMove, handleDragEnd };
}
```

Then in SetupView:
```javascript
const { dragIdx, dragOverIdx, listRef, handleDragStart, handleDragMove, handleDragEnd } = 
  useDragReorder(substitutes.length, (from, to) => {
    const newOrder = [...substitutes];
    const [moved] = newOrder.splice(from, 1);
    newOrder.splice(to, 0, moved);
    setSubstitutes(newOrder);
  });
```

Note: FieldView uses coordinate transformation (not list indexing), so it would keep its custom implementation or a separate `useDragOffset()` hook.

---

## Issue 3: New Interval Calculation vs. Existing Schedule Generation (Low Priority)

**Location:** `/src/hooks/useMatchState.js` lines 17–47  
**Finding:** `calculateDynamicInterval()` and `generateSubSchedule()` are **complementary, not duplicate**

### Analysis:

**calculateDynamicInterval(halfDurationMin, benchSize):**
```javascript
const roundsNeeded = Math.ceil(F / benchSize);
return halfDurationMin / (roundsNeeded + 1);
```
- Calculates **substitution interval** (minutes between swaps)
- Math: divides available time by (rounds needed + 1)

**generateSubSchedule(field, bench, interval, ...):**
- Uses the interval to generate **substitution times/order** within that interval
- Uses interval as input parameter, not calculation

### Usage Pattern (Call Site):
```javascript
const interval = calculateDynamicInterval(halfDurationMin, bench.length);
const schedule = generateSubSchedule(field, bench, interval, ...);
```

### Verdict:
✓ Not duplicative. The two functions serve different purposes:
1. Calculate optimal interval given field/bench size
2. Generate substitution schedule using that interval

The combination is **well-designed and intentional**. No refactoring needed.

---

## Summary Table

| Issue | Type | File(s) | Lines | Priority | Effort | Impact |
|-------|------|---------|-------|----------|--------|--------|
| Keeper swap duplication | Logic | useMatchState.js | 109–134 | Medium | 1 helper fn + 2 calls | Maintenance, readability |
| Drag handlers duplication | UI/Logic | SetupView, FieldView | Multiple | Medium | 1 custom hook | Consistency, maintainability |
| Interval calculation | None | useMatchState.js | 17–47 | N/A | N/A | ✓ Already optimal |

---

## Recommendations (Priority Order)

1. **Extract keeper swap logic** (30 mins) — Reduces lines of code, improves clarity, centralizes balance logic
2. **Create useDragReorder hook** (45 mins) — Standardizes drag interaction, makes it reusable for future list reordering features
3. **Document interval/schedule relationship** (5 mins) — Add code comment explaining why two functions exist

**Total estimated effort:** ~1.5 hours for both refactors. Both are medium-complexity, low-risk changes.
