# Design: V4.2 – UI/UX Upgrade Pack

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Deck Detail Page                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Bulk Actions Bar (visible when selections > 0)          │   │
│  │  [Select All] [Delete Selected] [Move to...] [Export]    │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Card List                                                │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │ [☐] Card Preview | Type | [Edit] [Duplicate] [Del] │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │ [☐] Card Preview | Type | [Edit] [Duplicate] [Del] │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Feature Set A: MCQ Editor UI Overhaul

### Component: Enhanced MCQ Form

```tsx
// Layout structure
<form className="space-y-4">
  {/* Stem */}
  <div className="space-y-1">
    <label>Question Stem</label>
    <textarea className="min-h-[100px]" />
  </div>

  {/* Options with consistent spacing */}
  <div className="space-y-3">
    <label>Answer Options</label>
    {options.map((opt, i) => (
      <div key={i} className="flex items-center gap-3">
        <input type="radio" />
        <span className="w-6">{letter}.</span>
        <input type="text" className="flex-1" onKeyDown={handleKeyDown} />
        {options.length > 2 && <button onClick={() => removeOption(i)}>×</button>}
      </div>
    ))}
    {options.length < 5 && (
      <button onClick={addOption}>+ Add Option</button>
    )}
  </div>

  {/* Explanation with auto-expand */}
  <div>
    <label>Explanation</label>
    <textarea className="min-h-[80px] resize-y" />
  </div>

  {/* Desktop submit */}
  <button type="submit">Save Card</button>

  {/* Mobile floating button */}
  <div className="fixed bottom-4 right-4 sm:hidden">
    <button type="submit">Save</button>
  </div>
</form>
```

### Keyboard Shortcuts

```ts
const handleKeyDown = (e: KeyboardEvent, index: number) => {
  if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
    e.preventDefault()
    if (options.length < 5) addOption()
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault()
    submitForm()
  }
}
```

---

## Feature Set B: Duplicate Card

### Server Action

```ts
// src/actions/card-actions.ts
export async function duplicateCard(cardId: string): Promise<CardActionResult> {
  // 1. Fetch original card
  // 2. Verify ownership
  // 3. Create new card with:
  //    - New UUID
  //    - stem/front + " (copy)"
  //    - All other fields copied
  // 4. Return success/error
}
```

### UI Integration

```tsx
// CardListItem.tsx - Add Duplicate button
<button onClick={() => onDuplicate(card.id)}>
  <Copy className="w-4 h-4" />
  <span className="hidden sm:inline">Duplicate</span>
</button>
```

---

## Feature Set C: Deck Bulk Actions

### State Management

```tsx
// CardList.tsx
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

const toggleSelection = (id: string) => {
  setSelectedIds(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
}

const selectAll = () => {
  setSelectedIds(new Set(cards.map(c => c.id)))
}

const clearSelection = () => {
  setSelectedIds(new Set())
}
```

### Bulk Actions Bar Component

```tsx
// src/components/cards/BulkActionsBar.tsx
interface BulkActionsBarProps {
  selectedCount: number
  onDelete: () => void
  onMove: () => void
  onExport: () => void
  onClearSelection: () => void
}

export function BulkActionsBar({ ... }) {
  return (
    <div className="sticky top-0 z-10 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg mb-4 flex items-center justify-between">
      <span>{selectedCount} selected</span>
      <div className="flex gap-2">
        <button onClick={onDelete}>Delete Selected</button>
        <button onClick={onMove}>Move to...</button>
        <button onClick={onExport}>Export</button>
        <button onClick={onClearSelection}>Clear</button>
      </div>
    </div>
  )
}
```

### Server Actions for Bulk Operations

```ts
// src/actions/card-actions.ts
export async function bulkDeleteCards(cardIds: string[]): Promise<CardActionResult>
export async function bulkMoveCards(cardIds: string[], targetDeckId: string): Promise<CardActionResult>
```

### Export Function (Client-side)

```ts
const handleExport = () => {
  const selectedCards = cards.filter(c => selectedIds.has(c.id))
  const json = JSON.stringify(selectedCards, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${deckTitle}-export.json`
  a.click()
  URL.revokeObjectURL(url)
}
```

---

## Feature Set D: Premium UI Polish

### Design Tokens

```css
/* Consistent spacing */
--spacing-card: 16px;
--spacing-gap: 12px;

/* Shadows */
--shadow-card: 0 1px 3px rgba(0,0,0,0.1);

/* Borders */
--radius-card: 12px; /* rounded-xl */
--radius-button: 8px; /* rounded-lg */

/* Colors */
--color-primary: #2563eb; /* blue-600 */
--color-primary-hover: #1d4ed8; /* blue-700 */
--color-text: #475569; /* slate-600 */
--color-text-dark: #94a3b8; /* slate-400 for dark mode */
```

### Updated CardListItem Styles

```tsx
<div className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md transition-shadow">
  {/* Content */}
  <div className="flex gap-2">
    <button className="hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
      Edit
    </button>
    <button className="hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
      Delete
    </button>
  </div>
</div>
```

### Card List Dividers

```tsx
<div className="divide-y divide-slate-100 dark:divide-slate-700/50">
  {cards.map(card => (
    <CardListItem key={card.id} ... />
  ))}
</div>
```

---

## File Structure

```
src/
├── actions/
│   └── card-actions.ts        # Add duplicateCard, bulkDeleteCards, bulkMoveCards
├── components/
│   └── cards/
│       ├── CardList.tsx       # Add selection state, bulk actions
│       ├── CardListItem.tsx   # Add checkbox, duplicate button, polish
│       ├── BulkActionsBar.tsx # NEW: Bulk actions UI
│       ├── DeckSelector.tsx   # NEW: Dropdown for move-to-deck
│       └── EditCardForm.tsx   # MCQ UI overhaul, keyboard shortcuts
└── app/(app)/decks/[deckId]/
    └── page.tsx               # Wire up bulk actions
```
