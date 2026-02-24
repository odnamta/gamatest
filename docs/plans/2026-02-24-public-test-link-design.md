# Public Test Link & Candidate UX Redesign

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let non-tech candidates take assessments via a simple shareable link — no login, no dashboard navigation. Clean up admin dashboard to be assessment-focused.

**Architecture:** New public route `/t/[code]` that auto-creates a Supabase user + org membership on registration, then uses the existing assessment engine. Admin dashboard decluttered to prioritize assessments over study mode.

---

## 1. Candidate Flow

**URL:** `cekatan.com/t/[code]` where `[code]` is a 6-8 char alphanumeric string.

### Step-by-step:

1. **Candidate taps link** → `/t/ABC123`
2. **Landing page shows:**
   - Org logo + name ("PT. Gama Intisamudera")
   - Assessment title ("Heavy Equipment Safety Test")
   - Metadata: question count, time limit, pass score
   - Access code input (if assessment requires one)
   - Registration form:
     - Name: **required**
     - Email: optional (required if phone is empty)
     - Phone: optional (required if email is empty)
     - Rule: at least one of email/phone must be filled
   - Confirmation popup before starting: "Pastikan data Anda benar: [Name], [Email/Phone]. Data ini tidak bisa diubah setelah tes dimulai."
   - "Mulai Tes" button
3. **Server processes registration:**
   - Creates Supabase auth user via `admin.createUser()` (service role)
   - Creates profile record (name, email, phone)
   - Adds user to org as `candidate` role in `organization_members`
   - Creates assessment session with real `user_id`
   - Returns session token (JWT or cookie) for exam access
4. **Exam page** → `/t/ABC123/exam`
   - Same question UI as existing take page
   - Timer, question navigation, flag, keyboard shortcuts
   - Basic proctoring: fullscreen + tab-switch detection (if enabled on assessment)
5. **Submit** → `/t/ABC123/results/[sessionId]`
   - Score, pass/fail, per-section breakdown
   - "Download Certificate" if passed + certification enabled
   - No dashboard link, no library — just results

