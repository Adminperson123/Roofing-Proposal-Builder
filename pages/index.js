import { useEffect, useState } from 'react'
import Head from 'next/head'

const DEFAULT_SETTINGS = {
  shingle: { good: 680, better: 780, best: 900 },
  tile:    { good: 600, better: 700, best: 850 },
  adders:  { steep: 50, story2: 40, layer: 25, decking: 85 },
  addons:  { icewater:350, ridgevent:450, boots:65, chimney:550, skylight:400, drip:280, gutters:1200, solar:850 },
  company: { name:'Good People Roofing Inc.', lic:'C39 #1126880', phone:'(844) ROOFS-09', email:'info@goodpeoplehi.com', web:'goodpeopleroofinginc.com' },
}

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

const blankCustomer = { name:'', phone:'', email:'', address:'', rep:'', ghlId:'', notes:'' }
const blankScope    = { roofType:'shingle', tileSubtype:'flat', squares:14, pitch:5, stories:1, layers:1, deckingSheets:0, permit:0, addons:[] }

export default function Home() {
  const [tab, setTab]           = useState('builder')
  const [step, setStep]         = useState(0)
  const [customer, setCustomer] = useState(blankCustomer)
  const [scope, setScope]       = useState(blankScope)
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [generating, setGenerating] = useState(false)
  const [result, setResult]     = useState(null)  // { id, propNum, shareUrl, tiers }
  const [genError, setGenError] = useState('')
  const [photos, setPhotos]     = useState([])    // array of downscaled data URLs
  const [analysis, setAnalysis] = useState(null)  // OpenAI Vision result, or null
  const [financingEnabled, setFinancingEnabled] = useState(false)
  const [revisingFrom, setRevisingFrom] = useState(null)  // { id, version } when revising, else null
  const [editReason, setEditReason]     = useState('')    // why this revision is being made

  // Hydrate settings from localStorage (rep-local pricing)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('gpr_settings')
      if (raw) setSettings(s => ({ ...s, ...JSON.parse(raw) }))
    } catch {}
  }, [])
  function persistSettings(next) {
    setSettings(next); try { localStorage.setItem('gpr_settings', JSON.stringify(next)) } catch {}
  }

  // GHL webhook poll — auto-fill customer
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const r = await fetch('/api/webhook')
        const d = await r.json()
        if (d.contact && (d.contact.firstName || d.contact.lastName || d.contact.email)) {
          setCustomer(c => ({
            ...c,
            name:    [d.contact.firstName, d.contact.lastName].filter(Boolean).join(' ') || c.name,
            phone:   d.contact.phone   || c.phone,
            email:   d.contact.email   || c.email,
            address: [d.contact.address, d.contact.city, d.contact.state, d.contact.zip].filter(Boolean).join(', ') || c.address,
          }))
        }
      } catch {}
    }, 3000)
    return () => clearInterval(t)
  }, [])

  function reset() {
    setStep(0); setCustomer(blankCustomer); setScope(blankScope); setResult(null); setGenError('')
    setPhotos([]); setAnalysis(null); setFinancingEnabled(false)
    setRevisingFrom(null); setEditReason('')
  }

  async function generate() {
    setGenerating(true); setGenError('')
    try {
      const r = await fetch('/api/generate', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          customer, scope, settings, photos, visionAnalysis: analysis, financingEnabled,
          reviseOf:   revisingFrom?.id || null,
          editReason: revisingFrom ? editReason : null,
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Generation failed')
      setResult(d)
    } catch (e) { setGenError(e.message) }
    finally { setGenerating(false) }
  }

  // Load an existing proposal back into the builder as the start of a new version.
  // Uses ?noview=1 so this internal reload isn't counted as a customer view.
  async function startRevision(proposalId) {
    try {
      const r = await fetch(`/api/proposal/${proposalId}?noview=1`)
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Could not load proposal')
      setCustomer({
        name: d.customer_name || '', phone: d.customer_phone || '', email: d.customer_email || '',
        address: d.customer_address || '', rep: d.rep_name || '', ghlId: d.ghl_contact_id || '',
        notes: d.inspection_notes || '',
      })
      setScope({
        roofType: d.roof_type || 'shingle', tileSubtype: d.tile_subtype || 'flat',
        squares: d.squares ?? 14, pitch: d.pitch ?? 5, stories: d.stories ?? 1,
        layers: d.layers ?? 1, deckingSheets: d.decking_sheets ?? 0, permit: d.permit_amount ?? 0,
        addons: Array.isArray(d.addons) ? d.addons : [],
      })
      setFinancingEnabled(!!d.financing_enabled)
      setPhotos([])                         // existing photos carry over server-side
      setAnalysis(d.vision_analysis || null)
      setRevisingFrom({ id: d.id, version: d.version_num || 1 })
      setEditReason(''); setResult(null); setGenError(''); setStep(0)
      setTab('builder')
    } catch (e) {
      alert('Could not start revision: ' + e.message)
    }
  }

  return (
    <>
      <Head><title>Good People Roofing — Proposal Builder</title></Head>

      <nav className="nav">
        <div className="brand">
          <img src="/logo.png" alt="Good People Roofing" className="brand-logo" />
          <div>
            <div className="brand-name">GOOD PEOPLE ROOFING</div>
            <div className="brand-sub">PROPOSAL BUILDER</div>
          </div>
        </div>
        <div className="nav-status">⬤ LIVE</div>
      </nav>

      <div className="tabs">
        <button className={`tab ${tab==='builder'?'on':''}`}    onClick={() => setTab('builder')}>📋 Build Proposal</button>
        <button className={`tab ${tab==='proposals'?'on':''}`}  onClick={() => setTab('proposals')}>📁 All Proposals</button>
        <button className={`tab ${tab==='reps'?'on':''}`}       onClick={() => setTab('reps')}>📊 Team</button>
        <button className={`tab ${tab==='settings'?'on':''}`}   onClick={() => setTab('settings')}>⚙️ Settings</button>
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
            analysis={analysis} setAnalysis={setAnalysis}
            financingEnabled={financingEnabled} setFinancingEnabled={setFinancingEnabled}
            revisingFrom={revisingFrom} editReason={editReason} setEditReason={setEditReason}
            generating={generating} genError={genError}
            onGenerate={generate}
          />
        )
      )}
      {tab === 'proposals' && <ProposalsTab onOpenBuilder={() => { setTab('builder'); reset() }} onRevise={startRevision} />}
      {tab === 'reps'      && <RepsTab />}
      {tab === 'settings'  && <SettingsTab settings={settings} onChange={persistSettings} />}

      <GlobalCSS />
    </>
  )
}

