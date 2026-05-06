export default async function handler(req, res) {
  const SB_URL = process.env.SUPABASE_URL || 'https://mmokunpuslcfphalrwot.supabase.co';
  const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_publishable_aETz_9ECH5RcBMjmRhUnfw_g71zRdwT';

  try {
    // 1. Fetch Shops, Services, and Staff in parallel
    const [shopsRes, configRes] = await Promise.all([
      fetch(`${SB_URL}/rest/v1/shops?select=*,servicios(*),staff:barberos(*)&activo=eq.true`, {
        headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` }
      }),
      fetch(`${SB_URL}/rest/v1/landing_config?select=key,value`, {
        headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` }
      })
    ]);

    if (!shopsRes.ok) throw new Error('Failed to fetch shops');
    const shopsRaw = await shopsRes.json();
    const configRaw = await configRes.json();

    // 2. Map Marketplace Configuration
    const mktConfig = {};
    if (Array.isArray(configRaw)) {
      configRaw.forEach(row => {
        if (row.key.startsWith('mkt_')) {
          mktConfig[row.key] = row.value;
        }
      });
    }

    // 3. Normalize Shop Data for the Frontend
    const shops = shopsRaw.map(s => ({
      ...s,
      id: String(s.id),
      nombre: s.mkt_name || s.nombre,
      lat: parseFloat(s.mkt_lat || s.lat || 18.4861),
      lng: parseFloat(s.mkt_lng || s.lng || -69.9312),
      horario: s.horario || [
        {dia:'Lunes', apertura:'09:00', cierre:'20:00'}, {dia:'Martes', apertura:'09:00', cierre:'20:00'},
        {dia:'Miércoles', apertura:'09:00', cierre:'20:00'}, {dia:'Jueves', apertura:'09:00', cierre:'20:00'},
        {dia:'Viernes', apertura:'09:00', cierre:'21:00'}, {dia:'Sábado', apertura:'09:00', cierre:'21:00'},
        {dia:'Domingo', apertura:'10:00', cierre:'18:00'}
      ]
    }));

    res.status(200).json({ shops, config: mktConfig });
  } catch (error) {
    console.error('Marketplace API Error:', error);
    res.status(500).json({ error: error.message });
  }
}