### Registration validation:
- Name: 2-100 chars, trimmed
- Email: valid email format (if provided)
- Phone: Indonesian format, 10-15 digits (if provided)
- At least one of email/phone required
- Duplicate check: if email/phone already exists as org member, link to existing user (don't create duplicate)

---

## 2. Admin Sharing

### When admin publishes an assessment:
- `public_code` auto-generated (6-char alphanumeric, uppercase, unique)
- Shown in assessment detail page

### Sharing UI (assessment detail/list):
- **"Bagikan Link"** button → copies `cekatan.com/t/ABC123` to clipboard (toast: "Link disalin!")
- **"Share via WhatsApp"** button → opens `wa.me/?text=...` with pre-filled message
- **"QR Code"** button → popup with downloadable QR code (for printing / in-person use)
- **Access code** setting stays as-is (optional extra security layer)

---

## 3. Admin Results Dashboard

**Route:** `/assessments/[id]/results` (enhanced existing route)

### Summary bar:
- Total candidates
- Completed count
- Average score
- Pass rate
- Median score

### Candidate results table (sortable, searchable, filterable):

| Name | Email | Phone | Score | Status | Duration | Completed At |
|------|-------|-------|-------|--------|----------|--------------|
| Budi Santoso | — | 0812xxx | 85% | Passed | 32m | 23 Feb 16:00 |
| Siti Rahayu | siti@gis.co | — | 60% | Failed | 45m | 23 Feb 15:30 |

- Click row → drill into candidate's per-question answers
- Filter: All / Passed / Failed
- Search by name/email/phone
- **Export CSV** — full results table
- **Export PDF report** — per-candidate or per-assessment summary for HR filing

### Comparison view:
- Score distribution histogram
- Per-section/domain breakdown (e.g., IQ test: verbal vs numerical vs logical vs spatial)
- Top 5 / Bottom 5 performers cards

---

## 4. Admin Dashboard Cleanup

### Current problems:
- Onboarding wizard about creating decks shown to everyone
- "Browse Library" / "Create my own Deck" dominate the page
- Study heatmap irrelevant for assessment-focused orgs
- Candidate assessment card buried below study content

### Changes:

**Admin/Creator view — new priority order:**
1. **OrgStatsCard** (existing, keep as-is) — members, assessments, attempts, pass rate, active
2. **Recent Assessment Results** — last 10 results across all assessments with scores
3. **Active Assessments** — assessments currently accepting candidates, with share buttons
4. **Quick Actions** — Create Assessment, View Candidates, Org Analytics

**Remove from default dashboard:**
- "Welcome to Cekatan / Let's find your first study deck" hero
- "Browse Library" / "Create my own Deck" buttons
- Study heatmap (move to My Library page only)
- "98 cards missing from study queue" repair notice
- Onboarding wizard (replace with assessment-focused onboarding if no assessments exist)

**Study mode** stays accessible via "My Library" nav link — just not on the dashboard.

**Candidate member view** (logged-in org members with candidate role):
1. **My Assessments** — available tests, upcoming, completed
2. **My Results** — scores, pass/fail, certificates
3. No study mode, no library, no deck creation

---

## 5. Data Model Changes

### New column on `assessments`:
```sql
ALTER TABLE assessments ADD COLUMN public_code VARCHAR(8) UNIQUE;
CREATE INDEX idx_assessments_public_code ON assessments(public_code) WHERE public_code IS NOT NULL;
```

- Auto-generated on publish (6-char alphanumeric, uppercase)
- Null when draft/archived
- Unique across all assessments (not just within org)

### No changes to `assessment_sessions`:
- All sessions use real `user_id` (guest accounts auto-created)
- No guest_* nullable fields needed

### Profile enhancement:
- `profiles.phone` column if not already present
- Populated during public registration

---

## 6. Security

1. **Rate limiting** — Max 5 session starts per IP per hour (prevents registration spam)
2. **Session token** — Signed JWT cookie after registration, required for all exam actions
3. **Public code opacity** — Short alphanumeric string, no UUID exposure in public URLs
4. **Access code** — Still works. If set on assessment, required before session starts
5. **Service role for registration** — Public routes use service role client for user creation. RLS enforced for all subsequent exam actions via the created user's session.
6. **Basic proctoring** — Fullscreen + tab-switch detection enabled for public candidates if configured on assessment
7. **Duplicate prevention** — If email/phone matches existing org member, link to existing user instead of creating new account
8. **Input validation** — All registration fields validated server-side with Zod

---

## 7. Out of Scope (YAGNI)

- Account linking / "save your results" upsell
- Guest retake tracking (each visit = new check, matched by email/phone to existing member)
- Auto-email results to candidate
- Custom branding/themes per org
- Native mobile app
- Per-candidate invite tracking (admin shares one link, sees completions in results)
- Webcam proctoring / ID verification

---

## 8. New Routes Summary

```
Public (no auth):
  /t/[code]                          — Landing + registration
  /t/[code]/exam                     — Exam taking (session token required)
  /t/[code]/results/[sessionId]      — Results view

Enhanced existing (auth required):
  /assessments/[id]/results          — Admin results dashboard (enhanced)
  /dashboard                         — Cleaned up admin + candidate views
```

## 9. New Server Actions

```
src/actions/public-assessment-actions.ts
  - getPublicAssessment(code)                    — Fetch by public_code (no auth)
  - registerAndStartSession(code, name, email?, phone?, accessCode?)
      → Creates user, joins org, starts session, returns JWT
  - submitPublicAnswer(sessionToken, cardId, selectedIndex)
  - completePublicSession(sessionToken)
  - getPublicResults(sessionId)                  — Fetch results (session token required)
```
