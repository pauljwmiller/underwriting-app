// src/components/IncomeSummary.jsx

import { useState } from 'react'
import { FlagBadge } from './shared/Badges'
import { AGENCIES, AGENCY_LABELS, AGENCY_COLORS, fmt$, fmtPct } from '../lib/constants'
import { calcAgencyIncome, calcLoanTotal } from '../lib/calculations'

export default function IncomeSummary({ loan, profile, saveCalculations, updateLoanStatus }) {
  const [selectedAgency, setSelectedAgency] = useState('FNMA')
  const [activeTab, setActiveTab]           = useState('comparison')
  const [saving, setSaving]                 = useState(false)
  const [saved, setSaved]                   = useState(false)

  const selfEmpBorrowers = (loan.borrowers ?? []).filter(b => b.is_self_employed)

  const borrowerCalcs = selfEmpBorrowers.map(b => ({
    borrower: b,
    calc: calcAgencyIncome(b),
  })).filter(x => x.calc)

  const loanTotals = AGENCIES.reduce((acc, ag) => {
    acc[ag] = calcLoanTotal(loan.borrowers ?? [], ag)
    return acc
  }, {})

  // Calculate annual totals from actual annual values (not just monthly × 12)
  const loanAnnualTotals = AGENCIES.reduce((acc, ag) => {
    let annual = 0
    // Sum annual from self-employed borrowers
    if (Array.isArray(borrowerCalcs)) {
      borrowerCalcs.forEach(({ calc }) => {
        if (calc && calc.agencies && calc.agencies[ag]) {
          annual += calc.agencies[ag].annual ?? 0
        }
      })
    }
    // Add W-2 annual income from co-borrowers
    (loan.borrowers ?? []).forEach(b => {
      if (!b.is_self_employed && b.w2_annual_income) {
        annual += b.w2_annual_income
      }
    })
    acc[ag] = annual
    return acc
  }, {})

  const maxTotal = Math.max(...Object.values(loanTotals).filter(Boolean))

  const handleFinalize = async () => {
    setSaving(true)
    try {
      // Build rows for every borrower × agency combination
      const rows = []
      borrowerCalcs.forEach(({ borrower, calc }) => {
        AGENCIES.forEach(ag => {
          const result = calc.agencies[ag]
          rows.push({
            borrowerId: borrower.id,
            agency:     ag,
            monthly:    result.monthly,
            annual:     result.annual,
            flag:       result.flag,
            eligible:   result.eligible,
            inputs: {
              year2022: calc.year2022,
              year2023: calc.year2023,
              pctChange: calc.pctChange,
            },
            breakdown: result,
          })
        })
      })
      await saveCalculations(loan.id, rows, profile.id)
      await updateLoanStatus(loan.id, 'Finalized')
      setSaved(true)
    } catch (err) {
      console.error('Failed to finalize:', err)
    } finally {
      setSaving(false)
    }
  }

  const tabs = [
    { id: 'comparison', label: 'Agency Comparison' },
    { id: 'trend',      label: 'Year-Over-Year Trend' },
    { id: 'borrower',   label: 'Borrower Detail' },
    { id: 'loan',       label: 'Loan-Level Summary' },
  ]

  return (
    <div className="fade-in" style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#cdd5e0', marginBottom: 4 }}>
            Income Calculations — {loan.id}
          </h2>
          <p style={{ color: '#8899b0', fontSize: 13 }}>
            Qualifying income under all four agency guidelines. Verify before finalizing.
          </p>
        </div>
        <button
          onClick={handleFinalize}
          disabled={saving || saved}
          style={{
            background: saved ? '#3fb95022' : '#e8a83822',
            border: `1px solid ${saved ? '#3fb950' : '#e8a838'}55`,
            color: saved ? '#3fb950' : '#e8a838',
            padding: '10px 20px', fontSize: 13, fontWeight: 600, borderRadius: 6
          }}
        >
          {saving ? 'Saving…' : saved ? '✓ Finalized' : 'Finalize & Save →'}
        </button>
      </div>

      {/* Agency quick-select */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        {AGENCIES.map(ag => (
          <div
            key={ag}
            onClick={() => setSelectedAgency(ag)}
            style={{
              background: selectedAgency === ag ? AGENCY_COLORS[ag] + '22' : '#161b22',
              border: `1px solid ${selectedAgency === ag ? AGENCY_COLORS[ag] : '#2a3347'}`,
              borderRadius: 8, padding: '10px 16px', cursor: 'pointer', flex: 1, textAlign: 'center',
              transition: 'all 0.15s'
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: AGENCY_COLORS[ag], fontFamily: 'IBM Plex Mono' }}>
              {fmt$(loanTotals[ag])}<span style={{ fontSize: 11, fontWeight: 400 }}>/mo</span>
            </div>
            <div style={{ fontSize: 11, color: '#8899b0', marginTop: 2 }}>{AGENCY_LABELS[ag]}</div>
            {borrowerCalcs.some(({ calc }) => calc.agencies[ag]?.flag) && (
              <div style={{ fontSize: 9, color: '#f0883e', marginTop: 3 }}>⚠ Flags</div>
            )}
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #2a3347', marginBottom: 16 }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: 'transparent',
              color: activeTab === tab.id ? '#e8a838' : '#8899b0',
              padding: '8px 18px',
              borderBottom: `2px solid ${activeTab === tab.id ? '#e8a838' : 'transparent'}`,
              borderRadius: 0, fontWeight: activeTab === tab.id ? 600 : 400,
              fontSize: 13, marginBottom: -1
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB: COMPARISON ── */}
      {activeTab === 'comparison' && (
        <div className="slide-in">
          <div style={{ color: '#8899b0', fontSize: 12, marginBottom: 12 }}>
            Side-by-side qualifying income under each agency. Differences arise from varying add-back policies, declining income treatment, and minimum history requirements.
          </div>
          <div style={{ background: '#161b22', border: '1px solid #2a3347', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 1fr 1fr 1fr', padding: '8px 16px', background: '#1c2230', borderBottom: '1px solid #2a3347' }}>
              <span style={{ fontSize: 10, color: '#556070', fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase' }}>Borrower</span>
              {AGENCIES.map(ag => (
                <span key={ag} style={{ fontSize: 10, color: AGENCY_COLORS[ag], fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase', textAlign: 'right' }}>
                  {AGENCY_LABELS[ag]}
                </span>
              ))}
            </div>

            {/* Self-employed borrowers */}
            {borrowerCalcs.map(({ borrower, calc }) => (
              <div key={borrower.id} style={{ borderBottom: '1px solid #1c2230' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 1fr 1fr 1fr', padding: '12px 16px', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, color: '#cdd5e0', fontWeight: 500 }}>{borrower.name}</div>
                    <div style={{ fontSize: 11, color: '#556070' }}>{borrower.business_type?.split('–')[0].trim()}</div>
                  </div>
                  {AGENCIES.map(ag => {
                    const result = calc.agencies[ag]
                    return (
                      <div key={ag} style={{ textAlign: 'right', padding: '0 8px' }}>
                        {result.eligible ? (
                          <>
                            <div className="mono" style={{ fontSize: 14, fontWeight: ag === selectedAgency ? 700 : 500, color: ag === selectedAgency ? AGENCY_COLORS[ag] : '#cdd5e0' }}>
                              {fmt$(result.monthly)}/mo
                            </div>
                            <div className="mono" style={{ fontSize: 11, color: '#556070' }}>{fmt$(result.annual)}/yr</div>
                            {result.flag && <FlagBadge flag={result.flag} />}
                          </>
                        ) : (
                          <FlagBadge flag={result.flag} />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            {/* W-2 co-borrowers */}
            {(loan.borrowers ?? []).filter(b => !b.is_self_employed && b.w2_annual_income).map(b => (
              <div key={b.id} style={{ borderBottom: '1px solid #1c2230' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 1fr 1fr 1fr', padding: '12px 16px', alignItems: 'center', background: '#1a1f2e' }}>
                  <div>
                    <div style={{ fontSize: 13, color: '#cdd5e0', fontWeight: 500 }}>{b.name}</div>
                    <div style={{ fontSize: 11, color: '#556070' }}>W-2 Co-Borrower</div>
                  </div>
                  {AGENCIES.map(ag => (
                    <div key={ag} style={{ textAlign: 'right', padding: '0 8px' }}>
                      <div className="mono" style={{ fontSize: 14, color: '#3fb950' }}>{fmt$(b.w2_annual_income / 12)}/mo</div>
                      <div className="mono" style={{ fontSize: 11, color: '#556070' }}>All agencies</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Totals */}
            <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 1fr 1fr 1fr', padding: '12px 16px', background: '#212836', borderTop: '2px solid #2a3347' }}>
              <div style={{ fontSize: 13, color: '#e8a838', fontWeight: 700 }}>Total Qualifying Income</div>
              {AGENCIES.map(ag => {
                const isMax = loanTotals[ag] === maxTotal
                return (
                  <div key={ag} style={{ textAlign: 'right', padding: '0 8px' }}>
                    <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: isMax ? '#3fb950' : '#cdd5e0' }}>
                      {fmt$(loanTotals[ag])}/mo
                    </div>
                    <div className="mono" style={{ fontSize: 11, color: '#556070' }}>{fmt$(loanTotals[ag] * 12)}/yr</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Agency rules explanation */}
          <div style={{ background: '#161b22', border: '1px solid #2a3347', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 11, color: '#556070', fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 }}>
              Why Income Differs Across Agencies
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { ag: 'FNMA', title: 'Fannie Mae B3-3.2',
                  rules: ['24-month avg if stable/increasing', 'Lower year if any decline', 'Sharp >25% decline triggers additional analysis', 'Add-backs: depreciation, home office, mileage, meals 50%'] },
                { ag: 'FHLMC', title: 'Freddie Mac Guide 5304 / Form 91',
                  rules: ['24-month avg if stable/increasing', 'Most recent year only if declining (not lowest year)', 'Slightly more generous than FNMA on declining income', 'Add-backs: same as FNMA'] },
                { ag: 'FHA', title: 'FHA / HUD 4000.1',
                  rules: ['Requires both years — ineligible with only 1 year', 'Any decline → use lower year', 'Home office deduction NOT added back', 'Most conservative of the four agencies'] },
                { ag: 'VA', title: 'VA Lender\'s Handbook Ch. 4',
                  rules: ['2-year avg standard; 1-year acceptable with compensating factors', 'Negative business income treated as $0', 'Full meals add-back (not just 50%)', 'Most flexible income policy'] },
              ].map(item => (
                <div key={item.ag} style={{ background: '#1c2230', borderRadius: 6, padding: 12, borderLeft: `3px solid ${AGENCY_COLORS[item.ag]}` }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: AGENCY_COLORS[item.ag], marginBottom: 8 }}>{item.title}</div>
                  {item.rules.map((rule, i) => (
                    <div key={i} style={{ fontSize: 11, color: '#8899b0', marginBottom: 4, display: 'flex', gap: 6 }}>
                      <span style={{ color: AGENCY_COLORS[item.ag], flexShrink: 0 }}>·</span>{rule}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: TREND ── */}
      {activeTab === 'trend' && (
        <div className="slide-in">
          {borrowerCalcs.map(({ borrower, calc }) => {
            const y1 = calc.year2022
            const y2 = calc.year2023
            const barMax = Math.max(y1?.totalWithWages || 0, y2?.totalWithWages || 0) * 1.1

            return (
              <div key={borrower.id} style={{ background: '#161b22', border: '1px solid #2a3347', borderRadius: 8, padding: 20, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#cdd5e0' }}>{borrower.name}</div>
                    <div style={{ fontSize: 12, color: '#8899b0' }}>{borrower.business_type}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: '#556070' }}>YoY Change</div>
                    <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: (calc.pctChange ?? 0) >= 0 ? '#3fb950' : '#f85149' }}>
                      {fmtPct(calc.pctChange)}
                    </div>
                    {calc.isSharpDecline && <FlagBadge flag="SHARP_DECLINE" />}
                    {calc.isDecline && !calc.isSharpDecline && <FlagBadge flag="DECLINING" />}
                  </div>
                </div>

                {/* Bar chart */}
                <div style={{ display: 'flex', gap: 24, marginBottom: 20, alignItems: 'flex-end', height: 140 }}>
                  {[{ year: 2022, data: y1, color: '#4a90d9' }, { year: 2023, data: y2, color: '#6aaff0' }].map(({ year, data, color }) => {
                    if (!data) return (
                      <div key={year} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                        <div style={{ fontSize: 12, color: '#556070' }}>—</div>
                        <div style={{ width: '100%', flex: 1 }} />
                        <div style={{ height: 2, width: '100%', background: '#2a3347' }} />
                        <div style={{ fontSize: 12, color: '#8899b0', marginTop: 4 }}>Tax Year {year}</div>
                      </div>
                    )
                    const pct = barMax > 0 ? (data.totalWithWages / barMax) * 100 : 0
                    return (
                      <div key={year} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                        <div className="mono" style={{ fontSize: 13, color, fontWeight: 600, marginBottom: 4 }}>
                          {fmt$(data.totalWithWages)}
                        </div>
                        <div style={{ width: '100%', flex: 1, display: 'flex', alignItems: 'flex-end' }}>
                          <div style={{ width: '100%', height: `${pct}%`, background: `linear-gradient(to top, ${color}, ${color}88)`, borderRadius: '4px 4px 0 0', minHeight: 4 }} />
                        </div>
                        <div style={{ height: 2, width: '100%', background: '#2a3347' }} />
                        <div style={{ fontSize: 12, color: '#8899b0', marginTop: 4 }}>Tax Year {year}</div>
                      </div>
                    )
                  })}
                </div>

                {/* Component breakdown */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[{ year: 2022, data: y1 }, { year: 2023, data: y2 }].map(({ year, data }) =>
                    !data ? null : (
                      <div key={year} style={{ background: '#1c2230', borderRadius: 6, padding: 12 }}>
                        <div style={{ fontSize: 11, color: '#e8a838', fontWeight: 600, marginBottom: 8 }}>{year} Components</div>
                        {[
                          ['Net Schedule C Profit', data.netProfit],
                          ['+ Depreciation Add-back', data.depreciation],
                          ['+ Home Office Add-back', data.homeOffice],
                          ['+ Mileage Add-back', data.mileageAddback],
                          ['+ Meals Add-back', data.mealsAddback],
                          ['+ Schedule E Income', data.schedENet],
                          ['+ W-2 Wages', data.wages],
                        ].filter(([, v]) => v !== 0).map(([label, val]) => (
                          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #2a3347', fontSize: 11 }}>
                            <span style={{ color: '#8899b0' }}>{label}</span>
                            <span className="mono" style={{ color: val >= 0 ? '#cdd5e0' : '#f85149' }}>{fmt$(val)}</span>
                          </div>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', marginTop: 2 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#cdd5e0' }}>Total Adjusted</span>
                          <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: '#3fb950' }}>{fmt$(data.totalWithWages)}</span>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── TAB: BORROWER DETAIL ── */}
      {activeTab === 'borrower' && (
        <div className="slide-in">
          {borrowerCalcs.map(({ borrower, calc }) => (
            <div key={borrower.id} style={{ background: '#161b22', border: '1px solid #2a3347', borderRadius: 8, padding: 20, marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#cdd5e0', marginBottom: 4 }}>{borrower.name}</div>
              <div style={{ fontSize: 12, color: '#8899b0', marginBottom: 16 }}>{borrower.business_type}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {AGENCIES.map(ag => {
                  const result = calc.agencies[ag]
                  return (
                    <div key={ag} style={{ background: '#1c2230', borderRadius: 6, padding: 14, borderTop: `3px solid ${AGENCY_COLORS[ag]}` }}>
                      <div style={{ fontSize: 11, color: AGENCY_COLORS[ag], fontWeight: 600, marginBottom: 6 }}>{AGENCY_LABELS[ag]}</div>
                      {result.eligible ? (
                        <>
                          <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: '#cdd5e0', marginBottom: 2 }}>
                            {fmt$(result.monthly)}<span style={{ fontSize: 12, fontWeight: 400, color: '#556070' }}>/mo</span>
                          </div>
                          <div className="mono" style={{ fontSize: 11, color: '#556070' }}>{fmt$(result.annual)}/yr</div>
                          {result.flag && <div style={{ marginTop: 6 }}><FlagBadge flag={result.flag} /></div>}
                        </>
                      ) : (
                        <div>
                          <div style={{ fontSize: 12, color: '#f85149', marginBottom: 4 }}>Not Eligible</div>
                          <FlagBadge flag={result.flag} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── TAB: LOAN SUMMARY ── */}
      {activeTab === 'loan' && (
        <div className="slide-in">
          <div style={{ color: '#8899b0', fontSize: 12, marginBottom: 16 }}>
            Total qualifying monthly income across all borrowers, used for DTI calculations.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
            {AGENCIES.map(ag => {
              const total = loanTotals[ag]
              const isMax = total === maxTotal
              const dti = total > 0 ? ((loan.loan_amount * 0.005) / total * 100) : null
              return (
                <div key={ag} style={{
                  background: '#161b22', border: `1px solid ${isMax ? AGENCY_COLORS[ag] + '55' : '#2a3347'}`,
                  borderRadius: 8, padding: 20, textAlign: 'center',
                  boxShadow: isMax ? `0 0 20px ${AGENCY_COLORS[ag]}15` : 'none'
                }}>
                  {isMax && <div style={{ fontSize: 9, color: AGENCY_COLORS[ag], fontWeight: 700, letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' }}>↑ Highest</div>}
                  <div style={{ fontSize: 12, color: AGENCY_COLORS[ag], fontWeight: 600, marginBottom: 8 }}>{AGENCY_LABELS[ag]}</div>
                  <div className="mono" style={{ fontSize: 26, fontWeight: 700, color: '#cdd5e0', marginBottom: 2 }}>{fmt$(total)}</div>
                  <div style={{ fontSize: 12, color: '#556070' }}>per month</div>
                  <div className="mono" style={{ fontSize: 13, color: '#8899b0', marginTop: 6 }}>{fmt$(loanAnnualTotals[ag])}/year</div>
                  {dti && (
                    <div style={{ marginTop: 10, fontSize: 11, color: dti > 45 ? '#f85149' : dti > 36 ? '#e8a838' : '#3fb950' }}>
                      Est. DTI: {dti.toFixed(1)}%
                      {dti > 45 && <div style={{ fontSize: 10, color: '#f85149' }}>⚠ Exceeds 45%</div>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Contribution breakdown */}
          <div style={{ background: '#161b22', border: '1px solid #2a3347', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 11, color: '#556070', fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 14 }}>
              Income by Borrower — {AGENCY_LABELS[selectedAgency]}
            </div>
            {[
              ...borrowerCalcs.map(({ borrower, calc }) => ({
                name: borrower.name, type: 'Self-Employed',
                monthly: calc.agencies[selectedAgency]?.monthly ?? 0
              })),
              ...(loan.borrowers ?? []).filter(b => !b.is_self_employed && b.w2_annual_income).map(b => ({
                name: b.name, type: 'W-2 Employee', monthly: b.w2_annual_income / 12
              }))
            ].map((item, i) => {
              const total = loanTotals[selectedAgency]
              const pct = total > 0 ? (item.monthly / total * 100) : 0
              return (
                <div key={i} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div>
                      <span style={{ fontSize: 13, color: '#cdd5e0' }}>{item.name}</span>
                      <span style={{ fontSize: 11, color: '#556070', marginLeft: 8 }}>{item.type}</span>
                    </div>
                    <div>
                      <span className="mono" style={{ fontSize: 13, color: '#cdd5e0', fontWeight: 600 }}>{fmt$(item.monthly)}/mo</span>
                      <span style={{ fontSize: 11, color: '#556070', marginLeft: 8 }}>{pct.toFixed(0)}%</span>
                    </div>
                  </div>
                  <div style={{ height: 6, background: '#1c2230', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: item.type === 'W-2 Employee' ? '#3fb950' : AGENCY_COLORS[selectedAgency], borderRadius: 3, transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
