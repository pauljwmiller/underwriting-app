# Copilot Instructions — CapCenter Underwrite

**Purpose**: Self-employed income underwriting tool for loan processors. Automates PDF tax return extraction and implements multi-agency income calculation rules (Fannie Mae, Freddie Mac, FHA, VA).

---

## Architecture

### High-Level Flow
1. **LoginScreen** → Supabase email auth (role-based: underwriter, loan_officer, manager)
2. **PipelineView** → List of loans filtered by user role
3. **LoanDetailView** → Manage borrowers, upload tax returns, view extracted fields
4. **ExtractionReview** → Human-in-the-loop correction of OCR/PDF extraction errors
5. **IncomeSummary** → Agency-specific income calculations and add-backs

### Data Model (See [supabase/schema.sql](supabase/schema.sql#L1))
- **loans**: Parent record; status progresses: `Not Started` → `Documents Uploaded` → `Extracted` → `In Review` → `Finalized`
- **borrowers**: One+ per loan; each has `is_self_employed` flag and optional `business_type`
- **tax_returns**: One per borrower per tax year; stores `extracted_fields` (JSONB), `extraction_status`, and raw confidence scores
- **field_overrides**: Audit trail of underwriter corrections; **never delete**, only soft-apply when merging
- **income_calculations**: Snapshot of qualifying income when finalized; preserves calculation frozen in time

### Key Components

| Component | Purpose | Key Prop | Notes |
|-----------|---------|----------|-------|
| [App.jsx](src/App.jsx) | Router + state wiring | `view`, `selectedLoanId` | Centralizes auth + data; passes functions down to children |
| [useLoans](src/hooks/useLoans.js) | Data fetcher + mutations | `loans`, `uploadTaxReturn()`, `runExtraction()` | Refetches after every mutation to ensure DB freshness |
| [useAuth](src/hooks/useAuth.js) | Supabase session + profile | `session`, `profile` | Auto-persists across page reloads |
| [pdfExtraction.js](src/lib/pdfExtraction.js) | Two-phase extraction | `extractTextFromPDF()`, `ocrPDF()` | Phase 1: text layer (PDF.js); Phase 1B: OCR fallback (Tesseract) |
| [calculations.js](src/lib/calculations.js) | Income math + add-backs | `calcAgencyIncome()`, `mergeFieldsWithOverrides()` | Implements FNMA, FHLMC, FHA, VA rulebooks |

---

## Critical Patterns & Developer Workflows

