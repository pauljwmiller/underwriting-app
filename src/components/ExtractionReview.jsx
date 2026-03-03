// src/components/ExtractionReview.jsx

import { useState } from 'react'
import { ConfidenceBadge, ErrorBox, Spinner } from './shared/Badges'
import { FIELD_GROUPS, FIELD_SOURCES, KEY_CALC_FIELDS, fmt$ } from '../lib/constants'

export default function ExtractionReview({ loan, profile, runExtraction, saveOverride, onComplete }) {
  const selfEmpBorrowers = (loan.borrowers ?? []).filter(b => b.is_self_employed)

  const [selectedBorrowerId, setSelectedBorrowerId] = useState(selfEmpBorrowers[0]?.id ?? null)
  const [selectedYear, setSelectedYear] = useState(2023)
  const [editingField, setEditingField]   = useState(null)
  const [editValue, setEditValue]         = useState('')
  const [showSource, setShowSource]       = useState(null)
  const [extracting, setExtracting]       = useState(false)
  const [extractionProgress, setExtractionProgress] = useState(0)
  const [extractionStep, setExtractionStep]     = useState('')
  const [extractionError, setExtractionError]   = useState(null)
  const [savingOverride, setSavingOverride]      = useState(false)
  const [savedFields, setSavedFields]           = useState(new Set()) // fields saved this session

  const borrower = selfEmpBorrowers.find(b => b.id === selectedBorrowerId)
  const taxReturn = (borrower?.taxReturns ?? []).find(r => r.tax_year === selectedYear)
  const fields = taxReturn?.extracted_fields ?? null
  const confidence = taxReturn?.field_confidence ?? {}
  const overrides = taxReturn?.field_overrides ?? []

  // Get effective value: latest override wins over raw extraction
  const getEffectiveValue = (fieldName) => {
    const override = [...overrides].reverse().find(o => o.field_name === fieldName)
    if (override) return override.overridden_value
    return fields?.[fieldName] ?? 0
  }

  const hasOverride = (fieldName) =>
    overrides.some(o => o.field_name === fieldName)

  const startEdit = (fieldName) => {
    setEditingField(fieldName)
    setEditValue(String(getEffectiveValue(fieldName)))
  }

  const commitEdit = async (fieldName) => {
    setEditingField(null)
    const newVal = parseFloat(editValue)
    if (isNaN(newVal)) return
    const originalVal = fields?.[fieldName] ?? 0
    if (newVal === originalVal && !hasOverride(fieldName)) return // no change

    setSavingOverride(true)
    try {
      await saveOverride({
        taxReturnId: taxReturn.id,
        fieldName,
        originalValue: originalVal,
        overriddenValue: newVal,
        userId: profile.id,
      })
      setSavedFields(prev => new Set([...prev, fieldName]))
    } catch (err) {
      console.error('Failed to save override:', err)
    } finally {
      setSavingOverride(false)
    }
  }

  const handleRunExtraction = async () => {
    if (!taxReturn?.storage_path) return
    setExtracting(true)
    setExtractionError(null)
    setExtractionProgress(0)

    // Show step messages while progress runs
    const steps = [
      'Analyzing document structure…',
      'Running OCR on pages…',
      'Extracting Schedule C line items…',
      'Cross-referencing totals…',
      'Assigning confidence scores…',
    ]
    let stepIdx = 0
    const stepInterval = setInterval(() => {
      if (stepIdx < steps.length) setExtractionStep(steps[stepIdx++])
    }, 600)

    try {
      await runExtraction(
        taxReturn.id,
        taxReturn.storage_path,
        borrower.id,
        loan.id,
        (pct) => setExtractionProgress(pct)
      )
    } catch (err) {
      setExtractionError(err.message)
    } finally {
      clearInterval(stepInterval)
      setExtracting(false)
      setExtractionStep('')
    }
  }

  const lowCount = Object.values(confidence).filter(v => v === 'low').length
  const medCount = Object.values(confidence).filter(v => v === 'medium').length

  return (
    <div className="fade-in" style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: '#cdd5e0', marginBottom: 4 }}>
          Extraction Review — {loan.id}
        </h2>
        <p style={{ color: '#8899b0', fontSize: 13 }}>
          Review AI-extracted fields. Click any value to correct it. All edits are saved to the audit log.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        {/* Left panel */}
        <div style={{ width: 260, flexShrink: 0 }}>
          {selfEmpBorrowers.map(b => {
            const returns = b.taxReturns ?? []
            return (
              <div key={b.id} style={{
                background: '#161b22', border: '1px solid #2a3347',
                borderRadius: 8, padding: 14, marginBottom: 12
              }}>
                <div
                  onClick={() => setSelectedBorrowerId(b.id)}
                  style={{ fontWeight: 600, color: selectedBorrowerId === b.id ? '#e8a838' : '#cdd5e0', marginBottom: 10, cursor: 'pointer', fontSize: 13 }}
                >
                  {b.name}
                </div>
                {[2022, 2023].map(yr => {
                  const ret = returns.find(r => r.tax_year === yr)
                  const isSelected = selectedBorrowerId === b.id && selectedYear === yr
                  const status = ret?.extraction_status
                  return (
                    <div
                      key={yr}
                      onClick={() => { if (ret?.storage_path) { setSelectedBorrowerId(b.id); setSelectedYear(yr) } }}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 10px', borderRadius: 5,
                        cursor: ret?.storage_path ? 'pointer' : 'default',
                        background: isSelected ? '#1c2230' : 'transparent',
                        border: `1px solid ${isSelected ? '#354060' : 'transparent'}`,
                        marginBottom: 4, opacity: ret?.storage_path ? 1 : 0.4
                      }}
                    >
                      <span style={{ fontSize: 12, color: isSelected ? '#4a90d9' : '#8899b0' }}>Tax Year {yr}</span>
                      {status === 'complete' && <span style={{ fontSize: 10, color: '#3fb950' }}>✓</span>}
                      {status === 'running'  && <span style={{ fontSize: 10, color: '#bc8cff' }} className="pulse">…</span>}
                      {status === 'failed'   && <span style={{ fontSize: 10, color: '#f85149' }}>✗</span>}
                      {status === 'pending'  && ret?.storage_path && <span style={{ fontSize: 10, color: '#e8a838' }}>Pending</span>}
                      {!ret?.storage_path    && <span style={{ fontSize: 10, color: '#556070' }}>No file</span>}
                    </div>
                  )
                })}
              </div>
            )
          })}

          {/* Extraction trigger */}
          {taxReturn?.storage_path && taxReturn.extraction_status === 'pending' && (
            <div style={{ background: '#161b22', border: '1px solid #bc8cff44', borderRadius: 8, padding: 14, marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#bc8cff', fontWeight: 600, marginBottom: 6 }}>✦ AI Extraction</div>
              <p style={{ fontSize: 11, color: '#8899b0', marginBottom: 10, lineHeight: 1.5 }}>
                Run document AI to extract 1040 fields. Review all results before finalizing.
              </p>
              {extracting ? (
                <div>
                  <div style={{ fontSize: 11, color: '#bc8cff', marginBottom: 6 }} className="pulse">{extractionStep}</div>
                  <div style={{ height: 4, background: '#1c2230', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${extractionProgress}%`, background: '#bc8cff', transition: 'width 0.3s' }} />
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleRunExtraction}
                  style={{ width: '100%', background: '#bc8cff22', border: '1px solid #bc8cff55', color: '#bc8cff', padding: '8px', fontSize: 12, borderRadius: 5 }}
                >
                  Extract Now →
                </button>
              )}
              {extractionError && <ErrorBox message={extractionError} />}
            </div>
          )}

          {/* Quality summary */}
          {fields && (
            <div style={{ background: '#161b22', border: '1px solid #2a3347', borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 11, color: '#556070', fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>
                Extraction Quality
              </div>
              {[
                ['High confidence', Object.values(confidence).filter(v => v === 'high').length, '#3fb950'],
                ['Medium confidence', medCount, '#e8a838'],
                ['Low confidence', lowCount, '#f85149'],
              ].map(([label, count, color]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color }}>{label}</span>
                  <span className="mono" style={{ fontSize: 12, color }}>{count}</span>
                </div>
              ))}
              {lowCount > 0 && (
                <div style={{ marginTop: 8, padding: '6px 8px', background: '#f8514922', borderRadius: 4, fontSize: 11, color: '#f85149' }}>
                  ⚠ {lowCount} field(s) need review
                </div>
              )}
              {savingOverride && <div style={{ marginTop: 8 }}><Spinner label="Saving…" /></div>}
            </div>
          )}
        </div>

        {/* Main table */}
        <div style={{ flex: 1 }}>
          {!taxReturn?.storage_path ? (
            <div style={{ background: '#161b22', border: '1px solid #2a3347', borderRadius: 8, padding: 40, textAlign: 'center', color: '#556070' }}>
              Document not uploaded for this year.
            </div>
          ) : !fields ? (
            <div style={{ background: '#161b22', border: '1px solid #2a3347', borderRadius: 8, padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🤖</div>
              <div style={{ color: '#8899b0' }}>Document uploaded — ready for extraction.</div>
              <div style={{ fontSize: 12, color: '#556070', marginTop: 4 }}>Click "Extract Now" in the left panel.</div>
            </div>
          ) : (
            <div>
              <div style={{ background: '#161b22', border: '1px solid #2a3347', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
                {/* Table header */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 60px 90px 30px', padding: '8px 16px', background: '#1c2230', borderBottom: '1px solid #2a3347' }}>
                  {['Field / IRS Reference', 'Value', 'Conf.', 'Action', ''].map(h => (
                    <span key={h} style={{ fontSize: 10, color: '#556070', fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase' }}>{h}</span>
                  ))}
                </div>

                {FIELD_GROUPS.map(group => (
                  <div key={group.label}>
                    <div style={{ padding: '6px 16px', background: '#212836', borderBottom: '1px solid #1c2230' }}>
                      <span style={{ fontSize: 11, color: '#556070', fontWeight: 600, letterSpacing: 0.5 }}>{group.label}</span>
                    </div>
                    {group.fields.map(([fieldKey, fieldLabel]) => {
                      const val = getEffectiveValue(fieldKey)
                      const conf = confidence[fieldKey] || 'high'
                      const isEditing = editingField === fieldKey
                      const isOverridden = hasOverride(fieldKey)
                      const isKey = KEY_CALC_FIELDS.has(fieldKey)
                      const isMoney = fieldKey !== 'business_miles'

                      return (
                        <div
                          key={fieldKey}
                          style={{
                            display: 'grid', gridTemplateColumns: '1fr 130px 60px 90px 30px',
                            padding: '7px 16px', borderBottom: '1px solid #1c2230',
                            background: isKey ? '#1a1f2e' : 'transparent', alignItems: 'center'
                          }}
                        >
                          <div>
                            <span style={{ fontSize: 12, color: isKey ? '#cdd5e0' : '#8899b0' }}>{fieldLabel}</span>
                            {FIELD_SOURCES[fieldKey] && (
                              <span style={{ marginLeft: 8, fontSize: 10, color: '#556070', fontFamily: 'IBM Plex Mono' }}>
                                {FIELD_SOURCES[fieldKey]}
                              </span>
                            )}
                          </div>

                          <div>
                            {isEditing ? (
                              <input
                                autoFocus
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                onBlur={() => commitEdit(fieldKey)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') commitEdit(fieldKey)
                                  if (e.key === 'Escape') setEditingField(null)
                                }}
                                style={{ width: '100%', padding: '2px 6px', fontSize: 12 }}
                              />
                            ) : (
                              <span
                                className="mono"
                                onClick={() => startEdit(fieldKey)}
                                style={{
                                  fontSize: 12, cursor: 'text',
                                  fontWeight: isKey ? 600 : 400,
                                  color: isOverridden ? '#e8a838' : val < 0 ? '#f85149' : isKey ? '#cdd5e0' : '#8899b0'
                                }}
                              >
                                {isMoney ? fmt$(val) : val?.toLocaleString?.() ?? '0'}
                                {isOverridden && <span style={{ fontSize: 9, marginLeft: 4, color: '#e8a838' }}>EDITED</span>}
                              </span>
                            )}
                          </div>

                          <ConfidenceBadge level={conf} />

                          <button
                            onClick={() => startEdit(fieldKey)}
                            style={{ background: 'transparent', color: '#4a90d9', fontSize: 10, padding: '2px 6px', border: '1px solid #2a3347' }}
                          >Edit</button>

                          <div>
                            {FIELD_SOURCES[fieldKey] && (
                              <button
                                onClick={() => setShowSource(showSource === fieldKey ? null : fieldKey)}
                                style={{ background: 'transparent', color: '#556070', fontSize: 11, padding: '2px 4px', border: 'none' }}
                                title="Show source"
                              >ℹ</button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>

              {/* Source context panel */}
              {showSource && (
                <div className="slide-in" style={{ background: '#161b22', border: '1px solid #e8a83855', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontSize: 12, color: '#e8a838', fontWeight: 600 }}>
                      Source — {FIELD_SOURCES[showSource]}
                    </span>
                    <button onClick={() => setShowSource(null)} style={{ background: 'transparent', color: '#556070', fontSize: 14 }}>✕</button>
                  </div>
                  <div style={{ background: '#1c2230', borderRadius: 6, padding: 12 }}>
                    <div style={{ fontSize: 11, color: '#8899b0', marginBottom: 6, fontFamily: 'IBM Plex Mono' }}>
                      Source: {taxReturn.original_filename}
                    </div>
                    <div style={{ fontSize: 12, color: '#cdd5e0', lineHeight: 1.7 }}>
                      <span style={{ color: '#556070' }}>…context from form… </span>
                      <span style={{
                        background: '#e8a83833', border: '1px solid #e8a83866',
                        borderRadius: 3, padding: '0 4px', fontFamily: 'IBM Plex Mono'
                      }}>
                        {FIELD_SOURCES[showSource]}: {fmt$(getEffectiveValue(showSource))}
                      </span>
                      <span style={{ color: '#556070' }}> …following context…</span>
                    </div>
                    <div style={{ marginTop: 8, fontSize: 11, color: '#556070' }}>
                      Confidence: <ConfidenceBadge level={confidence[showSource] || 'high'} />
                      {confidence[showSource] === 'low' && (
                        <span style={{ marginLeft: 8, color: '#f85149' }}>
                          Verify against original document before finalizing.
                        </span>
                      )}
                    </div>
                    {/* TODO: In a future iteration, store and display the raw text
                        snippet from taxReturn.raw_text (if you store it) so the
                        underwriter can see the actual extracted text context here. */}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#556070' }}>
                  {overrides.length} manual correction(s) saved to audit log
                </span>
                <button
                  onClick={onComplete}
                  style={{
                    background: '#3fb95022', border: '1px solid #3fb95055',
                    color: '#3fb950', padding: '10px 24px', fontSize: 13, fontWeight: 600, borderRadius: 6
                  }}
                >
                  Mark Reviewed → Proceed to Income Calculations
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
