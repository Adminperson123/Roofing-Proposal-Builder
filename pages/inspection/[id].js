import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'

const DAMAGE_TYPES = [
  { id: 'missing_shingles', label: 'Missing shingles' },
  { id: 'broken_tiles',     label: 'Broken / cracked tiles' },
  { id: 'granule_loss',     label: 'Granule loss' },
  { id: 'hail_strikes',     label: 'Hail strikes' },
  { id: 'wind_damage',      label: 'Wind lift / blow-off' },
  { id: 'exposed_nails',    label: 'Exposed nails / fasteners' },
  { id: 'flashing_failure', label: 'Flashing failure' },
  { id: 'underlayment',     label: 'Underlayment exposed' },
]

const FLASHING_AREAS = ['Chimney', 'Skylight', 'Valleys', 'Sidewall', 'Pipe boots', 'Drip edge']

const getIdFromUrl = () => {
  if (typeof window === 'undefined') return null
  const m = window.location.pathname.match(/\/inspection\/([^\/?#]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

const SECTIONS = [
  { key: 'access',       title: 'Roof Access & Safety',    icon: '🪜' },
  { key: 'system',       title: 'Roof System',             icon: '🏠' },
  { key: 'measure',      title: 'Measurements',            icon: '📏' },
  { key: 'damage',       title: 'Damage Survey',           icon: '⚠️' },
  { key: 'penetrations', title: 'Penetrations & Flashings', icon: '🛠' },
  { key: 'attic',        title: 'Attic Inspection',        icon: '🔦', required: true },
  { key: 'ventilation',  title: 'Ventilation & Gutters',   icon: '💨' },
  { key: 'recommend',    title: 'Recommendations',         icon: '📋' },
  { key: 'review',       title: 'Review & Submit',         icon: '✅' },
]

export default function InspectionForm() {
  const router = useRouter()
  const id = router.query.id || getIdFromUrl()
  const [insp, setInsp] = useState(null)
  const [err, setErr] = useState('')
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)         // autosave in flight (drives the "Saving…" hint only)
  const [submitting, setSubmitting] = useState(false) // final submit — kept separate so a pending/stuck autosave can never block it
  const [savedAt, setSavedAt] = useState(null)
  const [uploading, setUploading] = useState(false)
  const photoRef = useRef(null)
  const saveTimerRef = useRef(null)

  useEffect(() => {
    if (!id) return
    fetch(`/api/inspection/${id}`).then(async r => {
      if (!r.ok) { setErr('Inspection not found.'); return }
      const data = await r.json()
      setInsp(data)
      setStep(Math.min(data.step_completed || 0, SECTIONS.length - 1))
    }).catch(e => setErr(e.message))
  }, [id])

  function patchSection(key, partial) {
    setInsp(prev => {
      if (!prev) return prev
      const sections = { ...(prev.sections || {}), [key]: { ...(prev.sections?.[key] || {}), ...partial } }
      const next = { ...prev, sections }
      scheduleSave(next, step)
      return next
    })
  }

  function scheduleSave(state, currentStep) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => saveDraft(state, currentStep), 800)
  }

  async function saveDraft(state, currentStep) {
    if (!state) return
    setBusy(true)
    // Abort a hung autosave after 8s so poor on-site signal can't leave the
    // "Saving…" state stuck (and, historically, block the submit button).
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 8000)
    try {
      const r = await fetch(`/api/inspection/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
        body: JSON.stringify({ sections: state.sections, step_completed: currentStep, recommendation_summary: state.recommendation_summary, urgency: state.urgency, rep_name: state.rep_name }),
      })
      if (r.ok) setSavedAt(new Date())
    } catch {} finally { clearTimeout(t); setBusy(false) }
  }

  async function submit() {
    if (submitting) return
    // Cancel any pending debounced autosave so it can't race the submit.
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    setSubmitting(true)
    try {
      const r = await fetch(`/api/inspection/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'submitted', sections: insp.sections, step_completed: SECTIONS.length - 1, recommendation_summary: insp.recommendation_summary, urgency: insp.urgency }),
      })
      if (!r.ok) throw new Error('Submit failed — check your connection and try again.')
      const updated = await r.json()
      setInsp(updated)
      router.push(`/inspection/${id}/pdf`)  // client nav — no full reload
    } catch (e) { alert(e.message); setSubmitting(false) }
  }

  async function onPhotoFiles(fileList) {
    if (!fileList?.length) return
    setUploading(true)
    try {
      const items = []
      const sectionKey = SECTIONS[step]?.key || 'general'
      for (const f of fileList) {
        if (!/^image\//.test(f.type)) continue
        if (f.size > 10 * 1024 * 1024) continue
        const b64 = await fileToBase64(f)
        items.push({ name: f.name, mime: f.type, base64: b64, section: sectionKey })
      }
      if (!items.length) return
      const CHUNK = 3
      for (let i = 0; i < items.length; i += CHUNK) {
        const slice = items.slice(i, i + CHUNK)
        const r = await fetch(`/api/inspection/${id}/photos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files: slice }) })
        if (!r.ok) throw new Error('Photo upload failed')
        const d = await r.json()
        setInsp(prev => ({ ...prev, photos: [...(prev.photos || []), ...(d.photos || [])] }))
      }
    } catch (e) { alert(e.message) }
    finally { setUploading(false); if (photoRef.current) photoRef.current.value = '' }
  }

  if (err) return <Center><div className="ins-err">⚠️ {err}</div></Center>
  if (!insp) return <Center><div>Loading inspection…</div></Center>

  const section = SECTIONS[step]
  const sectionData = insp.sections?.[section.key] || {}
  const sectionPhotos = (insp.photos || []).filter(p => p.section === section.key)
  const submitted = insp.status === 'submitted'

  return (
    <>
      <Head>
        <title>Inspection {insp.inspection_num} — {insp.customer_name}</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
      </Head>

      <div className="ins-wrap">
        <header className="ins-hero">
          <div>
            <div className="ins-hero-eyebrow">SITE INSPECTION</div>
            <div className="ins-hero-num">{insp.inspection_num}</div>
            <div className="ins-hero-customer">{insp.customer_name}</div>
            <div className="ins-hero-addr">{insp.customer_address}</div>
          </div>
          <div className="ins-hero-status">
            {submitted ? <span className="ins-status ins-status-sub">SUBMITTED</span> : <span className="ins-status ins-status-draft">DRAFT</span>}
            {savedAt && !submitted && <div className="ins-saved">✓ Saved {timeAgo(savedAt)}</div>}
            {busy && <div className="ins-saving">⏳ Saving…</div>}
          </div>
        </header>

        <nav className="ins-stepper">
          {SECTIONS.map((s, i) => {
            const done = i < step
            const active = i === step
            return (
              <button key={s.key} className={`ins-stepper-btn ${active ? 'on' : ''} ${done ? 'done' : ''}`} onClick={() => setStep(i)} type="button">
                <span className="ins-stepper-num">{done ? '✓' : i + 1}</span>
                <span className="ins-stepper-label">{s.icon} {s.title}{s.required && <em> *</em>}</span>
              </button>
            )
          })}
        </nav>

        <main className="ins-main">
          <div className="ins-card">
            <h2 className="ins-section-title">{section.icon} {section.title}</h2>

            {section.key === 'access'       && <SectionAccess data={sectionData} onChange={p => patchSection('access', p)} />}
            {section.key === 'system'       && <SectionSystem data={sectionData} onChange={p => patchSection('system', p)} />}
            {section.key === 'measure'      && <SectionMeasure data={sectionData} onChange={p => patchSection('measure', p)} />}
            {section.key === 'damage'       && <SectionDamage data={sectionData} onChange={p => patchSection('damage', p)} />}
            {section.key === 'penetrations' && <SectionPenetrations data={sectionData} onChange={p => patchSection('penetrations', p)} />}
            {section.key === 'attic'        && <SectionAttic data={sectionData} onChange={p => patchSection('attic', p)} />}
            {section.key === 'ventilation'  && <SectionVentilation data={sectionData} onChange={p => patchSection('ventilation', p)} />}
            {section.key === 'recommend'    && <SectionRecommend insp={insp} setInsp={setInsp} onSchedule={(s) => scheduleSave(s, step)} />}
            {section.key === 'review'       && <SectionReview insp={insp} onSubmit={submit} submitted={submitted} busy={submitting} />}

            {section.key !== 'review' && (
              <div className="ins-photos">
                <div className="ins-photos-head">
                  <strong>📸 Photos for this section</strong>
                  <button className="btn btn-outline btn-sm" onClick={() => photoRef.current?.click()} disabled={uploading}>
                    {uploading ? 'Uploading…' : '+ Add'}
                  </button>
                  <input ref={photoRef} type="file" accept="image/*" capture="environment" multiple style={{display:'none'}} onChange={e => onPhotoFiles(e.target.files)} />
                </div>
                {sectionPhotos.length > 0 ? (
                  <div className="ins-photo-grid">
                    {sectionPhotos.map((p, i) => (
                      <a key={i} href={p.url} target="_blank" rel="noreferrer" className="ins-photo">
                        <img src={p.url} alt={p.name || `Photo ${i+1}`} loading="lazy" />
                      </a>
                    ))}
                  </div>
                ) : <div className="ins-photo-empty">No photos yet — tap "+ Add" to capture.</div>}
              </div>
            )}
          </div>

          <div className="ins-nav">
            <button className="btn btn-back" disabled={step === 0} onClick={() => { setStep(s => Math.max(0, s - 1)) }}>← Back</button>
            {step < SECTIONS.length - 1 && (
              <button className="btn btn-primary" onClick={() => { setStep(s => Math.min(SECTIONS.length - 1, s + 1)); scheduleSave(insp, Math.min(SECTIONS.length - 1, step + 1)) }}>Next →</button>
            )}
          </div>
        </main>
      </div>

      <style jsx global>{`
        :root{--navy:#0C1C38;--navy2:#16305E;--crimson:#B01E17;--gold:#D4960E;--cream:#F7F6F3;--text:#1A1A2E;--mute:#4A5568;--bord:#E2E0DB;--success:#10B981}
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;background:var(--cream);color:var(--text);min-height:100vh}
        .ins-wrap{max-width:920px;margin:0 auto;padding-bottom:60px}
        .ins-hero{background:var(--navy);color:#fff;padding:18px 22px;display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap;border-bottom:4px solid var(--crimson)}
        .ins-hero-eyebrow{color:var(--gold);font-size:10px;font-weight:900;letter-spacing:1.6px}
        .ins-hero-num{color:#fff;font-size:18px;font-weight:900;margin-top:3px}
        .ins-hero-customer{color:#fff;font-size:15px;font-weight:700;margin-top:6px}
        .ins-hero-addr{color:rgba(255,255,255,.7);font-size:12px;margin-top:2px}
        .ins-hero-status{display:flex;flex-direction:column;gap:4px;align-items:flex-end}
        .ins-status{display:inline-block;padding:4px 12px;border-radius:20px;font-size:10px;font-weight:900;letter-spacing:1.2px}
        .ins-status-draft{background:#FBBF24;color:#78350F}
        .ins-status-sub{background:var(--success);color:#fff}
        .ins-saved{font-size:11px;color:rgba(255,255,255,.65)}
        .ins-saving{font-size:11px;color:var(--gold)}
        .ins-stepper{display:flex;overflow-x:auto;background:var(--navy2);padding:10px 16px;gap:6px;-webkit-overflow-scrolling:touch}
        .ins-stepper-btn{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:8px 14px;cursor:pointer;color:rgba(255,255,255,.6);font-family:inherit;font-size:12px;font-weight:700;flex-shrink:0;white-space:nowrap}
        .ins-stepper-btn.on{background:var(--crimson);border-color:var(--crimson);color:#fff}
        .ins-stepper-btn.done{background:rgba(16,185,129,.18);border-color:var(--success);color:var(--success)}
        .ins-stepper-num{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;background:rgba(255,255,255,.1);font-size:10px;font-weight:900}
        .ins-stepper-btn.on .ins-stepper-num{background:rgba(255,255,255,.2)}
        .ins-stepper-btn.done .ins-stepper-num{background:rgba(16,185,129,.3)}
        .ins-stepper-label em{color:var(--crimson);font-style:normal;font-weight:900}
        .ins-stepper-btn.on .ins-stepper-label em{color:#FDE68A}
        .ins-main{padding:22px 18px;display:flex;flex-direction:column;gap:14px}
        .ins-card{background:#fff;border-radius:14px;padding:24px 22px;box-shadow:0 4px 24px rgba(0,0,0,.05);display:flex;flex-direction:column;gap:18px}
        .ins-section-title{font-size:22px;font-weight:900;color:var(--navy);letter-spacing:.3px}
        .ins-field{display:flex;flex-direction:column;gap:6px}
        .ins-field label{font-size:12px;font-weight:800;color:var(--mute);letter-spacing:.4px;text-transform:uppercase}
        .ins-field input,.ins-field textarea,.ins-field select{padding:12px 14px;border:2px solid var(--bord);border-radius:9px;font-size:14px;font-family:inherit;outline:none;background:#fff;color:var(--text);font-weight:600}
        .ins-field input:focus,.ins-field textarea:focus,.ins-field select:focus{border-color:var(--crimson)}
        .ins-field textarea{resize:vertical;min-height:80px}
        .ins-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .ins-toggles{display:flex;flex-wrap:wrap;gap:8px}
        .ins-toggle{display:flex;align-items:center;gap:8px;border:2px solid var(--bord);border-radius:24px;padding:8px 14px;background:#fff;font-size:13px;font-weight:700;color:var(--mute);cursor:pointer;font-family:inherit}
        .ins-toggle.on{border-color:var(--crimson);background:rgba(176,30,23,.06);color:var(--navy)}
        .ins-radio-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px}
        .ins-radio{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:4px;border:2px solid var(--bord);border-radius:11px;padding:14px 8px;cursor:pointer;background:#fff;font-size:12px;font-weight:700;color:var(--mute);font-family:inherit;min-height:60px}
        .ins-radio.on{border-color:var(--crimson);background:rgba(176,30,23,.06);color:var(--navy)}
        .ins-radio-icon{font-size:20px}
        .ins-photos{margin-top:8px;border-top:1px dashed var(--bord);padding-top:18px}
        .ins-photos-head{display:flex;align-items:center;gap:10px;margin-bottom:10px}
        .ins-photos-head strong{font-size:13px;color:var(--navy);flex:1}
        .ins-photo-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:6px}
        .ins-photo{aspect-ratio:1;border-radius:8px;overflow:hidden;border:2px solid var(--bord);display:block}
        .ins-photo img{width:100%;height:100%;object-fit:cover;display:block}
        .ins-photo-empty{font-size:12px;color:var(--mute);font-style:italic;padding:14px;text-align:center;background:var(--cream);border-radius:8px}
        .ins-nav{display:flex;justify-content:space-between;gap:10px;margin-top:6px}
        .btn{padding:14px 28px;border-radius:10px;font-size:14px;font-weight:800;cursor:pointer;border:none;font-family:inherit;min-height:48px}
        .btn-primary{background:var(--crimson);color:#fff}
        .btn-back{background:transparent;color:var(--mute);border:2px solid var(--bord) !important}
        .btn-outline{background:transparent;color:var(--crimson);border:2px solid var(--crimson) !important}
        .btn-sm{padding:8px 16px;font-size:12px;min-height:36px}
        .btn-mega{width:100%;background:linear-gradient(135deg,var(--crimson),#7c1410);color:#fff;border:none;border-radius:14px;padding:20px;font-size:16px;font-weight:900;letter-spacing:1px;cursor:pointer;font-family:inherit;min-height:62px;box-shadow:0 8px 24px rgba(176,30,23,.25)}
        .btn:disabled{opacity:.5;cursor:not-allowed}
        .ins-err{padding:24px;background:#fff;border:1px solid #FCA5A5;border-radius:12px;color:#991B1B;font-weight:700;text-align:center;max-width:420px;margin:0 18px}
        .ins-callout{background:#FFFBEB;border:1px solid #FCD34D;border-left:5px solid #F59E0B;border-radius:9px;padding:12px 14px;font-size:13px;line-height:1.55;color:#78350F}
        .ins-callout strong{color:#92400E}
        .ins-review-stat{background:var(--cream);border-radius:9px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;font-size:13px}
        .ins-review-stat strong{color:var(--navy);font-weight:800}
        @media(max-width:520px){
          .ins-row{grid-template-columns:1fr}
          .ins-main{padding:14px 12px}
          .ins-card{padding:18px 16px}
          .ins-hero{padding:14px 16px}
          .ins-section-title{font-size:18px}
        }
      `}</style>
    </>
  )
}

// ─── Section components ──────────────────────────────────────────────

function SectionAccess({ data, onChange }) {
  return (
    <>
      <div className="ins-field">
        <label>Access method</label>
        <div className="ins-radio-grid">
          {[{v:'ladder',i:'🪜',l:'Ladder'},{v:'walk',i:'🚶',l:'Walkable'},{v:'lift',i:'🏗',l:'Lift / scaffold'},{v:'declined',i:'🚫',l:'Did not access'}].map(opt => (
            <button key={opt.v} type="button" className={`ins-radio ${data.access_method === opt.v ? 'on' : ''}`} onClick={() => onChange({ access_method: opt.v })}>
              <span className="ins-radio-icon">{opt.i}</span>{opt.l}
            </button>
          ))}
        </div>
      </div>
      <div className="ins-field">
        <label>Hazards observed</label>
        <textarea placeholder="Steep pitch, wet shingles, electrical lines nearby, etc." value={data.hazards || ''} onChange={e => onChange({ hazards: e.target.value })} />
      </div>
      <div className="ins-field">
        <label>General condition (from ground)</label>
        <textarea placeholder="Overall age, weathering, prior repair signs visible from below…" value={data.ground_observation || ''} onChange={e => onChange({ ground_observation: e.target.value })} />
      </div>
    </>
  )
}

function SectionSystem({ data, onChange }) {
  return (
    <>
      <div className="ins-field">
        <label>Current roofing material</label>
        <div className="ins-radio-grid">
          {[{v:'shingle',i:'🏠',l:'Asphalt shingle'},{v:'tile_concrete',i:'🏛',l:'Concrete tile'},{v:'tile_clay',i:'🟧',l:'Clay tile'},{v:'metal',i:'🔧',l:'Metal'},{v:'flat_torch',i:'🔥',l:'Flat / torch-down'},{v:'wood_shake',i:'🪵',l:'Wood shake'}].map(opt => (
            <button key={opt.v} type="button" className={`ins-radio ${data.material === opt.v ? 'on' : ''}`} onClick={() => onChange({ material: opt.v })}>
              <span className="ins-radio-icon">{opt.i}</span>{opt.l}
            </button>
          ))}
        </div>
      </div>
      <div className="ins-row">
        <div className="ins-field">
          <label>Manufacturer / brand</label>
          <input type="text" placeholder="GAF, Owens Corning, Eagle, …" value={data.brand || ''} onChange={e => onChange({ brand: e.target.value })} />
        </div>
        <div className="ins-field">
          <label>Estimated age (years)</label>
          <input type="number" placeholder="e.g. 18" value={data.age_years || ''} onChange={e => onChange({ age_years: e.target.value })} />
        </div>
      </div>
      <div className="ins-row">
        <div className="ins-field">
          <label>Number of layers</label>
          <select value={data.layers || ''} onChange={e => onChange({ layers: e.target.value })}>
            <option value="">—</option>
            <option value="1">1 layer</option>
            <option value="2">2 layers</option>
            <option value="3">3+ layers</option>
          </select>
        </div>
        <div className="ins-field">
          <label>Decking type (visible from above)</label>
          <select value={data.decking || ''} onChange={e => onChange({ decking: e.target.value })}>
            <option value="">— pending attic check —</option>
            <option value="plywood_1/2">Plywood ½"</option>
            <option value="plywood_5/8">Plywood ⅝"</option>
            <option value="osb">OSB</option>
            <option value="planks">Plank decking</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>
      </div>
    </>
  )
}

function SectionMeasure({ data, onChange }) {
  return (
    <>
      <div className="ins-row">
        <div className="ins-field">
          <label>Squares (1 sq = 100 sqft)</label>
          <input type="number" placeholder="e.g. 24" value={data.squares || ''} onChange={e => onChange({ squares: e.target.value })} />
        </div>
        <div className="ins-field">
          <label>Pitch (x/12)</label>
          <input type="number" placeholder="e.g. 6" value={data.pitch || ''} onChange={e => onChange({ pitch: e.target.value })} />
        </div>
      </div>
      <div className="ins-row">
        <div className="ins-field">
          <label>Number of roof planes / facets</label>
          <input type="number" placeholder="e.g. 6" value={data.planes || ''} onChange={e => onChange({ planes: e.target.value })} />
        </div>
        <div className="ins-field">
          <label>Total home sqft (optional)</label>
          <input type="number" placeholder="e.g. 2200" value={data.home_sqft || ''} onChange={e => onChange({ home_sqft: e.target.value })} />
        </div>
      </div>
      <div className="ins-field">
        <label>Stories</label>
        <div className="ins-toggles">
          {['1','2','3+'].map(s => (
            <button key={s} type="button" className={`ins-toggle ${data.stories === s ? 'on' : ''}`} onClick={() => onChange({ stories: s })}>{s}</button>
          ))}
        </div>
      </div>
      <div className="ins-field">
        <label>Measurement method</label>
        <select value={data.method || ''} onChange={e => onChange({ method: e.target.value })}>
          <option value="">—</option>
          <option value="onsite">On-site (tape / wheel)</option>
          <option value="aerial">Aerial / drone</option>
          <option value="eagleview">EagleView report</option>
          <option value="county">County / public records</option>
        </select>
      </div>
    </>
  )
}

function SectionDamage({ data, onChange }) {
  const selected = data.types || []
  function toggle(id) {
    const next = selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]
    onChange({ types: next })
  }
  return (
    <>
      <div className="ins-field">
        <label>Damage types observed (select all that apply)</label>
        <div className="ins-toggles">
          {DAMAGE_TYPES.map(d => (
            <button key={d.id} type="button" className={`ins-toggle ${selected.includes(d.id) ? 'on' : ''}`} onClick={() => toggle(d.id)}>{d.label}</button>
          ))}
        </div>
      </div>
      <div className="ins-field">
        <label>Severity overall</label>
        <div className="ins-radio-grid">
          {[{v:'cosmetic',i:'👌',l:'Cosmetic only'},{v:'moderate',i:'⚠️',l:'Moderate'},{v:'severe',i:'🚨',l:'Severe / active leak'}].map(opt => (
            <button key={opt.v} type="button" className={`ins-radio ${data.severity === opt.v ? 'on' : ''}`} onClick={() => onChange({ severity: opt.v })}>
              <span className="ins-radio-icon">{opt.i}</span>{opt.l}
            </button>
          ))}
        </div>
      </div>
      <div className="ins-field">
        <label>Damage details / locations</label>
        <textarea placeholder="North slope ridge missing 8 shingles. SW valley showing wear. Two cracked tiles near chimney…" value={data.details || ''} onChange={e => onChange({ details: e.target.value })} />
      </div>
    </>
  )
}

function SectionPenetrations({ data, onChange }) {
  const cond = data.conditions || {}
  function set(area, val) { onChange({ conditions: { ...cond, [area]: val } }) }
  return (
    <>
      <div className="ins-field">
        <label>Condition of each flashing / penetration area</label>
        {FLASHING_AREAS.map(area => (
          <div key={area} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'1px solid var(--bord)'}}>
            <span style={{flex:1,fontWeight:700,fontSize:13,color:'var(--navy)'}}>{area}</span>
            <div className="ins-toggles" style={{margin:0}}>
              {['good','worn','failing','n/a'].map(s => (
                <button key={s} type="button" className={`ins-toggle ${cond[area] === s ? 'on' : ''}`} style={{padding:'4px 10px',fontSize:11}} onClick={() => set(area, s)}>{s}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="ins-field">
        <label>Pipe boot count + condition</label>
        <textarea placeholder="3 pipe boots. 2 are cracked and need replacement." value={data.pipe_boots || ''} onChange={e => onChange({ pipe_boots: e.target.value })} />
      </div>
    </>
  )
}

function SectionAttic({ data, onChange }) {
  return (
    <>
      <div className="ins-callout">
        <strong>Required by SOP.</strong> Alex's protocol: every inspection requires an attic walkthrough. This confirms decking type, ventilation function, and reveals issues invisible from above (mold, light leaks, leak trails).
      </div>
      <div className="ins-field">
        <label>Attic accessed?</label>
        <div className="ins-radio-grid">
          {[{v:'yes',i:'✅',l:'Yes — full walkthrough'},{v:'partial',i:'🟡',l:'Partial / limited access'},{v:'no',i:'🚫',l:'No — homeowner declined'}].map(opt => (
            <button key={opt.v} type="button" className={`ins-radio ${data.accessed === opt.v ? 'on' : ''}`} onClick={() => onChange({ accessed: opt.v })}>
              <span className="ins-radio-icon">{opt.i}</span>{opt.l}
            </button>
          ))}
        </div>
      </div>
      <div className="ins-row">
        <div className="ins-field">
          <label>Decking type confirmed (from below)</label>
          <select value={data.decking_confirmed || ''} onChange={e => onChange({ decking_confirmed: e.target.value })}>
            <option value="">—</option>
            <option value="plywood_1/2">Plywood ½"</option>
            <option value="plywood_5/8">Plywood ⅝"</option>
            <option value="osb">OSB</option>
            <option value="planks">Plank decking</option>
            <option value="multiple">Mixed / multiple</option>
          </select>
        </div>
        <div className="ins-field">
          <label>Insulation level</label>
          <select value={data.insulation || ''} onChange={e => onChange({ insulation: e.target.value })}>
            <option value="">—</option>
            <option value="none">None / minimal</option>
            <option value="adequate">Adequate</option>
            <option value="thick">Thick / R30+</option>
            <option value="excessive">Excessive (blocking vents)</option>
          </select>
        </div>
      </div>
      <div className="ins-field">
        <label>Findings (multi-select)</label>
        <div className="ins-toggles">
          {[{id:'mold',l:'Mold / mildew'},{id:'light',l:'Light leaks (= roof holes)'},{id:'water_stain',l:'Water staining'},{id:'rot',l:'Wood rot'},{id:'pests',l:'Pest / animal activity'},{id:'poor_vent',l:'Poor ventilation'},{id:'none',l:'No issues found'}].map(opt => {
            const sel = (data.findings || []).includes(opt.id)
            return <button key={opt.id} type="button" className={`ins-toggle ${sel ? 'on' : ''}`} onClick={() => {
              const cur = data.findings || []
              const next = sel ? cur.filter(x => x !== opt.id) : [...cur, opt.id]
              onChange({ findings: next })
            }}>{opt.l}</button>
          })}
        </div>
      </div>
      <div className="ins-field">
        <label>Notes</label>
        <textarea placeholder="What you saw in the attic that the homeowner should know about…" value={data.notes || ''} onChange={e => onChange({ notes: e.target.value })} />
      </div>
    </>
  )
}

function SectionVentilation({ data, onChange }) {
  return (
    <>
      <div className="ins-field">
        <label>Current ventilation type(s)</label>
        <div className="ins-toggles">
          {[{id:'ridge',l:'Ridge vent'},{id:'soffit',l:'Soffit vents'},{id:'gable',l:'Gable vents'},{id:'box',l:'Box vents'},{id:'turbine',l:'Turbines'},{id:'none',l:'None observed'}].map(opt => {
            const sel = (data.types || []).includes(opt.id)
            return <button key={opt.id} type="button" className={`ins-toggle ${sel ? 'on' : ''}`} onClick={() => {
              const cur = data.types || []
              onChange({ types: sel ? cur.filter(x => x !== opt.id) : [...cur, opt.id] })
            }}>{opt.l}</button>
          })}
        </div>
      </div>
      <div className="ins-field">
        <label>Ventilation adequacy</label>
        <div className="ins-radio-grid">
          {[{v:'adequate',i:'✅',l:'Adequate'},{v:'borderline',i:'🟡',l:'Borderline'},{v:'inadequate',i:'🚨',l:'Inadequate'}].map(opt => (
            <button key={opt.v} type="button" className={`ins-radio ${data.adequacy === opt.v ? 'on' : ''}`} onClick={() => onChange({ adequacy: opt.v })}>
              <span className="ins-radio-icon">{opt.i}</span>{opt.l}
            </button>
          ))}
        </div>
      </div>
      <div className="ins-row">
        <div className="ins-field">
          <label>Gutters condition</label>
          <select value={data.gutters || ''} onChange={e => onChange({ gutters: e.target.value })}>
            <option value="">—</option>
            <option value="good">Good</option>
            <option value="worn">Worn / functional</option>
            <option value="failing">Failing / needs replacement</option>
            <option value="missing">Missing</option>
          </select>
        </div>
        <div className="ins-field">
          <label>Fascia condition</label>
          <select value={data.fascia || ''} onChange={e => onChange({ fascia: e.target.value })}>
            <option value="">—</option>
            <option value="good">Good</option>
            <option value="worn">Worn</option>
            <option value="rot">Rot visible</option>
          </select>
        </div>
      </div>
    </>
  )
}

function SectionRecommend({ insp, setInsp, onSchedule }) {
  function set(k, v) {
    setInsp(prev => { const next = { ...prev, [k]: v }; onSchedule(next); return next })
  }
  return (
    <>
      <div className="ins-field">
        <label>Recommended scope</label>
        <textarea rows={4} placeholder="Full tear-off and replacement with GAF Timberline HDZ. Replace 6 sheets of decking. Install new ridge vent. Re-flash chimney…" value={insp.recommendation_summary || ''} onChange={e => set('recommendation_summary', e.target.value)} />
      </div>
      <div className="ins-field">
        <label>Urgency</label>
        <div className="ins-radio-grid">
          {[{v:'low',i:'🟢',l:'Low — monitor'},{v:'medium',i:'🟡',l:'Medium — within season'},{v:'high',i:'🟠',l:'High — within 30 days'},{v:'emergency',i:'🔴',l:'Emergency — active leak'}].map(opt => (
            <button key={opt.v} type="button" className={`ins-radio ${insp.urgency === opt.v ? 'on' : ''}`} onClick={() => set('urgency', opt.v)}>
              <span className="ins-radio-icon">{opt.i}</span>{opt.l}
            </button>
          ))}
        </div>
      </div>
      <div className="ins-field">
        <label>Rep name (will appear on report)</label>
        <input type="text" placeholder="Carlos M." value={insp.rep_name || ''} onChange={e => set('rep_name', e.target.value)} />
      </div>
    </>
  )
}

function SectionReview({ insp, onSubmit, submitted, busy }) {
  const sec = insp.sections || {}
  const photoCount = (insp.photos || []).length
  const atticOK = !!sec.attic?.accessed
  return (
    <>
      <div className="ins-callout">
        Review your inspection before submitting. Once submitted, you'll be redirected to the printable report.
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        <div className="ins-review-stat"><span>Access method</span><strong>{sec.access?.access_method || '—'}</strong></div>
        <div className="ins-review-stat"><span>Material</span><strong>{sec.system?.material || '—'}</strong></div>
        <div className="ins-review-stat"><span>Squares · Pitch · Planes</span><strong>{sec.measure?.squares || '—'} sq · {sec.measure?.pitch || '—'}/12 · {sec.measure?.planes || '—'}</strong></div>
        <div className="ins-review-stat"><span>Damage types</span><strong>{(sec.damage?.types || []).length} flagged</strong></div>
        <div className="ins-review-stat"><span>Attic accessed (required)</span><strong style={{color: atticOK ? 'var(--success)' : 'var(--crimson)'}}>{atticOK ? '✓ yes' : '✗ not yet'}</strong></div>
        <div className="ins-review-stat"><span>Urgency</span><strong>{insp.urgency || '—'}</strong></div>
        <div className="ins-review-stat"><span>Photos uploaded</span><strong>{photoCount}</strong></div>
      </div>
      {!atticOK && <div className="ins-callout" style={{borderLeftColor:'#DC2626',background:'#FEF2F2',color:'#991B1B'}}><strong>Attic inspection required.</strong> Per Alex's SOP, all inspections must include attic access (or note why declined). Go back to step 6 to complete.</div>}
      {submitted ? (
        <a className="btn btn-primary" href={`/inspection/${insp.id}/pdf`} style={{textAlign:'center',textDecoration:'none',display:'inline-flex',alignItems:'center',justifyContent:'center'}}>📄 View Report</a>
      ) : (
        <button className="btn-mega" disabled={busy} onClick={onSubmit}>{busy ? 'Submitting…' : 'Submit Inspection & Generate Report'}</button>
      )}
    </>
  )
}

function Center({ children }) {
  return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:24,fontFamily:'system-ui'}}>{children}</div>
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => { const s = r.result; const i = s.indexOf(','); resolve(i >= 0 ? s.slice(i + 1) : s) }
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

function timeAgo(date) {
  const s = Math.round((Date.now() - date.getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.round(s/60)}m ago`
  return `${Math.round(s/3600)}h ago`
}
