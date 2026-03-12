-- ============================================================
-- BarberOS — Supabase Multi-Tenant Setup
-- Ejecutar en: https://supabase.com/dashboard → SQL Editor
-- ============================================================

-- 1. TABLA SHOPS (una fila por barbería)
CREATE TABLE IF NOT EXISTS shops (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre         TEXT NOT NULL,
  slug           TEXT UNIQUE NOT NULL,        -- ej: "elite-cuts"
  whatsapp       TEXT,                         -- número del dueño
  plan           TEXT DEFAULT 'free',          -- free | pro | elite
  webhook_url    TEXT,                         -- URL n8n de esta barbería
  duracion_turno INTEGER DEFAULT 45,           -- minutos por turno
  activo         BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABLA BARBEROS
CREATE TABLE IF NOT EXISTS barberos (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id   UUID REFERENCES shops(id) ON DELETE CASCADE,
  nombre    TEXT NOT NULL,
  activo    BOOLEAN DEFAULT TRUE
);

-- 3. ACTUALIZAR TABLA CITAS (agregar shop_id)
ALTER TABLE citas ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES shops(id);
ALTER TABLE citas ADD COLUMN IF NOT EXISTS barbero_id UUID REFERENCES barberos(id);

-- 4. ACTUALIZAR TABLA CONVERSACIONES (agregar shop_id)
ALTER TABLE conversaciones ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES shops(id);

-- 5. ÍNDICES para performance
CREATE INDEX IF NOT EXISTS idx_citas_shop_fecha ON citas(shop_id, fecha);
CREATE INDEX IF NOT EXISTS idx_conv_shop ON conversaciones(shop_id);
CREATE INDEX IF NOT EXISTS idx_shops_slug ON shops(slug);

-- 6. ROW LEVEL SECURITY (opcional pero recomendado)
ALTER TABLE shops         ENABLE ROW LEVEL SECURITY;
ALTER TABLE barberos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE citas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversaciones ENABLE ROW LEVEL SECURITY;

-- Políticas públicas de lectura (para el display de sala)
CREATE POLICY "Public read citas"  ON citas  FOR SELECT USING (true);
CREATE POLICY "Public read shops"  ON shops  FOR SELECT USING (true);
CREATE POLICY "Public read barbs"  ON barberos FOR SELECT USING (true);

-- Políticas de escritura (solo con service_role key desde n8n)
CREATE POLICY "Insert citas"  ON citas  FOR INSERT WITH CHECK (true);
CREATE POLICY "Update citas"  ON citas  FOR UPDATE USING (true);
CREATE POLICY "Insert conv"   ON conversaciones FOR INSERT WITH CHECK (true);
CREATE POLICY "Update conv"   ON conversaciones FOR UPDATE USING (true);
CREATE POLICY "Insert shops"  ON shops  FOR INSERT WITH CHECK (true);
CREATE POLICY "Insert barbs"  ON barberos FOR INSERT WITH CHECK (true);

-- ============================================================
-- 7. INSERTAR TU PRIMERA BARBERÍA (Elite Cuts)
--    Cambia los datos según tu barbería real
-- ============================================================
INSERT INTO shops (nombre, slug, whatsapp, plan, duracion_turno)
VALUES ('Elite Cuts', 'elite-cuts', '+18098498528', 'pro', 45)
ON CONFLICT (slug) DO NOTHING
RETURNING id, slug, nombre;

-- 8. INSERTAR BARBEROS DE ELITE CUTS
-- Primero obtén el shop_id del paso anterior, luego:
INSERT INTO barberos (shop_id, nombre)
SELECT id, 'Matías' FROM shops WHERE slug = 'elite-cuts'
ON CONFLICT DO NOTHING;

INSERT INTO barberos (shop_id, nombre)
SELECT id, 'Lucas' FROM shops WHERE slug = 'elite-cuts'
ON CONFLICT DO NOTHING;

INSERT INTO barberos (shop_id, nombre)
SELECT id, 'Gonzalo' FROM shops WHERE slug = 'elite-cuts'
ON CONFLICT DO NOTHING;

-- ============================================================
-- 9. VERIFICAR TODO
-- ============================================================
SELECT s.id, s.slug, s.nombre, s.plan,
       COUNT(b.id) AS barberos
FROM shops s
LEFT JOIN barberos b ON b.shop_id = s.id
GROUP BY s.id, s.slug, s.nombre, s.plan;
