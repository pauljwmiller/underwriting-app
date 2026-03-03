// src/lib/pdfExtraction.js
//
// Two-phase extraction:
//   Phase 1 — Get raw text from the PDF (PDF.js for text-layer PDFs,
//              Tesseract.js fallback for scanned images)
//   Phase 2 — Map raw text to 1040 field names via regex patterns
//
// TODO: Test against 5–10 real 1040 PDFs and tune the regex patterns.
// The IRS publishes blank fillable forms at:
//   https://www.irs.gov/forms-instructions (search "1040")
// These are great for testing patterns without using real borrower data.

import * as pdfjsLib from 'pdfjs-dist'

// PDF.js requires its worker to be loaded separately.
// The worker is bundled as pdf.worker.min.js in the public folder.
// This path is relative to the dev server root and works regardless of port.
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'

// ─── PHASE 1A: Extract text from a PDF with a text layer ──────────────────
// Works on: TurboTax, H&R Block, TaxAct, IRS-generated PDFs
// Quality: Excellent — exact values extracted

export async function extractTextFromPDF(file) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const pageTexts = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const content = await page.getTextContent()

    // Reconstruct text with approximate layout using x/y positions.
    // Sorting by vertical position (y) then horizontal (x) gives a
    // reading-order approximation that helps regex matching.
    const items = content.items
      .filter(item => item.str.trim().length > 0)
      .map(item => ({
        str: item.str,
        x: Math.round(item.transform[4]),
        y: Math.round(item.transform[5]),
      }))
      .sort((a, b) => b.y - a.y || a.x - b.x)

    // Reconstruct text preserving vertical structure
    // When Y position changes by >5px, insert a newline to preserve line breaks
    let lastY = null
    let pageText = ''
    for (const item of items) {
      if (lastY !== null && Math.abs(item.y - lastY) > 5) {
        pageText += '\n'
      }
      pageText += item.str + ' '
      lastY = item.y
    }
    pageTexts.push({ page: pageNum, text: pageText })
  }

  const fullText = pageTexts.map(p => `\n--- PAGE ${p.page} ---\n${p.text}`).join('\n')

  // If most pages have substantial text, this is a text-layer PDF
  // A single page with <500 chars is likely a scanned image
  const hasTextLayerPages = pageTexts.filter(p => p.text.length > 500).length >= 1
  return { fullText, pageTexts, isTextLayer: hasTextLayerPages }
}

// ─── PHASE 1B: OCR fallback for scanned PDFs ──────────────────────────────
// Works on: paper returns that were scanned and uploaded
// Quality: Decent on clean 300dpi+ scans, poor on low quality
//
// TODO: Tesseract.js is large (~30MB). Consider lazy-loading:
//   const Tesseract = await import('tesseract.js')

export async function ocrPDF(file, onProgress) {
  const { default: Tesseract } = await import('tesseract.js')

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const pageTexts = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)

    // Render page to a canvas at 2x scale for better OCR quality
    const viewport = page.getViewport({ scale: 2.0 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')
    await page.render({ canvasContext: ctx, viewport }).promise

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))

    const result = await Tesseract.recognize(blob, 'eng', {
      logger: m => {
        if (m.status === 'recognizing text' && onProgress) {
          // Progress: page 1 of N, each page takes 1/N of total
          const overall = ((pageNum - 1) / pdf.numPages) + (m.progress / pdf.numPages)
          onProgress(Math.round(overall * 100))
        }
      }
    })

    pageTexts.push({ page: pageNum, text: result.data.text })
  }

  const fullText = pageTexts.map(p => `\n--- PAGE ${p.page} ---\n${p.text}`).join('\n')
  return { fullText, pageTexts, isTextLayer: false }
}

// ─── PHASE 2: Map extracted text to 1040 field names ─────────────────────
//
// Each pattern should match the labeled value on the form.
// The capture group (group 1) must capture the dollar amount.
//
// Dollar amount format on 1040: digits only, optional commas, optional negative
// in parens like (12,345) or with a leading minus.
// The AMOUNT_RE pattern handles all these variants.
//
// TODO: These patterns are starting points. Validate against real returns.
// When a pattern fails, console.log(fullText) and look for what text actually
// surrounds the value you're targeting, then update the regex.

const AMOUNT_RE = `([\\d,]+(?:\\.\\d{2})?)`                  // positive number
const NEG_AMOUNT_RE = `(?:-|\\()${AMOUNT_RE}(?:\\))?`        // negative in parens or with minus

