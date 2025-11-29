# Design: V4.1 – Card Edit & Delete

## High-Level Flow

Deck Detail Page (`/decks/[deckId]`)

- Lists all cards for that deck.
- Each card row shows:
  - Question/Stem preview
  - Type pill (MCQ / Flashcard)
  - Action area: [Edit] [Delete]

Edit Flow:

1. User clicks "Edit".
2. Navigate to `/decks/[deckId]/cards/[cardId]/edit` (or open inline form).
3. Load card data via server component or server action.
4. Render pre-filled form using existing Add Card component.
5. On submit:
   - Call `updateCard` server action.
   - On success: redirect back to deck page + toast "Card updated".

Delete Flow:

1. User clicks "Delete".
2. Show confirmation modal (client-side).
3. On confirm:
   - Call `deleteCard` server action.
   - On success: revalidate deck page (or mutate local state) + toast "Card deleted".

## Backend / Data Model

Existing `cards` table (assumed):

- `id` (uuid)
- `deck_id`
- `type` ("flashcard" | "mcq")
- For flashcards:
  - `front`, `back`, `image_url?`
- For MCQ:
  - `stem`, `options` (json), `correct_index`, `explanation?`
- Metadata: `created_at`, `updated_at`, `owner_id` / `user_id`

### New Server Actions

1. `updateCard(cardId, data)`

```ts
// src/actions/card-actions.ts
'use server';

export async function updateCard(input: UpdateCardInput): Promise<ActionResult> {
  // 1. Auth: ensure user is logged in
  // 2. Check card belongs to this user (join via deck.user_id)
  // 3. Validate payload with Zod (same schema as create)
  // 4. Update in DB
  // 5. Return success or error
}
```

2. `deleteCard(cardId: string)`

```ts
export async function deleteCard(cardId: string): Promise<ActionResult> {
  // 1. Auth + ownership check
  // 2. Delete card
  // 3. Return success or error
}
```

ActionResult simple pattern:

```ts
type ActionResult =
  | { ok: true }
  | { ok: false; error: string };
```

## Frontend Components

### 1. CardListItem

Location: `src/components/cards/CardListItem.tsx`

Responsibilities:

- Display:
  - Question/Stem (clamped to 2 lines)
  - Type pill (MCQ, Flashcard, tags like "Has image")
- On the right side:
  - Edit (outline button)
  - Delete (ghost / subtle red text button)

Example JSX:

```tsx
<div className="flex items-center justify-between rounded-xl border bg-white px-4 py-3 shadow-sm">
  <div className="flex flex-col gap-1">
    <p className="text-sm font-medium line-clamp-2">{questionPreview}</p>
    <div className="flex gap-2">
      <Badge variant="outline">{typeLabel}</Badge>
      {hasImage && <Badge variant="secondary">Has image</Badge>}
    </div>
  </div>
  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
    <Button variant="outline" size="xs" onClick={onEdit}>Edit</Button>
    <Button variant="ghost" size="xs" className="text-red-500" onClick={onDelete}>
      Delete
    </Button>
  </div>
</div>
```

### 2. Edit Card Page

Route: `src/app/(app)/decks/[deckId]/cards/[cardId]/edit/page.tsx`

Server component:

- Fetch card by cardId.
- Decide which form to render (Flashcard vs MCQ).

Client component:

- Wraps existing CardForm / CreateMCQForm with initialValues prop.
- On submit, calls updateCard.

Example:

```tsx
export default async function EditCardPage({ params }) {
  const card = await getCardById(params.cardId); // server-side
  if (!card) notFound();
  
  return (
    <EditCardForm
      card={card}
      deckId={params.deckId}
    />
  );
}
```

### 3. Delete Confirmation

Simple approach:

Client component around Delete button:

```ts
const handleDelete = async () => {
  const ok = window.confirm(
    `Delete this ${typeLabel}?\n\n"${previewText}"`
  );
  if (!ok) return;
  const res = await deleteCard(cardId);
  if (res.ok) {
    toast.success('Card deleted');
    router.refresh();
  } else {
    toast.error('Could not delete card');
  }
};
```

Later, this can be upgraded to a shadcn AlertDialog.

## Error Handling

- If `updateCard` fails:
  - Show toast: "Could not save changes. Please try again."
- If `deleteCard` fails:
  - Show toast: "Could not delete card. Please try again."

## Mobile Layout

Stack Edit/Delete horizontally under the text on small screens:

```tsx
<div className="mt-3 flex gap-2 sm:mt-0 sm:flex-col sm:items-end">
  {/* buttons */}
</div>
```

This keeps tap targets big and prevents mis-taps.
