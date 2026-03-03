// src/hooks/useLoans.js
//
// Fetches the full loan pipeline with borrowers, tax returns, and overrides.
// Also exposes mutation functions for upload, extraction, and overrides.

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { extractFrom1040 } from '../lib/pdfExtraction'

export function useLoans() {
  const [loans, setLoans]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  const fetchLoans = useCallback(async () => {
    setLoading(true)
    setError(null)

    // Fetch loans with nested borrowers, tax returns, and overrides in one query.
    // Supabase supports nested selects via foreign key relationships.
    const { data, error } = await supabase
      .from('loans')
      .select(`
        *,
        borrowers (
          *,
          tax_returns (
            *,
            field_overrides (*)
          )
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // Reshape: attach overrides directly to each tax return for easy access
    const shaped = data.map(loan => ({
      ...loan,
      borrowers: (loan.borrowers ?? []).map(b => ({
        ...b,
        taxReturns: (b.tax_returns ?? []).map(ret => ({
          ...ret,
          overrides: ret.field_overrides ?? [],
        }))
      }))
    }))

    setLoans(shaped)
    setLoading(false)
  }, [])

  useEffect(() => { fetchLoans() }, [fetchLoans])

  // ── UPLOAD A PDF ────────────────────────────────────────────
  // 1. Upload file to Supabase Storage
  // 2. Create or update the tax_return row with storage path
  // 3. Refresh loan data

  const uploadTaxReturn = useCallback(async (file, loanId, borrowerId, taxYear, userId) => {
    const storagePath = `${loanId}/${borrowerId}/${taxYear}/${file.name}`

    // Upload to storage bucket "tax-returns"
    const { error: uploadError } = await supabase.storage
      .from('tax-returns')
      .upload(storagePath, file, { upsert: true, contentType: 'application/pdf' })

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

    // Upsert tax return row (create if doesn't exist, update if it does)
    const { error: dbError } = await supabase
      .from('tax_returns')
      .upsert({
        borrower_id:       borrowerId,
        loan_id:           loanId,
        tax_year:          taxYear,
        storage_path:      storagePath,
        original_filename: file.name,
        uploaded_at:       new Date().toISOString(),
        uploaded_by:       userId,
        extraction_status: 'pending',
      }, { onConflict: 'borrower_id,tax_year' })

    if (dbError) throw new Error(`DB update failed: ${dbError.message}`)

    // Update loan status to "Documents Uploaded" if it was "Not Started"
    await supabase
      .from('loans')
      .update({ status: 'Documents Uploaded' })
      .eq('id', loanId)
      .eq('status', 'Not Started')

    await fetchLoans()
  }, [fetchLoans])

  // ── RUN EXTRACTION ON A TAX RETURN ──────────────────────────
  // 1. Download the PDF from Supabase Storage
  // 2. Run extractFrom1040() locally in the browser
  // 3. Save extracted_fields and confidence back to the DB

  const runExtraction = useCallback(async (taxReturnId, storagePath, borrowerId, loanId, onProgress) => {
    // Mark as running
    await supabase
      .from('tax_returns')
      .update({ extraction_status: 'running' })
      .eq('id', taxReturnId)

    try {
      // Download the PDF from private storage
      const { data: fileData, error: dlError } = await supabase.storage
        .from('tax-returns')
        .download(storagePath)

      if (dlError) throw new Error(`Download failed: ${dlError.message}`)

      // Run extraction (PDF.js + regex, OCR fallback)
      const result = await extractFrom1040(fileData, onProgress)

      // Save results
      await supabase
        .from('tax_returns')
        .update({
          extracted_fields:  result.fields,
          field_confidence:  result.confidence,
          extraction_status: 'complete',
          extracted_at:      new Date().toISOString(),
        })
        .eq('id', taxReturnId)

      // Advance loan status to "Extracted" if all uploaded returns are extracted
      // (This is a simplified check — a more thorough check would query the DB)
      await supabase
        .from('loans')
        .update({ status: 'Extracted' })
        .eq('id', loanId)
        .in('status', ['Documents Uploaded'])

      await fetchLoans()
      return result

    } catch (err) {
      // Save error state so the UI can show what went wrong
      await supabase
        .from('tax_returns')
        .update({
          extraction_status: 'failed',
          extraction_error: err.message,
        })
        .eq('id', taxReturnId)

      await fetchLoans()
      throw err
    }
  }, [fetchLoans])

  // ── SAVE A FIELD OVERRIDE ────────────────────────────────────
  // Inserts a new override row (never updates — preserves full audit trail).

  const saveOverride = useCallback(async ({ taxReturnId, fieldName, originalValue, overriddenValue, userId }) => {
    const { error } = await supabase
      .from('field_overrides')
      .insert({
        tax_return_id:    taxReturnId,
        field_name:       fieldName,
        original_value:   originalValue,
        overridden_value: overriddenValue,
        overridden_by:    userId,
      })

    if (error) throw new Error(`Failed to save override: ${error.message}`)
    await fetchLoans()
  }, [fetchLoans])

  // ── UPDATE LOAN STATUS ───────────────────────────────────────

  const updateLoanStatus = useCallback(async (loanId, newStatus) => {
    const { error } = await supabase
      .from('loans')
      .update({ status: newStatus })
      .eq('id', loanId)

    if (error) throw new Error(`Status update failed: ${error.message}`)
    await fetchLoans()
  }, [fetchLoans])

  // ── SAVE INCOME CALCULATION SNAPSHOT ───────────────────────
  // Called when an underwriter finalizes the income review.

  const saveCalculations = useCallback(async (loanId, borrowerCalcs, userId) => {
    // borrowerCalcs: array of { borrowerId, agency, monthly, annual, flag, eligible, inputs, breakdown }
    const rows = borrowerCalcs.map(c => ({
      loan_id:                    loanId,
      borrower_id:                c.borrowerId,
      calculated_by:              userId,
      agency:                     c.agency,
      qualifying_monthly_income:  c.monthly,
      qualifying_annual_income:   c.annual,
      flag:                       c.flag ?? null,
      is_eligible:                c.eligible,
      calc_inputs:                c.inputs ?? null,
      calc_breakdown:             c.breakdown ?? null,
    }))

    const { error } = await supabase
      .from('income_calculations')
      .insert(rows)

    if (error) throw new Error(`Failed to save calculations: ${error.message}`)
  }, [])

  // ── DELETE A TAX RETURN ────────────────────────────────────────────
  // Removes the tax return record and its file from storage.
  // Useful when a file upload fails or needs to be replaced.

  const deleteTaxReturn = useCallback(async (taxReturnId, storagePath, loanId) => {
    // Delete file from storage
    const { error: storageError } = await supabase.storage
      .from('tax-returns')
      .remove([storagePath])

    // Don't fail if file doesn't exist; proceed to delete the record
    if (storageError && !storageError.message.includes('not found')) {
      throw new Error(`Storage deletion failed: ${storageError.message}`)
    }

    // Delete the tax return record (cascades will delete overrides)
    const { error: dbError } = await supabase
      .from('tax_returns')
      .delete()
      .eq('id', taxReturnId)

    if (dbError) throw new Error(`Record deletion failed: ${dbError.message}`)

    // Check remaining tax returns for this loan to determine new status
    const { data: remaining } = await supabase
      .from('tax_returns')
      .select('extraction_status')
      .eq('loan_id', loanId)

    let newStatus = 'Not Started'
    if (remaining && remaining.length > 0) {
      const hasExtracted = remaining.some(r => r.extraction_status === 'complete')
      newStatus = hasExtracted ? 'Extracted' : 'Documents Uploaded'
    }

    // Update loan status to reflect the deletion
    await supabase
      .from('loans')
      .update({ status: newStatus })
      .eq('id', loanId)

    await fetchLoans()
  }, [fetchLoans])

  return {
    loans,
    loading,
    error,
    fetchLoans,
    uploadTaxReturn,
    runExtraction,
    saveOverride,
    updateLoanStatus,
    saveCalculations,
    deleteTaxReturn,
  }
}