/* ─────────────── BUILDER ─────────────── */
function BuilderFlow({ step, setStep, customer, setCustomer, scope, setScope, photos, setPhotos, analysis, setAnalysis, financingEnabled, setFinancingEnabled, revisingFrom, editReason, setEditReason, generating, genError, onGenerate }) {
  const LABELS = ['Customer', 'Roof & Scope', 'Photos & AI', 'Review & Generate']
  const LAST = LABELS.length - 1
  // Step 2 (Photos) is optional — the rep can always advance.
  const canNext = step === 0
    ? customer.name && customer.phone && customer.email && customer.address && customer.rep
    : step === 1 ? !!scope.roofType : true

  return (
    <>
      {revisingFrom && (
        <div className="revise-banner">
          ✏️ <strong>Revising proposal</strong> — generating this will create <strong>version {revisingFrom.version + 1}</strong>.
          The customer's existing link automatically updates to the new version.
        </div>
      )}
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
          {step === 0 && <StepCustomer customer={customer} setCustomer={setCustomer} />}
          {step === 1 && <StepScope    scope={scope}       setScope={setScope} />}
          {step === 2 && <StepPhotos   photos={photos} setPhotos={setPhotos} analysis={analysis} setAnalysis={setAnalysis} customer={customer} scope={scope} onBackToScope={() => setStep(1)} />}
          {step === 3 && <StepReview   customer={customer} scope={scope} photos={photos} analysis={analysis} financingEnabled={financingEnabled} setFinancingEnabled={setFinancingEnabled} revisingFrom={revisingFrom} editReason={editReason} setEditReason={setEditReason} onGenerate={onGenerate} generating={generating} genError={genError} />}

          <div className="step-nav">
            <button className="btn btn-back" disabled={step === 0} onClick={() => setStep(step - 1)}>← Back</button>
            {step < LAST ? (
              <button className="btn btn-primary" disabled={!canNext} onClick={() => setStep(step + 1)}>Next →</button>
            ) : null}
          </div>
        </div>
      </main>
    </>
  )
}

