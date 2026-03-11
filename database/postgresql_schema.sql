BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('superadmin', 'owner', 'admin', 'cajero');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sale_status') THEN
        CREATE TYPE sale_status AS ENUM ('draft', 'completed', 'cancelled', 'refunded');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_movement_type') THEN
        CREATE TYPE inventory_movement_type AS ENUM (
            'purchase',
            'sale',
            'sale_cancel',
            'manual_adjustment',
            'initial_load',
            'stock_count',
            'transfer_in',
            'transfer_out',
            'return',
            'waste'
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
        CREATE TYPE subscription_status AS ENUM ('trial', 'active', 'past_due', 'cancelled', 'expired');
    END IF;
END $$;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(160) NOT NULL,
    telefono VARCHAR(40),
    email VARCHAR(160),
    direccion TEXT,
    plan VARCHAR(80) NOT NULL DEFAULT 'base',
    modulos_activos JSONB NOT NULL DEFAULT '["pos","inventario","reportes"]'::jsonb,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_businesses_email_not_blank CHECK (email IS NULL OR btrim(email) <> '')
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    nombre VARCHAR(160) NOT NULL,
    email VARCHAR(160) NOT NULL,
    password_hash TEXT NOT NULL,
    rol user_role NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    nombre VARCHAR(180) NOT NULL,
    sku VARCHAR(120) NOT NULL,
    barcode VARCHAR(120),
    categoria VARCHAR(120),
    precio_compra NUMERIC(14,2) NOT NULL DEFAULT 0,
    precio_venta NUMERIC(14,2) NOT NULL,
    stock_actual NUMERIC(14,3),
    stock_minimo NUMERIC(14,3) NOT NULL DEFAULT 0,
    inventario_confirmado BOOLEAN NOT NULL DEFAULT FALSE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_products_precio_compra CHECK (precio_compra >= 0),
    CONSTRAINT chk_products_precio_venta CHECK (precio_venta >= 0),
    CONSTRAINT chk_products_stock_minimo CHECK (stock_minimo >= 0)
);

CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total NUMERIC(14,2) NOT NULL,
    metodo_pago VARCHAR(40) NOT NULL,
    status sale_status NOT NULL DEFAULT 'completed',
    referencia_externa VARCHAR(120),
    notas TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_sales_total CHECK (total >= 0)
);

CREATE TABLE IF NOT EXISTS sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    cantidad NUMERIC(14,3) NOT NULL,
    precio_unitario NUMERIC(14,2) NOT NULL,
    subtotal NUMERIC(14,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_sale_items_cantidad CHECK (cantidad > 0),
    CONSTRAINT chk_sale_items_precio_unitario CHECK (precio_unitario >= 0),
    CONSTRAINT chk_sale_items_subtotal CHECK (subtotal >= 0)
);

CREATE TABLE IF NOT EXISTS inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    tipo inventory_movement_type NOT NULL,
    cantidad NUMERIC(14,3) NOT NULL,
    motivo VARCHAR(200),
    referencia VARCHAR(120),
    usuario_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_cuts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES users(id) ON DELETE SET NULL,
    fecha DATE NOT NULL,
    monto_efectivo NUMERIC(14,2) NOT NULL DEFAULT 0,
    monto_tarjeta NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_ventas NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_transacciones INTEGER NOT NULL DEFAULT 0,
    notas TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_daily_cuts_montos CHECK (
        monto_efectivo >= 0 AND
        monto_tarjeta >= 0 AND
        total_ventas >= 0 AND
        total_transacciones >= 0
    )
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    plan VARCHAR(80) NOT NULL,
    modalidad VARCHAR(40) NOT NULL DEFAULT 'mensual',
    modulos_activos JSONB NOT NULL DEFAULT '[]'::jsonb,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE,
    status subscription_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_subscriptions_fechas CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(120) NOT NULL,
    target_type VARCHAR(80) NOT NULL,
    target_id UUID,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_users_email_lower
    ON users (LOWER(email));

CREATE UNIQUE INDEX IF NOT EXISTS ux_products_tenant_sku
    ON products (tenant_id, sku);

CREATE UNIQUE INDEX IF NOT EXISTS ux_products_tenant_barcode
    ON products (tenant_id, barcode)
    WHERE barcode IS NOT NULL AND btrim(barcode) <> '';

