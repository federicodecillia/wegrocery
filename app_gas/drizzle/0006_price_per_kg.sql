-- Optional reference price-per-kilogram for weight-based items.
-- Used purely for price-transparency display: members can compare the actual
-- packaged price (`unit_price`) against the bulk-equivalent (`price_per_kg`).
-- Nullable: most products do not need it.

ALTER TABLE supplier_products ADD COLUMN IF NOT EXISTS price_per_kg numeric(10, 2);
ALTER TABLE products          ADD COLUMN IF NOT EXISTS price_per_kg numeric(10, 2);
