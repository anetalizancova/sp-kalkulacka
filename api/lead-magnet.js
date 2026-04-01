export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, tag, results, utm } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const AIRTABLE_TOKEN = process.env.AIRTABLE_API_TOKEN;
  const BREVO_KEY = process.env.BREVO_API_KEY;
  const BASE_ID = process.env.AIRTABLE_BASE_ID;
  const TABLE_NAME = 'Leads';

  const errors = [];

  // 1. Save to Airtable
  if (AIRTABLE_TOKEN && BASE_ID) {
    try {
      const atRes = await fetch(
        `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${AIRTABLE_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            records: [
              {
                fields: {
                  Email: email,
                  'Lead Magnet': tag || 'sp-lm-kalkulacka',
                  Results: results ? JSON.stringify(results) : '',
                  'UTM Source': utm?.source || '',
                  'UTM Medium': utm?.medium || '',
                  'UTM Campaign': utm?.campaign || '',
                },
              },
            ],
          }),
        }
      );

      if (!atRes.ok) {
        const err = await atRes.json();
        console.error('Airtable error:', err);
        errors.push('airtable');
      }
    } catch (err) {
      console.error('Airtable error:', err);
      errors.push('airtable');
    }
  }

  // 2. Create/update contact in Brevo with tags
  if (BREVO_KEY) {
    try {
      const brevoRes = await fetch('https://api.brevo.com/v3/contacts', {
        method: 'POST',
        headers: {
          'api-key': BREVO_KEY,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          email,
          updateEnabled: true,
          attributes: {
            SP_LEAD_MAGNET: tag || 'sp-lm-kalkulacka',
            SP_CALCULATOR_HOURS: results?.weeklyHours || 0,
          },
          listIds: process.env.BREVO_LIST_ID
            ? [parseInt(process.env.BREVO_LIST_ID)]
            : [],
        }),
      });

      if (!brevoRes.ok && brevoRes.status !== 204) {
        const err = await brevoRes.json().catch(() => ({}));
        console.error('Brevo error:', err);
        errors.push('brevo');
      }
    } catch (err) {
      console.error('Brevo error:', err);
      errors.push('brevo');
    }
  }

  if (errors.length > 0) {
    return res.status(207).json({ success: true, partial: true, errors });
  }

  return res.status(200).json({ success: true });
}
