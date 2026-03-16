## TV Focus Graph – Guidelines

This project treats **focus as an explicit graph**, not as a by‑product of layout.  
Use these rules whenever you build or extend TV UI.

---

### 1. Model focus as nodes and edges

- **Nodes**: every focusable element (Sidebar item, Search, Category header, Category filter, Category list item, Channel row, Player buttons, Fullscreen overlay, etc.).
- **Edges**: explicit focus transitions via `nextFocusUp/Down/Left/Right`, or self‑loops.
- **Heuristic navigation (geometry)** should be a fallback only. For important paths, always wire `nextFocus*`.

---

### 2. Define anchors per screen and column

For each screen, define:

- **Screen entry node**  
  - The element that should get focus when entering the screen (e.g. Search input or first list row).
- **Column anchors**  
  - Sidebar anchor: active nav item.  
  - Content anchor: first focusable in the main content (e.g. first channel row).  
  - Player anchor: first player control (e.g. Play button).
- **Exit / back paths**  
  - Where focus goes when leaving the screen (e.g. back to Sidebar).

Use these anchors with `nextFocus*` so horizontal moves (`←`/`→`) are deterministic:

- Sidebar item `nextFocusRight` → screen entry anchor.
- List row `nextFocusRight` → player anchor.

---

### 3. Keep clusters internally stable

A **cluster** is a small group of related controls (e.g. the three player buttons, or the category picker).

Rules:

- Inside a cluster, vertical navigation should **never leak** into other columns accidentally.
- Use **self‑loops** for `nextFocusUp` / `nextFocusDown` where appropriate:
  - Player controls in split‑screen: `nextFocusUp/Down` on each button → itself.
  - Fullscreen overlay catcher: all `nextFocus*` point to the overlay itself.
- Horizontal navigation (`←`/`→`) is what moves between clusters (e.g. list ↔ player, sidebar ↔ content).

---

### 4. Avoid focus leaks in modal / overlay states

When a UI behaves like a **modal** (Fullscreen player, overlay menus, expanded pickers):

- Only **one cluster** should be focusable.
- All `nextFocus*` from inside the modal must either:
  - Stay inside (self‑loops or intra‑cluster navigation), or
  - Exit the modal in a **single, intentional direction** (e.g. Back button).
- Do **not** change JSX order for visibility toggles. Use:
  - `opacity`
  - `pointerEvents`
  - `zIndex`
to show/hide overlays or controls without reordering siblings.

Example implemented here:

- Fullscreen player always renders in order:  
  `overlay → controlsBar → <Video> → errorOverlay`.  
  Only opacity and pointer events change when controls hide/show.

---

### 5. Make transitions explicit instead of heuristic

Whenever the “obvious” next element matters to the user:

- **Do not rely** on geometric heuristics alone.
- Set the edges explicitly:
  - Channel row `nextFocusRight` → player anchor.
  - Categories header `nextFocusDown` → category filter input.
  - First category list row `nextFocusUp` → category filter input (so `↑` returns to filter).

If a jump feels wrong in manual testing, fix it by changing the **graph** (edges), not the layout.

---

### 6. Deterministic behavior after state changes

Whenever a state change could reorder / remount views:

- Keep render order **stable**; prefer toggling visibility and pointer events.
- After toggling important state (Fullscreen, controlsVisible, expanded pickers), ensure:
  - Focus moves to a **valid node** (e.g. play button or overlay catcher).
  - New nodes are wired into the graph before they can receive focus (via `findNodeHandle` and `nextFocus*` updates).

Examples already used:

- Fullscreen controls use a visibility hook that re‑focuses either:
  - Play button (when controls are visible), or
  - Overlay catcher (when controls are hidden).
- Category picker resets invalid `selectedCategoryId` to `All` after provider resync so focus never targets a dead category.

---

### 7. Category picker / filters – specific rules

For all category pickers:

- Category navigation must be **independent** from channel search:
  - Category list is filtered only by the category filter input, not by the main search query.
- Flow:
  1. `Categories` header `nextFocusDown` → category filter input.
  2. Filter input `↓` goes into the category list (heuristic is ok here).
  3. Selecting a category:
     - Updates `selectedCategoryId`.
     - Closes the picker (`categoriesExpanded = false`).
- When providers / categories are refreshed:
  - If `selectedCategoryId` no longer exists, reset it to **All** to avoid stale focus.

---

### 8. Testing checklist for new TV components

For any new screen / component:

1. **Entry focus**
   - Is the initial focused element clear and intentional?
2. **Column anchors**
   - Can you move deterministically: Sidebar → main content → player?
3. **Vertical stability**
   - Can `↑/↓` from clusters unexpectedly jump into other columns?  
     - If yes, add self‑loops or explicit edges.
4. **Modals / overlays**
   - When open, can focus escape into background content?  
     - If yes, add an overlay catcher and self‑loops.
5. **Search / filters**
   - Are filter and search inputs reachable with a clear D‑Pad path?
6. **State changes**
   - After fullscreen / picker / overlay toggles, does focus always land on a valid node?

