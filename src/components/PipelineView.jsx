// src/components/PipelineView.jsx

import { useState } from 'react'
import { StatusBadge } from './shared/Badges'
import { STATUSES, STATUS_COLORS, fmt$ } from '../lib/constants'

const LOAN_OFFICERS = ['Maya Chen', 'Derek Mills', 'Priya Patel', 'James Whitford']

export default function PipelineView({ loans, onSelectLoan }) {
  const [filterStatus, setFilterStatus] = useState('')
  const [filterLO, setFilterLO]         = useState('')
  const [filterSearch, setFilterSearch] = useState('')

  const selfEmpCount = (loan) =>
    (loan.borrowers ?? []).filter(b => b.is_self_employed).length

  const filtered = loans.filter(l => {
    if (filterStatus && l.status !== filterStatus) return false
    if (filterLO && l.loan_officer_name !== filterLO) return false
    if (filterSearch) {
      const q = filterSearch.toLowerCase()
      return l.id.toLowerCase().includes(q) ||
        (l.borrowers ?? []).some(b => b.name.toLowerCase().includes(q)) ||
        (l.property_address ?? '').toLowerCase().includes(q)
    }
    return true
  })

  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = loans.filter(l => l.status === s).length
    return acc
  }, {})

  return (
    <div className="fade-in" style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: '#cdd5e0', letterSpacing: -0.5, marginBottom: 4 }}>
          Self-Employed Income Pipeline
        </h1>
        <p style={{ color: '#8899b0', fontSize: 13 }}>
          {loans.length} loans requiring self-employed income analysis
        </p>
      </div>

      {/* Status summary */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {STATUSES.map(s => (
          <div
            key={s}
            onClick={() => setFilterStatus(filterStatus === s ? '' : s)}
            style={{
              background: filterStatus === s ? STATUS_COLORS[s] + '22' : '#161b22',
              border: `1px solid ${filterStatus === s ? STATUS_COLORS[s] : '#2a3347'}`,
              borderRadius: 8, padding: '8px 14px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s'
            }}
          >
            <span style={{ fontSize: 18, fontWeight: 700, color: STATUS_COLORS[s], fontFamily: 'IBM Plex Mono' }}>
              {counts[s]}
            </span>
            <span style={{ fontSize: 12, color: '#8899b0' }}>{s}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <input
          placeholder="Search loans, borrowers, address…"
          value={filterSearch}
          onChange={e => setFilterSearch(e.target.value)}
          style={{ width: 280 }}
        />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: 180 }}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterLO} onChange={e => setFilterLO(e.target.value)} style={{ width: 180 }}>
          <option value="">All Loan Officers</option>
          {LOAN_OFFICERS.map(lo => <option key={lo} value={lo}>{lo}</option>)}
        </select>
        {(filterStatus || filterLO || filterSearch) &&
          <button
            onClick={() => { setFilterStatus(''); setFilterLO(''); setFilterSearch('') }}
            style={{ background: 'transparent', color: '#4a90d9', border: '1px solid #2a3347', padding: '5px 12px' }}
          >Clear filters</button>
        }
      </div>

      {/* Table */}
      <div style={{ background: '#161b22', border: '1px solid #2a3347', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '130px 1fr 1fr 130px 120px 140px 80px',
          padding: '8px 16px', background: '#1c2230', borderBottom: '1px solid #2a3347'
        }}>
          {['Loan ID', 'Borrower(s)', 'Property', 'Loan Amount', 'Loan Officer', 'Status', 'Action'].map(h => (
            <span key={h} style={{ fontSize: 11, color: '#556070', fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase' }}>
              {h}
            </span>
          ))}
        </div>

        {filtered.map((loan, i) => (
          <div
            key={loan.id}
            onClick={() => onSelectLoan(loan)}
            style={{
              display: 'grid', gridTemplateColumns: '130px 1fr 1fr 130px 120px 140px 80px',
              padding: '12px 16px', cursor: 'pointer',
              borderBottom: i < filtered.length - 1 ? '1px solid #1c2230' : 'none',
              transition: 'background 0.1s', alignItems: 'center'
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#1c2230'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <span className="mono" style={{ color: '#4a90d9', fontSize: 12, fontWeight: 600 }}>{loan.id}</span>

            <div>
              {(loan.borrowers ?? []).filter(b => b.is_self_employed).map(b => (
                <div key={b.id} style={{ fontSize: 13, color: '#cdd5e0' }}>{b.name}</div>
              ))}
              <div style={{ fontSize: 11, color: '#556070', marginTop: 1 }}>
                {selfEmpCount(loan)} self-employed borrower(s)
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, color: '#8899b0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {loan.property_address}
              </div>
              <div style={{ fontSize: 11, color: '#556070' }}>{loan.loan_purpose}</div>
            </div>

            <span className="mono" style={{ fontSize: 13, color: '#cdd5e0', fontWeight: 500 }}>
              {fmt$(loan.loan_amount)}
            </span>
            <span style={{ fontSize: 12, color: '#8899b0' }}>{loan.loan_officer_name}</span>
            <StatusBadge status={loan.status} />
            <button
              onClick={e => { e.stopPropagation(); onSelectLoan(loan) }}
              style={{ background: '#1c2230', border: '1px solid #2a3347', color: '#4a90d9', padding: '4px 10px', fontSize: 12 }}
            >Open →</button>
          </div>
        ))}

        {filtered.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: '#556070' }}>
            No loans match the current filters.
          </div>
        )}
      </div>
      <div style={{ marginTop: 12, color: '#556070', fontSize: 12 }}>
        Showing {filtered.length} of {loans.length} loans
      </div>
    </div>
  )
}
