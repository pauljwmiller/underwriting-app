// src/components/ResetPassword.jsx

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [success, setSuccess]   = useState(false)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [hasSession, setHasSession] = useState(false)

  useEffect(() => {
    // Ensure there is a valid session from the recovery link
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session)
      setSessionChecked(true)
    })
  }, [])

  const handleSubmit = async () => {
    if (!password || !confirm || password !== confirm) return
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
    }

    setLoading(false)
  }

  const goToLogin = () => {
    window.location.assign('/')
  }

  const disabled =
    loading || !password || !confirm || password !== confirm || password.length < 8

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#0d1117'
    }}>
      <div style={{
        background: '#161b22', border: '1px solid #2a3347',
        borderRadius: 12, padding: 40, width: 360
      }}>
        {/* Logo / Header */}
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
          Reset password
        </h2>
        <p style={{ color: '#8899b0', fontSize: 13, marginBottom: 16 }}>
          Choose a new password for your account.
        </p>

        {!sessionChecked && (
          <p style={{ color: '#8899b0', fontSize: 12, marginBottom: 16 }}>
            Verifying your reset link…
          </p>
        )}

        {sessionChecked && !hasSession && !success && (
          <div style={{
            background: '#f8514922', border: '1px solid #f85149',
            borderRadius: 6, padding: '8px 12px', marginBottom: 16,
            color: '#f85149', fontSize: 12
          }}>
            This reset link is invalid or has expired. Please request a new one.
          </div>
        )}

        {error && (
          <div style={{
            background: '#f8514922', border: '1px solid #f85149',
            borderRadius: 6, padding: '8px 12px', marginBottom: 16,
            color: '#f85149', fontSize: 12
          }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{
            background: '#23863622', border: '1px solid #238636',
            borderRadius: 6, padding: '8px 12px', marginBottom: 16,
            color: '#3fb950', fontSize: 12
          }}>
            Your password has been updated. You can now sign in with your new credentials.
          </div>
        )}

        {/* Form only if we have a valid session and not yet successful */}
        {sessionChecked && hasSession && !success && (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, color: '#8899b0', marginBottom: 5, fontWeight: 600, letterSpacing: 0.5 }}>
                NEW PASSWORD
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !disabled && handleSubmit()}
                style={{ width: '100%' }}
                placeholder="At least 8 characters"
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 11, color: '#8899b0', marginBottom: 5, fontWeight: 600, letterSpacing: 0.5 }}>
                CONFIRM PASSWORD
              </label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !disabled && handleSubmit()}
                style={{ width: '100%' }}
                placeholder="Re-enter new password"
              />
              {password && confirm && password !== confirm && (
                <p style={{ color: '#f85149', fontSize: 11, marginTop: 4 }}>
                  Passwords do not match.
                </p>
              )}
            </div>

            <button
              onClick={handleSubmit}
              disabled={disabled}
              style={{
                width: '100%', background: disabled ? '#2a3347' : '#e8a838',
                color: disabled ? '#556070' : '#0d1117',
                padding: '10px', fontWeight: 700, fontSize: 13, borderRadius: 6
              }}
            >
              {loading ? 'Updating…' : 'Update Password'}
            </button>
          </>
        )}

        <p style={{ marginTop: 20, fontSize: 11, color: '#556070', textAlign: 'center' }}>
          {success ? (
            <button
              onClick={goToLogin}
              style={{
                background: 'transparent', border: 'none', color: '#cdd5e0',
                textDecoration: 'underline', cursor: 'pointer', fontSize: 11
              }}
            >
              Return to sign-in
            </button>
          ) : (
            'If you did not request this change, please contact your administrator.'
          )}
        </p>
      </div>
    </div>
  )
}