CREATE INDEX IF NOT EXISTS ix_users_tenant_id ON users (tenant_id);
CREATE INDEX IF NOT EXISTS ix_products_tenant_id ON products (tenant_id);
CREATE INDEX IF NOT EXISTS ix_products_tenant_created_at ON products (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_sales_tenant_id ON sales (tenant_id);
CREATE INDEX IF NOT EXISTS ix_sales_usuario_id ON sales (usuario_id);
CREATE INDEX IF NOT EXISTS ix_sales_fecha ON sales (fecha DESC);
CREATE INDEX IF NOT EXISTS ix_sales_tenant_fecha ON sales (tenant_id, fecha DESC);
CREATE INDEX IF NOT EXISTS ix_sale_items_tenant_id ON sale_items (tenant_id);
CREATE INDEX IF NOT EXISTS ix_sale_items_sale_id ON sale_items (sale_id);
CREATE INDEX IF NOT EXISTS ix_sale_items_product_id ON sale_items (product_id);
CREATE INDEX IF NOT EXISTS ix_inventory_movements_tenant_id ON inventory_movements (tenant_id);
CREATE INDEX IF NOT EXISTS ix_inventory_movements_product_id ON inventory_movements (product_id);
CREATE INDEX IF NOT EXISTS ix_inventory_movements_created_at ON inventory_movements (created_at DESC);
CREATE INDEX IF NOT EXISTS ix_inventory_movements_tenant_created_at ON inventory_movements (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_daily_cuts_tenant_id ON daily_cuts (tenant_id);
CREATE INDEX IF NOT EXISTS ix_daily_cuts_fecha ON daily_cuts (fecha DESC);
CREATE INDEX IF NOT EXISTS ix_daily_cuts_tenant_fecha ON daily_cuts (tenant_id, fecha DESC);
CREATE INDEX IF NOT EXISTS ix_subscriptions_tenant_id ON subscriptions (tenant_id);
CREATE INDEX IF NOT EXISTS ix_subscriptions_fecha_fin ON subscriptions (fecha_fin);
CREATE INDEX IF NOT EXISTS ix_audit_logs_tenant_id ON audit_logs (tenant_id);
CREATE INDEX IF NOT EXISTS ix_audit_logs_actor_user_id ON audit_logs (actor_user_id);
CREATE INDEX IF NOT EXISTS ix_audit_logs_created_at ON audit_logs (created_at DESC);

DROP TRIGGER IF EXISTS trg_businesses_set_updated_at ON businesses;
CREATE TRIGGER trg_businesses_set_updated_at
BEFORE UPDATE ON businesses
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_users_set_updated_at ON users;
CREATE TRIGGER trg_users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_products_set_updated_at ON products;
CREATE TRIGGER trg_products_set_updated_at
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_sales_set_updated_at ON sales;
CREATE TRIGGER trg_sales_set_updated_at
BEFORE UPDATE ON sales
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_sale_items_set_updated_at ON sale_items;
CREATE TRIGGER trg_sale_items_set_updated_at
BEFORE UPDATE ON sale_items
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_daily_cuts_set_updated_at ON daily_cuts;
CREATE TRIGGER trg_daily_cuts_set_updated_at
BEFORE UPDATE ON daily_cuts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_subscriptions_set_updated_at ON subscriptions;
CREATE TRIGGER trg_subscriptions_set_updated_at
BEFORE UPDATE ON subscriptions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

INSERT INTO businesses (
    id,
    nombre,
    telefono,
    email,
    direccion,
    plan,
    modulos_activos,
    activo
) VALUES
    (
        '00000000-0000-0000-0000-000000000001',
        'Plataforma',
        NULL,
        'platform@local.test',
        'Sistema interno',
        'internal',
        '["pos","inventario","reportes","google_sheets_sync","exportacion_excel","agente_ia","pagina_web","recordatorios"]'::jsonb,
        TRUE
    ),
    (
        '11111111-1111-1111-1111-111111111111',
        'Negocio Demo POS',
        '+52 5550001000',
        'demo@negocio.test',
        'Av. Demo 123, Ciudad de Mexico',
        'pro',
        '["pos","inventario","reportes","google_sheets_sync","exportacion_excel"]'::jsonb,
        TRUE
    )
ON CONFLICT (id) DO NOTHING;

INSERT INTO subscriptions (
    id,
    tenant_id,
    plan,
    modalidad,
    modulos_activos,
    fecha_inicio,
    fecha_fin,
    status
) VALUES (
    '22222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    'pro',
    'mensual',
    '["pos","inventario","reportes","google_sheets_sync","exportacion_excel"]'::jsonb,
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '30 day',
    'active'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (
    id,
    tenant_id,
    nombre,
    email,
    password_hash,
    rol,
    activo
) VALUES
    (
        '33333333-3333-3333-3333-333333333333',
        '00000000-0000-0000-0000-000000000001',
        'Superadmin Inicial',
        'superadmin@local.test',
        crypt('Admin123!', gen_salt('bf', 12)),
        'superadmin',
        TRUE
    ),
    (
        '44444444-4444-4444-4444-444444444444',
        '11111111-1111-1111-1111-111111111111',
        'Owner Demo',
        'owner@local.test',
        crypt('Owner123!', gen_salt('bf', 12)),
        'owner',
        TRUE
    )
ON CONFLICT (id) DO NOTHING;

COMMIT;
