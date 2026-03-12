-- ============================================================
-- BarberOS SaaS — Base de Datos Escalable v2
-- Ejecutar en: supabase.com → SQL Editor
-- Soporta N barberías con un solo workflow n8n
-- ============================================================

-- ── 1. SHOPS ────────────────────────────────────────────────
-- Cada barbería = 1 fila. El campo twilio_number permite
-- identificar automáticamente qué barbería es por el número
-- al que llegó el WhatsApp.
CREATE TABLE IF NOT EXISTS shops (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre           TEXT NOT NULL,
  slug             TEXT UNIQUE NOT NULL,
  twilio_number    TEXT UNIQUE,        -- ej: '+18291234567' — clave para multi-tenant
  whatsapp_dueño   TEXT,               -- número del dueño para notificaciones
  plan             TEXT DEFAULT 'free' CHECK (plan IN ('free','pro','elite')),
  duracion_turno   INTEGER DEFAULT 45,
  hora_inicio      INTEGER DEFAULT 9,  -- 9am
  hora_fin         INTEGER DEFAULT 18, -- 6pm
  timezone         TEXT DEFAULT 'America/Santo_Domingo',
  activo           BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. BARBEROS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS barberos (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id   UUID REFERENCES shops(id) ON DELETE CASCADE,
  nombre    TEXT NOT NULL,
  activo    BOOLEAN DEFAULT TRUE,
  orden     INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. CITAS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS citas (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id     UUID REFERENCES shops(id) ON DELETE CASCADE,
  chat_id     TEXT,
  nombre      TEXT,
  telefono    TEXT,
  fecha       DATE NOT NULL,
  hora        TIME NOT NULL,
  servicio    TEXT DEFAULT 'Corte de cabello',
  barbero     TEXT,
  barbero_id  UUID REFERENCES barberos(id),
  estado      TEXT DEFAULT 'Confirmada' CHECK (estado IN ('Confirmada','Cancelada','Completada','No-Show')),
  recordatorio_enviado BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. CONVERSACIONES ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversaciones (
  id                     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id                UUID REFERENCES shops(id) ON DELETE CASCADE,
  chat_id                TEXT NOT NULL,
  telefono               TEXT,
  estado_conversacion    TEXT DEFAULT 'en_progreso',
  nombre_parcial         TEXT,
  fecha_parcial          TEXT,
  hora_parcial           TEXT,
  servicio_parcial       TEXT,
  barbero_parcial        TEXT,
  esperando_confirmacion BOOLEAN DEFAULT FALSE,
  esperando_barbero      BOOLEAN DEFAULT FALSE,
  barberos_disponibles   TEXT DEFAULT '[]',
  ultima_actualizacion   TIMESTAMPTZ DEFAULT NOW(),
  ultimo_mensaje         TEXT,
  UNIQUE(shop_id, chat_id)
);

-- ── 5. ÍNDICES ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_shops_twilio    ON shops(twilio_number);
CREATE INDEX IF NOT EXISTS idx_shops_slug      ON shops(slug);
CREATE INDEX IF NOT EXISTS idx_citas_shop_fecha ON citas(shop_id, fecha);
CREATE INDEX IF NOT EXISTS idx_citas_estado    ON citas(estado);
CREATE INDEX IF NOT EXISTS idx_conv_shop_chat  ON conversaciones(shop_id, chat_id);
CREATE INDEX IF NOT EXISTS idx_barberos_shop   ON barberos(shop_id, activo);

-- ── 6. ROW LEVEL SECURITY ───────────────────────────────────
ALTER TABLE shops         ENABLE ROW LEVEL SECURITY;
ALTER TABLE barberos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE citas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversaciones ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas (el control lo maneja n8n con service_role)
DROP POLICY IF EXISTS "public_read_shops"  ON shops;
DROP POLICY IF EXISTS "public_read_barbs"  ON barberos;
DROP POLICY IF EXISTS "public_read_citas"  ON citas;
DROP POLICY IF EXISTS "all_conv"           ON conversaciones;
DROP POLICY IF EXISTS "all_citas"          ON citas;
DROP POLICY IF EXISTS "all_shops"          ON shops;
DROP POLICY IF EXISTS "all_barbs"          ON barberos;

CREATE POLICY "public_read_shops" ON shops  FOR SELECT USING (true);
CREATE POLICY "public_read_barbs" ON barberos FOR SELECT USING (true);
CREATE POLICY "public_read_citas" ON citas  FOR SELECT USING (true);
CREATE POLICY "all_citas"  ON citas  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "all_conv"   ON conversaciones FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "all_shops"  ON shops  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "all_barbs"  ON barberos FOR ALL USING (true) WITH CHECK (true);

-- ── 7. FUNCIÓN: buscar shop por número Twilio ────────────────
-- Esta función es la clave del multi-tenant escalable.
-- n8n la llama con el número "To" del mensaje entrante
-- y obtiene el shop_id automáticamente.
CREATE OR REPLACE FUNCTION get_shop_by_twilio(p_number TEXT)
RETURNS TABLE(
  shop_id        UUID,
  nombre         TEXT,
  slug           TEXT,
  duracion_turno INTEGER,
  hora_inicio    INTEGER,
  hora_fin       INTEGER,
  timezone       TEXT,
  whatsapp_dueño TEXT
) LANGUAGE sql STABLE AS $$
  SELECT id, nombre, slug, duracion_turno, hora_inicio, hora_fin, timezone, whatsapp_dueño
  FROM shops
  WHERE twilio_number = p_number AND activo = TRUE
  LIMIT 1;
$$;

-- ── 8. DATOS INICIALES: Elite Cuts ──────────────────────────
INSERT INTO shops (nombre, slug, twilio_number, whatsapp_dueño, plan, duracion_turno)
VALUES (
  'Elite Cuts',
  'elite-cuts',
  '+14155238886',          -- número Twilio Sandbox actual
  '+18098498528',          -- tu número para notificaciones
  'pro',
  45
)
ON CONFLICT (slug) DO UPDATE SET
  twilio_number  = EXCLUDED.twilio_number,
  whatsapp_dueño = EXCLUDED.whatsapp_dueño,
  plan           = EXCLUDED.plan;

-- Barberos de Elite Cuts
INSERT INTO barberos (shop_id, nombre, orden)
SELECT id, 'Matías', 1 FROM shops WHERE slug = 'elite-cuts'
ON CONFLICT DO NOTHING;

INSERT INTO barberos (shop_id, nombre, orden)
SELECT id, 'Lucas', 2 FROM shops WHERE slug = 'elite-cuts'
ON CONFLICT DO NOTHING;

INSERT INTO barberos (shop_id, nombre, orden)
SELECT id, 'Gonzalo', 3 FROM shops WHERE slug = 'elite-cuts'
ON CONFLICT DO NOTHING;

-- ── 9. EJEMPLO: agregar nueva barbería ──────────────────────
-- Cuando tengas un cliente nuevo, ejecuta esto:
/*
INSERT INTO shops (nombre, slug, twilio_number, whatsapp_dueño, plan, duracion_turno)
VALUES ('Barber King', 'barber-king', '+18291112222', '+18293334444', 'pro', 45);

INSERT INTO barberos (shop_id, nombre, orden)
SELECT id, 'Pedro', 1 FROM shops WHERE slug = 'barber-king';

INSERT INTO barberos (shop_id, nombre, orden)
SELECT id, 'Juan', 2 FROM shops WHERE slug = 'barber-king';
*/

-- ── 10. VERIFICAR ───────────────────────────────────────────
SELECT s.nombre, s.slug, s.twilio_number, s.plan,
       COUNT(b.id) AS barberos
FROM shops s
LEFT JOIN barberos b ON b.shop_id = s.id
GROUP BY s.id, s.nombre, s.slug, s.twilio_number, s.plan
ORDER BY s.created_at;
