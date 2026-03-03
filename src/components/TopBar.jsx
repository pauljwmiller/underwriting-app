// src/components/TopBar.jsx

export default function TopBar({ view, loan, profile, onBack, onBackToLoan, onSignOut }) {
  const initials = profile?.full_name
    ?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? '??'

  return (
    <div style={{
      background: '#0d1117', borderBottom: '1px solid #1e2940',
      padding: '0 20px', height: 52, display: 'flex',
      alignItems: 'center', gap: 16, flexShrink: 0,
      position: 'sticky', top: 0, zIndex: 100
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 8 }}>
        <div style={{
          width: 28, height: 28, background: '#e8a838', borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700, color: '#0d1117'
        }}>C</div>
        <span style={{ fontWeight: 600, color: '#cdd5e0', letterSpacing: -0.3, fontSize: 14 }}>
          CapCenter <span style={{ color: '#e8a838', fontWeight: 500 }}>Underwrite</span>
        </span>
      </div>

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
        <span
          onClick={onBack}
          style={{
            color: view !== 'pipeline' ? '#4a90d9' : '#8899b0',
            cursor: view !== 'pipeline' ? 'pointer' : 'default', fontSize: 13
          }}
        >Pipeline</span>

        {loan && <>
          <span style={{ color: '#556070' }}>/</span>
          <span
            onClick={view === 'extraction' || view === 'income' ? onBackToLoan : undefined}
            style={{
              color: (view === 'extraction' || view === 'income') ? '#4a90d9' : '#8899b0',
              cursor: (view === 'extraction' || view === 'income') ? 'pointer' : 'default',
              fontSize: 13
            }}
          >{loan.id}</span>

          {view === 'extraction' && <>
            <span style={{ color: '#556070' }}>/</span>
            <span style={{ color: '#cdd5e0', fontSize: 13 }}>Extraction Review</span>
          </>}
          {view === 'income' && <>
            <span style={{ color: '#556070' }}>/</span>
            <span style={{ color: '#cdd5e0', fontSize: 13 }}>Income Summary</span>
          </>}
        </>}
      </div>

      {/* User info + sign out */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%', background: '#4a90d9',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 600, color: '#fff'
        }}>{initials}</div>
        <span style={{ color: '#8899b0', fontSize: 12 }}>
          {profile?.full_name ?? 'Unknown'} · {profile?.role ?? ''}
        </span>
        <button
          onClick={onSignOut}
          style={{
            background: 'transparent', color: '#556070',
            border: '1px solid #2a3347', padding: '3px 10px', fontSize: 11
          }}
        >Sign out</button>
      </div>
    </div>
  )
}
