// /api/webhook-proxy.js
// Proxy serverless de Vercel — reenvía POST del simulador al webhook de n8n
// evitando el bloqueo CORS del browser.

export default async function handler(req, res) {
  // Permitir CORS desde cualquier origen (solo para el simulador interno)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // El webhook de n8n viene en el body como campo "webhook_url"
  const { webhook_url, ...fields } = req.body;

  if (!webhook_url) {
    return res.status(400).json({ error: 'Falta webhook_url' });
  }

  // Validar que sea un webhook de n8n (seguridad básica)
  if (!webhook_url.includes('n8n.cloud') && !webhook_url.includes('localhost')) {
    return res.status(400).json({ error: 'URL no permitida' });
  }

  try {
    // Reenviar como form-urlencoded, igual que Twilio
    const body = new URLSearchParams(fields).toString();

    const response = await fetch(webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const contentType = response.headers.get('content-type') || '';
    let data;

    if (contentType.includes('json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return res.status(response.status).json({
      ok: response.ok,
      status: response.status,
      data,
    });

  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(500).json({ error: err.message });
  }
}
