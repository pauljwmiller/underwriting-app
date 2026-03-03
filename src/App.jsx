// src/App.jsx
// Root component. Manages view routing and wires auth + data into child components.

import { useState } from 'react'
import { useAuth }  from './hooks/useAuth'
import { useLoans } from './hooks/useLoans'
import LoginScreen      from './components/LoginScreen'
import TopBar           from './components/TopBar'
import PipelineView     from './components/PipelineView'
import LoanDetailView   from './components/LoanDetailView'
import ExtractionReview from './components/ExtractionReview'
import IncomeSummary    from './components/IncomeSummary'

export default function App() {
  const { session, profile, loading: authLoading, authError, signIn, signOut } = useAuth()
  const {
    loans, loading: loansLoading, fetchLoans,
    uploadTaxReturn, runExtraction, saveOverride,
    updateLoanStatus, saveCalculations, deleteTaxReturn
  } = useLoans()

  const [view, setView]           = useState('pipeline')
  const [selectedLoanId, setSelectedLoanId] = useState(null)

  // Always read the current loan from the loans array so it reflects real-time DB state
  const selectedLoan = loans.find(l => l.id === selectedLoanId) ?? null

  // ── AUTH STATES ────────────────────────────────────────────
  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0d1117', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#8899b0', fontFamily: 'IBM Plex Mono' }}>Loading…</span>
      </div>
    )
  }

  if (!session) {
    return <LoginScreen onSignIn={signIn} error={authError} />
  }

  // ── LOADING STATE ──────────────────────────────────────────
  if (loansLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0d1117', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#8899b0', fontFamily: 'IBM Plex Mono' }}>Loading pipeline…</span>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <TopBar
        view={view}
        loan={selectedLoan}
        profile={profile}
        onBack={() => { setView('pipeline'); setSelectedLoanId(null) }}
        onBackToLoan={() => setView('loan')}
        onSignOut={signOut}
      />

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {view === 'pipeline' && (
          <PipelineView
            loans={loans}
            onSelectLoan={(loan) => {
              setSelectedLoanId(loan.id)
              setView('loan')
            }}
          />
        )}

        {view === 'loan' && selectedLoan && (
          <LoanDetailView
            loan={selectedLoan}
            profile={profile}
            uploadTaxReturn={uploadTaxReturn}
            updateLoanStatus={updateLoanStatus}
            deleteTaxReturn={deleteTaxReturn}
            onGoExtraction={() => setView('extraction')}
            onGoIncome={() => setView('income')}
          />
        )}

        {view === 'extraction' && selectedLoan && (
          <ExtractionReview
            loan={selectedLoan}
            profile={profile}
            runExtraction={runExtraction}
            saveOverride={saveOverride}
            onComplete={() => {
              updateLoanStatus(selectedLoan.id, 'In Review')
              setView('income')
            }}
          />
        )}

        {view === 'income' && selectedLoan && (
          <IncomeSummary
            loan={selectedLoan}
            profile={profile}
            saveCalculations={saveCalculations}
            updateLoanStatus={updateLoanStatus}
          />
        )}
      </div>
    </div>
  )
}
