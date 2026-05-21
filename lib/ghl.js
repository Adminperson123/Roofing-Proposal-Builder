/**
 * GHL (GoHighLevel) helper module — outbound integration.
 *
 * What this file does: gives the rest of the app one clean place to talk to GHL.
 *   - sendSms()         → text a contact (must already exist in GHL)
 *   - upsertContact()   → create-or-update a contact by phone/email; returns the GHL contactId
 *   - addContactTags()  → attach tags like "proposal-accepted" / "tier-better"
 *   - upsertOpportunity()→ create-or-update an opportunity inside a pipeline
 *   - findPipelineStageByName() → look up pipeline + stage IDs by name (so we don't hardcode)
 *
 * All functions are SAFE — they catch their own errors and return { ok, error }
 * instead of throwing. The proposal flow MUST NOT break if GHL is temporarily down.
 *
 * Env vars required (set in Vercel project):
 *   GHL_PIT           — Private Integration Token for this GHL location
 *   GHL_LOCATION_ID   — the GHL location (sub-account) ID
 *
 * GHL API docs: https://highlevel.stoplight.io/docs/integrations
 */

const GHL_BASE = 'https://services.leadconnectorhq.com'

function getCreds() {
  const token = process.env.GHL_PIT
  const locationId = process.env.GHL_LOCATION_ID
  if (!token || !locationId) {
    return { ok: false, error: 'GHL_PIT or GHL_LOCATION_ID env var not set' }
  }
  return { ok: true, token, locationId }
}

/** Normalize a US phone to E.164 (+1XXXXXXXXXX). Returns null if it doesn't look like a phone. */
export function normalizePhone(raw) {
  if (!raw) return null
  const digits = String(raw).replace(/\D/g, '')
  if (digits.length === 10) return '+1' + digits
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits
  if (String(raw).startsWith('+')) return String(raw)
  return null
}

