import { useEffect, useRef, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'

const ADDON_DEFS = [
  { id:'icewater',  label:'Ice & Water Shield Upgrade', icon:'🧊' },
  { id:'ridgevent', label:'Ridge Vent (full length)',   icon:'💨' },
  { id:'boots',     label:'Pipe Boot Replacements',     icon:'🔩' },
  { id:'chimney',   label:'Chimney Flashing',           icon:'🏗️' },
  { id:'skylight',  label:'Skylight Flashing/Cricket',  icon:'🔆' },
  { id:'drip',      label:'Drip Edge Upgrade',          icon:'💧' },
  { id:'gutters',   label:'Gutter Remove & Replace',    icon:'🌧️' },
  { id:'solar',     label:'Solar Panel Remove/Reset',   icon:'☀️' },
]

const blankCustomer = { name:'', phone:'', email:'', address:'', city:'', state:'', zip:'', lat:null, lng:null, rep:'', ghlId:'', notes:'' }
const blankScope    = { roofType:'shingle', tileSubtype:'flat', squares:14, pitch:5, stories:1, layers:1, deckingSheets:0, permit:0, addons:[] }

const REP_STORAGE_KEY = 'gpr_last_rep'

const NOTES_TEMPLATES = {
  shingle:      'Standard architectural shingle tear-off and re-install. Check decking integrity during tear-off. Confirm color choice with homeowner before order. Run magnetic sweep daily.',
  tile_flat:    'Flat concrete tile reset. Reuse existing tiles where possible — order ~10% replacements for breakage. Confirm tile color + finish. Inspect underlayment and replace as needed.',
  'tile_s-type':'S-type concrete tile re-install. Confirm tile profile and color match. Inspect flashings around chimney/skylight/valleys. Plan for staged delivery of pallets.',
}

function getNotesTemplate(roofType, tileSubtype) {
  if (roofType === 'tile') return NOTES_TEMPLATES[`tile_${tileSubtype}`] || NOTES_TEMPLATES.tile_flat
  return NOTES_TEMPLATES.shingle
}
const ALL_NOTES_TEMPLATES = Object.values(NOTES_TEMPLATES)

export default function Home() {
  const router = useRouter()
  const [tab, setTab]           = useState('dashboard')
  const [step, setStep]         = useState(0)
  const [customer, setCustomer] = useState(blankCustomer)
  const [scope, setScope]       = useState(blankScope)
  const [photos, setPhotos]     = useState([])
  const [settings, setSettings] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [result, setResult]     = useState(null)
  const [genError, setGenError] = useState('')
  const [openProposal, setOpenProposal] = useState(null)

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => setSettings(d.settings)).catch(() => {})
  }, [])

  // Sales Rep auto-remember: on mount, hydrate from localStorage. On change, persist.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = window.localStorage.getItem(REP_STORAGE_KEY)
    if (saved) setCustomer(c => c.rep ? c : { ...c, rep: saved })
  }, [])
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (customer.rep) window.localStorage.setItem(REP_STORAGE_KEY, customer.rep)
  }, [customer.rep])

  // Inspection notes auto-template: fill when roofType/tileSubtype changes, but only if
  // the field is empty OR still contains a previous auto-template (rep hasn't customized).
  useEffect(() => {
    const next = getNotesTemplate(scope.roofType, scope.tileSubtype)
    setCustomer(c => {
      if (!c.notes || ALL_NOTES_TEMPLATES.includes(c.notes)) return { ...c, notes: next }
      return c
    })
  }, [scope.roofType, scope.tileSubtype])

  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const r = await fetch('/api/webhook')
        if (!r.ok) return
        const d = await r.json()
        if (d.contact && (d.contact.firstName || d.contact.lastName || d.contact.email)) {
          setCustomer(c => ({
            ...c,
            name:    [d.contact.firstName, d.contact.lastName].filter(Boolean).join(' ') || c.name,
            phone:   d.contact.phone || c.phone,
            email:   d.contact.email || c.email,
            address: [d.contact.address, d.contact.city, d.contact.state, d.contact.zip].filter(Boolean).join(', ') || c.address,
            ghlId:   d.contact.ghlContactId || c.ghlId,
          }))
        }
      } catch {}
    }, 5000)
    return () => clearInterval(t)
  }, [])

  function reset() {
    setStep(0); setCustomer(blankCustomer); setScope(blankScope); setPhotos([]); setResult(null); setGenError('')
  }

  async function generate() {
    setGenerating(true); setGenError('')
    try {
      // 1. Generate the proposal WITHOUT photos (keeps body under Vercel's 4.5MB limit)
      const r = await fetch('/api/generate', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ customer, scope }),
      })
      const ct = r.headers.get('content-type') || ''
      if (!ct.includes('application/json')) {
        // Vercel returned an HTML error page (usually body too large or 504)
        const txt = await r.text().catch(() => '')
        throw new Error('Server error (' + r.status + '). ' + txt.slice(0, 120))
      }
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Generation failed')

      // 2. Upload photos (if any) one batch at a time to the new proposal id
      const payloads = photos.map(p => p._payload).filter(Boolean)
      if (payloads.length) {
        try {
          // chunk to keep each request well under the 12MB body limit
          const CHUNK = 3
          for (let i = 0; i < payloads.length; i += CHUNK) {
            const slice = payloads.slice(i, i + CHUNK)
            await fetch(`/api/proposal/${d.id}/photos`, {
              method:'POST', headers:{'Content-Type':'application/json'},
              body: JSON.stringify({ files: slice }),
            })
          }
        } catch (photoErr) {
          // Don't fail the whole generate if photos upload partially — surface a soft warning
          console.error('photo upload err', photoErr)
        }
      }

      setResult(d)
    } catch (e) {
      setGenError(e.message || String(e))
    } finally { setGenerating(false) }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <>
      <Head>
        <title>Good People Roofing — Proposal Builder</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <nav className="nav">
        <div className="brand">
          <img src="/logo.png" alt="Good People Roofing" className="brand-logo" />
          <div>
            <div className="brand-name">GOOD PEOPLE ROOFING</div>
            <div className="brand-sub">PROPOSAL BUILDER</div>
          </div>
        </div>
        <div className="nav-right">
          <span className="nav-status">⬤ LIVE</span>
          <button className="nav-logout" onClick={logout}>Sign Out</button>
        </div>
      </nav>

      <div className="tabs">
        <button className={`tab ${tab==='dashboard'?'on':''}`} onClick={() => setTab('dashboard')}>📊 Dashboard</button>
        <button className={`tab ${tab==='builder'?'on':''}`}   onClick={() => setTab('builder')}>📋 Build</button>
        <button className={`tab ${tab==='proposals'?'on':''}`} onClick={() => setTab('proposals')}>📁 Proposals</button>
        <button className={`tab ${tab==='customers'?'on':''}`} onClick={() => setTab('customers')}>🏠 Customers</button>
        <button className={`tab ${tab==='reps'?'on':''}`}      onClick={() => setTab('reps')}>👥 Team</button>
        <button className={`tab ${tab==='settings'?'on':''}`}  onClick={() => setTab('settings')}>⚙️ Settings</button>
      </div>

      {tab === 'builder' && (
        result ? (
          <SuccessScreen result={result} onReset={reset} />
        ) : (
          <BuilderFlow
            step={step} setStep={setStep}
            customer={customer} setCustomer={setCustomer}
            scope={scope} setScope={setScope}
            photos={photos} setPhotos={setPhotos}
            generating={generating} genError={genError}
            onGenerate={generate}
            reps={settings?.reps || []}
          />
        )
      )}
      {tab === 'dashboard' && <OwnerDashboard onOpen={setOpenProposal} onGoBuild={() => { setTab('builder'); reset() }} />}
      {tab === 'proposals' && <ProposalsTab onOpenBuilder={() => { setTab('builder'); reset() }} onOpen={setOpenProposal} />}
      {tab === 'customers' && <CustomersTab onOpen={setOpenProposal} />}
      {tab === 'reps'      && <RepsTab />}
      {tab === 'settings'  && settings && <SettingsTab initial={settings} />}

      {openProposal && (
        <ProposalDetail proposal={openProposal} onClose={() => setOpenProposal(null)} onUpdated={(newId) => { setOpenProposal(null); }} />
      )}

      <AssistantWidget />
      <GlobalCSS />
    </>
  )
}

function BuilderFlow({ step, setStep, customer, setCustomer, scope, setScope, photos, setPhotos, generating, genError, onGenerate, reps }) {
  const LABELS = ['Customer', 'Scope', 'Photos', 'Review']
  const canNext =
    step === 0 ? customer.name && customer.phone && customer.email && customer.address && customer.rep :
    step === 1 ? !!scope.roofType && +scope.squares > 0 && +scope.pitch > 0 :
    true

  return (
    <>
      <div className="prog">
        <div className="prog-inner">
          {LABELS.map((lbl, i) => (
            <div key={i} className="prog-step">
              <div className={`prog-circle ${i < step ? 'done' : i === step ? 'active' : ''}`}>{i < step ? '✓' : i + 1}</div>
              <div className={`prog-label ${i < step ? 'done' : i === step ? 'active' : ''}`}>{lbl}</div>
              {i < LABELS.length - 1 && <div className={`prog-line ${i < step ? 'done' : ''}`} />}
            </div>
          ))}
        </div>
      </div>

      <main className="main">
        <div className="card">
          {step === 0 && <StepCustomer customer={customer} setCustomer={setCustomer} reps={reps} />}
          {step === 1 && <StepScope    scope={scope}       setScope={setScope} />}
          {step === 2 && <StepPhotos   photos={photos}     setPhotos={setPhotos} />}
          {step === 3 && <StepReview   customer={customer} scope={scope} photos={photos} onGenerate={onGenerate} generating={generating} genError={genError} />}

          <div className="step-nav">
            <button className="btn btn-back" disabled={step === 0} onClick={() => setStep(step - 1)}>← Back</button>
            {step < 3 && (
              <button className="btn btn-primary" disabled={!canNext} onClick={() => setStep(step + 1)}>Next →</button>
            )}
          </div>
        </div>
      </main>
    </>
  )
}

function StepCustomer({ customer, setCustomer, reps = [] }) {
  const set = (k, v) => setCustomer(c => ({ ...c, [k]: v }))
  function onAddressPick(structured) {
    setCustomer(c => ({ ...c, city: structured.city, state: structured.state, zip: structured.zip, lat: structured.lat, lng: structured.lng }))
  }
  return (
    <div>
      <h2 className="step-title">CUSTOMER INFO</h2>
      <p className="step-sub">Enter the lead — or let GHL auto-fill via webhook.</p>
      <div className="webhook-banner">
        <div className="wb-dot"/>
        <div><div className="wb-text">GHL Webhook Listener Active</div><div className="wb-sub">New contacts auto-populate this form</div></div>
        <div className="wb-badge">LIVE</div>
      </div>
      <div className="grid2">
        <Field label="Full Name *"      value={customer.name}    onChange={v=>set('name',v)}    placeholder="Jane Smith" />
        <Field label="Phone *"          value={customer.phone}   onChange={v=>set('phone',v)}   placeholder="(909) 555-0100" type="tel" />
        <Field label="Email *"          value={customer.email}   onChange={v=>set('email',v)}   placeholder="jane@email.com" type="email" />
        <RepField reps={reps} value={customer.rep} onChange={v=>set('rep',v)} />
        <AddressAutocomplete full label="Property Address *" value={customer.address} onChange={v=>set('address',v)} onPick={onAddressPick} placeholder="Start typing — we'll autofill city/state/zip" />
        {(customer.city || customer.state || customer.zip) && (
          <div className="field full addr-derived">
            <span className="addr-derived-lbl">Auto-detected:</span>
            {customer.city && <span className="addr-pill">📍 {customer.city}</span>}
            {customer.state && <span className="addr-pill">{customer.state}</span>}
            {customer.zip && <span className="addr-pill">{customer.zip}</span>}
            {customer.lat && customer.lng && <span className="addr-pill">{customer.lat.toFixed(4)}, {customer.lng.toFixed(4)}</span>}
          </div>
        )}
        <Field full label="GHL Contact ID (auto-filled)" value={customer.ghlId} onChange={v=>set('ghlId',v)} placeholder="Auto-populated from GHL" />
        <div className="field full">
          <label>Inspection Notes / Project Detail</label>
          <textarea rows={3} value={customer.notes} onChange={e=>set('notes',e.target.value)} placeholder="Auto-template based on roof type — edit as needed" />
        </div>
      </div>
    </div>
  )
}

