// src/components/LoginScreen.jsx

import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function LoginScreen({ onSignIn, error }) {
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [loading, setLoading]     = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetMessage, setResetMessage] = useState(null)
  const [resetError, setResetError]     = useState(null)

  const handleSubmit = async () => {
    if (!email || !password) return
    setLoading(true)
    await onSignIn(email, password)
    setLoading(false)
  }

  const handleResetPassword = async () => {
    if (!email) {
      setResetError('Enter your email above to request a reset link.')
      setResetMessage(null)
      return
    }

    setResetLoading(true)
    setResetError(null)
    setResetMessage(null)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) {
      setResetError(error.message)
    } else {
      setResetMessage('If an account exists for this email, a reset link has been sent.')
    }

    setResetLoading(false)
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

        {resetError && (
          <div style={{
            background: '#f8514922', border: '1px solid #f85149',
            borderRadius: 6, padding: '8px 12px', marginBottom: 16,
            color: '#f85149', fontSize: 12
          }}>
            {resetError}
          </div>
        )}

        {resetMessage && (
          <div style={{
            background: '#23863622', border: '1px solid #238636',
            borderRadius: 6, padding: '8px 12px', marginBottom: 16,
            color: '#3fb950', fontSize: 12
          }}>
            {resetMessage}
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

        <div style={{ marginTop: 16, fontSize: 11, color: '#556070', textAlign: 'center' }}>
          <button
            type="button"
            onClick={handleResetPassword}
            disabled={resetLoading}
            style={{
              background: 'transparent', border: 'none', padding: 0,
              color: '#cdd5e0', textDecoration: 'underline', cursor: 'pointer',
              fontSize: 11
            }}
          >
            {resetLoading ? 'Sending reset link…' : 'Forgot password? Email me a reset link'}
          </button>
        </div>
      </div>
    </div>
  )
}
