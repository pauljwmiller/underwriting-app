# CapCenter Underwrite — Self-Employed Income Tool

Complete setup guide. Read this first.

---

## Prerequisites

- Node.js 18+ (check: `node -v`)
- A free Supabase account → https://supabase.com
- A free Vercel account (for deployment) → https://vercel.com

---

## 1. Clone / Install

```bash
npm install
```

---

## 2. Supabase Setup

### 2a. Create a project
Go to https://supabase.com → New Project. Note your project URL and anon key from
Settings → API. You'll need both.

### 2b. Run the database schema
In Supabase dashboard → SQL Editor → paste and run the contents of:
  `supabase/schema.sql`

Then optionally seed demo data:
  `supabase/seed.sql`

### 2c. Create storage bucket
In Supabase dashboard → Storage → New bucket:
- Name: `tax-returns`
- Public: OFF (private)
- File size limit: 20MB
- Allowed MIME types: application/pdf

### 2d. Enable Email Auth
In Supabase dashboard → Authentication → Providers → Email → Enable

### 2e. Set up Row Level Security
The schema.sql file creates RLS policies automatically. Verify they are
enabled by checking Authentication → Policies in the dashboard.

---

## 3. Environment Variables

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Fill in your values:
```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhb...  (anon/public key, safe to expose)
```

**NEVER** put the service_role key in a VITE_ variable. It would be exposed
in the browser bundle and gives full database access.

---

## 4. Create Your First User

For demo purposes, create users manually in Supabase:
Dashboard → Authentication → Users → Invite User

Then in the SQL editor, insert their profile with a role:
```sql
insert into user_profiles (id, full_name, role)
values ('paste-user-uuid-here', 'Maya Chen', 'underwriter');
```

Roles available: `underwriter`, `loan_officer`, `manager`

---

## 5. Run Locally

```bash
npm run dev
```

Open http://localhost:5173

---

## 6. Deploy to Vercel

```bash
npm install -g vercel
vercel
```

When prompted, add environment variables in the Vercel dashboard under
Project → Settings → Environment Variables. Use the same keys from .env.

---

## Known Limitations / What to Build Next

### OCR Quality
- The extraction works well on digitally-created PDFs (TurboTax, H&R Block output)
- Scanned/photographed documents will have lower accuracy
- Test against 5-10 real 1040s and tune regex patterns in src/lib/pdfExtraction.js
- The IRS publishes blank fillable 1040s at irs.gov for testing without real data

### Calculation Coverage
- Current engine covers the main qualifying income patterns for each agency
- Does NOT yet handle: partnership K-1 income, S-corp W-2 + distributions,
  business age < 2 years, YTD P&L requirements, rental income (Schedule E Part I)
- Add these as additional functions in src/lib/calculations.js following same pattern

### Missing Features for Production
- Email notifications when extraction completes
- PDF viewer with field highlighting
- Export to PDF summary report
- Manager approval workflow
- Integration with LOS (Encompass, BytePro, etc.)
- Full audit log UI (data is captured, just not surfaced)
