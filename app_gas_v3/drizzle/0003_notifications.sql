CREATE TABLE IF NOT EXISTS notifications (
  notification_id text PRIMARY KEY,
  member_id       text REFERENCES members(member_id),
  role            text,
  type            text NOT NULL,
  title           text NOT NULL,
  body            text NOT NULL,
  href            text,
  read_at         timestamp with time zone,
  created_at      timestamp with time zone NOT NULL
);

ALTER TABLE supplier_products ADD COLUMN IF NOT EXISTS emoji text;

CREATE INDEX IF NOT EXISTS notifications_member_id_idx ON notifications(member_id);
CREATE INDEX IF NOT EXISTS notifications_role_idx ON notifications(role);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications(created_at);
