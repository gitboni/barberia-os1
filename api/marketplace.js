// /api/marketplace.js
// Proxy para ocultar SB_KEY y servir metadatos del marketplace de forma segura.

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const SB_URL = 'https://mmokunpuslcfphalrwot.supabase.co';
  // En producción, esto debe estar en Vercel Environment Variables como SB_SERVICE_ROLE_KEY
  const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_publishable_aETz_9ECH5RcBMjmRhUnfw_g71zRdwT';

  try {
    // 1. Fetch Shops activos
    const shopsRes = await fetch(`${SB_URL}/rest/v1/shops?select=*&activo=eq.true&order=plan.desc`, {
      headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` }
    });
    
    if (!shopsRes.ok) {
      const errorText = await shopsRes.text();
      throw new Error(`Supabase error: ${shopsRes.status} ${errorText}`);
    }
    
    const shops = await shopsRes.json();

    // 2. Fetch Config Global (opcional, si existe la tabla)
    let config = {};
    try {
      const configRes = await fetch(`${SB_URL}/rest/v1/landing_config?id=eq.marketplace&select=*`, {
        headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` }
      });
      const configData = await configRes.json();
      if (configData && configData.length > 0) config = configData[0];
    } catch (e) {
      console.warn('landing_config no disponible o error:', e.message);
    }

    return res.status(200).json({
      success: true,
      shops,
      config
    });

  } catch (err) {
    console.error('Marketplace Proxy Error:', err);
    return res.status(500).json({ error: 'Error interno del servidor', detail: err.message });
  }
}