function StepCustomer({ customer, setCustomer }) {
  const set = (k, v) => setCustomer(c => ({ ...c, [k]: v }))
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
        <Field label="Phone *"          value={customer.phone}   onChange={v=>set('phone',v)}   placeholder="(909) 555-0100" />
        <Field label="Email *"          value={customer.email}   onChange={v=>set('email',v)}   placeholder="jane@email.com" />
        <Field label="Sales Rep *"      value={customer.rep}     onChange={v=>set('rep',v)}     placeholder="Carlos M." />
        <Field full label="Property Address *" value={customer.address} onChange={v=>set('address',v)} placeholder="123 Main St, Yucaipa, CA 92399" />
        <Field full label="GHL Contact ID (auto-filled)" value={customer.ghlId} onChange={v=>set('ghlId',v)} placeholder="Auto-populated from GHL" />
        <div className="field full">
          <label>Inspection Notes / Project Detail</label>
          <textarea rows={3} value={customer.notes} onChange={e=>set('notes',e.target.value)} placeholder="2-story, 8/12 pitch, HOA approval pending…" />
        </div>
      </div>
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
          <div><div className="type-name">Architectural Shingle</div><div className="type-desc">Composition asphalt — most common in SoCal</div></div>
          <div className={`radio-dot ${scope.roofType==='shingle'?'sel':''}`}>{scope.roofType==='shingle' && <div className="radio-inner"/>}</div>
        </button>
        <button type="button" className={`type-card ${scope.roofType==='tile'?'on':''}`} onClick={() => set('roofType','tile')}>
          <div className="type-icon">🏛️</div>
          <div><div className="type-name">Tile Roofing</div><div className="type-desc">Flat tile or S-type tile</div></div>
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
        <Counter label="Bad Decking (sheets)" hint="$85/sheet (CO)"    value={scope.deckingSheets} onMinus={()=>num('deckingSheets',-1)} onPlus={()=>num('deckingSheets',1)} onChange={v=>set('deckingSheets',+v)} />
        <Counter label="Layers (tear-off)" hint="2+ = +$25/sq"         value={scope.layers}        onMinus={()=>num('layers',-1)}  onPlus={()=>num('layers',1)}  onChange={v=>set('layers',+v)} />
        <div className="scope-box">
          <div className="scope-box-label">PERMIT</div>
          <select value={scope.permit} onChange={e=>set('permit',+e.target.value)} style={{padding:'7px 10px',fontSize:12,marginTop:6}}>
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

/* ─────────────── STEP: PHOTOS & AI ─────────────── */
const MAX_PHOTOS = 6

// Downscale a File to a JPEG data URL no larger than `maxDim` on its longest edge.
// Phone roof photos are 5-12MB; this brings each one down to ~200-400KB so the
// payload stays small and OpenAI Vision still has plenty of detail.
function fileToDownscaledDataUrl(file, maxDim = 1600) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.onload = e => {
      const img = new Image()
      img.onerror = () => reject(new Error('Could not decode image (HEIC may not be supported on this browser)'))
      img.onload = () => {
        let { width, height } = img
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height)
          width = Math.round(width * scale)
          height = Math.round(height * scale)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

function ConfidenceBadge({ level }) {
  const map = { high: ['#D1FAE5', '#065F46'], medium: ['#FEF3C7', '#92400E'], low: ['#FEE2E2', '#991B1B'] }
  const [bg, fg] = map[level] || map.low
  return <span className="conf-badge" style={{ background: bg, color: fg }}>{(level || 'low').toUpperCase()}</span>
}

function StepPhotos({ photos, setPhotos, analysis, setAnalysis, customer, scope, onBackToScope }) {
  const [busy, setBusy]       = useState(false)   // downscaling files
  const [analyzing, setAnal]  = useState(false)   // calling the AI
  const [err, setErr]         = useState('')

  async function onPick(e) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''  // allow re-picking the same file
    if (!files.length) return
    setErr(''); setBusy(true)
    try {
      const room = MAX_PHOTOS - photos.length
      const toAdd = files.slice(0, room)
      const dataUrls = []
      for (const f of toAdd) {
        try { dataUrls.push(await fileToDownscaledDataUrl(f)) }
        catch (e2) { setErr(e2.message) }
      }
      if (dataUrls.length) {
        setPhotos(p => [...p, ...dataUrls])
        setAnalysis(null)  // photos changed — stale analysis no longer matches
      }
      if (files.length > room) setErr(`Only ${MAX_PHOTOS} photos max — extras were skipped.`)
    } finally { setBusy(false) }
  }

  function removePhoto(i) {
    setPhotos(p => p.filter((_, idx) => idx !== i))
    setAnalysis(null)
  }

  async function analyze() {
    if (!photos.length) return
    setErr(''); setAnal(true)
    try {
      const r = await fetch('/api/analyze-photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: photos,
          context: { customer: customer.name, address: customer.address, notes: customer.notes },
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Analysis failed')
      setAnalysis(d.analysis)
    } catch (e) { setErr(e.message) }
    finally { setAnal(false) }
  }

  return (
    <div>
      <h2 className="step-title">PHOTOS & AI ANALYSIS</h2>
      <p className="step-sub">Optional — but powerful. Add roof photos and let AI give you a second opinion on squares, pitch, material, and damage. You stay in control: the AI <strong>suggests</strong>, you decide.</p>

      <div className="section-label">ROOF PHOTOS <span style={{fontWeight:600,color:'var(--light)'}}>({photos.length}/{MAX_PHOTOS})</span></div>

      <div className="photo-grid">
        {photos.map((src, i) => (
          <div key={i} className="photo-thumb">
            <img src={src} alt={`Roof photo ${i+1}`} />
            <button type="button" className="photo-remove" onClick={() => removePhoto(i)} title="Remove">✕</button>
          </div>
        ))}
        {photos.length < MAX_PHOTOS && (
          <label className={`photo-add ${busy ? 'busy' : ''}`}>
            <input type="file" accept="image/*" capture="environment" multiple onChange={onPick} disabled={busy} />
            <div className="photo-add-icon">{busy ? '⏳' : '＋'}</div>
            <div className="photo-add-text">{busy ? 'Processing…' : 'Add Photos'}</div>
          </label>
        )}
      </div>

      {err && <div className="error-banner">⚠️ {err}</div>}

      {photos.length > 0 && (
        <button className="btn-analyze" onClick={analyze} disabled={analyzing}>
          {analyzing ? '🔍 AI is analyzing the roof…' : `🤖 Analyze ${photos.length} Photo${photos.length>1?'s':''} with AI`}
        </button>
      )}

      {analysis && (
        <div className="analysis-card">
          <div className="analysis-head">
            <div className="analysis-title">🤖 AI ROOF ANALYSIS</div>
            <div className="analysis-score">
              Condition <strong>{analysis.condition_score ?? '—'}/10</strong>
            </div>
          </div>

          <div className="analysis-rows">
            <div className="analysis-row">
              <div className="ar-label">Squares</div>
              <div className="ar-value">{analysis.squares_estimate?.value || '—'}</div>
              <ConfidenceBadge level={analysis.squares_estimate?.confidence} />
            </div>
            <div className="analysis-row">
              <div className="ar-label">Pitch</div>
              <div className="ar-value">{analysis.pitch_estimate?.value || '—'}</div>
              <ConfidenceBadge level={analysis.pitch_estimate?.confidence} />
            </div>
            <div className="analysis-row">
              <div className="ar-label">Material</div>
              <div className="ar-value">{analysis.material_guess?.value || '—'}</div>
              <ConfidenceBadge level={analysis.material_guess?.confidence} />
            </div>
          </div>

          {analysis.damage_summary && (
            <div className="analysis-block">
              <div className="ab-label">Damage Summary</div>
              <div className="ab-text">{analysis.damage_summary}</div>
            </div>
          )}

          {Array.isArray(analysis.recommended_addons) && analysis.recommended_addons.length > 0 && (
            <div className="analysis-block">
              <div className="ab-label">Recommended Add-ons</div>
              <div className="addon-chips">
                {analysis.recommended_addons.map(id => {
                  const def = ADDON_DEFS.find(a => a.id === id)
                  const active = scope.addons.includes(id)
                  return (
                    <span key={id} className={`addon-chip ${active ? 'active' : ''}`}>
                      {def ? `${def.icon} ${def.label}` : id}{active ? ' ✓' : ''}
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {analysis.notes && (
            <div className="analysis-block">
              <div className="ab-label">Notes for the Estimator</div>
              <div className="ab-text">{analysis.notes}</div>
            </div>
          )}

          <div className="analysis-hint">
            💡 These are <strong>AI suggestions</strong>, not final numbers. If you want to adjust the
            scope based on this, <button type="button" className="link-btn" onClick={onBackToScope}>← go back to Roof & Scope</button>.
            The analysis is saved with the proposal either way.
          </div>
        </div>
      )}
    </div>
  )
}

function StepReview({ customer, scope, photos, analysis, financingEnabled, setFinancingEnabled, revisingFrom, editReason, setEditReason, onGenerate, generating, genError }) {
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
        </div>
      </div>

      {customer.notes && (
        <div className="review-notes">
          <div className="rb-lbl">INSPECTION NOTES</div>
          <div className="rb-line">{customer.notes}</div>
        </div>
      )}

      <div className="review-notes" style={{borderLeftColor:'var(--navy)'}}>
        <div className="rb-lbl">PHOTOS & AI</div>
        <div className="rb-line">
          {photos?.length
            ? `${photos.length} roof photo${photos.length>1?'s':''} attached`
            : 'No photos attached'}
          {' · '}
          {analysis
            ? `AI analysis ran (condition ${analysis.condition_score ?? '?'}/10)`
            : 'AI analysis not run'}
        </div>
      </div>

      <div
        className={`financing-toggle ${financingEnabled ? 'on' : ''}`}
        onClick={() => setFinancingEnabled(!financingEnabled)}
        role="checkbox"
        aria-checked={financingEnabled}
      >
        <div className={`fin-chk ${financingEnabled ? 'on' : ''}`}>{financingEnabled && '✓'}</div>
        <div className="fin-text">
          <div className="fin-title">💳 Offer financing on this proposal</div>
          <div className="fin-sub">Adds a "Financing Available" section to the customer's proposal so they can spread the cost into monthly payments.</div>
        </div>
      </div>

      {revisingFrom && (
        <div className="field full" style={{marginTop:14}}>
          <label>Reason for this revision (optional — saved with the proposal history)</label>
          <textarea rows={2} value={editReason} onChange={e=>setEditReason(e.target.value)}
            placeholder="e.g. Customer requested upgraded shingle; added chimney flashing" />
        </div>
      )}

      {genError && <div className="error-banner">⚠️ {genError}</div>}

      <button className="btn-mega" onClick={onGenerate} disabled={generating}>
        {generating
          ? '⏳ AI is writing your three tier options…'
          : revisingFrom
            ? `⚡ GENERATE VERSION ${revisingFrom.version + 1}`
            : '⚡ GENERATE PROPOSAL WITH AI'}
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
        <h2 className="success-title">{result.version > 1 ? `Version ${result.version} created!` : 'Proposal generated!'}</h2>
        <p className="success-sub">
          {result.version > 1
            ? `This is version ${result.version}. The customer's existing link now shows this version automatically — you don't need to re-send it.`
            : 'Three tier options ready for the customer. Share this link — they can review, pick a package, and sign on their phone.'}
        </p>

        <div className="share-row">
          <input className="share-input" readOnly value={result.shareUrl} />
          <button className="btn btn-primary" onClick={copy}>{copied ? '✓ Copied' : 'Copy Link'}</button>
        </div>

        <div className="success-meta">
          <div><span>Proposal #</span><strong>{result.propNum}</strong></div>
          <div><span>Tiers</span><strong>${(result.tiers?.good?.price||0).toLocaleString()} · ${(result.tiers?.better?.price||0).toLocaleString()} · ${(result.tiers?.best?.price||0).toLocaleString()}</strong></div>
        </div>

        <div className="success-btns">
          <a className="btn btn-outline" href={result.shareUrl} target="_blank" rel="noreferrer">👁 View as Customer</a>
          <a className="btn btn-outline" href={`/api/proposal/${result.id}/pdf`} target="_blank" rel="noreferrer">⬇️ Download PDF</a>
          <button className="btn btn-primary" onClick={onReset}>+ New Proposal</button>
        </div>
      </div>
    </main>
  )
}

/* ─────────────── PROPOSALS TAB ─────────────── */
function ProposalsTab({ onOpenBuilder, onRevise }) {
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
    if (!confirm('Delete this proposal?')) return
    await fetch(`/api/proposal/${id}`, { method:'DELETE' })
    load()
  }
  function copy(id) {
    const url = `${location.origin}/p/${id}`
    navigator.clipboard.writeText(url); alert('Link copied:\n' + url)
  }

  // Only show the current version of each proposal — superseded (revised-away)
  // versions are hidden so the list stays clean. The vN badge flags revisions.
  const live = list.filter(p => !p.superseded_by_id)
  const filtered = q ? live.filter(p => (p.customer_name + ' ' + p.prop_num).toLowerCase().includes(q.toLowerCase())) : live

  return (
    <main className="main">
      <div className="card">
        <div className="proposals-head">
          <div><h2 className="step-title">ALL PROPOSALS</h2><p className="step-sub">Live database — synced across reps.</p></div>
          <div style={{display:'flex',gap:10,alignItems:'center'}}>
            <input className="search" placeholder="Search…" value={q} onChange={e=>setQ(e.target.value)} />
            <button className="btn btn-primary btn-sm" onClick={onOpenBuilder}>+ New</button>
            <button className="btn btn-outline btn-sm" onClick={load}>↻ Refresh</button>
          </div>
        </div>

        {error && <div className="error-banner">⚠️ {error} — set SUPABASE env vars in Vercel.</div>}

        {loading ? (
          <div className="empty"><div className="empty-icon">⏳</div>Loading…</div>
        ) : !filtered.length ? (
          <div className="empty"><div className="empty-icon">📋</div><strong>No proposals yet</strong><div>Create your first one in the Build tab</div></div>
        ) : (
          <table className="ptable">
            <thead><tr><th>#</th><th>Customer</th><th>Roof</th><th>Status</th><th>Selected</th><th>Created</th><th></th></tr></thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td className="mono">{p.prop_num}{p.version_num > 1 && <span className="ver-badge">v{p.version_num}</span>}</td>
                  <td><div className="ptable-name">{p.customer_name}</div><div className="ptable-meta">{p.rep_name || ''}</div></td>
                  <td>{p.roof_type === 'tile' ? '🏛️ Tile' : '🏠 Shingle'} {p.squares}sq</td>
                  <td><StatusBadge status={p.status} /></td>
                  <td>{p.selected_tier ? <TierPill tier={p.selected_tier} tiers={p.tiers}/> : <span className="meta">—</span>}</td>
                  <td className="meta">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td style={{whiteSpace:'nowrap'}}>
                    <button className="btn-icon" onClick={() => copy(p.id)} title="Copy link">🔗</button>
                    <a className="btn-icon" href={`/p/${p.id}`} target="_blank" rel="noreferrer" title="Open">👁</a>
                    <a className="btn-icon" href={`/api/proposal/${p.id}/pdf`} target="_blank" rel="noreferrer" title="PDF">⬇️</a>
                    {p.status !== 'accepted' && p.status !== 'signed' && (
                      <button className="btn-icon" onClick={() => onRevise(p.id)} title="Revise — create a new version">✏️</button>
                    )}
                    <button className="btn-icon danger" onClick={() => del(p.id)} title="Delete">🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  )
}

function StatusBadge({ status }) {
  const map = { draft:['#FEF3C7','#92400E'], sent:['#DBEAFE','#1E40AF'], viewed:['#E0E7FF','#3730A3'], accepted:['#D1FAE5','#065F46'], signed:['#D1FAE5','#065F46'], expired:['#F3F4F6','#6B7280'] }
  const [bg, fg] = map[status] || map.draft
  return <span className="status-pill" style={{background:bg,color:fg}}>{(status||'draft').toUpperCase()}</span>
}
function TierPill({ tier, tiers }) {
  const c = { good:'#4A5568', better:'#B01E17', best:'#D4960E' }[tier]
  const name = tiers?.[tier]?.name || tier
  return <span className="tier-pill" style={{background:c}}>{name}</span>
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
              <KpiCard label="Accept Rate"     value={pct(totals.acceptRate)} />
              <KpiCard label="Revenue Closed"  value={money(totals.revenue)} accent />
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
                      <td>{pct(r.acceptRate)}</td>
                      <td>{r.avgTicket ? money(r.avgTicket) : '—'}</td>
                      <td>{fmtDuration(r.avgHoursToAccept)}</td>
                      <td><strong>{money(r.revenue)}</strong></td>
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
function pct(n)   { return Math.round((n || 0) * 100) + '%' }
function money(n) { return '$' + (n || 0).toLocaleString() }
function fmtDuration(hours) {
  if (hours == null) return '—'
  if (hours < 48) return hours + 'h'
  return (hours / 24).toFixed(1) + 'd'
}

/* ─────────────── SETTINGS TAB ─────────────── */
function SettingsTab({ settings, onChange }) {
  const set = (path, val) => {
    const next = JSON.parse(JSON.stringify(settings))
    const keys = path.split('.'); let o = next
    while (keys.length > 1) o = o[keys.shift()]
    o[keys[0]] = val
    onChange(next)
  }
  return (
    <main className="main">
      <div className="card">
        <h2 className="step-title">PRICING SETTINGS</h2>
        <p className="step-sub">Per-square base rates. AI writes content; these set the math.</p>

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

        <div className="env-hint">
          ⚙️ This builder needs three env vars set in Vercel: <code>ANTHROPIC_API_KEY</code>, <code>SUPABASE_SERVICE_ROLE_KEY</code>, <code>NEXT_PUBLIC_SITE_URL</code>. Without them, generate will fail.
        </div>
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

/* ─────────────── shared inputs ─────────────── */
function Field({ label, value, onChange, placeholder, full, type='text' }) {
  return (
    <div className={`field${full?' full':''}`}>
      <label>{label}</label>
      <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} />
    </div>
  )
}
function Counter({ label, hint, value, onMinus, onPlus, onChange }) {
  return (
    <div className="scope-box">
      <div className="scope-box-label">{label}</div>
      <div className="scope-num">
        <button type="button" onClick={onMinus}>−</button>
        <input type="number" value={value} onChange={e=>onChange(e.target.value)} />
        <button type="button" onClick={onPlus}>+</button>
      </div>
      <div className="scope-hint">{hint}</div>
    </div>
  )
}

/* ─────────────── Global CSS (replaces globals.css usage) ─────────────── */
function GlobalCSS() {
  return (
    <style jsx global>{`
      :root{--navy:#0C1C38;--navy2:#16305E;--crimson:#B01E17;--crimson-h:#D4251C;--gold:#D4960E;--gold-l:#F0B429;--cream:#F7F6F3;--card:#fff;--bord:#E2E0DB;--text:#1A1A2E;--mute:#4A5568;--light:#9CA3AF;--success:#10B981}
      *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;background:var(--cream);color:var(--text);min-height:100vh}
      .nav{background:var(--navy);border-bottom:4px solid var(--crimson);padding:14px 32px;display:flex;align-items:center;justify-content:space-between}
      .brand{display:flex;align-items:center;gap:14px}
      .brand-logo{height:54px;width:auto;background:#fff;border-radius:9px;padding:5px}
      .brand-name{color:var(--gold-l);font-weight:900;font-size:16px;letter-spacing:1.5px}
      .brand-sub{color:rgba(255,255,255,.42);font-size:10px;letter-spacing:2.5px;margin-top:2px;font-weight:700}
      .nav-status{background:var(--success);color:#fff;font-size:11px;font-weight:900;letter-spacing:1px;padding:5px 12px;border-radius:20px}
      .tabs{background:var(--navy2);display:flex;border-bottom:2px solid rgba(255,255,255,.08)}
      .tab{padding:14px 26px;font-size:13px;font-weight:800;color:rgba(255,255,255,.5);background:none;border:none;cursor:pointer;border-bottom:3px solid transparent;font-family:inherit;letter-spacing:.5px;transition:all .15s}
      .tab.on{color:#fff;border-bottom-color:var(--crimson)}
      .tab:hover:not(.on){color:rgba(255,255,255,.8)}
      .prog{background:rgba(0,0,0,.18);padding:18px 32px}
      .prog-inner{max-width:760px;margin:0 auto;display:flex;align-items:center}
      .prog-step{display:flex;align-items:center;flex:1;gap:8px}
      .prog-step:last-child{flex:0}
      .prog-circle{width:36px;height:36px;border-radius:50%;border:2px solid rgba(255,255,255,.2);background:rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.4);font-size:13px;font-weight:900;flex-shrink:0;transition:all .2s}
      .prog-circle.active{background:var(--crimson);border-color:var(--crimson);color:#fff}
      .prog-circle.done{background:var(--success);border-color:var(--success);color:#fff}
      .prog-label{font-size:11px;color:rgba(255,255,255,.4);font-weight:700;letter-spacing:.5px;white-space:nowrap}
      .prog-label.active{color:#fff}
      .prog-label.done{color:var(--gold-l)}
      .prog-line{flex:1;height:3px;background:rgba(255,255,255,.12);margin:0 4px;border-radius:2px}
      .prog-line.done{background:var(--success)}
      .main{max-width:960px;margin:0 auto;padding:32px 22px 60px}
      .card{background:var(--card);border-radius:18px;padding:36px 42px;box-shadow:0 4px 24px rgba(0,0,0,.06)}
      .step-title{font-size:24px;font-weight:900;letter-spacing:.5px;margin-bottom:4px;color:var(--navy)}
      .step-sub{color:var(--mute);font-size:13px;margin-bottom:24px;line-height:1.5}
      .section-label{font-size:11px;font-weight:900;color:var(--mute);text-transform:uppercase;letter-spacing:1.4px;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid var(--bord)}
      .grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
      .field{display:flex;flex-direction:column}
      .field.full{grid-column:1/-1}
      .field label{font-size:12px;font-weight:700;margin-bottom:5px}
      .field input,.field textarea,.field select{padding:11px 14px;border:2px solid var(--bord);border-radius:9px;font-size:13px;font-family:inherit;outline:none;transition:border-color .15s;background:#fff;color:var(--text);font-weight:600}
      .field textarea{resize:vertical}
      .field input:focus,.field textarea:focus,.field select:focus{border-color:var(--crimson)}
      .webhook-banner{background:linear-gradient(135deg,var(--navy),var(--navy2));border-radius:12px;padding:16px 20px;margin-bottom:20px;display:flex;align-items:center;gap:14px}
      .wb-dot{width:11px;height:11px;border-radius:50%;background:var(--success);box-shadow:0 0 12px var(--success);flex-shrink:0;animation:pulse 2s infinite}
      @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
      .wb-text{color:#fff;font-size:13px;font-weight:800}
      .wb-sub{color:rgba(255,255,255,.5);font-size:11px;margin-top:2px}
      .wb-badge{margin-left:auto;background:rgba(16,185,129,.2);border:1px solid var(--success);color:var(--success);font-size:11px;font-weight:900;padding:4px 10px;border-radius:20px}
      .type-card{display:flex;align-items:center;gap:14px;background:#fff;border:3px solid var(--bord);border-radius:12px;padding:16px 18px;cursor:pointer;text-align:left;font-family:inherit;color:inherit;transition:all .15s}
      .type-card:hover{border-color:var(--crimson)}
      .type-card.on{border-color:var(--crimson);background:rgba(176,30,23,.04);box-shadow:0 0 0 3px rgba(176,30,23,.1)}
      .type-icon{font-size:30px;flex-shrink:0}
      .type-name{font-weight:900;font-size:14px}
      .type-desc{font-size:12px;color:var(--mute);margin-top:2px}
      .radio-dot{width:22px;height:22px;border-radius:50%;border:2px solid var(--bord);display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-left:auto}
      .radio-dot.sel{background:var(--crimson);border-color:var(--crimson)}
      .radio-inner{width:8px;height:8px;border-radius:50%;background:#fff}
      .scope-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
      .scope-box{background:var(--cream);border-radius:11px;padding:14px 16px;border:2px solid var(--bord)}
      .scope-box-label{font-size:10px;font-weight:900;color:var(--mute);text-transform:uppercase;letter-spacing:1.2px;margin-bottom:8px}
      .scope-num{display:flex;gap:7px;align-items:center}
      .scope-num button{width:30px;height:30px;border-radius:6px;border:2px solid var(--bord);background:#fff;font-size:18px;cursor:pointer;font-weight:900;color:var(--mute);font-family:inherit}
      .scope-num button:hover{border-color:var(--crimson);color:var(--crimson)}
      .scope-num input{flex:1;text-align:center;border:2px solid var(--bord);border-radius:6px;padding:6px;font-size:16px;font-weight:900;font-family:inherit;outline:none}
      .scope-num input:focus{border-color:var(--crimson)}
      .scope-hint{font-size:10px;color:var(--light);margin-top:5px}
      .scope-box select{width:100%;border:2px solid var(--bord);border-radius:6px;font-family:inherit;font-weight:600;outline:none;background:#fff}
      .addon-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .addon{display:flex;justify-content:space-between;align-items:center;background:var(--cream);border:2px solid var(--bord);border-radius:10px;padding:11px 14px;cursor:pointer;transition:all .15s}
      .addon:hover{border-color:var(--crimson)}
      .addon.on{border-color:var(--crimson);background:rgba(176,30,23,.04)}
      .addon-left{display:flex;align-items:center;gap:11px}
      .addon-chk{width:20px;height:20px;border-radius:5px;border:2px solid var(--bord);background:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;color:#fff}
      .addon-chk.on{background:var(--crimson);border-color:var(--crimson)}
      .addon-name{font-size:13px;font-weight:700}
      .review-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
      .review-box{background:var(--cream);border-left:5px solid var(--crimson);padding:18px 22px;border-radius:11px}
      .review-box:nth-child(2){border-left-color:var(--gold)}
      .rb-lbl{font-size:11px;font-weight:900;color:var(--mute);letter-spacing:1.3px;margin-bottom:8px}
      .rb-name{font-size:18px;font-weight:900;color:var(--navy);margin-bottom:4px}
      .rb-line{font-size:13px;color:var(--mute);margin-top:2px;line-height:1.5}
      .review-notes{background:var(--cream);border-left:5px solid var(--gold);padding:14px 22px;border-radius:11px;margin-bottom:16px}
      .btn-mega{width:100%;background:linear-gradient(135deg,var(--crimson),var(--crimson-h));color:#fff;border:none;border-radius:14px;padding:22px;font-size:18px;font-weight:900;letter-spacing:1px;cursor:pointer;font-family:inherit;margin-top:18px;box-shadow:0 8px 24px rgba(176,30,23,.25);transition:transform .12s}
      .btn-mega:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 12px 30px rgba(176,30,23,.32)}
      .btn-mega:disabled{opacity:.6;cursor:not-allowed}
      .step-nav{display:flex;justify-content:space-between;margin-top:28px}
      .btn{padding:12px 26px;border-radius:9px;font-size:14px;font-weight:800;cursor:pointer;border:none;font-family:inherit;letter-spacing:.3px;transition:all .15s}
      .btn-primary{background:var(--crimson);color:#fff}
      .btn-primary:hover:not(:disabled){background:var(--crimson-h)}
      .btn-back{background:transparent;color:var(--mute);border:2px solid var(--bord) !important}
      .btn-outline{background:transparent;color:var(--crimson);border:2px solid var(--crimson) !important;text-decoration:none;display:inline-block}
      .btn-outline:hover{background:var(--crimson);color:#fff}
      .btn-sm{padding:8px 16px;font-size:12px}
      .btn:disabled{background:#ccc !important;cursor:not-allowed;color:#888}
      .error-banner{background:#FEF2F2;border:2px solid #FCA5A5;border-radius:9px;padding:11px 14px;color:#991B1B;font-size:13px;font-weight:700;margin-top:14px}
      .success-icon{width:88px;height:88px;border-radius:50%;background:var(--success);color:#fff;font-size:48px;font-weight:900;display:flex;align-items:center;justify-content:center;margin:0 auto 18px;box-shadow:0 8px 24px rgba(16,185,129,.3)}
      .success-title{text-align:center;font-size:32px;font-weight:900;color:var(--navy);margin-bottom:8px}
      .success-sub{text-align:center;color:var(--mute);max-width:480px;margin:0 auto 28px;font-size:14px;line-height:1.6}
      .share-row{display:flex;gap:8px;margin-bottom:22px}
      .share-input{flex:1;padding:14px 16px;border:2px solid var(--bord);border-radius:9px;font-family:monospace;font-size:13px;color:var(--navy);font-weight:700;background:var(--cream);outline:none}
      .success-meta{display:grid;grid-template-columns:1fr 1fr;gap:14px;background:var(--cream);border-radius:10px;padding:14px 18px;margin-bottom:22px}
      .success-meta div{display:flex;flex-direction:column}
      .success-meta span{font-size:10px;font-weight:900;color:var(--mute);letter-spacing:1.2px}
      .success-meta strong{font-size:14px;color:var(--navy);margin-top:3px}
      .success-btns{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
      .proposals-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px}
      .search{padding:9px 13px;border:2px solid var(--bord);border-radius:8px;font-size:13px;font-family:inherit;outline:none;width:200px;font-weight:600}
      .search:focus{border-color:var(--crimson)}
      .empty{text-align:center;padding:48px 20px;color:var(--light)}
      .empty-icon{font-size:42px;margin-bottom:10px}
      .empty strong{display:block;font-weight:800;color:var(--text);margin-bottom:4px;font-size:14px}
      .ptable{width:100%;border-collapse:collapse}
      .ptable th{background:var(--navy);color:rgba(255,255,255,.7);font-size:11px;font-weight:900;padding:11px 14px;text-align:left;text-transform:uppercase;letter-spacing:.8px}
      .ptable td{padding:12px 14px;border-bottom:1px solid var(--bord);font-size:13px;vertical-align:middle}
      .ptable tr:hover td{background:rgba(176,30,23,.03)}
      .ptable-name{font-weight:700}
      .ptable-meta{font-size:11px;color:var(--light);margin-top:1px}
      .meta{color:var(--light);font-size:12px}
      .mono{font-family:monospace;font-weight:800}
      .status-pill{display:inline-block;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:900;letter-spacing:.5px}
      .tier-pill{display:inline-block;padding:3px 9px;border-radius:5px;font-size:10px;font-weight:900;color:#fff;letter-spacing:.5px}
      .btn-icon{width:30px;height:30px;border:2px solid var(--bord);background:#fff;border-radius:7px;cursor:pointer;font-size:14px;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;color:inherit;margin-right:4px}
      .btn-icon:hover{border-color:var(--crimson)}
      .btn-icon.danger:hover{background:#FEE2E2;border-color:#EF4444}
      .settings-section{margin-bottom:28px}
      .settings-title{font-size:14px;font-weight:900;color:var(--navy);text-transform:uppercase;letter-spacing:1px;margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid var(--bord)}
      .settings-rows{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .setting-row{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--cream);border-radius:7px;gap:10px}
      .setting-label{font-size:13px;font-weight:600}
      .setting-row input{width:100px;border:2px solid var(--bord);border-radius:6px;padding:6px 10px;font-size:13px;font-weight:700;font-family:inherit;outline:none;text-align:right}
      .setting-row input:focus{border-color:var(--crimson)}
      .env-hint{margin-top:18px;padding:14px 18px;background:#FFFBEB;border:1px solid #FCD34D;border-radius:10px;font-size:13px;color:#78350F;line-height:1.6}
      .env-hint code{background:rgba(0,0,0,.07);padding:2px 7px;border-radius:4px;font-family:monospace;font-size:12px}
      /* ── Photos & AI step ── */
      .photo-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:14px}
      .photo-thumb{position:relative;border-radius:11px;overflow:hidden;border:2px solid var(--bord);aspect-ratio:4/3;background:var(--cream)}
      .photo-thumb img{width:100%;height:100%;object-fit:cover;display:block}
      .photo-remove{position:absolute;top:6px;right:6px;width:26px;height:26px;border-radius:50%;border:none;background:rgba(12,28,56,.82);color:#fff;font-size:13px;font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1}
      .photo-remove:hover{background:var(--crimson)}
      .photo-add{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;border:2px dashed var(--bord);border-radius:11px;aspect-ratio:4/3;cursor:pointer;background:var(--cream);transition:all .15s}
      .photo-add:hover{border-color:var(--crimson);background:rgba(176,30,23,.04)}
      .photo-add.busy{opacity:.6;cursor:wait}
      .photo-add input{display:none}
      .photo-add-icon{font-size:30px;color:var(--mute);font-weight:300}
      .photo-add-text{font-size:12px;font-weight:800;color:var(--mute)}
      .btn-analyze{width:100%;background:linear-gradient(135deg,var(--navy),var(--navy2));color:#fff;border:none;border-radius:12px;padding:15px;font-size:15px;font-weight:900;letter-spacing:.5px;cursor:pointer;font-family:inherit;margin-top:6px;transition:transform .12s}
      .btn-analyze:hover:not(:disabled){transform:translateY(-1px)}
      .btn-analyze:disabled{opacity:.6;cursor:not-allowed}
      .analysis-card{margin-top:18px;border:2px solid var(--bord);border-radius:14px;overflow:hidden}
      .analysis-head{display:flex;justify-content:space-between;align-items:center;background:linear-gradient(135deg,var(--navy),var(--navy2));padding:14px 18px}
      .analysis-title{color:var(--gold-l);font-size:13px;font-weight:900;letter-spacing:1px}
      .analysis-score{color:#fff;font-size:13px;font-weight:600}
      .analysis-score strong{font-size:16px;font-weight:900;margin-left:4px}
      .analysis-rows{padding:6px 18px}
      .analysis-row{display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid var(--bord)}
      .analysis-row:last-child{border-bottom:none}
      .ar-label{font-size:11px;font-weight:900;color:var(--mute);text-transform:uppercase;letter-spacing:1px;width:78px;flex-shrink:0}
      .ar-value{flex:1;font-size:14px;font-weight:700;color:var(--navy)}
      .conf-badge{font-size:9px;font-weight:900;letter-spacing:.5px;padding:3px 8px;border-radius:20px}
      .analysis-block{padding:12px 18px;border-top:1px solid var(--bord)}
      .ab-label{font-size:10px;font-weight:900;color:var(--mute);text-transform:uppercase;letter-spacing:1.2px;margin-bottom:5px}
      .ab-text{font-size:13px;color:var(--text);line-height:1.55}
      .addon-chips{display:flex;flex-wrap:wrap;gap:7px}
      .addon-chip{font-size:12px;font-weight:700;padding:5px 11px;border-radius:20px;background:var(--cream);border:2px solid var(--bord);color:var(--mute)}
      .addon-chip.active{background:rgba(16,185,129,.12);border-color:var(--success);color:#065F46}
      .analysis-hint{padding:13px 18px;background:#FFFBEB;border-top:1px solid #FCD34D;font-size:12px;color:#78350F;line-height:1.6}
      .link-btn{background:none;border:none;color:var(--crimson);font-weight:800;font-family:inherit;font-size:12px;cursor:pointer;padding:0;text-decoration:underline}
      /* ── Team / Reps dashboard ── */
      .win-toggle{display:flex;gap:4px;background:var(--cream);padding:4px;border-radius:9px;border:2px solid var(--bord)}
      .win-btn{padding:7px 14px;font-size:12px;font-weight:800;border:none;background:none;border-radius:6px;cursor:pointer;font-family:inherit;color:var(--mute);transition:all .15s}
      .win-btn:hover:not(.on){color:var(--crimson)}
      .win-btn.on{background:var(--crimson);color:#fff}
      .kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px}
      .kpi{background:var(--cream);border:2px solid var(--bord);border-radius:12px;padding:18px 20px}
      .kpi.accent{background:var(--navy);border-color:var(--navy)}
      .kpi-val{font-size:26px;font-weight:900;color:var(--navy);line-height:1.1}
      .kpi.accent .kpi-val{color:var(--gold-l)}
      .kpi-lbl{font-size:11px;font-weight:800;color:var(--mute);letter-spacing:.8px;text-transform:uppercase;margin-top:4px}
      .kpi.accent .kpi-lbl{color:rgba(255,255,255,.55)}
      .rank{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:var(--cream);border:2px solid var(--bord);font-weight:900;font-size:11px;color:var(--mute)}
      .rank.gold{background:var(--gold);border-color:var(--gold);color:#fff}
      /* ── Financing toggle (Review step) ── */
      .financing-toggle{display:flex;gap:13px;align-items:flex-start;background:var(--cream);border:2px solid var(--bord);border-radius:11px;padding:15px 17px;margin-top:14px;cursor:pointer;transition:all .15s}
      .financing-toggle:hover{border-color:var(--crimson)}
      .financing-toggle.on{border-color:var(--success);background:rgba(16,185,129,.06)}
      .fin-chk{width:22px;height:22px;border-radius:6px;border:2px solid var(--bord);background:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;color:#fff;flex-shrink:0;margin-top:1px}
      .fin-chk.on{background:var(--success);border-color:var(--success)}
      .fin-title{font-size:14px;font-weight:800;color:var(--navy)}
      .fin-sub{font-size:12px;color:var(--mute);margin-top:3px;line-height:1.5}
      /* ── Revision mode ── */
      .revise-banner{background:linear-gradient(135deg,#92400E,#B45309);color:#fff;font-size:13px;font-weight:600;padding:12px 32px;text-align:center;line-height:1.5}
      .revise-banner strong{font-weight:900;color:#FDE68A}
      .ver-badge{display:inline-block;margin-left:6px;background:var(--gold);color:#fff;font-size:9px;font-weight:900;letter-spacing:.5px;padding:2px 6px;border-radius:5px;vertical-align:middle}
      @media(max-width:780px){
        .grid2{grid-template-columns:1fr}
        .scope-grid{grid-template-columns:1fr 1fr}
        .addon-grid{grid-template-columns:1fr}
        .review-grid{grid-template-columns:1fr}
        .photo-grid{grid-template-columns:repeat(2,1fr)}
        .nav{padding:12px 16px}
        .main{padding:18px 14px 40px}
        .card{padding:24px 22px}
        .tab{padding:11px 16px;font-size:12px}
        .settings-rows{grid-template-columns:1fr}
      }
    `}</style>
  )
}
