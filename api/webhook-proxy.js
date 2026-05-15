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

  // Validar que sea un webhook de n8n — whitelist exacta de hostnames (previene SSRF)
  let parsedUrl;
  try { parsedUrl = new URL(webhook_url); } catch(_) {
    return res.status(400).json({ error: 'URL inválida' });
  }
  const ALLOWED_HOSTS = ['app.n8n.cloud', 'n8n.cloud'];
  const hostOk = ALLOWED_HOSTS.some(h => parsedUrl.hostname === h || parsedUrl.hostname.endsWith('.' + h));
  const devOk  = process.env.NODE_ENV !== 'production' && parsedUrl.hostname === 'localhost';
  if (!hostOk && !devOk) {
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

    // Leer texto crudo primero — evita crash si el body está vacío
    const rawText = await response.text();
    let data = rawText;
    if (rawText && rawText.trim().startsWith('{')) {
      try { data = JSON.parse(rawText); } catch(_) { data = rawText; }
    }

    return res.status(200).json({
      ok: response.ok,
      status: response.status,
      data,
    });

  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(500).json({ error: err.message });
  }
}