// Add the 'm' flag to your RegExp constructors to make $ match the end of a line
const FIELD_PATTERNS = [
  // Form 1040 main income
  ['wages_salaries',            /1a\s+Total amount from Form[\s\S]*?\s(\(?-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?\)?)\s*$/im],
  ['taxable_interest',          /2b\s+Taxable interest[\s\S]*?\s(\(?-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?\)?)\s*$/im],
  ['ordinary_dividends',        /3b\s+Ordinary dividends[\s\S]*?\s(\(?-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?\)?)\s*$/im],
  ['capital_gain_loss',         /7a\s+Capital gain or[\s\S]*?\s(\(?-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?\)?)\s*$/im],
  ['adjusted_gross_income',     /11a?\s+Adjusted gross income[\s\S]*?\s(\(?-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?\)?)\s*$/im],

  // Schedule C income (Part I)
  ['schedC_gross_receipts',     /1\s+Gross receipts or[\s\S]*?\s(\(?-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?\)?)\s*$/im],
  ['schedC_cost_of_goods',      /4\s+Cost of goods[\s\S]*?\s(\(?-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?\)?)\s*$/im],
  ['schedC_gross_profit',       /5\s+Gross profit[\s\S]*?\s(\(?-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?\)?)\s*$/im],

  // Schedule C expenses (Part II)
  ['schedC_advertising',        /8\s+Advertising[\s\S]*?\s(\(?-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?\)?)\s*$/im],
  ['schedC_car_truck_expenses', /9\s+Car and truck[\s\S]*?\s(\(?-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?\)?)\s*$/im],
  ['schedC_depreciation',       /13\s+Depreciation[\s\S]*?\s(\(?-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?\)?)\s*$/im],
  ['schedC_insurance',          /15\s+Insurance[\s\S]*?\s(\(?-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?\)?)\s*$/im],
  ['schedC_legal_professional', /17\s+Legal and professional[\s\S]*?\s(\(?-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?\)?)\s*$/im],
  ['schedC_meals',              /24b?\s+Meals[\s\S]*?\s(\(?-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?\)?)\s*$/im],
  ['schedC_taxes_licenses',     /23\s+Taxes and licenses[\s\S]*?\s(\(?-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?\)?)\s*$/im],
  ['schedC_utilities',          /25\s+Utilities[\s\S]*?\s(\(?-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?\)?)\s*$/im],
  ['schedC_wages',              /26\s+Wages[\s\S]*?\s(\(?-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?\)?)\s*$/im],
  ['schedC_business_use_home',  /30\s+Expenses for business[\s\S]*?\s(\(?-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?\)?)\s*$/im],
  ['schedC_other_expenses',     /27a?\s+Other expenses[\s\S]*?\s(\(?-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?\)?)\s*$/im],
  ['schedC_total_expenses',     /28\s+Total expenses[\s\S]*?\s(\(?-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?\)?)\s*$/im],
  
  // THE CRITICAL FIX: Matches "87,300" at the end of the line instead of "30"
  ['schedC_net_profit_loss',    /31\s+Net profit or[\s\S]*?\s(\(?-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?\)?)\s*$/im],

  // Business miles
  ['business_miles',            /44a?\s+Business miles[\s\S]*?\s(\d+)\s*$/im],
]

function parseAmount(str) {
  if (!str) return 0
  // Handle accounting notation: (123,456) or -123,456
  const isNegative = str.includes('(') || str.startsWith('-')
  // Remove all non-numeric characters except decimal point
  const numStr = str.replace(/[(),]/g, '').replace(/^-/, '')
  const num = parseFloat(numStr) || 0
  return isNegative ? -num : num
}

function isLikelyNegative(text, matchIndex) {
  // Deprecated — parseAmount now handles negatives directly
  // Kept for compatibility but shouldn't be used
  const surrounding = text.substring(Math.max(0, matchIndex - 5), matchIndex + 20)
  return surrounding.includes('(') && surrounding.includes(')')
}

function extractField(fullText, pattern) {
  // CRITICAL: Added 'm' flag so '$' matches the end of lines
  const regex = new RegExp(pattern.source, 'gim'); 
  const matches = [...fullText.matchAll(regex)];

  if (matches.length === 0) {
    return { value: 0, confidence: 'low' };
  }

  // If multiple matches exist (e.g., summary vs. form), 
  // we take the LAST one as it's usually the final calculated field.
  const bestMatch = matches[matches.length - 1];
  const val = parseAmount(bestMatch[1]);

  return { 
    value: val, 
    confidence: matches.length === 1 ? 'high' : 'medium' 
  };
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────

export async function extractFrom1040(file, onProgress) {
  // Phase 1: Get text
  let textResult
  try {
    textResult = await extractTextFromPDF(file)
  } catch (err) {
    console.error('PDF.js extraction failed, falling back to OCR:', err)
    textResult = await ocrPDF(file, onProgress)
  }

  // If text layer was mostly empty, fall back to OCR
  if (!textResult.isTextLayer) {
    console.log('No text layer detected — using OCR')
    textResult = await ocrPDF(file, onProgress)
  }

  const { fullText } = textResult

  console.log(fullText) 

  // Phase 2: Extract fields
  const fields = {}
  const confidence = {}

  for (const [fieldName, pattern] of FIELD_PATTERNS) {
    const result = extractField(fullText, pattern)
    fields[fieldName] = result.value
    confidence[fieldName] = result.confidence
  }

  // Validate computed fields — if they don't add up, lower confidence
  const computedNetProfit = fields.schedC_gross_receipts
    - fields.schedC_cost_of_goods
    - fields.schedC_total_expenses

  if (fields.schedC_net_profit_loss !== 0 &&
      Math.abs(computedNetProfit - fields.schedC_net_profit_loss) > 100) {
    // Totals don't reconcile — flag the most likely culprits
    confidence.schedC_net_profit_loss = 'medium'
    confidence.schedC_total_expenses  = 'medium'
  }

  // Count low-confidence fields for the UI
  const lowCount = Object.values(confidence).filter(c => c === 'low').length
  const overallQuality = lowCount === 0 ? 'high'
    : lowCount <= 3 ? 'medium' : 'low'

  return {
    fields,
    confidence,
    overallQuality,
    rawText: fullText,          // store for debugging / source context display
    wasOCR: !textResult.isTextLayer,
  }
}
