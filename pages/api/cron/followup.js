/**
 * Scheduled 48-hour follow-up SMS.
 *
 * Runs DAILY via Vercel Cron (config in /vercel.json) at 01:00 UTC (~6pm Pacific previous day).
 * Why daily and not hourly? Vercel Hobby plan limits cron to once per day; upgrading to
 * Pro ($20/mo) unlocks unlimited schedules — then change vercel.json to "0 * * * *"
 * and tighten the window below to 48-72 hours.
 *
 * Finds proposals that:
 *   - Are in status "viewed"  (the customer DID open it but never accepted)
 *   - Were viewed 48-72 hours ago  (sweet spot for nudges)
 *   - Have NOT been followed-up yet  (followup_sent_at IS NULL)
 *   - Have a way to reach the customer (phone or stored GHL contact id)
 *
 * For each match, sends a single friendly SMS via GHL and stamps followup_sent_at
 * so we never double-nudge.
 *
 * Security: Vercel cron requests carry `Authorization: Bearer <CRON_SECRET>`.
 * We reject anything that doesn't match.
 *
 * TESTING SAFELY — use dry-run mode. This returns the candidates that WOULD be
 * texted but does NOT actually send SMS or stamp the database:
 *   curl -H "Authorization: Bearer $CRON_SECRET" "https://<your-app>/api/cron/followup?dry_run=true"
 *
 * Live run (be careful — sends real SMS to real customers):
 *   curl -H "Authorization: Bearer $CRON_SECRET" "https://<your-app>/api/cron/followup"
 */

import { serverClient } from '../../../lib/supabase'
import { ensureContactAndSendSms } from '../../../lib/ghl'

// Tunables — change here if the window doesn't feel right.
// We sweep a wide window (36-96 hours) because the cron runs DAILY on Vercel Hobby.
// On Pro you can switch to hourly and tighten this back to 48-72 hours.
const FOLLOWUP_AFTER_HOURS = 36
const FOLLOWUP_BEFORE_HOURS = 96

export default async function handler(req, res) {
  // 1. Auth check — only Vercel Cron (or a curl with the secret) may run this.
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return res.status(500).json({ error: 'CRON_SECRET env var not set on Vercel' })
  }
  const provided = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (provided !== expected) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  // Dry-run mode — caller can preview what the cron WOULD do without firing real SMS.
  // Accepts ?dry_run=true (or "1") in the query string.
  const dryRun =
    String(req.query?.dry_run || '').toLowerCase() === 'true' ||
    String(req.query?.dry_run || '') === '1'

  const sb = serverClient()
  const now = Date.now()
  const windowEnd   = new Date(now - FOLLOWUP_AFTER_HOURS  * 3600_000).toISOString()
  const windowStart = new Date(now - FOLLOWUP_BEFORE_HOURS * 3600_000).toISOString()

  // 2. Find proposals due for a nudge.
  const { data: candidates, error } = await sb
    .from('proposals')
    .select('id, prop_num, customer_name, customer_phone, customer_email, ghl_contact_id, viewed_at, followup_sent_at, status')
    .eq('status', 'viewed')
    .is('followup_sent_at', null)
    .gte('viewed_at', windowStart)
    .lte('viewed_at', windowEnd)
    .limit(50)

  if (error) {
    console.error('cron query failed:', error)
    return res.status(500).json({ error: error.message })
  }

  // 3. Send nudges. Track per-proposal results so the response is useful.
  const results = []
  const base = process.env.NEXT_PUBLIC_SITE_URL || ''

  for (const p of candidates || []) {
    if (!p.customer_phone && !p.ghl_contact_id) {
      results.push({ id: p.id, prop_num: p.prop_num, ok: false, skipped: 'no phone or ghl_contact_id' })
      continue
    }

    const firstName = (p.customer_name || '').split(/\s+/)[0] || 'there'
    const link = base ? `${base.replace(/\/$/, '')}/p/${p.id}` : ''
    const message =
      `Hi ${firstName}, just checking in — did you get a chance to look over your roofing proposal? ` +
      `Happy to answer any questions or walk through the options together. ${link}`.trim()

    // ===== DRY RUN BRANCH =====
    // Report what we'd do without actually sending or stamping the database.
    if (dryRun) {
      results.push({
        id: p.id,
        prop_num: p.prop_num,
        ok: true,
        wouldSendTo: p.customer_name,
        wouldUseContactId: p.ghl_contact_id || '(would upsert from phone ' + p.customer_phone + ')',
        wouldSendMessage: message,
      })
      continue
    }
    // ===== LIVE BRANCH =====

    const smsResult = await ensureContactAndSendSms({
      contactId: p.ghl_contact_id || null,
      phone: p.customer_phone,
      name: p.customer_name,
      email: p.customer_email,
      message,
    })

    if (smsResult.ok) {
      // Stamp followup_sent_at so we don't text again on the next hourly run
      await sb
        .from('proposals')
        .update({ followup_sent_at: new Date().toISOString() })
        .eq('id', p.id)
      results.push({ id: p.id, prop_num: p.prop_num, ok: true, contactId: smsResult.contactId })
    } else {
      // Leave followup_sent_at NULL so the next run retries.
      console.error(`Follow-up SMS failed for proposal ${p.prop_num}:`, smsResult.error)
      results.push({ id: p.id, prop_num: p.prop_num, ok: false, error: smsResult.error })
    }
  }

  return res.status(200).json({
    dryRun, // surface this loud and clear in the response
    window: { from: windowStart, to: windowEnd, hours: [FOLLOWUP_AFTER_HOURS, FOLLOWUP_BEFORE_HOURS] },
    candidates: candidates?.length || 0,
    sent: dryRun ? 0 : results.filter(r => r.ok).length,
    wouldSend: dryRun ? results.filter(r => r.ok).length : undefined,
    failed: results.filter(r => !r.ok && !r.skipped).length,
    skipped: results.filter(r => r.skipped).length,
    results,
  })
}