### 1. PDF Extraction Pipeline
**File**: [src/lib/pdfExtraction.js](src/lib/pdfExtraction.js#L1)

Two-phase strategy:
- **Phase 1A** (`extractTextFromPDF`): Try PDF.js on text-layer PDFs → yields excellent accuracy
- **Phase 1B** (`ocrPDF`): Fallback to Tesseract.js for scanned/image PDFs → decent on 300dpi+
- **Phase 2** (`extractFrom1040`): Map raw text to field names via regex patterns (line ~150+)

**Critical Setup**: The PDF worker file (`pdf.worker.min.js`) is in `public/`. The code references it at `/pdf.worker.min.js`. If extraction fails silently, verify the worker path is correct and the browser can fetch it.

**Example workflow** in [useLoans.js](src/hooks/useLoans.js#L100):
```javascript
const runExtraction = useCallback(async (taxReturnId, file) => {
  const { fullText } = await extractTextFromPDF(file);
  const fields = await extractFrom1040(fullText);
  // Update tax_returns.extracted_fields + extraction_status
}, [])
```

**Test PDFs**: Download IRS blank 1040 forms from https://www.irs.gov/forms-instructions (do NOT use real borrower data).

### 2. Overrides & Audit Trail
**File**: [supabase/schema.sql](supabase/schema.sql#L110)

When an underwriter corrects an extracted field:
1. Insert row into `field_overrides` table (`original_value`, `overridden_value`, `overridden_by`, `override_reason`)
2. **Never delete**; just add new rows for each correction
3. When calculating income, merge overrides **on top of** raw fields (see [calculations.js](src/lib/calculations.js#L25)):
```javascript
const merged = mergeFieldsWithOverrides(rawFields, overrides);
```

### 3. Multi-Agency Income Calculation
**File**: [src/lib/calculations.js](src/lib/calculations.js#L1)

Entry point: `calcAgencyIncome(borrower, year, agency)` where `agency ∈ {FNMA, FHLMC, FHA, VA}`

Key concepts:
- Each borrower can have multiple tax years
- Calculation merges extracted fields + overrides + agency-specific rules
- Stores result in `income_calculations` table (snapshot for audit)
- Add-backs vary by agency (e.g., depreciation, meals, auto expenses)

**Mileage rates** indexed by year (line ~18); update when IRS changes them.

### 4. Environment & Supabase Setup
**File**: [README.md](README.md#L1) (must read first)

1. Copy `.env.example` to `.env`
2. Set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (safe to expose; anon key only)
3. Run schema + seed in Supabase SQL editor
4. Create storage bucket `tax-returns` (private, 20MB limit, PDF only)
5. Enable email auth + RLS policies (schema auto-creates them)

**Storage path format**: `{loanId}/{borrowerId}/{taxYear}/{filename}`

### 5. Build & Run
```bash
npm install           # Install deps (React, Vite, pdfjs-dist, tesseract.js, @supabase/supabase-js)
npm run dev          # Vite dev server @ http://localhost:5173
npm run build        # Production bundle
npm run preview      # Preview built bundle locally
```

**Vite config** ([vite.config.js](vite.config.js)): 
- `pdfjs-dist` excluded from optimization (worker issues)
- Worker format set to `es` (for Tesseract)

---

## Project-Specific Conventions

### Field Naming
- Database: snake_case (e.g., `schedC_net_profit_loss`)
- Extracted JSONB keys: snake_case + IRS form reference (e.g., `1040_line_7`)
- Components: camelCase (React standard)

### Confidence Scoring
`tax_returns.field_confidence` is a JSONB object: `{ field_name: "high"|"medium"|"low" }`
- Used to flag low-confidence extractions for human review in ExtractionReview
- Not yet surfaced in UI; future enhancement

### Status Transitions
Loan status is **state-driven** (see [useLoans.js](src/hooks/useLoans.js#L50)):
```javascript
// Auto-advance on upload
await supabase.from('loans').update({ status: 'Documents Uploaded' })
  .eq('id', loanId).eq('status', 'Not Started')
```
Only advance if current status matches expected value (prevents race conditions).

### RLS & Multi-Tenancy
**Row Level Security** is **enabled** on all tables ([schema.sql](supabase/schema.sql#L155)).
- User role (`underwriter`, `loan_officer`, `manager`) queried via `current_user_role()` SQL function
- RLS policies **not yet implemented** in schema (TODO); currently relies on auth check in app
- When adding new tables, **always enable RLS** and define policies

---

## Integration Points

### External Dependencies
- **@supabase/supabase-js**: Authentication, CRUD, storage, real-time (if added)
- **pdfjs-dist**: Text extraction from PDFs with text layers
- **tesseract.js**: OCR fallback for scanned PDFs (~30MB; consider lazy load)
- **react**: UI framework

### Supabase Client
Single shared instance: [lib/supabase.js](src/lib/supabase.js#L1)
- Persists session across page reloads (`persistSession: true`)
- Auto-refreshes token (`autoRefreshToken: true`)
- Throws error if env vars missing

### PDF Worker Setup
**Critical**: PDF.js requires a separate worker file.
- Bundled path: `node_modules/pdfjs-dist/build/pdf.worker.min.js`
- Deploy to: `public/pdf.worker.min.js`
- Set in code: `pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'` (line ~16 in pdfExtraction.js)
- **If missing**, PDF text extraction silently fails

---

## Known TODOs & Future Work

1. **Regex Pattern Tuning**: Test extraction against 5–10 real 1040 PDFs; current patterns may miss edge cases
2. **Tesseract Lazy Load**: OCR library is 30MB; consider dynamic import to reduce initial bundle
3. **RLS Policies**: Schema has tables with RLS enabled but no policies defined; add before multi-user deployment
4. **Confidence UI**: Display extracted field confidence scores in ExtractionReview
5. **Real-Time Collab**: Add Supabase real-time subscriptions for simultaneous underwriter workflows

## Recent Fixes (as of March 2026)

### Tax Return Deletion
- **Issue**: No UI mechanism to delete or replace any uploaded tax return; stale data persisted after Supabase deletions
- **Solution**: Added `deleteTaxReturn()` function in `useLoans` hook and universal delete button in `LoanDetailView`
- **How It Works**: 
  - Every uploaded return now shows a red "Delete & Re-upload" button (simply "Delete" on failed extractions)
  - Clicking the button prompts for confirmation, then removes both the file from storage and the database record
  - After deletion the loan data is refetched and the upload UI reappears for that year
  - The extraction error message (if any) is still displayed above the delete button

### PDF Worker Path Fix
- **Issue**: `Failed to fetch dynamically imported module: /pdf.worker.min.js?import` error during extraction
- **Solution**: Updated `pdfExtraction.js` to use correct worker path `/pdf.worker.min.mjs` (matches the actual file in public folder)
- **Impact**: PDF text extraction now works reliably without manual setup

---

## References
- Fannie Mae Selling Guide: B3-3.2, B3-3.2-01
- Freddie Mac Seller/Servicer Guide: Chapter 5304, Form 91
- FHA HUD 4000.1: Single Family Housing Policy Handbook
- VA Lender's Handbook: Chapter 4
- IRS 1040 Forms: https://www.irs.gov/forms-instructions
