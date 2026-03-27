/**
 * GHL Webhook API Endpoint
 * POST /api/webhook  — receives contact data from GHL workflow
 * GET  /api/webhook  — polled by the frontend every 3s to pick up new contact
 */

let pendingContact = null;

export default function handler(req, res) {
  if (req.method === 'POST') {
    const body = req.body || {};

    const contact = {
      firstName : body.firstName  || body.first_name  || body.contact_first_name  || '',
      lastName  : body.lastName   || body.last_name   || body.contact_last_name   || '',
      email     : body.email      || body.contact_email                            || '',
      phone     : body.phone      || body.phone_number || body.contact_phone       || '',
      address   : body.address    || body.address1     || body.full_address        || '',
      city      : body.city                                                         || '',
      state     : body.state                                                        || '',
      zip       : body.zip        || body.postal_code                               || '',
    };

    pendingContact = contact;
    res.status(200).json({ ok: true, received: contact });
    return;
  }

  if (req.method === 'GET') {
    if (pendingContact) {
      const contact = pendingContact;
      pendingContact = null;
      res.status(200).json({ contact });
    } else {
      res.status(200).json({ contact: null });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
