// src/components/LoanDetailView.jsx

import { useRef, useState } from 'react'
import { StatusBadge, ErrorBox } from './shared/Badges'
import { STATUSES, STATUS_COLORS, fmt$ } from '../lib/constants'

export default function LoanDetailView({ loan, profile, onGoExtraction, onGoIncome, uploadTaxReturn, updateLoanStatus, deleteTaxReturn }) {
  const [uploading, setUploading]   = useState(null)  // "borrowerId-year" key
  const [uploadError, setUploadError] = useState(null)
  const [deleting, setDeleting]     = useState(null)  // "taxReturnId" being deleted
  const fileInputRefs = useRef({})

  const selfEmpBorrowers = (loan.borrowers ?? []).filter(b => b.is_self_employed)

  // Find a tax return for a given borrower + year
  const getReturn = (borrower, year) =>
    (borrower.taxReturns ?? []).find(r => r.tax_year === year) ?? null

  const allUploaded = selfEmpBorrowers.every(b =>
    [2022, 2023].every(yr => getReturn(b, yr)?.storage_path)
  )

  const anyExtracted = selfEmpBorrowers.some(b =>
    (b.taxReturns ?? []).some(r => r.extraction_status === 'complete')
  )

  const allExtracted = selfEmpBorrowers.every(b =>
    (b.taxReturns ?? []).filter(r => r.storage_path).every(r => r.extraction_status === 'complete')
  )

  const handleFileSelect = async (borrowerId, year, file) => {
    if (!file || file.type !== 'application/pdf') {
      setUploadError('Please select a PDF file.')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setUploadError('File must be under 20MB.')
      return
    }

    const key = `${borrowerId}-${year}`
    setUploading(key)
    setUploadError(null)

    try {
      await uploadTaxReturn(file, loan.id, borrowerId, year, profile.id)
    } catch (err) {
      setUploadError(err.message)
    } finally {
      setUploading(null)
    }
  }

  const handleDeleteReturn = async (taxReturnId, storagePath) => {
    if (!window.confirm('Delete this tax return? This cannot be undone.')) return
    setDeleting(taxReturnId)
    setUploadError(null)
    try {
      await deleteTaxReturn(taxReturnId, storagePath, loan.id)
    } catch (err) {
      setUploadError(err.message)
      setDeleting(null)
    }
  }

  const getNextAction = () => {
    if (!anyExtracted && !allUploaded) return null
    if (allExtracted) return { label: 'View Income Calculations →', onClick: onGoIncome, color: '#3fb950' }
    if (anyExtracted) return { label: 'Review Extracted Data →', onClick: onGoExtraction, color: '#bc8cff' }
    return { label: 'Review Extracted Data →', onClick: onGoExtraction, color: '#bc8cff' }
  }

  const nextAction = getNextAction()

  return (
    <div className="fade-in" style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      {/* Loan header */}
      <div style={{
        background: '#161b22', border: '1px solid #2a3347',
        borderRadius: 8, padding: 20, marginBottom: 20,
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <span className="mono" style={{ fontSize: 18, fontWeight: 600, color: '#e8a838' }}>{loan.id}</span>
            <StatusBadge status={loan.status} size="md" />
          </div>
          <div style={{ color: '#cdd5e0', fontSize: 14, marginBottom: 4 }}>{loan.property_address}</div>
          <div style={{ display: 'flex', gap: 20 }}>
            {[
              ['Loan Amount', fmt$(loan.loan_amount)],
              ['Purpose', loan.loan_purpose],
              ['LO', loan.loan_officer_name],
            ].map(([label, val]) => (
              <span key={label} style={{ color: '#8899b0', fontSize: 12 }}>
                {label}: <span className="mono" style={{ color: '#cdd5e0' }}>{val}</span>
              </span>
            ))}
          </div>
        </div>
        {nextAction && (
          <button
            onClick={nextAction.onClick}
            style={{
              background: nextAction.color + '22', border: `1px solid ${nextAction.color}55`,
              color: nextAction.color, padding: '10px 20px', fontSize: 13,
              fontWeight: 600, borderRadius: 6, flexShrink: 0
            }}
          >
            {nextAction.label}
          </button>
        )}
      </div>

      {/* Workflow progress */}
      <div style={{ background: '#161b22', border: '1px solid #2a3347', borderRadius: 8, padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: '#556070', fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 }}>
          Workflow Progress
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {STATUSES.map((s, i) => {
            const statusIdx = STATUSES.indexOf(loan.status)
            const isComplete = i < statusIdx
            const isCurrent  = i === statusIdx
            const color = isCurrent ? STATUS_COLORS[s] : isComplete ? '#3fb950' : '#2a3347'
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: isCurrent ? color + '33' : isComplete ? '#3fb95022' : '#1c2230',
                    border: `2px solid ${color}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, color: isCurrent ? color : isComplete ? '#3fb950' : '#556070', fontWeight: 700
                  }}>
                    {isComplete ? '✓' : i + 1}
                  </div>
                  <span style={{ fontSize: 10, color: isCurrent ? color : isComplete ? '#3fb950' : '#556070', marginTop: 4, textAlign: 'center', lineHeight: 1.2 }}>
                    {s}
                  </span>
                </div>
                {i < STATUSES.length - 1 && (
                  <div style={{ height: 2, flex: 0.5, background: isComplete ? '#3fb950' : '#2a3347', marginBottom: 16 }} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {uploadError && <ErrorBox message={uploadError} />}

      {/* Borrowers */}
      <div style={{ fontSize: 13, color: '#8899b0', marginBottom: 12 }}>
        Self-Employed Borrowers ({selfEmpBorrowers.length})
      </div>

      {(loan.borrowers ?? []).map(borrower => (
        <div key={borrower.id} style={{
          background: '#161b22', border: '1px solid #2a3347',
          borderRadius: 8, padding: 20, marginBottom: 16
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#cdd5e0', marginBottom: 2 }}>{borrower.name}</div>
              <div style={{ fontSize: 12, color: '#8899b0' }}>{borrower.business_type}</div>
            </div>
            {borrower.w2_annual_income && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: '#556070' }}>W-2 Annual Income</div>
                <div className="mono" style={{ fontSize: 15, color: '#3fb950', fontWeight: 600 }}>
                  {fmt$(borrower.w2_annual_income)}
                </div>
              </div>
            )}
          </div>

          {borrower.is_self_employed ? (
            <div style={{ display: 'flex', gap: 12 }}>
              {[2022, 2023].map(year => {
                const ret = getReturn(borrower, year)
                const uploadKey = `${borrower.id}-${year}`
                const isUploading = uploading === uploadKey
                const isUploaded = !!ret?.storage_path
                const isExtracted = ret?.extraction_status === 'complete'
                const isFailed = ret?.extraction_status === 'failed'

                return (
                  <div key={year} style={{
                    flex: 1, background: '#1c2230',
                    border: '1px solid #2a3347', borderRadius: 6, padding: 14
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#e8a838' }}>Tax Year {year}</span>
                      {isExtracted && <span style={{ fontSize: 10, color: '#3fb950' }}>✓ Extracted</span>}
                      {isUploaded && !isExtracted && !isFailed && <span style={{ fontSize: 10, color: '#bc8cff' }}>Uploaded</span>}
                      {isFailed && <span style={{ fontSize: 10, color: '#f85149' }}>⚠ Extraction failed</span>}
                    </div>

                    {isUploaded ? (
                      <div>
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                          background: '#212836', borderRadius: 5, padding: '7px 10px', marginBottom: 8
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                            <span style={{ fontSize: 18 }}>📄</span>
                            <div>
                              <div style={{ fontSize: 12, color: '#cdd5e0' }}>{ret.original_filename}</div>
                              <div style={{ fontSize: 11, color: '#556070' }}>
                                {isExtracted ? 'Extraction complete' : 'Awaiting extraction'}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteReturn(ret.id, ret.storage_path)}
                            disabled={deleting === ret.id}
                            style={{
                              background: 'transparent', border: '1px solid #f85149', color: '#f85149',
                              padding: '4px 8px', fontSize: 10, borderRadius: 4, cursor: 'pointer', flexShrink: 0,
                              opacity: deleting === ret.id ? 0.5 : 1, transition: 'opacity 0.2s'
                            }}
                          >
                            {deleting === ret.id ? 'Deleting…' : isFailed ? 'Delete' : 'Delete & Re-upload'}
                          </button>
                        </div>
                        {isFailed && (
                          <div style={{ fontSize: 11, color: '#f85149', marginBottom: 8 }}>
                            {ret.extraction_error}
                          </div>
                        )}
                        {isExtracted && ret.extracted_fields && (
                          <div style={{ display: 'flex', gap: 12 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 10, color: '#556070' }}>Net Profit (Sch. C)</div>
                              <div className="mono" style={{
                                fontSize: 13, fontWeight: 600,
                                color: (ret.extracted_fields.schedC_net_profit_loss ?? 0) >= 0 ? '#3fb950' : '#f85149'
                              }}>
                                {fmt$(ret.extracted_fields.schedC_net_profit_loss)}
                              </div>
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 10, color: '#556070' }}>Depreciation</div>
                              <div className="mono" style={{ fontSize: 13, color: '#cdd5e0' }}>
                                {fmt$(ret.extracted_fields.schedC_depreciation)}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        {/* Hidden real file input */}
                        <input
                          ref={el => fileInputRefs.current[uploadKey] = el}
                          type="file"
                          accept="application/pdf"
                          style={{ display: 'none' }}
                          onChange={e => {
                            const file = e.target.files?.[0]
                            if (file) handleFileSelect(borrower.id, year, file)
                            e.target.value = '' // reset so same file can be re-selected
                          }}
                        />
                        <div style={{
                          border: '2px dashed #2a3347', borderRadius: 5,
                          padding: '20px 12px', textAlign: 'center', marginBottom: 8,
                          cursor: 'pointer'
                        }}
                          onClick={() => fileInputRefs.current[uploadKey]?.click()}
                        >
                          <div style={{ fontSize: 20, marginBottom: 6 }}>📂</div>
                          <div style={{ fontSize: 12, color: '#556070' }}>Form 1040 — {year}</div>
                          <div style={{ fontSize: 11, color: '#556070' }}>Click to browse</div>
                        </div>
                        <button
                          onClick={() => fileInputRefs.current[uploadKey]?.click()}
                          disabled={isUploading}
                          style={{
                            width: '100%',
                            background: isUploading ? '#1c2230' : '#4a90d922',
                            border: `1px solid ${isUploading ? '#2a3347' : '#4a90d9'}`,
                            color: isUploading ? '#556070' : '#4a90d9',
                            padding: '7px', fontSize: 12, borderRadius: 4
                          }}
                        >
                          {isUploading ? <span className="pulse">Uploading…</span> : 'Upload PDF'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ background: '#1c2230', borderRadius: 6, padding: 14, color: '#556070', fontSize: 12, textAlign: 'center' }}>
              W-2 co-borrower — no self-employment tax return required
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