async function ghlFetch(path, { method = 'POST', body, version = '2021-07-28' } = {}) {
  const creds = getCreds()
  if (!creds.ok) return creds

  try {
    const res = await fetch(`${GHL_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${creds.token}`,
        Version: version,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    const text = await res.text()
    const json = text ? safeJson(text) : null
    if (!res.ok) {
      return { ok: false, status: res.status, error: json?.message || text || `HTTP ${res.status}` }
    }
    return { ok: true, data: json }
  } catch (err) {
    return { ok: false, error: err.message || String(err) }
  }
}

function safeJson(s) {
  try { return JSON.parse(s) } catch { return null }
}

/**
 * Upsert a contact by phone (or email if no phone).
 * Returns { ok, contactId } on success.
 */
export async function upsertContact({ firstName, lastName, name, phone, email, address, tags, customFields }) {
  const creds = getCreds()
  if (!creds.ok) return creds

  // Split a single "name" into firstName/lastName if not already split
  if (!firstName && !lastName && name) {
    const parts = String(name).trim().split(/\s+/)
    firstName = parts.shift() || ''
    lastName = parts.join(' ') || ''
  }

  const phoneE164 = normalizePhone(phone)
  const body = {
    locationId: creds.locationId,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    name: name || undefined,
    email: email || undefined,
    phone: phoneE164 || undefined,
    address1: address || undefined,
    tags: Array.isArray(tags) && tags.length ? tags : undefined,
    // customFields: [{ id|key, field_value|value }] — for cross-referencing in GHL
    customFields: Array.isArray(customFields) && customFields.length ? customFields : undefined,
    source: 'Roofing Proposal Builder',
  }

  const result = await ghlFetch('/contacts/upsert', { body, version: '2021-07-28' })
  if (!result.ok) return result

  const contactId = result.data?.contact?.id || result.data?.id || null
  if (!contactId) return { ok: false, error: 'Upsert succeeded but no contactId returned' }
  // GHL's upsert response flags whether the contact was newly created.
  const isNew = result.data?.new === true || result.data?.contact?.new === true
  return { ok: true, contactId, isNew, contact: result.data?.contact || result.data }
}

/** Attach tags to a GHL contact. */
export async function addContactTags(contactId, tags) {
  if (!contactId) return { ok: false, error: 'contactId required' }
  if (!Array.isArray(tags) || !tags.length) return { ok: false, error: 'tags required' }
  return ghlFetch(`/contacts/${contactId}/tags`, {
    body: { tags },
    version: '2021-07-28',
  })
}

/**
 * Send an SMS to a GHL contact. Requires contactId (the contact must exist in GHL).
 * If you only have a phone number, call upsertContact() first.
 */
export async function sendSms({ contactId, message }) {
  if (!contactId) return { ok: false, error: 'contactId required for SMS' }
  if (!message) return { ok: false, error: 'message required' }

  return ghlFetch('/conversations/messages', {
    body: {
      type: 'SMS',
      contactId,
      message,
    },
    version: '2021-04-15',
  })
}

/**
 * Convenience: ensure-contact-then-text.
 * If you have a phone but no contactId, this upserts the contact first.
 * Returns { ok, contactId, smsResult }.
 */
export async function ensureContactAndSendSms({ contactId, phone, name, email, message }) {
  let cid = contactId
  if (!cid) {
    if (!phone) return { ok: false, error: 'Need either contactId or phone' }
    const up = await upsertContact({ phone, name, email })
    if (!up.ok) return { ok: false, error: 'upsert failed: ' + up.error, step: 'upsert' }
    cid = up.contactId
  }
  const smsResult = await sendSms({ contactId: cid, message })
  return { ok: smsResult.ok, contactId: cid, smsResult, error: smsResult.error }
}

/**
 * Find a pipeline + stage by name (case-insensitive substring match).
 * Lets us write code like `findPipelineStageByName('proposal', 'accepted')`
 * without hardcoding pipeline IDs that vary per location.
 */
export async function findPipelineStageByName(pipelineNameContains, stageNameContains) {
  const creds = getCreds()
  if (!creds.ok) return creds

  const result = await ghlFetch(`/opportunities/pipelines?locationId=${creds.locationId}`, {
    method: 'GET',
    version: '2021-07-28',
  })
  if (!result.ok) return result

  const pipelines = result.data?.pipelines || []
  const pipeline = pipelines.find(p =>
    String(p.name || '').toLowerCase().includes(String(pipelineNameContains).toLowerCase())
  )
  if (!pipeline) return { ok: false, error: `No pipeline matching "${pipelineNameContains}"` }

  const stage = (pipeline.stages || []).find(s =>
    String(s.name || '').toLowerCase().includes(String(stageNameContains).toLowerCase())
  )
  if (!stage) return { ok: false, error: `Pipeline "${pipeline.name}" has no stage matching "${stageNameContains}"` }

  return { ok: true, pipelineId: pipeline.id, pipelineName: pipeline.name, stageId: stage.id, stageName: stage.name }
}

/**
 * Create or update an opportunity for a contact.
 * Pass status 'open' | 'won' | 'lost' | 'abandoned'.
 */
export async function upsertOpportunity({ contactId, pipelineId, pipelineStageId, name, monetaryValue, status = 'open' }) {
  const creds = getCreds()
  if (!creds.ok) return creds
  if (!contactId || !pipelineId || !pipelineStageId) {
    return { ok: false, error: 'contactId, pipelineId, pipelineStageId all required' }
  }

  const body = {
    locationId: creds.locationId,
    contactId,
    pipelineId,
    pipelineStageId,
    name: name || 'Roofing Proposal',
    status,
    monetaryValue: monetaryValue || undefined,
  }

  const result = await ghlFetch('/opportunities/upsert', { body, version: '2021-07-28' })
  if (!result.ok) return result
  const opportunityId = result.data?.opportunity?.id || result.data?.id || null
  return { ok: true, opportunityId, opportunity: result.data?.opportunity || result.data }
}
