-- Unique indexes backing invariants that until now lived only in app code
-- (issue #65). Apply with `npm run db:push` or by running this file directly.
--
-- BEFORE APPLYING, check for existing rows that would violate them:
--
--   -- duplicate order lines (must return 0 rows):
--   SELECT member_id, cycle_id, product_id, count(*)
--   FROM orders GROUP BY 1,2,3 HAVING count(*) > 1;
--
--   -- duplicate products by app identity key (must return 0 rows):
--   SELECT cycle_id, lower(trim(name)), lower(trim(coalesce(variant,''))),
--          lower(trim(coalesce(format,''))), lower(trim(coalesce(unit,''))), count(*)
--   FROM products GROUP BY 1,2,3,4,5 HAVING count(*) > 1;
--
-- If either query returns rows, resolve those duplicates first (they are
-- app-level bugs worth inspecting, not rows to delete blindly).

-- saveOrder writes at most one line per (member, cycle, product); reject any
-- future write path that breaks that invariant instead of silently
-- accumulating duplicate lines.
CREATE UNIQUE INDEX IF NOT EXISTS orders_member_cycle_product_uniq
  ON orders (member_id, cycle_id, product_id);

-- DB-level twin of the app-side dedup key in lib/db/cycle-products.ts
-- (lower/trimmed name|variant|format|unit, NULL treated as ''): closes the
-- TOCTOU window where two concurrent imports both pass the SELECT-then-INSERT
-- check and insert the same product twice into a cycle.
CREATE UNIQUE INDEX IF NOT EXISTS products_cycle_identity_uniq
  ON products (
    cycle_id,
    lower(trim(name)),
    lower(trim(coalesce(variant, ''))),
    lower(trim(coalesce(format, ''))),
    lower(trim(coalesce(unit, '')))
  );
