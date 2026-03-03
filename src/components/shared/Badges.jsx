// src/components/shared/Badges.jsx
// Reusable UI primitives used across all views.

export const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0d1117; --surface: #161b22; --surface2: #1c2230; --surface3: #212836;
    --border: #2a3347; --border2: #354060;
    --text: #cdd5e0; --text2: #8899b0; --text3: #556070;
    --gold: #e8a838; --gold2: #f5c050;
    --blue: #4a90d9; --blue2: #6aaff0;
    --green: #3fb950; --red: #f85149; --orange: #f0883e;
    --purple: #bc8cff; --teal: #39c5cf;
  }
  body { background: var(--bg); color: var(--text); font-family: 'IBM Plex Sans', sans-serif; font-size: 13px; line-height: 1.5; }
  .mono { font-family: 'IBM Plex Mono', monospace; }
  input, select, textarea { background: var(--surface); border: 1px solid var(--border); color: var(--text); border-radius: 4px; padding: 5px 10px; font-family: 'IBM Plex Sans', sans-serif; font-size: 13px; outline: none; transition: border-color 0.15s; }
  input:focus, select:focus { border-color: var(--blue); }
  button { cursor: pointer; font-family: 'IBM Plex Sans', sans-serif; font-size: 13px; border: none; border-radius: 4px; transition: all 0.15s; }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: var(--surface); }
  ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 3px; }
  .pulse { animation: pulse 1.5s ease-in-out infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
  .fade-in { animation: fadeIn 0.3s ease; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
  .slide-in { animation: slideIn 0.25s ease; }
  @keyframes slideIn { from { opacity: 0; transform: translateX(8px); } to { opacity: 1; transform: translateX(0); } }
`

import { STATUS_COLORS } from '../../lib/constants'

export function ConfidenceBadge({ level }) {
  const colors = { high: '#3fb950', medium: '#e8a838', low: '#f85149' }
  const labels = { high: 'HIGH', medium: 'MED', low: 'LOW' }
  return (
    <span style={{
      fontSize: 9, fontFamily: 'IBM Plex Mono', fontWeight: 600,
      color: colors[level], background: colors[level] + '22',
      padding: '1px 5px', borderRadius: 3, letterSpacing: 1
    }}>
      {labels[level]}
    </span>
  )
}

export function StatusBadge({ status, size = 'sm' }) {
  const color = STATUS_COLORS[status] || '#556070'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: size === 'sm' ? 11 : 12, fontWeight: 500,
      color, background: color + '1a', border: `1px solid ${color}33`,
      padding: size === 'sm' ? '1px 7px' : '3px 10px',
      borderRadius: 99, letterSpacing: 0.3, whiteSpace: 'nowrap'
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {status}
    </span>
  )
}

export function FlagBadge({ flag }) {
  if (!flag) return null
  const flagInfo = {
    SHARP_DECLINE:        { label: '⚠ Sharp Decline >25%',  color: '#f85149' },
    DECLINING:            { label: '↘ Declining Income',     color: '#f0883e' },
    DECLINING_USE_RECENT: { label: '↘ Use Recent Year',      color: '#f0883e' },
    MISSING_YEAR:         { label: '✗ Requires 2 Years',     color: '#f85149' },
    ONE_YEAR_ONLY:        { label: 'ⓘ 1-Year History',       color: '#e8a838' },
  }
  const info = flagInfo[flag] || { label: flag, color: '#556070' }
  return (
    <span style={{
      fontSize: 10, color: info.color, background: info.color + '15',
      border: `1px solid ${info.color}40`, padding: '1px 6px',
      borderRadius: 3, fontFamily: 'IBM Plex Mono', fontWeight: 500
    }}>
      {info.label}
    </span>
  )
}

export function Spinner({ label }) {
  return (
    <span className="pulse" style={{ color: '#bc8cff', fontSize: 12 }}>
      {label || 'Loading…'}
    </span>
  )
}

export function ErrorBox({ message }) {
  return (
    <div style={{
      background: '#f8514922', border: '1px solid #f85149',
      borderRadius: 6, padding: 12, color: '#f85149', fontSize: 12
    }}>
      ⚠ {message}
    </div>
  )
}
