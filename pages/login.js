import { useState, useEffect } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'

export default function Login() {
  const router = useRouter()
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setErr('')
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'Login failed')
      const next = router.query.next || '/'
      router.replace(typeof next === 'string' ? next : '/')
    } catch (e) { setErr(e.message); setBusy(false) }
  }

  return (
    <>
      <Head><title>Sign In — Good People Roofing Builder</title></Head>
      <div className="wrap">
        <div className="card">
          <img src="/logo.png" alt="GPR" className="logo" />
          <h1>Proposal Builder</h1>
          <p className="sub">Sign in to continue.</p>
          <form onSubmit={submit}>
            <label>Password</label>
            <input
              type="password"
              autoFocus
              value={pw}
              onChange={e => setPw(e.target.value)}
              placeholder="••••••••"
            />
            {err && <div className="err">{err}</div>}
            <button type="submit" disabled={busy || !pw}>
              {busy ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
      <style jsx global>{`
        body{margin:0;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;background:#0C1C38;color:#fff;min-height:100vh}
        .wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
        .card{background:#fff;color:#1A1A2E;padding:34px 30px;border-radius:18px;width:100%;max-width:380px;box-shadow:0 24px 60px rgba(0,0,0,.4)}
        .logo{height:64px;width:auto;display:block;margin:0 auto 18px;background:#fff;border-radius:9px;padding:6px}
        h1{font-size:22px;font-weight:900;text-align:center;margin:0 0 6px;color:#0C1C38;letter-spacing:.5px}
        .sub{text-align:center;color:#4A5568;font-size:13px;margin-bottom:22px}
        label{display:block;font-size:12px;font-weight:700;margin-bottom:6px;color:#4A5568}
        input{width:100%;padding:13px 14px;border:2px solid #E2E0DB;border-radius:10px;font-size:15px;font-family:inherit;outline:none;font-weight:600}
        input:focus{border-color:#B01E17}
        .err{background:#FEF2F2;border:1px solid #FCA5A5;color:#991B1B;padding:9px 12px;border-radius:8px;font-size:13px;margin-top:12px;font-weight:700}
        button{width:100%;background:#B01E17;color:#fff;border:none;padding:14px;border-radius:10px;font-size:14px;font-weight:900;letter-spacing:1px;margin-top:18px;cursor:pointer;font-family:inherit;transition:filter .15s}
        button:hover:not(:disabled){filter:brightness(1.1)}
        button:disabled{opacity:.5;cursor:not-allowed}
      `}</style>
    </>
  )
}
