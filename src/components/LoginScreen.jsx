// src/components/LoginScreen.jsx

import { useState } from 'react'

export default function LoginScreen({ onSignIn, error }) {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)

  const handleSubmit = async () => {
    if (!email || !password) return
    setLoading(true)
    await onSignIn(email, password)
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#0d1117'
    }}>
      <div style={{
        background: '#161b22', border: '1px solid #2a3347',
        borderRadius: 12, padding: 40, width: 360
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
          <div style={{
            width: 36, height: 36, background: '#e8a838', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 700, color: '#0d1117'
          }}>C</div>
          <span style={{ fontWeight: 600, fontSize: 16, color: '#cdd5e0' }}>
            CapCenter <span style={{ color: '#e8a838' }}>Underwrite</span>
          </span>
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 600, color: '#cdd5e0', marginBottom: 4 }}>
          Sign in
        </h2>
        <p style={{ color: '#8899b0', fontSize: 13, marginBottom: 24 }}>
          Access is restricted to authorized underwriting staff.
        </p>

        {error && (
          <div style={{
            background: '#f8514922', border: '1px solid #f85149',
            borderRadius: 6, padding: '8px 12px', marginBottom: 16,
            color: '#f85149', fontSize: 12
          }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 11, color: '#8899b0', marginBottom: 5, fontWeight: 600, letterSpacing: 0.5 }}>
            EMAIL ADDRESS
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            style={{ width: '100%' }}
            placeholder="you@example.com"
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 11, color: '#8899b0', marginBottom: 5, fontWeight: 600, letterSpacing: 0.5 }}>
            PASSWORD
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            style={{ width: '100%' }}
            placeholder="••••••••"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || !email || !password}
          style={{
            width: '100%', background: loading ? '#2a3347' : '#e8a838',
            color: loading ? '#556070' : '#0d1117',
            padding: '10px', fontWeight: 700, fontSize: 13, borderRadius: 6
          }}
        >
          {loading ? 'Signing in…' : 'Sign In →'}
        </button>

        <p style={{ marginTop: 20, fontSize: 11, color: '#556070', textAlign: 'center' }}>
          Contact your administrator to reset your password or request access.
        </p>
      </div>
    </div>
  )
}