// Rep selection — dropdown of saved reps with "+ Add new" fallback to free-text.
function RepField({ reps, value, onChange }) {
  const [adding, setAdding] = useState(false)
  const hasRoster = Array.isArray(reps) && reps.length > 0
  if (!hasRoster || adding) {
    return (
      <div className="field">
        <label>Sales Rep *{hasRoster && <button type="button" className="rep-link" onClick={() => setAdding(false)}>· cancel</button>}</label>
        <input type="text" value={value} onChange={e=>onChange(e.target.value)} placeholder="Carlos M." />
      </div>
    )
  }
  return (
    <div className="field">
      <label>Sales Rep *</label>
      <select value={value} onChange={e => {
        const v = e.target.value
        if (v === '__add__') { setAdding(true); onChange('') } else { onChange(v) }
      }}>
        <option value="">— select a rep —</option>
        {reps.map(r => <option key={r.name || r} value={r.name || r}>{r.name || r}</option>)}
        <option value="__add__">+ Add new rep…</option>
      </select>
    </div>
  )
}

function StepScope({ scope, setScope }) {
  const set = (k, v) => setScope(s => ({ ...s, [k]: v }))
  const num = (k, d) => set(k, Math.max(0, +scope[k] + d))
  const tog = id => set('addons', scope.addons.includes(id) ? scope.addons.filter(x => x !== id) : [...scope.addons, id])

  return (
    <div>
      <h2 className="step-title">ROOF & SCOPE</h2>
      <p className="step-sub">Material, measurements, and add-ons. The AI will generate three tier options from this.</p>

      <div className="section-label">ROOF TYPE</div>
      <div className="grid2">
        <button type="button" className={`type-card ${scope.roofType==='shingle'?'on':''}`} onClick={() => set('roofType','shingle')}>
          <div className="type-icon">🏠</div>
          <div className="type-text"><div className="type-name">Architectural Shingle</div><div className="type-desc">Composition asphalt — most common in SoCal</div></div>
          <div className={`radio-dot ${scope.roofType==='shingle'?'sel':''}`}>{scope.roofType==='shingle' && <div className="radio-inner"/>}</div>
        </button>
        <button type="button" className={`type-card ${scope.roofType==='tile'?'on':''}`} onClick={() => set('roofType','tile')}>
          <div className="type-icon">🏛️</div>
          <div className="type-text"><div className="type-name">Tile Roofing</div><div className="type-desc">Flat tile or S-type tile</div></div>
          <div className={`radio-dot ${scope.roofType==='tile'?'sel':''}`}>{scope.roofType==='tile' && <div className="radio-inner"/>}</div>
        </button>
      </div>
      {scope.roofType === 'tile' && (
        <div className="field" style={{marginTop:14, marginBottom:18}}>
          <label>Tile Style</label>
          <select value={scope.tileSubtype} onChange={e=>set('tileSubtype',e.target.value)}>
            <option value="flat">Flat Tile</option>
            <option value="s-type">S-Type Tile</option>
          </select>
        </div>
      )}

      <div className="section-label" style={{marginTop:22}}>MEASUREMENTS</div>
      <div className="scope-grid">
        <Counter label="Total Squares"     hint="1 sq = 100 sq ft"     value={scope.squares}       onMinus={()=>num('squares',-1)} onPlus={()=>num('squares',1)} onChange={v=>set('squares',+v)} />
        <Counter label="Pitch (x/12)"      hint="Steep charge ≥7/12"   value={scope.pitch}         onMinus={()=>num('pitch',-1)}   onPlus={()=>num('pitch',1)}   onChange={v=>set('pitch',+v)} />
        <Counter label="Stories"           hint="2+ adder applies"     value={scope.stories}       onMinus={()=>num('stories',-1)} onPlus={()=>num('stories',1)} onChange={v=>set('stories',+v)} />
        <Counter label="Bad Decking"       hint="$85/sheet (CO)"       value={scope.deckingSheets} onMinus={()=>num('deckingSheets',-1)} onPlus={()=>num('deckingSheets',1)} onChange={v=>set('deckingSheets',+v)} />
        <Counter label="Layers"            hint="2+ = +$25/sq"         value={scope.layers}        onMinus={()=>num('layers',-1)}  onPlus={()=>num('layers',1)}  onChange={v=>set('layers',+v)} />
        <div className="scope-box">
          <div className="scope-box-label">PERMIT</div>
          <select className="scope-permit" value={scope.permit} onChange={e=>set('permit',+e.target.value)}>
            <option value="0">No Permit</option>
            <option value="500">~$500</option>
            <option value="850">~$850</option>
            <option value="1200">~$1,200</option>
          </select>
        </div>
      </div>

      <div className="section-label" style={{marginTop:22}}>ADD-ONS</div>
      <div className="addon-grid">
        {ADDON_DEFS.map(a => {
          const on = scope.addons.includes(a.id)
          return (
            <div key={a.id} className={`addon ${on?'on':''}`} onClick={() => tog(a.id)}>
              <div className="addon-left">
                <div className={`addon-chk ${on?'on':''}`}>{on && '✓'}</div>
                <span className="addon-name">{a.icon} {a.label}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StepPhotos({ photos, setPhotos }) {
  const [busy, setBusy] = useState(false)
  const fileRef = useRef(null)

  async function onFiles(fileList) {
    if (!fileList?.length) return
    setBusy(true)
    try {
      const items = []
      for (const f of fileList) {
        if (!/^image\//.test(f.type)) continue
        if (f.size > 10 * 1024 * 1024) { alert(`${f.name} is over 10MB — skipped`); continue }
        const b64 = await fileToBase64(f)
        items.push({ name: f.name, mime: f.type, base64: b64 })
      }
      const previews = items.map(it => ({
        url: `data:${it.mime};base64,${it.base64}`,
        name: it.name,
        _pending: true,
        _payload: it,
      }))
      setPhotos(p => [...p, ...previews])
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function remove(idx) {
    setPhotos(p => p.filter((_, i) => i !== idx))
  }

  return (
    <div>
      <h2 className="step-title">PHOTOS (OPTIONAL)</h2>
      <p className="step-sub">Snap roof photos on-site. They'll appear on the customer's proposal page — huge trust boost.</p>

      <div className="photo-drop" onClick={() => fileRef.current?.click()}>
        <div className="photo-drop-icon">📷</div>
        <div className="photo-drop-text"><strong>Tap to add photos</strong></div>
        <div className="photo-drop-sub">JPG / PNG / HEIC, up to 10MB each</div>
        <input
          ref={fileRef} type="file" accept="image/*" multiple
          capture="environment"
          style={{ display: 'none' }}
          onChange={e => onFiles(e.target.files)}
        />
      </div>

      {busy && <div className="meta" style={{textAlign:'center',marginTop:10}}>⏳ Loading…</div>}

      {photos.length > 0 && (
        <div className="photo-thumbs">
          {photos.map((ph, i) => (
            <div key={i} className="photo-thumb">
              <img src={ph.url} alt={ph.name || ''} />
              <button className="photo-thumb-x" onClick={() => remove(i)} title="Remove">×</button>
            </div>
          ))}
        </div>
      )}
      <div className="photo-help">
        💡 Photos uploaded here are attached to the proposal automatically when you Generate.
      </div>
    </div>
  )
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => {
      const s = r.result
      const i = s.indexOf(',')
      resolve(i >= 0 ? s.slice(i + 1) : s)
    }
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

function StepReview({ customer, scope, photos, onGenerate, generating, genError }) {
  return (
    <div>
      <h2 className="step-title">REVIEW & GENERATE</h2>
      <p className="step-sub">Confirm the inputs. Hit Generate and the AI writes three customer-facing tier options. You'll get a shareable link.</p>

      <div className="review-grid">
        <div className="review-box">
          <div className="rb-lbl">CUSTOMER</div>
          <div className="rb-name">{customer.name}</div>
          <div className="rb-line">{customer.email}</div>
          <div className="rb-line">{customer.phone}</div>
          <div className="rb-line">{customer.address}</div>
          <div className="rb-line" style={{color:'var(--crimson)',fontWeight:700,marginTop:6}}>Rep: {customer.rep}</div>
        </div>
        <div className="review-box">
          <div className="rb-lbl">SCOPE</div>
          <div className="rb-name">{scope.roofType === 'tile' ? `Tile (${scope.tileSubtype})` : 'Architectural Shingle'}</div>
          <div className="rb-line">{scope.squares} squares · pitch {scope.pitch}/12 · {scope.stories} stor{scope.stories>1?'ies':'y'}</div>
          <div className="rb-line">{scope.layers} layer{scope.layers>1?'s':''} tear-off · {scope.deckingSheets} bad sheets</div>
          <div className="rb-line">Permit: {scope.permit ? '$'+scope.permit : 'none'}</div>
          <div className="rb-line" style={{marginTop:6}}>Add-ons: <strong>{scope.addons.length ? scope.addons.length + ' selected' : 'none'}</strong></div>
          <div className="rb-line">Photos: <strong>{photos.length}</strong></div>
        </div>
      </div>

      {customer.notes && (
        <div className="review-notes">
          <div className="rb-lbl">INSPECTION NOTES</div>
          <div className="rb-line">{customer.notes}</div>
        </div>
      )}

      {genError && <div className="error-banner">⚠️ {genError}</div>}

      <button className="btn-mega" onClick={onGenerate} disabled={generating}>
        {generating ? '⏳ GPT-4 Turbo is writing your three tier options…' : '⚡ GENERATE PROPOSAL WITH AI'}
      </button>
    </div>
  )
}

function SuccessScreen({ result, onReset }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(result.shareUrl); setCopied(true); setTimeout(() => setCopied(false), 1800)
  }
  return (
    <main className="main">
      <div className="card">
        <div className="success-icon">✓</div>
        <h2 className="success-title">Proposal generated!</h2>
        <p className="success-sub">Three tier options ready for the customer. Share this link — they can review, pick a package, and sign on their phone.</p>

        <div className="share-row">
          <input className="share-input" readOnly value={result.shareUrl} onClick={e => e.target.select()} />
          <button className="btn btn-primary" onClick={copy}>{copied ? '✓ Copied' : 'Copy'}</button>
        </div>

        <div className="success-meta">
          <div><span>Proposal #</span><strong>{result.propNum}</strong></div>
          <div><span>Tiers</span><strong>${(result.tiers?.good?.price||0).toLocaleString()} · ${(result.tiers?.better?.price||0).toLocaleString()} · ${(result.tiers?.best?.price||0).toLocaleString()}</strong></div>
        </div>

        <div className="success-btns">
          <a className="btn btn-outline" href={result.shareUrl} target="_blank" rel="noreferrer">👁 View as Customer</a>
          <a className="btn btn-outline" href={`/api/proposal/${result.id}/pdf`} target="_blank" rel="noreferrer">⬇️ PDF</a>
          <button className="btn btn-primary" onClick={onReset}>+ New Proposal</button>
        </div>
      </div>
    </main>
  )
}

function ProposalsTab({ onOpenBuilder, onOpen }) {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [error, setError] = useState('')

  async function load() {
    setLoading(true); setError('')
    try {
      const r = await fetch('/api/proposals')
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setList(d.proposals || [])
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  async function del(id) {
    if (!confirm('Delete this proposal? This cannot be undone.')) return
    await fetch(`/api/proposal/${id}`, { method:'DELETE' })
    load()
  }
  function copy(id) {
    const url = `${location.origin}/p/${id}`
    navigator.clipboard.writeText(url); alert('Link copied:\n' + url)
  }

  const filtered = q ? list.filter(p => {
    const hay = [p.customer_name, p.prop_num, p.customer_address, p.rep_name, p.customer_email, p.customer_phone].filter(Boolean).join(' ').toLowerCase()
    return hay.includes(q.toLowerCase())
  }) : list

  return (
    <main className="main wide">
      <div className="card">
        <div className="proposals-head">
          <div><h2 className="step-title">ALL PROPOSALS</h2><p className="step-sub">Live database. Click any row to edit with AI.</p></div>
          <div className="proposals-actions">
            <input className="search" placeholder="Search name, address, rep…" value={q} onChange={e=>setQ(e.target.value)} />
            <button className="btn btn-primary btn-sm" onClick={onOpenBuilder}>+ New</button>
            <button className="btn btn-outline btn-sm" onClick={load}>↻</button>
          </div>
        </div>

        {error && <div className="error-banner">⚠️ {error}</div>}

        {loading ? (
          <div className="empty"><div className="empty-icon">⏳</div>Loading…</div>
        ) : !filtered.length ? (
          <div className="empty"><div className="empty-icon">📋</div><strong>No proposals yet</strong><div>Create your first one in the Build tab</div></div>
        ) : (
          <div className="ptable-wrap">
            <table className="ptable">
              <thead><tr><th>#</th><th>Customer</th><th>Roof</th><th>Status</th><th>Selected</th><th>Views</th><th>Created</th><th></th></tr></thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} onClick={() => onOpen(p)} style={{cursor:'pointer'}}>
                    <td className="mono">
                      {p.prop_num}
                      {p.version_num > 1 && <span className="version-pill">v{p.version_num}</span>}
                    </td>
                    <td>
                      <div className="ptable-name">{p.customer_name}</div>
                      <div className="ptable-meta">{p.rep_name || '—'} · {p.customer_address || ''}</div>
                    </td>
                    <td>{p.roof_type === 'tile' ? '🏛️ Tile' : '🏠 Shingle'} {p.squares}sq</td>
                    <td><StatusBadge status={p.status} /></td>
                    <td>{p.selected_tier ? <TierPill tier={p.selected_tier} tiers={p.tiers}/> : <span className="meta">—</span>}</td>
                    <td className="mono" style={{fontWeight:800,color:'var(--navy)'}}>{p.view_count || 0}</td>
                    <td className="meta">{new Date(p.created_at).toLocaleDateString()}</td>
                    <td className="action-cell" onClick={e => e.stopPropagation()} style={{whiteSpace:'nowrap'}}>
                      <button className="btn-icon" onClick={() => copy(p.id)} title="Copy link">🔗</button>
                      <a className="btn-icon" href={`/p/${p.id}`} target="_blank" rel="noreferrer" title="Open">👁</a>
                      <a className="btn-icon" href={`/api/proposal/${p.id}/pdf`} target="_blank" rel="noreferrer" title="PDF">⬇️</a>
                      <button className="btn-icon" onClick={() => onOpen(p)} title="AI Edit">✨</button>
                      <button className="btn-icon danger" onClick={() => del(p.id)} title="Delete">🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}

function StatusBadge({ status }) {
  const map = {
    draft:    ['#FEF3C7','#92400E'],
    sent:     ['#DBEAFE','#1E40AF'],
    viewed:   ['#E0E7FF','#3730A3'],
    accepted: ['#D1FAE5','#065F46'],
    signed:   ['#D1FAE5','#065F46'],
    expired:  ['#F3F4F6','#6B7280'],
  }
  const [bg, fg] = map[status] || map.draft
  return <span className="status-pill" style={{background:bg,color:fg}}>{(status||'draft').toUpperCase()}</span>
}
function TierPill({ tier, tiers }) {
  const c = { good:'#4A5568', better:'#B01E17', best:'#D4960E' }[tier]
  const name = tiers?.[tier]?.name || tier
  return <span className="tier-pill" style={{background:c}}>{name}</span>
}

function ProposalDetail({ proposal, onClose, onUpdated }) {
  const [chat, setChat] = useState([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [pendingPatch, setPendingPatch] = useState(null)
  const [reason, setReason] = useState('')
  const [fieldToken, setFieldToken] = useState(proposal.field_token || null)
  const [showField, setShowField] = useState(false)
  const [inspections, setInspections] = useState([])
  const [creatingInsp, setCreatingInsp] = useState(false)

  // Re-fetch the proposal to get a fresh field_token if we didn't get one from the list.
  useEffect(() => {
    if (fieldToken) return
    fetch(`/api/proposal/${proposal.id}`).then(r => r.json()).then(d => {
      if (d.field_token) setFieldToken(d.field_token)
    }).catch(() => {})
  }, [proposal.id, fieldToken])

  // Load existing inspections for this proposal
  useEffect(() => {
    fetch(`/api/inspections?proposal_id=${proposal.id}`).then(r => r.json()).then(d => {
      setInspections(d.inspections || [])
    }).catch(() => {})
  }, [proposal.id])

  async function newInspection() {
    setCreatingInsp(true)
    try {
      const r = await fetch('/api/inspections', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposal_id:      proposal.id,
          customer_name:    proposal.customer_name,
          customer_address: proposal.customer_address,
          customer_phone:   proposal.customer_phone || null,
          customer_email:   proposal.customer_email || null,
          rep_name:         proposal.rep_name || null,
          ghl_contact_id:   proposal.ghl_contact_id || null,
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Failed to create inspection')
      window.location.href = `/inspection/${d.inspection.id}`
    } catch (e) { alert(e.message) }
    finally { setCreatingInsp(false) }
  }

  async function sendChat() {
    const inst = draft.trim()
    if (!inst || busy) return
    setChat(c => [...c, { role: 'user', text: inst }])
    setDraft(''); setBusy(true)
    try {
      const r = await fetch(`/api/proposal/${proposal.id}/chat-edit`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ instruction: inst }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'AI editor failed')
      setPendingPatch(d.patch)
      setChat(c => [...c, { role: 'assistant', text: d.patch.edit_summary || 'Here are the changes I plan to make.', patch: d.patch }])
    } catch (e) {
      setChat(c => [...c, { role: 'assistant', text: '⚠️ ' + e.message }])
    } finally { setBusy(false) }
  }

  async function applyPatch() {
    if (!pendingPatch) return
    setBusy(true)
    try {
      const body = { ...pendingPatch, edit_reason: reason || pendingPatch.edit_summary }
      delete body.edit_summary
      const r = await fetch(`/api/proposal/${proposal.id}/edit`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(body),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Edit failed')
      setChat(c => [...c, { role: 'assistant', text: `✅ v${(proposal.version_num || 1) + 1} created. New link: ${d.shareUrl}` }])
      setPendingPatch(null); setReason('')
      if (onUpdated) onUpdated(d.id)
    } catch (e) {
      setChat(c => [...c, { role: 'assistant', text: '⚠️ ' + e.message }])
    } finally { setBusy(false) }
  }

  function discardPatch() {
    setPendingPatch(null); setReason('')
    setChat(c => [...c, { role: 'assistant', text: '🗑 Discarded.' }])
  }

  const shareUrl = typeof window !== 'undefined' ? `${location.origin}/p/${proposal.id}` : ''
  const fieldUrl = typeof window !== 'undefined' && fieldToken
    ? `${location.origin}/field/${proposal.id}?t=${encodeURIComponent(fieldToken)}`
    : ''

  return (
    <div className="detail-overlay" onClick={onClose}>
      <div className="detail-panel" onClick={e => e.stopPropagation()}>
        <div className="detail-head">
          <div>
            <div className="meta" style={{fontSize:11,fontWeight:900,letterSpacing:1.2}}>PROPOSAL {proposal.prop_num}</div>
            <h2 style={{fontSize:22,fontWeight:900,color:'var(--navy)',margin:'4px 0'}}>{proposal.customer_name}</h2>
            <div className="meta">{proposal.customer_address || '—'}</div>
          </div>
          <button className="btn-icon" onClick={onClose} style={{fontSize:20}}>×</button>
        </div>

        <div className="detail-body">
          <div className="detail-summary">
            <div><span>Roof</span><strong>{proposal.roof_type === 'tile' ? 'Tile' : 'Shingle'} · {proposal.squares} sq</strong></div>
            <div><span>Status</span><strong><StatusBadge status={proposal.status} /></strong></div>
            <div><span>Views</span><strong>{proposal.view_count || 0}</strong></div>
            <div><span>Selected</span><strong>{proposal.selected_tier ? <TierPill tier={proposal.selected_tier} tiers={proposal.tiers}/> : '—'}</strong></div>
          </div>

          <div className="detail-link">
            <input readOnly value={shareUrl} onClick={e => e.target.select()} />
            <button className="btn btn-outline btn-sm" onClick={() => { navigator.clipboard.writeText(shareUrl); alert('Copied') }}>Copy</button>
            <a className="btn btn-outline btn-sm" href={shareUrl} target="_blank" rel="noreferrer">Open</a>
          </div>

          <div className="field-link-block">
            <div className="field-link-head">
              <div>
                <div className="field-link-title">📲 Field Link</div>
                <div className="field-link-sub">For the rep on-site — opens straight to camera. Valid 30 days.</div>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => setShowField(s => !s)} disabled={!fieldUrl}>
                {showField ? 'Hide' : (fieldUrl ? 'Show' : 'Loading…')}
              </button>
            </div>
            {showField && fieldUrl && (
              <div className="field-link-body">
                <div className="detail-link">
                  <input readOnly value={fieldUrl} onClick={e => e.target.select()} />
                  <button className="btn btn-outline btn-sm" onClick={() => { navigator.clipboard.writeText(fieldUrl); alert('Copied') }}>Copy</button>
                  <a className="btn btn-outline btn-sm" href={fieldUrl} target="_blank" rel="noreferrer">Open</a>
                </div>
                <div className="field-link-qr-row">
                  <img
                    className="field-link-qr"
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(fieldUrl)}`}
                    alt="Field Link QR code"
                  />
                  <div className="field-link-hint">
                    <strong>Two ways to use:</strong>
                    <ol>
                      <li>SMS the link to the rep's phone</li>
                      <li>Or have them scan this QR on-site</li>
                    </ol>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="inspection-block">
            <div className="inspection-head">
              <div>
                <div className="inspection-title">🔍 Site Inspection</div>
                <div className="inspection-sub">Step-by-step on-site assessment. Auto-generates a printable report.</div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={newInspection} disabled={creatingInsp}>
                {creatingInsp ? 'Creating…' : '+ New Inspection'}
              </button>
            </div>
            {inspections.length > 0 && (
              <ul className="inspection-list">
                {inspections.map(ins => (
                  <li key={ins.id}>
                    <div className="inspection-row">
                      <div>
                        <span className="inspection-num">{ins.inspection_num}</span>
                        <span className={`inspection-status inspection-status-${ins.status}`}>{(ins.status || 'draft').toUpperCase()}</span>
                      </div>
                      <div className="meta">{new Date(ins.updated_at).toLocaleDateString()}</div>
                      <div className="inspection-actions">
                        <a className="btn btn-outline btn-sm" href={`/inspection/${ins.id}`} target="_blank" rel="noreferrer">{ins.status === 'submitted' ? 'View' : 'Continue'}</a>
                        {ins.status === 'submitted' && <a className="btn btn-outline btn-sm" href={`/inspection/${ins.id}/pdf`} target="_blank" rel="noreferrer">📄 Report</a>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {!inspections.length && (
              <div className="inspection-empty">No inspections yet. Tap "+ New Inspection" to start a step-by-step assessment.</div>
            )}
          </div>

          <div className="ai-chat">
            <div className="ai-chat-head">
              <div className="ai-chat-title">✨ AI Editor</div>
              <div className="ai-chat-sub">Describe the change in plain English. I'll preview it before saving as v{(proposal.version_num || 1) + 1}.</div>
            </div>

            <div className="ai-chat-msgs">
              {chat.length === 0 && (
                <div className="ai-chat-hint">
                  Try: <em>"Add ridge vent and drop the Best tier price by 5%"</em> · <em>"Change the rep to David"</em> · <em>"Make the Better tier sound more premium"</em>
                </div>
              )}
              {chat.map((m, i) => (
                <div key={i} className={`ai-msg ${m.role}`}>
                  <div className="ai-msg-bubble">{m.text}</div>
                  {m.patch && <PatchPreview patch={m.patch} />}
                </div>
              ))}
              {busy && <div className="ai-msg assistant"><div className="ai-msg-bubble">⏳ Thinking…</div></div>}
            </div>

            {pendingPatch && (
              <div className="ai-confirm">
                <input
                  className="ai-confirm-reason"
                  placeholder="Optional: why this edit (saved to history)"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                />
                <div className="ai-confirm-btns">
                  <button className="btn btn-back btn-sm" onClick={discardPatch}>Discard</button>
                  <button className="btn btn-primary btn-sm" onClick={applyPatch}>✓ Apply &amp; create v{(proposal.version_num || 1) + 1}</button>
                </div>
              </div>
            )}

            <div className="ai-chat-input">
              <textarea
                rows={2}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendChat() }}
                placeholder="Tell the AI what to change…"
                disabled={busy || !!pendingPatch}
              />
              <button className="btn btn-primary" onClick={sendChat} disabled={busy || !!pendingPatch || !draft.trim()}>Send</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PatchPreview({ patch }) {
  const rows = []
  if (patch.customer)         rows.push(['Customer', JSON.stringify(patch.customer)])
  if (patch.scope)            rows.push(['Scope', JSON.stringify(patch.scope)])
  if (patch.addons?.add?.length)    rows.push(['Add-ons +', patch.addons.add.join(', ')])
  if (patch.addons?.remove?.length) rows.push(['Add-ons −', patch.addons.remove.join(', ')])
  if (patch.tier_overrides) {
    for (const k of ['good','better','best']) {
      if (patch.tier_overrides[k]) rows.push([`${k} override`, JSON.stringify(patch.tier_overrides[k])])
    }
  }
  if (patch.tier_price_pct) {
    for (const k of ['good','better','best']) {
      if (typeof patch.tier_price_pct[k] === 'number') rows.push([`${k} price %`, (patch.tier_price_pct[k] >= 0 ? '+' : '') + patch.tier_price_pct[k] + '%'])
    }
  }
  if (patch.regenerate_with_ai) rows.push(['Regenerate AI tiers', 'YES'])
  if (!rows.length) return null
  return (
    <div className="patch-preview">
      <div className="patch-preview-title">Proposed changes</div>
      {rows.map(([k, v], i) => (
        <div key={i} className="patch-row"><span>{k}</span><code>{v}</code></div>
      ))}
    </div>
  )
}

function SettingsTab({ initial }) {
  const [settings, setSettings] = useState(initial)
  const [savedAt, setSavedAt] = useState(null)
  const [busy, setBusy] = useState(false)

  function set(path, val) {
    const next = JSON.parse(JSON.stringify(settings))
    const keys = path.split('.'); let o = next
    while (keys.length > 1) o = o[keys.shift()]
    o[keys[0]] = val
    setSettings(next)
  }

  async function save() {
    setBusy(true)
    try {
      const r = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ settings }) })
      if (!r.ok) throw new Error('Save failed')
      setSavedAt(new Date().toLocaleTimeString())
    } catch (e) { alert(e.message) }
    finally { setBusy(false) }
  }

  return (
    <main className="main wide">
      <div className="card">
        <div className="proposals-head">
          <div><h2 className="step-title">PRICING SETTINGS</h2><p className="step-sub">Per-square base rates. Changes apply to all reps.</p></div>
          <div>
            {savedAt && <span className="meta" style={{marginRight:10}}>✓ Saved at {savedAt}</span>}
            <button className="btn btn-primary btn-sm" onClick={save} disabled={busy}>{busy ? 'Saving…' : '💾 Save'}</button>
          </div>
        </div>

        <SettingSection title="🏠 Shingle Pricing (per square)">
          {['good','better','best'].map(k => (
            <SettingRow key={k} label={`${k[0].toUpperCase()+k.slice(1)} tier`} value={settings.shingle[k]} onChange={v=>set(`shingle.${k}`, +v)} />
          ))}
        </SettingSection>

        <SettingSection title="🏛️ Tile Pricing (per square)">
          {['good','better','best'].map(k => (
            <SettingRow key={k} label={`${k[0].toUpperCase()+k.slice(1)} tier`} value={settings.tile[k]} onChange={v=>set(`tile.${k}`, +v)} />
          ))}
        </SettingSection>

        <SettingSection title="⚡ Automatic Adders">
          <SettingRow label="Steep pitch (≥7/12) per sq" value={settings.adders.steep}  onChange={v=>set('adders.steep',+v)} />
          <SettingRow label="2nd story per sq"           value={settings.adders.story2} onChange={v=>set('adders.story2',+v)} />
          <SettingRow label="Extra layer per sq"         value={settings.adders.layer}  onChange={v=>set('adders.layer',+v)} />
          <SettingRow label="Decking sheet"              value={settings.adders.decking} onChange={v=>set('adders.decking',+v)} />
        </SettingSection>

        <SettingSection title="🔧 Add-On Prices">
          {ADDON_DEFS.map(a => (
            <SettingRow key={a.id} label={a.label} value={settings.addons[a.id]} onChange={v=>set(`addons.${a.id}`,+v)} />
          ))}
        </SettingSection>

        <SettingSection title="👤 Sales Rep Roster">
          <div className="setting-row" style={{flexDirection:'column',alignItems:'stretch',background:'transparent',padding:0,gap:8}}>
            {(settings.reps || []).map((r, i) => (
              <div key={i} className="rep-row">
                <input type="text" value={r.name || ''} onChange={e => {
                  const next = [...(settings.reps || [])]
                  next[i] = { ...next[i], name: e.target.value }
                  set('reps', next)
                }} placeholder="Rep name" />
                <button type="button" className="btn btn-back btn-sm" onClick={() => {
                  const next = (settings.reps || []).filter((_, j) => j !== i)
                  set('reps', next)
                }}>×</button>
              </div>
            ))}
            <button type="button" className="btn btn-outline btn-sm" onClick={() => set('reps', [...(settings.reps || []), { name: '' }])}>+ Add Rep</button>
          </div>
        </SettingSection>

        <SettingSection title="💳 Financing (shown on /p/[id])">
          <div className="setting-row">
            <div className="setting-label">Show financing widget</div>
            <input type="checkbox" checked={settings.financing?.enabled !== false} onChange={e => set('financing.enabled', e.target.checked)} style={{width:'auto'}} />
          </div>
          <SettingRow label="APR (%)"        value={settings.financing?.apr || 7.99}   onChange={v=>set('financing.apr',+v)} />
          <SettingRow label="Term (months)"  value={settings.financing?.termMonths || 120} onChange={v=>set('financing.termMonths',+v)} />
        </SettingSection>
      </div>
    </main>
  )
}

function SettingSection({ title, children }) {
  return (
    <div className="settings-section">
      <div className="settings-title">{title}</div>
      <div className="settings-rows">{children}</div>
    </div>
  )
}
function SettingRow({ label, value, onChange }) {
  return (
    <div className="setting-row">
      <div className="setting-label">{label}</div>
      <input type="number" value={value} onChange={e=>onChange(e.target.value)} />
    </div>
  )
}

function Field({ label, value, onChange, placeholder, full, type='text' }) {
  return (
    <div className={`field${full?' full':''}`}>
      <label>{label}</label>
      <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} />
    </div>
  )
}

// Address autocomplete via OpenStreetMap Nominatim (free, no key).
// Swap baseUrl + parsing later if upgrading to Google Places.
function AddressAutocomplete({ label, value, onChange, onPick, placeholder, full }) {
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState([])
  const [hover, setHover] = useState(-1)
  const [loading, setLoading] = useState(false)
  const debRef = useRef(null)
  const inputRef = useRef(null)
  const lastQuery = useRef('')

  function fetchSuggestions(q) {
    if (q.length < 4 || q === lastQuery.current) return
    lastQuery.current = q
    setLoading(true)
    const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=us&limit=5&q=${encodeURIComponent(q)}`
    fetch(url, { headers: { 'Accept-Language': 'en' } })
      .then(r => r.json())
      .then(data => {
        const formatted = (data || [])
          .map(d => ({
            label: d.display_name,
            compact: formatAddress(d.address),
            structured: {
              city:  d.address?.city || d.address?.town || d.address?.village || d.address?.hamlet || d.address?.suburb || '',
              state: d.address?.state || '',
              zip:   d.address?.postcode || '',
              lat:   d.lat ? Number(d.lat) : null,
              lng:   d.lon ? Number(d.lon) : null,
            },
          }))
          .filter(r => r.compact)
        setResults(formatted)
        setOpen(formatted.length > 0)
        setHover(-1)
      })
      .catch(() => { setResults([]); setOpen(false) })
      .finally(() => setLoading(false))
  }

  function onInput(v) {
    onChange(v)
    if (debRef.current) clearTimeout(debRef.current)
    debRef.current = setTimeout(() => fetchSuggestions(v), 350)
  }

  function pick(item) {
    onChange(item.compact)
    if (onPick && item.structured) onPick(item.structured)
    setOpen(false); setResults([]); setHover(-1)
    inputRef.current?.blur()
  }

  return (
    <div className={`field addr-wrap${full ? ' full' : ''}`}>
      <label>{label}</label>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => onInput(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setHover(h => Math.min(h + 1, results.length - 1)); setOpen(true) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHover(h => Math.max(h - 1, 0)) }
          else if (e.key === 'Enter' && open && hover >= 0) { e.preventDefault(); pick(results[hover]) }
          else if (e.key === 'Escape') { setOpen(false) }
        }}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
      />
      {loading && <div className="addr-loading">searching…</div>}
      {open && results.length > 0 && (
        <ul className="addr-dropdown" role="listbox">
          {results.map((r, i) => (
            <li
              key={i}
              role="option"
              aria-selected={i === hover}
              className={i === hover ? 'on' : ''}
              onMouseEnter={() => setHover(i)}
              onMouseDown={e => { e.preventDefault(); pick(r) }}
            >
              <span className="addr-pin">📍</span>
              <span>{r.compact}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function formatAddress(a) {
  if (!a) return ''
  const street = [a.house_number, a.road].filter(Boolean).join(' ')
  const city = a.city || a.town || a.village || a.hamlet || a.suburb || a.county || ''
  const state = a.state || ''
  const zip = a.postcode || ''
  if (!street || !city) return ''
  return [street, city, state, zip].filter(Boolean).join(', ')
}
function Counter({ label, hint, value, onMinus, onPlus, onChange }) {
  return (
    <div className="scope-box">
      <div className="scope-box-label">{label}</div>
      <div className="scope-num">
        <button type="button" onClick={onMinus} aria-label="decrease">−</button>
        <input type="number" inputMode="numeric" value={value} onChange={e=>onChange(e.target.value)} />
        <button type="button" onClick={onPlus} aria-label="increase">+</button>
      </div>
      <div className="scope-hint">{hint}</div>
    </div>
  )
}

/* ─────────────── AI ASSISTANT WIDGET (v3.4) ─────────────── */
function AssistantWidget() {
  const [open, setOpen]       = useState(false)
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi! Ask me anything about your proposals — stats, hot leads, a specific customer…" },
  ])
  const [input, setInput]     = useState('')
  const [busy, setBusy]       = useState(false)
  const endRef = useRef(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, open])

  async function send() {
    const text = input.trim()
    if (!text || busy) return
    const next = [...messages, { role: 'user', content: text }]
    setMessages(next); setInput(''); setBusy(true)
    try {
      const r = await fetch('/api/assistant', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.filter(m => m.role !== 'system') }),
      })
      const d = await r.json()
      setMessages(m => [...m, { role: 'assistant', content: r.ok ? (d.reply || '(no answer)') : ('⚠️ ' + (d.error || 'error')) }])
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', content: '⚠️ ' + e.message }])
    } finally { setBusy(false) }
  }

  return (
    <>
      <button className="assist-fab" onClick={() => setOpen(o => !o)} title="AI Assistant">
        {open ? '✕' : '💬'}
      </button>
      {open && (
        <div className="assist-panel">
          <div className="assist-head">🤖 AI Assistant</div>
          <div className="assist-body">
            {messages.map((m, i) => (
              <div key={i} className={`assist-msg ${m.role}`}>{m.content}</div>
            ))}
            {busy && <div className="assist-msg assistant">…thinking</div>}
            <div ref={endRef} />
          </div>
          <div className="assist-input">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') send() }}
              placeholder="Ask about your proposals…"
              disabled={busy}
            />
            <button onClick={send} disabled={busy || !input.trim()}>Send</button>
          </div>
        </div>
      )}
    </>
  )
}

/* ─────────────── CUSTOMERS TAB (v3.3) ─────────────── */
function CustomersTab({ onOpen }) {
  const [list, setList]   = useState(null)
  const [error, setError] = useState('')
  const [q, setQ]         = useState('')
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    fetch('/api/proposals')
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setList(d.proposals || []) })
      .catch(e => setError(e.message))
  }, [])

  if (error) return <main className="main"><div className="card"><div className="error-banner">⚠️ {error}</div></div></main>
  if (!list) return <main className="main"><div className="card"><div className="empty"><div className="empty-icon">⏳</div>Loading customers…</div></div></main>

  const customers = groupCustomers(list)
  const filtered = q
    ? customers.filter(c => (c.name + ' ' + c.email + ' ' + c.phone + ' ' + c.address).toLowerCase().includes(q.toLowerCase()))
    : customers

  return (
    <main className="main">
      <div className="card">
        <div className="proposals-head">
          <div><h2 className="step-title">CUSTOMERS</h2><p className="step-sub">Every customer, grouped across all their proposals.</p></div>
          <input className="search" placeholder="Search customers…" value={q} onChange={e => setQ(e.target.value)} />
        </div>

        {!filtered.length ? (
          <div className="empty"><div className="empty-icon">🏠</div><strong>No customers yet</strong><div>Customers appear here once you build proposals.</div></div>
        ) : (
          <table className="ptable">
            <thead><tr><th>Customer</th><th>Proposals</th><th>Status</th><th>Closed Value</th><th>Last Activity</th></tr></thead>
            <tbody>
              {filtered.map(c => (
                <CustomerRow key={c.key} c={c} expanded={expanded === c.key}
                  onToggle={() => setExpanded(expanded === c.key ? null : c.key)} onOpen={onOpen} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  )
}

function CustomerRow({ c, expanded, onToggle, onOpen }) {
  return (
    <>
      <tr onClick={onToggle} style={{cursor:'pointer'}}>
        <td>
          <div className="ptable-name">{expanded ? '▾ ' : '▸ '}{c.name}</div>
          <div className="ptable-meta">{c.email || c.phone || c.address || ''}</div>
        </td>
        <td>{c.proposals.length}</td>
        <td><StatusBadge status={c.latestStatus} /></td>
        <td><strong>{c.closedValue ? repMoney(c.closedValue) : '—'}</strong></td>
        <td className="meta">{c.lastActivity ? relTime(c.lastActivity) : '—'}</td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={5} style={{background:'#F7F6F3',padding:'10px 14px'}}>
            {c.proposals.map(p => (
              <div key={p.id} className="cust-prop" onClick={() => onOpen && onOpen(p)}>
                <span className="mono">{p.prop_num}{p.version_num > 1 ? ` v${p.version_num}` : ''}</span>
                <span>{p.roof_type === 'tile' ? '🏛️ Tile' : '🏠 Shingle'} · {p.squares}sq</span>
                <StatusBadge status={p.status} />
                <span className="meta">{new Date(p.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </td>
        </tr>
      )}
    </>
  )
}

/** Group the proposals list into unique customers (keyed by email → phone → name). */
function groupCustomers(list) {
  const isClosed = p => p.status === 'accepted' || p.status === 'signed'
  const ticket = p => {
    if (p.accepted_total) return Number(p.accepted_total) || 0
    const t = p.tiers?.[p.selected_tier]
    return t?.price ? Number(t.price) || 0 : 0
  }
  const byKey = new Map()
  for (const p of list) {
    const key = (p.customer_email || p.customer_phone || p.customer_name || 'unknown').trim().toLowerCase()
    if (!byKey.has(key)) {
      byKey.set(key, {
        key, name: p.customer_name || 'Unknown', email: p.customer_email || '',
        phone: p.customer_phone || '', address: p.customer_address || '',
        proposals: [], closedValue: 0, lastActivity: null, latestStatus: 'sent',
      })
    }
    const c = byKey.get(key)
    c.proposals.push(p)
    if (isClosed(p)) c.closedValue += ticket(p)
    const stamps = [p.created_at, p.viewed_at, p.accepted_at].filter(Boolean)
    for (const s of stamps) {
      if (!c.lastActivity || new Date(s) > new Date(c.lastActivity)) c.lastActivity = s
    }
  }
  // latest status = status of the customer's most-recently-created proposal
  for (const c of byKey.values()) {
    c.proposals.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    c.latestStatus = c.proposals[0]?.status || 'sent'
  }
  return [...byKey.values()].sort((a, b) =>
    new Date(b.lastActivity || 0) - new Date(a.lastActivity || 0))
}

/* ─────────────── OWNER DASHBOARD (v3.2) ─────────────── */
function OwnerDashboard({ onOpen, onGoBuild }) {
  const [list, setList]   = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/proposals')
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setList(d.proposals || []) })
      .catch(e => setError(e.message))
  }, [])

  if (error) return <main className="main"><div className="card"><div className="error-banner">⚠️ {error}</div></div></main>
  if (!list) return <main className="main"><div className="card"><div className="empty"><div className="empty-icon">⏳</div>Loading dashboard…</div></div></main>

  if (!list.length) {
    return (
      <main className="main"><div className="card">
        <h2 className="step-title">DASHBOARD</h2>
        <div className="empty"><div className="empty-icon">📊</div><strong>No proposals yet</strong>
          <div>Build your first proposal and your numbers will appear here.</div>
          <button className="btn btn-primary" style={{marginTop:14}} onClick={onGoBuild}>+ Build a Proposal</button>
        </div>
      </div></main>
    )
  }

  const m = computeDashboard(list)

  return (
    <main className="main">
      <div className="card">
        <h2 className="step-title">DASHBOARD</h2>
        <p className="step-sub">Live overview of your proposal pipeline.</p>

        {/* KPI strip */}
        <div className="kpi-row kpi-row-6">
          <KpiCard label="Revenue Closed"  value={repMoney(m.revenue)} accent />
          <KpiCard label="Conversion"      value={repPct(m.conversion)} />
          <KpiCard label="Open Pipeline"   value={repMoney(m.pipeline)} />
          <KpiCard label="Avg Deal"        value={repMoney(Math.round(m.avgDeal))} />
          <KpiCard label="Avg Close Time"  value={repDuration(m.avgTta != null ? Math.round(m.avgTta) : null)} />
          <KpiCard label="Active Reps"     value={m.repCount} accent />
        </div>

        <div className="dash-grid">
          {/* Conversion funnel */}
          <div className="dash-panel">
            <div className="dash-panel-title">CONVERSION FUNNEL</div>
            {[['Sent', m.funnel.sent, '#16305E'], ['Viewed', m.funnel.viewed, '#D4960E'], ['Accepted', m.funnel.accepted, '#10B981']].map(([lbl, n, c]) => (
              <div key={lbl} className="funnel-row">
                <div className="funnel-lbl">{lbl}</div>
                <div className="funnel-track">
                  <div className="funnel-fill" style={{ width: `${m.funnel.sent ? Math.max(4, (n / m.funnel.sent) * 100) : 0}%`, background: c }}>{n}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Tier mix */}
          <div className="dash-panel">
            <div className="dash-panel-title">ACCEPTED TIER MIX</div>
            {m.accepted.length === 0 ? (
              <div className="dash-muted">No accepted proposals yet.</div>
            ) : (
              [['good','Essential','#4A5568'], ['better','Performance','#B01E17'], ['best','Signature','#D4960E']].map(([k, lbl, c]) => (
                <div key={k} className="funnel-row">
                  <div className="funnel-lbl">{lbl}</div>
                  <div className="funnel-track">
                    <div className="funnel-fill" style={{ width: `${m.accepted.length ? Math.max(4, (m.tierMix[k] / m.accepted.length) * 100) : 0}%`, background: c }}>{m.tierMix[k]}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Hot leads */}
          <div className="dash-panel">
            <div className="dash-panel-title">🔥 HOT LEADS <span className="dash-hint">opened 2+ times, not yet signed</span></div>
            {m.hotLeads.length === 0 ? (
              <div className="dash-muted">No hot leads right now.</div>
            ) : m.hotLeads.map(p => (
              <div key={p.id} className="hot-lead" onClick={() => onOpen && onOpen(p)}>
                <div>
                  <div className="hot-name">{p.customer_name}</div>
                  <div className="hot-meta">#{p.prop_num} · {p.rep_name || 'no rep'}</div>
                </div>
                <div className="hot-views">{p.view_count}× views</div>
              </div>
            ))}
          </div>

          {/* Activity feed */}
          <div className="dash-panel">
            <div className="dash-panel-title">LIVE ACTIVITY</div>
            {m.events.map((e, i) => (
              <div key={i} className="activity-item">
                <span className="activity-icon">{e.type === 'created' ? '📝' : e.type === 'viewed' ? '👁' : '✅'}</span>
                <span className="activity-text">
                  <strong>{e.p.customer_name}</strong> — {e.type === 'created' ? 'proposal created' : e.type === 'viewed' ? 'opened the proposal' : 'accepted ' + (e.p.selected_tier || '')}
                </span>
                <span className="activity-time">{relTime(e.t)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Leaderboard */}
        <div className="dash-panel" style={{marginTop:16}}>
          <div className="dash-panel-title">REP LEADERBOARD</div>
          <table className="ptable">
            <thead><tr><th>#</th><th>Rep</th><th>Sent</th><th>Closed</th><th>Revenue</th></tr></thead>
            <tbody>
              {m.leaderboard.map((r, i) => (
                <tr key={r.rep}>
                  <td><span className={`rank ${i===0 && r.accepted>0 ? 'gold' : ''}`}>{i+1}</span></td>
                  <td className="ptable-name">{r.rep}</td>
                  <td>{r.sent}</td>
                  <td><strong>{r.accepted}</strong></td>
                  <td><strong>{repMoney(r.revenue)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}

/** Crunch the proposals list into every dashboard metric. Pure function. */
function computeDashboard(list) {
  const isClosed = p => p.status === 'accepted' || p.status === 'signed'
  const ticket = p => {
    if (p.accepted_total) return Number(p.accepted_total) || 0
    const t = p.tiers?.[p.selected_tier]
    return t?.price ? Number(t.price) || 0 : 0
  }
  const estimate = p => {
    const t = p.tiers?.better || p.tiers?.good
    return t?.price ? Number(t.price) || 0 : 0
  }

  const accepted = list.filter(isClosed)
  const viewed   = list.filter(p => p.viewed_at)
  const openPipe = list.filter(p => p.status === 'sent' || p.status === 'viewed')

  const revenue  = accepted.reduce((s, p) => s + ticket(p), 0)
  const pipeline = openPipe.reduce((s, p) => s + estimate(p), 0)

  const ttaHours = accepted
    .map(p => {
      if (!p.created_at || !p.accepted_at) return null
      const ms = new Date(p.accepted_at).getTime() - new Date(p.created_at).getTime()
      return ms >= 0 ? ms / 3600000 : null
    })
    .filter(x => x != null)

  const reps = new Set(list.map(p => (p.rep_name || '').trim().toLowerCase()).filter(Boolean))

  const hotLeads = list
    .filter(p => (p.view_count || 0) >= 2 && !isClosed(p))
    .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
    .slice(0, 6)

  const events = []
  for (const p of list) {
    if (p.created_at)  events.push({ t: p.created_at,  type: 'created',  p })
    if (p.viewed_at)   events.push({ t: p.viewed_at,   type: 'viewed',   p })
    if (p.accepted_at) events.push({ t: p.accepted_at, type: 'accepted', p })
  }
  events.sort((a, b) => new Date(b.t).getTime() - new Date(a.t).getTime())

  const tierMix = { good: 0, better: 0, best: 0 }
  for (const p of accepted) if (tierMix[p.selected_tier] != null) tierMix[p.selected_tier]++

  const byRep = new Map()
  for (const p of list) {
    const key = (p.rep_name || '').trim() || 'Unassigned'
    if (!byRep.has(key)) byRep.set(key, { rep: key, sent: 0, accepted: 0, revenue: 0 })
    const r = byRep.get(key)
    r.sent++
    if (isClosed(p)) { r.accepted++; r.revenue += ticket(p) }
  }
  const leaderboard = [...byRep.values()].sort((a, b) => b.accepted - a.accepted || b.revenue - a.revenue)

  return {
    accepted, revenue, pipeline,
    avgDeal:    accepted.length ? revenue / accepted.length : 0,
    avgTta:     ttaHours.length ? ttaHours.reduce((a, b) => a + b, 0) / ttaHours.length : null,
    conversion: list.length ? accepted.length / list.length : 0,
    repCount:   reps.size,
    hotLeads,
    events:     events.slice(0, 12),
    funnel:     { sent: list.length, viewed: viewed.length, accepted: accepted.length },
    tierMix,
    leaderboard,
  }
}

/** Relative time like "3h ago" / "2d ago". */
function relTime(iso) {
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return ''
  const mins = Math.floor(ms / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return mins + 'm ago'
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return hrs + 'h ago'
  const days = Math.floor(hrs / 24)
  return days + 'd ago'
}

/* ─────────────── TEAM / REPS TAB ─────────────── */
function RepsTab() {
  const [range, setRange]     = useState('all')   // 30d | 90d | all
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  async function load(win) {
    setLoading(true); setError('')
    try {
      const r = await fetch(`/api/reps?window=${win}`)
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Failed to load')
      setData(d)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { load(range) }, [range])

  const reps   = data?.reps || []
  const totals = data?.totals || { sent: 0, viewed: 0, accepted: 0, revenue: 0, acceptRate: 0 }

  return (
    <main className="main">
      <div className="card">
        <div className="proposals-head">
          <div><h2 className="step-title">TEAM PERFORMANCE</h2><p className="step-sub">Per-rep proposal stats — ranked by deals closed.</p></div>
          <div className="win-toggle">
            {[['30d','30 Days'],['90d','90 Days'],['all','All-Time']].map(([v, lbl]) => (
              <button key={v} className={`win-btn ${range===v?'on':''}`} onClick={() => setRange(v)}>{lbl}</button>
            ))}
          </div>
        </div>

        {error && <div className="error-banner">⚠️ {error}</div>}

        {loading ? (
          <div className="empty"><div className="empty-icon">⏳</div>Loading…</div>
        ) : (
          <>
            <div className="kpi-row">
              <KpiCard label="Proposals Sent"  value={totals.sent} />
              <KpiCard label="Deals Closed"    value={totals.accepted} accent />
              <KpiCard label="Accept Rate"     value={repPct(totals.acceptRate)} />
              <KpiCard label="Revenue Closed"  value={repMoney(totals.revenue)} accent />
            </div>

            {!reps.length ? (
              <div className="empty"><div className="empty-icon">📊</div><strong>No data for this window</strong><div>Proposals created in range will show up here</div></div>
            ) : (
              <table className="ptable">
                <thead><tr>
                  <th>#</th><th>Rep</th><th>Sent</th><th>Viewed</th><th>Closed</th>
                  <th>Accept&nbsp;%</th><th>Avg&nbsp;Ticket</th><th>Avg&nbsp;Close&nbsp;Time</th><th>Revenue</th>
                </tr></thead>
                <tbody>
                  {reps.map((r, i) => (
                    <tr key={r.rep_name}>
                      <td><span className={`rank ${i===0 && r.accepted>0 ? 'gold' : ''}`}>{i+1}</span></td>
                      <td className="ptable-name">{r.rep_name}</td>
                      <td>{r.sent}</td>
                      <td>{r.viewed}</td>
                      <td><strong>{r.accepted}</strong></td>
                      <td>{repPct(r.acceptRate)}</td>
                      <td>{r.avgTicket ? repMoney(r.avgTicket) : '—'}</td>
                      <td>{repDuration(r.avgHoursToAccept)}</td>
                      <td><strong>{repMoney(r.revenue)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </main>
  )
}

function KpiCard({ label, value, accent }) {
  return (
    <div className={`kpi ${accent ? 'accent' : ''}`}>
      <div className="kpi-val">{value}</div>
      <div className="kpi-lbl">{label}</div>
    </div>
  )
}
function repPct(n)   { return Math.round((n || 0) * 100) + '%' }
function repMoney(n) { return '$' + (n || 0).toLocaleString() }
function repDuration(hours) {
  if (hours == null) return '—'
  if (hours < 48) return hours + 'h'
  return (hours / 24).toFixed(1) + 'd'
}

function GlobalCSS() {
  return (
    <style jsx global>{`
      :root{--navy:#0C1C38;--navy2:#16305E;--crimson:#B01E17;--crimson-h:#D4251C;--gold:#D4960E;--gold-l:#F0B429;--cream:#F7F6F3;--card:#fff;--bord:#E2E0DB;--text:#1A1A2E;--mute:#4A5568;--light:#9CA3AF;--success:#10B981}
      *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
      html,body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;background:var(--cream);color:var(--text);min-height:100vh;-webkit-text-size-adjust:100%}
      .nav{background:var(--navy);border-bottom:4px solid var(--crimson);padding:14px 24px;display:flex;align-items:center;justify-content:space-between;gap:12px}
      .brand{display:flex;align-items:center;gap:12px;min-width:0}
      .brand-logo{height:48px;width:auto;background:#fff;border-radius:9px;padding:5px;flex-shrink:0}
      .brand-name{color:var(--gold-l);font-weight:900;font-size:14px;letter-spacing:1.4px}
      .brand-sub{color:rgba(255,255,255,.42);font-size:9px;letter-spacing:2.2px;margin-top:2px;font-weight:700}
      .nav-right{display:flex;gap:10px;align-items:center;flex-shrink:0}
      .nav-status{background:var(--success);color:#fff;font-size:10px;font-weight:900;letter-spacing:1px;padding:5px 11px;border-radius:20px}
      .nav-logout{background:rgba(255,255,255,.08);color:rgba(255,255,255,.7);border:1px solid rgba(255,255,255,.15);padding:7px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit}
      .nav-logout:hover{background:rgba(255,255,255,.15);color:#fff}
      .tabs{background:var(--navy2);display:flex;border-bottom:2px solid rgba(255,255,255,.08);overflow-x:auto;-webkit-overflow-scrolling:touch}
      .tab{padding:14px 22px;font-size:13px;font-weight:800;color:rgba(255,255,255,.5);background:none;border:none;cursor:pointer;border-bottom:3px solid transparent;font-family:inherit;letter-spacing:.5px;transition:all .15s;white-space:nowrap;flex-shrink:0}
      .tab.on{color:#fff;border-bottom-color:var(--crimson)}
      .tab:hover:not(.on){color:rgba(255,255,255,.8)}
      .prog{background:rgba(0,0,0,.18);padding:16px 22px;overflow:hidden}
      .prog-inner{max-width:780px;margin:0 auto;display:flex;align-items:center}
      .prog-step{display:flex;align-items:center;flex:1;gap:8px;min-width:0}
      .prog-step:last-child{flex:0}
      .prog-circle{width:34px;height:34px;border-radius:50%;border:2px solid rgba(255,255,255,.2);background:rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.4);font-size:13px;font-weight:900;flex-shrink:0;transition:all .2s}
      .prog-circle.active{background:var(--crimson);border-color:var(--crimson);color:#fff}
      .prog-circle.done{background:var(--success);border-color:var(--success);color:#fff}
      .prog-label{font-size:11px;color:rgba(255,255,255,.4);font-weight:700;letter-spacing:.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .prog-label.active{color:#fff}
      .prog-label.done{color:var(--gold-l)}
      .prog-line{flex:1;height:3px;background:rgba(255,255,255,.12);margin:0 4px;border-radius:2px;min-width:8px}
      .prog-line.done{background:var(--success)}
      .main{max-width:980px;margin:0 auto;padding:28px 18px 60px}
      .main.wide{max-width:1320px}
      .card{background:var(--card);border-radius:18px;padding:32px 36px;box-shadow:0 4px 24px rgba(0,0,0,.06)}
      .step-title{font-size:22px;font-weight:900;letter-spacing:.4px;margin-bottom:4px;color:var(--navy)}
      .step-sub{color:var(--mute);font-size:13px;margin-bottom:20px;line-height:1.5}
      .section-label{font-size:11px;font-weight:900;color:var(--mute);text-transform:uppercase;letter-spacing:1.4px;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid var(--bord)}
      .grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
      .field{display:flex;flex-direction:column}
      .field.full{grid-column:1/-1}
      .field label{font-size:12px;font-weight:700;margin-bottom:5px;color:var(--mute)}
      .field input,.field textarea,.field select{padding:12px 14px;border:2px solid var(--bord);border-radius:9px;font-size:14px;font-family:inherit;outline:none;transition:border-color .15s;background:#fff;color:var(--text);font-weight:600}
      .field textarea{resize:vertical;min-height:80px}
      .field input:focus,.field textarea:focus,.field select:focus{border-color:var(--crimson)}
      .addr-wrap{position:relative}
      .addr-loading{position:absolute;right:14px;top:38px;font-size:11px;color:var(--light);pointer-events:none}
      .addr-dropdown{position:absolute;top:100%;left:0;right:0;margin-top:4px;background:#fff;border:2px solid var(--bord);border-radius:9px;list-style:none;max-height:240px;overflow-y:auto;z-index:50;box-shadow:0 12px 32px rgba(0,0,0,.12)}
      .addr-dropdown li{padding:11px 14px;cursor:pointer;font-size:13px;color:var(--text);border-bottom:1px solid var(--bord);display:flex;align-items:flex-start;gap:8px;line-height:1.4}
      .addr-dropdown li:last-child{border-bottom:none}
      .addr-dropdown li.on,.addr-dropdown li:hover{background:rgba(176,30,23,.05)}
      .addr-pin{flex-shrink:0;font-size:14px}
      .addr-derived{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:8px 12px;background:#ECFDF5;border:1px solid #A7F3D0;border-radius:9px;font-size:12px}
      .addr-derived-lbl{color:#065F46;font-weight:800;letter-spacing:.5px;text-transform:uppercase;font-size:10px;margin-right:2px}
      .addr-pill{display:inline-block;padding:3px 9px;background:#fff;border:1px solid #A7F3D0;border-radius:20px;font-weight:700;color:#065F46;font-size:11px}
      .rep-link{background:none;border:none;color:var(--mute);font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;padding:0;margin-left:4px}
      .rep-link:hover{color:var(--crimson)}
      .rep-row{display:flex;gap:8px;align-items:center}
      .rep-row input{flex:1;padding:9px 12px;border:2px solid var(--bord);border-radius:7px;font-size:13px;font-family:inherit;font-weight:600;outline:none;background:#fff}
      .rep-row input:focus{border-color:var(--crimson)}
      .webhook-banner{background:linear-gradient(135deg,var(--navy),var(--navy2));border-radius:12px;padding:14px 18px;margin-bottom:18px;display:flex;align-items:center;gap:12px}
      .wb-dot{width:11px;height:11px;border-radius:50%;background:var(--success);box-shadow:0 0 12px var(--success);flex-shrink:0;animation:pulse 2s infinite}
      @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
      .wb-text{color:#fff;font-size:13px;font-weight:800}
      .wb-sub{color:rgba(255,255,255,.5);font-size:11px;margin-top:2px}
      .wb-badge{margin-left:auto;background:rgba(16,185,129,.2);border:1px solid var(--success);color:var(--success);font-size:10px;font-weight:900;padding:4px 10px;border-radius:20px}
      .type-card{display:flex;align-items:center;gap:12px;background:#fff;border:3px solid var(--bord);border-radius:12px;padding:14px;cursor:pointer;text-align:left;font-family:inherit;color:inherit;transition:all .15s;width:100%}
      .type-card:hover{border-color:var(--crimson)}
      .type-card.on{border-color:var(--crimson);background:rgba(176,30,23,.04);box-shadow:0 0 0 3px rgba(176,30,23,.1)}
      .type-icon{font-size:28px;flex-shrink:0}
      .type-text{flex:1;min-width:0}
      .type-name{font-weight:900;font-size:14px}
      .type-desc{font-size:11px;color:var(--mute);margin-top:2px}
      .radio-dot{width:22px;height:22px;border-radius:50%;border:2px solid var(--bord);display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-left:auto;margin-right:4px}
      .radio-dot.sel{background:var(--crimson);border-color:var(--crimson)}
      .radio-inner{width:8px;height:8px;border-radius:50%;background:#fff}
      .scope-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
      .scope-box{background:var(--cream);border-radius:11px;padding:13px 14px;border:2px solid var(--bord)}
      .scope-box-label{font-size:10px;font-weight:900;color:var(--mute);text-transform:uppercase;letter-spacing:1.1px;margin-bottom:8px}
      .scope-num{display:flex;gap:6px;align-items:center}
      .scope-num button{width:36px;height:36px;border-radius:7px;border:2px solid var(--bord);background:#fff;font-size:18px;cursor:pointer;font-weight:900;color:var(--mute);font-family:inherit;flex-shrink:0;touch-action:manipulation}
      .scope-num button:hover,.scope-num button:active{border-color:var(--crimson);color:var(--crimson)}
      .scope-num input{flex:1 1 0;width:0;text-align:center;border:2px solid var(--bord);border-radius:7px;padding:7px;font-size:16px;font-weight:900;font-family:inherit;outline:none;min-width:0;-webkit-appearance:none;appearance:none;-moz-appearance:textfield}
      .scope-num input::-webkit-outer-spin-button,.scope-num input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
      .scope-num{min-width:0}
      .scope-box{min-width:0;overflow:hidden}
      .scope-num input:focus{border-color:var(--crimson)}
      .scope-hint{font-size:10px;color:var(--light);margin-top:5px}
      .scope-box select,.scope-permit{width:100%;border:2px solid var(--bord);border-radius:7px;font-family:inherit;font-weight:600;outline:none;background:#fff;padding:8px 10px;font-size:13px;margin-top:6px;color:var(--text)}
      .scope-permit:focus{border-color:var(--crimson)}
      .addon-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .addon{display:flex;justify-content:space-between;align-items:center;background:var(--cream);border:2px solid var(--bord);border-radius:10px;padding:12px 14px;cursor:pointer;transition:all .15s;min-height:48px}
      .addon:hover{border-color:var(--crimson)}
      .addon.on{border-color:var(--crimson);background:rgba(176,30,23,.04)}
      .addon-left{display:flex;align-items:center;gap:11px}
      .addon-chk{width:22px;height:22px;border-radius:5px;border:2px solid var(--bord);background:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;color:#fff;flex-shrink:0}
      .addon-chk.on{background:var(--crimson);border-color:var(--crimson)}
      .addon-name{font-size:13px;font-weight:700}
      .photo-drop{border:3px dashed var(--bord);border-radius:14px;padding:36px 20px;text-align:center;cursor:pointer;background:var(--cream);transition:all .15s}
      .photo-drop:hover{border-color:var(--crimson);background:#fff}
      .photo-drop-icon{font-size:48px;margin-bottom:12px}
      .photo-drop-text{font-size:16px;color:var(--navy);margin-bottom:4px}
      .photo-drop-sub{font-size:12px;color:var(--mute)}
      .photo-thumbs{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;margin-top:18px}
      .photo-thumb{position:relative;aspect-ratio:1;border-radius:10px;overflow:hidden;border:2px solid var(--bord)}
      .photo-thumb img{width:100%;height:100%;object-fit:cover;display:block}
      .photo-thumb-x{position:absolute;top:6px;right:6px;width:28px;height:28px;border-radius:50%;background:rgba(0,0,0,.7);color:#fff;border:none;font-size:18px;cursor:pointer;font-weight:300;display:flex;align-items:center;justify-content:center;line-height:1}
      .photo-help{margin-top:14px;padding:10px 14px;background:#FFFBEB;border:1px solid #FCD34D;border-radius:8px;font-size:12px;color:#78350F;line-height:1.5}
      .review-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}
      .review-box{background:var(--cream);border-left:5px solid var(--crimson);padding:16px 20px;border-radius:11px}
      .review-box:nth-child(2){border-left-color:var(--gold)}
      .rb-lbl{font-size:11px;font-weight:900;color:var(--mute);letter-spacing:1.3px;margin-bottom:8px}
      .rb-name{font-size:17px;font-weight:900;color:var(--navy);margin-bottom:4px}
      .rb-line{font-size:13px;color:var(--mute);margin-top:2px;line-height:1.5}
      .review-notes{background:var(--cream);border-left:5px solid var(--gold);padding:14px 20px;border-radius:11px;margin-bottom:14px}
      .btn-mega{width:100%;background:linear-gradient(135deg,var(--crimson),var(--crimson-h));color:#fff;border:none;border-radius:14px;padding:20px;font-size:16px;font-weight:900;letter-spacing:1px;cursor:pointer;font-family:inherit;margin-top:18px;box-shadow:0 8px 24px rgba(176,30,23,.25);transition:transform .12s;min-height:60px}
      .btn-mega:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 12px 30px rgba(176,30,23,.32)}
      .btn-mega:disabled{opacity:.6;cursor:not-allowed}
      .step-nav{display:flex;justify-content:space-between;margin-top:24px;gap:10px}
      .btn{padding:12px 24px;border-radius:9px;font-size:14px;font-weight:800;cursor:pointer;border:none;font-family:inherit;letter-spacing:.3px;transition:all .15s;min-height:44px}
      .btn-primary{background:var(--crimson);color:#fff}
      .btn-primary:hover:not(:disabled){background:var(--crimson-h)}
      .btn-back{background:transparent;color:var(--mute);border:2px solid var(--bord) !important}
      .btn-outline{background:transparent;color:var(--crimson);border:2px solid var(--crimson) !important;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:6px}
      .btn-outline:hover{background:var(--crimson);color:#fff}
      .btn-sm{padding:8px 14px;font-size:12px;min-height:36px}
      .btn:disabled{background:#ccc !important;cursor:not-allowed;color:#888;border-color:#ccc !important}
      .error-banner{background:#FEF2F2;border:2px solid #FCA5A5;border-radius:9px;padding:11px 14px;color:#991B1B;font-size:13px;font-weight:700;margin-top:14px}
      .success-icon{width:80px;height:80px;border-radius:50%;background:var(--success);color:#fff;font-size:42px;font-weight:900;display:flex;align-items:center;justify-content:center;margin:0 auto 18px;box-shadow:0 8px 24px rgba(16,185,129,.3)}
      .success-title{text-align:center;font-size:28px;font-weight:900;color:var(--navy);margin-bottom:8px}
      .success-sub{text-align:center;color:var(--mute);max-width:480px;margin:0 auto 24px;font-size:14px;line-height:1.6}
      .share-row{display:flex;gap:8px;margin-bottom:22px}
      .share-input{flex:1;padding:14px 16px;border:2px solid var(--bord);border-radius:9px;font-family:monospace;font-size:12px;color:var(--navy);font-weight:700;background:var(--cream);outline:none;min-width:0}
      .success-meta{display:grid;grid-template-columns:1fr 1fr;gap:12px;background:var(--cream);border-radius:10px;padding:14px 18px;margin-bottom:20px}
      .success-meta div{display:flex;flex-direction:column}
      .success-meta span{font-size:10px;font-weight:900;color:var(--mute);letter-spacing:1.2px}
      .success-meta strong{font-size:13px;color:var(--navy);margin-top:3px}
      .success-btns{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
      .proposals-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;flex-wrap:wrap;gap:14px}
      .proposals-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
      .search{padding:10px 14px;border:2px solid var(--bord);border-radius:8px;font-size:13px;font-family:inherit;outline:none;width:240px;font-weight:600;max-width:100%}
      .search:focus{border-color:var(--crimson)}
      .empty{text-align:center;padding:48px 20px;color:var(--light)}
      .empty-icon{font-size:42px;margin-bottom:10px}
      .empty strong{display:block;font-weight:800;color:var(--text);margin-bottom:4px;font-size:14px}
      .ptable-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
      .ptable{width:100%;border-collapse:collapse;min-width:780px}
      .ptable th{background:var(--navy);color:rgba(255,255,255,.7);font-size:11px;font-weight:900;padding:12px 14px;text-align:left;text-transform:uppercase;letter-spacing:.8px;position:sticky;top:0}
      .ptable td{padding:12px 14px;border-bottom:1px solid var(--bord);font-size:13px;vertical-align:middle}
      .ptable tr:hover td{background:rgba(176,30,23,.03)}
      .ptable-name{font-weight:700}
      .ptable-meta{font-size:11px;color:var(--light);margin-top:1px}
      .meta{color:var(--light);font-size:12px}
      .mono{font-family:monospace;font-weight:800}
      .version-pill{display:inline-block;margin-left:6px;font-size:9px;font-weight:900;color:#fff;background:var(--gold);padding:2px 6px;border-radius:4px;letter-spacing:.5px}
      .status-pill{display:inline-block;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:900;letter-spacing:.5px}
      .tier-pill{display:inline-block;padding:3px 9px;border-radius:5px;font-size:10px;font-weight:900;color:#fff;letter-spacing:.5px}
      .btn-icon{width:32px;height:32px;border:2px solid var(--bord);background:#fff;border-radius:7px;cursor:pointer;font-size:14px;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;color:inherit;margin-right:4px}
      .btn-icon:hover{border-color:var(--crimson)}
      .btn-icon.danger:hover{background:#FEE2E2;border-color:#EF4444}
      .action-cell{text-align:right}
      .settings-section{margin-bottom:28px}
      .settings-title{font-size:14px;font-weight:900;color:var(--navy);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid var(--bord)}
      .settings-rows{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .setting-row{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--cream);border-radius:7px;gap:10px}
      .setting-label{font-size:13px;font-weight:600}
      .setting-row input{width:110px;border:2px solid var(--bord);border-radius:6px;padding:7px 10px;font-size:13px;font-weight:700;font-family:inherit;outline:none;text-align:right}
      .setting-row input:focus{border-color:var(--crimson)}
      .detail-overlay{position:fixed;inset:0;background:rgba(12,28,56,.75);z-index:900;display:flex;align-items:center;justify-content:center;padding:24px}
      .detail-panel{background:#fff;width:100%;max-width:880px;max-height:90vh;border-radius:18px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.4)}
      .detail-head{padding:20px 24px;border-bottom:1px solid var(--bord);display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-shrink:0}
      .detail-body{padding:18px 24px 24px;overflow-y:auto;display:flex;flex-direction:column;gap:18px}
      .detail-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;background:var(--cream);border-radius:11px;padding:14px}
      .detail-summary div{display:flex;flex-direction:column;gap:3px}
      .detail-summary span{font-size:10px;font-weight:900;color:var(--mute);letter-spacing:1.1px}
      .detail-summary strong{font-size:13px;font-weight:800;color:var(--navy)}
      .detail-link{display:flex;gap:8px;align-items:center}
      .detail-link input{flex:1;padding:11px 13px;border:2px solid var(--bord);border-radius:8px;font-family:monospace;font-size:12px;color:var(--navy);font-weight:700;background:var(--cream);outline:none;min-width:0}
      .field-link-block{background:linear-gradient(180deg,#FFFBEB,#fff);border:1px solid #FCD34D;border-radius:12px;padding:14px 16px}
      .field-link-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
      .field-link-title{font-size:14px;font-weight:900;color:var(--navy)}
      .field-link-sub{font-size:11.5px;color:var(--mute);margin-top:2px}
      .field-link-body{margin-top:14px;display:flex;flex-direction:column;gap:14px}
      .field-link-qr-row{display:flex;gap:16px;align-items:center;background:#fff;border:1px solid var(--bord);border-radius:10px;padding:14px}
      .field-link-qr{width:140px;height:140px;flex-shrink:0;border-radius:8px;background:#fff}
      .field-link-hint{font-size:12.5px;color:var(--mute);line-height:1.55}
      .field-link-hint strong{color:var(--navy);font-weight:800;display:block;margin-bottom:6px;font-size:13px}
      .field-link-hint ol{margin:0;padding-left:18px}
      .field-link-hint li{margin-bottom:3px}
      .inspection-block{background:linear-gradient(180deg,#F0FDF4,#fff);border:1px solid #A7F3D0;border-radius:12px;padding:14px 16px}
      .inspection-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}
      .inspection-title{font-size:14px;font-weight:900;color:var(--navy)}
      .inspection-sub{font-size:11.5px;color:var(--mute);margin-top:2px}
      .inspection-list{list-style:none;margin-top:12px;display:flex;flex-direction:column;gap:8px}
      .inspection-row{display:flex;justify-content:space-between;align-items:center;gap:10px;background:#fff;border:1px solid var(--bord);border-radius:9px;padding:10px 14px;flex-wrap:wrap}
      .inspection-num{font-family:monospace;font-weight:800;color:var(--navy);font-size:13px;margin-right:8px}
      .inspection-status{display:inline-block;padding:2px 9px;border-radius:20px;font-size:9px;font-weight:900;letter-spacing:.5px}
      .inspection-status-draft{background:#FEF3C7;color:#92400E}
      .inspection-status-submitted{background:#D1FAE5;color:#065F46}
      .inspection-actions{display:flex;gap:6px;flex-wrap:wrap}
      .inspection-empty{margin-top:12px;padding:14px;background:#fff;border:1px dashed var(--bord);border-radius:9px;font-size:12px;color:var(--mute);text-align:center;font-style:italic}
      .ai-chat{background:linear-gradient(180deg,#FAFAFC,#fff);border:1px solid var(--bord);border-radius:14px;padding:18px;display:flex;flex-direction:column;gap:14px}
      .ai-chat-head{padding-bottom:12px;border-bottom:1px solid var(--bord)}
      .ai-chat-title{font-size:15px;font-weight:900;color:var(--navy)}
      .ai-chat-sub{font-size:12px;color:var(--mute);margin-top:3px}
      .ai-chat-msgs{min-height:120px;max-height:340px;overflow-y:auto;display:flex;flex-direction:column;gap:10px;padding-right:4px}
      .ai-chat-hint{font-size:12px;color:var(--mute);background:#fff;border:1px dashed var(--bord);border-radius:9px;padding:11px;line-height:1.5}
      .ai-chat-hint em{color:var(--navy);font-style:normal;font-weight:600}
      .ai-msg{display:flex;flex-direction:column;gap:6px}
      .ai-msg.user{align-items:flex-end}
      .ai-msg.assistant{align-items:flex-start}
      .ai-msg-bubble{max-width:88%;padding:10px 14px;border-radius:14px;font-size:13px;line-height:1.5}
      .ai-msg.user .ai-msg-bubble{background:var(--navy);color:#fff;border-bottom-right-radius:4px}
      .ai-msg.assistant .ai-msg-bubble{background:#fff;border:1px solid var(--bord);border-bottom-left-radius:4px}
      .patch-preview{background:#FFFBEB;border:1px solid #FCD34D;border-radius:9px;padding:11px;font-size:12px}
      .patch-preview-title{font-weight:900;color:#78350F;margin-bottom:6px;font-size:11px;letter-spacing:.8px;text-transform:uppercase}
      .patch-row{display:flex;gap:8px;padding:3px 0}
      .patch-row span{font-weight:700;color:#92400E;min-width:120px;flex-shrink:0}
      .patch-row code{background:rgba(0,0,0,.05);padding:1px 6px;border-radius:4px;font-size:11px;word-break:break-all}
      .ai-confirm{background:#fff;border:2px solid var(--gold);border-radius:11px;padding:12px;display:flex;flex-direction:column;gap:8px}
      .ai-confirm-reason{padding:10px 12px;border:1.5px solid var(--bord);border-radius:7px;font-size:13px;outline:none;font-family:inherit}
      .ai-confirm-reason:focus{border-color:var(--crimson)}
      .ai-confirm-btns{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}
      .ai-chat-input{display:flex;gap:8px;align-items:flex-end}
      .ai-chat-input textarea{flex:1;padding:11px 13px;border:2px solid var(--bord);border-radius:9px;font-size:14px;font-family:inherit;resize:none;outline:none;font-weight:500}
      .ai-chat-input textarea:focus{border-color:var(--crimson)}
      .ai-chat-input button{align-self:stretch;padding:0 18px}
      @media(max-width:780px){
        .nav{padding:11px 14px;flex-wrap:wrap}
        .brand-name{font-size:13px}
        .brand-sub{display:none}
        .prog{padding:12px 8px}
        .prog-circle{width:24px;height:24px;font-size:10px}
        .prog-label{font-size:10px;letter-spacing:0}
        .prog-step{gap:3px}
        .prog-line{margin:0 2px;min-width:3px}
        .grid2{grid-template-columns:1fr}
        .scope-grid{grid-template-columns:1fr 1fr}
        .addon-grid{grid-template-columns:1fr}
        .review-grid{grid-template-columns:1fr}
        .main{padding:18px 12px 40px}
        .card{padding:22px 18px}
        .tab{padding:12px 16px;font-size:12px}
        .settings-rows{grid-template-columns:1fr}
        .detail-summary{grid-template-columns:repeat(2,1fr)}
        .detail-overlay{align-items:flex-end;padding:0}
        .detail-panel{max-height:96vh;border-radius:14px 14px 0 0}
        .field-link-qr-row{flex-direction:column;text-align:center}
        .field-link-qr{width:160px;height:160px}
        .detail-head{padding:16px 18px}
        .detail-body{padding:14px 18px 18px}
        .ai-chat-input{flex-direction:column;align-items:stretch}
        .step-nav .btn{flex:1}
        .photo-drop-icon{font-size:42px}
        .ptable th,.ptable td{padding:10px 12px;font-size:12px}
        .step-title{font-size:20px}
      }
      @media(max-width:480px){
        .prog-label{display:none}
        .prog-step{gap:0}
        .prog-circle{width:26px;height:26px;font-size:11px}
        .prog{padding:14px 16px}
        .prog-line{margin:0 6px}
        .scope-grid{grid-template-columns:1fr;gap:10px}
        .scope-box{padding:14px 16px}
        .scope-box-label{font-size:11px;margin-bottom:10px}
        .scope-num{gap:10px}
        .scope-num button{width:44px;height:44px;font-size:22px}
        .scope-num input{font-size:18px;padding:10px}
        .scope-hint{font-size:11px;margin-top:7px}
        .scope-box select.scope-permit{padding:12px 14px;font-size:15px;min-height:44px}
        .type-card{padding:16px}
        .type-icon{font-size:32px}
        .type-name{font-size:15px}
        .type-desc{font-size:12px;line-height:1.4}
        .addon{padding:14px 16px;min-height:52px}
        .addon-name{font-size:14px}
        .card{padding:20px 16px}
        .main{padding:14px 10px 40px}
        .kpi-row{grid-template-columns:1fr 1fr}
      }
      /* ── Team / Reps dashboard ── */
      .win-toggle{display:flex;gap:4px;background:#F7F6F3;padding:4px;border-radius:9px;border:2px solid #E2E0DB}
      .win-btn{padding:7px 14px;font-size:12px;font-weight:800;border:none;background:none;border-radius:6px;cursor:pointer;font-family:inherit;color:#4A5568;transition:all .15s}
      .win-btn:hover:not(.on){color:#B01E17}
      .win-btn.on{background:#B01E17;color:#fff}
      .kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px}
      .kpi{background:#F7F6F3;border:2px solid #E2E0DB;border-radius:12px;padding:18px 20px}
      .kpi.accent{background:#0C1C38;border-color:#0C1C38}
      .kpi-val{font-size:26px;font-weight:900;color:#0C1C38;line-height:1.1}
      .kpi.accent .kpi-val{color:#F0B429}
      .kpi-lbl{font-size:11px;font-weight:800;color:#4A5568;letter-spacing:.8px;text-transform:uppercase;margin-top:4px}
      .kpi.accent .kpi-lbl{color:rgba(255,255,255,.55)}
      .rank{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:#F7F6F3;border:2px solid #E2E0DB;font-weight:900;font-size:11px;color:#4A5568}
      .rank.gold{background:#D4960E;border-color:#D4960E;color:#fff}
      /* ── Owner Dashboard (v3.2) ── */
      .kpi-row-6{grid-template-columns:repeat(6,1fr)}
      .dash-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
      .dash-panel{background:#fff;border:2px solid #E2E0DB;border-radius:12px;padding:16px 18px}
      .dash-panel-title{font-size:11px;font-weight:900;color:#4A5568;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:12px}
      .dash-hint{font-weight:600;color:#9CA3AF;letter-spacing:.3px;text-transform:none}
      .dash-muted{font-size:13px;color:#9CA3AF;padding:8px 0}
      .funnel-row{display:flex;align-items:center;gap:10px;margin-bottom:9px}
      .funnel-lbl{font-size:12px;font-weight:700;color:#4A5568;width:84px;flex-shrink:0}
      .funnel-track{flex:1;background:#F7F6F3;border-radius:6px;overflow:hidden}
      .funnel-fill{height:24px;border-radius:6px;color:#fff;font-size:12px;font-weight:900;display:flex;align-items:center;padding:0 9px;min-width:24px;transition:width .3s}
      .hot-lead{display:flex;justify-content:space-between;align-items:center;padding:9px 11px;border-radius:8px;background:#F7F6F3;margin-bottom:7px;cursor:pointer;border:2px solid transparent}
      .hot-lead:hover{border-color:#B01E17}
      .hot-name{font-size:13px;font-weight:800;color:#0C1C38}
      .hot-meta{font-size:11px;color:#9CA3AF;margin-top:1px}
      .hot-views{font-size:12px;font-weight:900;color:#B01E17;background:rgba(176,30,23,.1);padding:3px 9px;border-radius:20px;white-space:nowrap}
      .activity-item{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #F0EFEC;font-size:12px}
      .activity-item:last-child{border-bottom:none}
      .activity-icon{flex-shrink:0}
      .activity-text{flex:1;color:#4A5568;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .activity-time{flex-shrink:0;color:#9CA3AF;font-weight:700;font-size:11px}
      /* ── Customers tab (v3.3) ── */
      .cust-prop{display:flex;align-items:center;gap:12px;padding:7px 9px;border-radius:7px;cursor:pointer;font-size:12px}
      .cust-prop:hover{background:#fff}
      /* ── AI Assistant widget (v3.4) ── */
      .assist-fab{position:fixed;bottom:22px;right:22px;width:56px;height:56px;border-radius:50%;border:none;background:#B01E17;color:#fff;font-size:24px;cursor:pointer;box-shadow:0 6px 20px rgba(176,30,23,.4);z-index:900}
      .assist-fab:hover{background:#D4251C}
      .assist-panel{position:fixed;bottom:88px;right:22px;width:370px;max-width:calc(100vw - 44px);height:480px;max-height:calc(100vh - 130px);background:#fff;border-radius:16px;box-shadow:0 16px 48px rgba(0,0,0,.25);display:flex;flex-direction:column;overflow:hidden;z-index:900}
      .assist-head{background:#0C1C38;color:#F0B429;font-weight:900;font-size:14px;padding:14px 18px;letter-spacing:.5px}
      .assist-body{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:9px}
      .assist-msg{font-size:13px;line-height:1.5;padding:9px 12px;border-radius:11px;max-width:85%;white-space:pre-wrap}
      .assist-msg.user{background:#B01E17;color:#fff;align-self:flex-end;border-bottom-right-radius:3px}
      .assist-msg.assistant{background:#F7F6F3;color:#1A1A2E;align-self:flex-start;border-bottom-left-radius:3px}
      .assist-input{display:flex;gap:7px;padding:11px;border-top:2px solid #E2E0DB}
      .assist-input input{flex:1;border:2px solid #E2E0DB;border-radius:8px;padding:9px 11px;font-size:13px;font-family:inherit;outline:none}
      .assist-input input:focus{border-color:#B01E17}
      .assist-input button{background:#B01E17;color:#fff;border:none;border-radius:8px;padding:0 16px;font-weight:800;font-size:13px;cursor:pointer;font-family:inherit}
      .assist-input button:disabled{background:#ccc;cursor:not-allowed}
      @media(max-width:780px){
        .kpi-row-6{grid-template-columns:1fr 1fr}
        .dash-grid{grid-template-columns:1fr}
      }
    `}</style>
  )
}
