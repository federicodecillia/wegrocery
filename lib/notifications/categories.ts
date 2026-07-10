// Notification categories are the user-facing grouping shown in the
// preferences panel. They are a level above the raw `notifications.type`
// values emitted by the server: several legacy types collapse into one
// category (e.g. both order_adjusted and order_corrected are "order_updates").
//
// Storage model is sparse: an absent notification_preferences row means "use
// the default from CATEGORY_DEFAULTS". Nothing is back-filled for existing
// members; the defaults live here in code.

export const NOTIFICATION_CATEGORIES = [
  "cycle_opened",
  "cycle_closing_reminder",
  "order_charge",
  "order_updates",
  "wallet_topup",
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export type ChannelPrefs = { app: boolean; email: boolean };

// Per-category defaults. App is on for everything; email is on ONLY for
// cycle_opened (the one broadcast members opted into by default). Every other
// category is email-off until the member turns it on in the panel.
export const CATEGORY_DEFAULTS: Record<NotificationCategory, ChannelPrefs> = {
  cycle_opened: { app: true, email: true },
  cycle_closing_reminder: { app: true, email: false },
  order_charge: { app: true, email: false },
  order_updates: { app: true, email: false },
  wallet_topup: { app: true, email: false },
};

// Maps a raw `notifications.type` value to its category. Legacy DB values are
// kept unchanged (historical rows and the demo seed keep working); this only
// classifies them. Unknown types return null: dispatch treats that as
// "deliver in-app, never email" so a new type can never silently email people.
const TYPE_TO_CATEGORY: Record<string, NotificationCategory> = {
  order_closed: "order_charge",
  topup_received: "wallet_topup",
  order_corrected: "order_updates",
  order_adjusted: "order_updates",
  cycle_opened: "cycle_opened",
  cycle_closing_reminder: "cycle_closing_reminder",
};

export function categoryForType(type: string): NotificationCategory | null {
  return TYPE_TO_CATEGORY[type] ?? null;
}

export function isNotificationCategory(value: string): value is NotificationCategory {
  return (NOTIFICATION_CATEGORIES as readonly string[]).includes(value);
}

export type StoredPreferenceRow = {
  category: string;
  appEnabled: boolean;
  emailEnabled: boolean;
};

// Builds the effective preference map: start from the defaults, then overlay
// any stored rows. Rows for unknown categories are ignored (defensive against
// stale data after a category is renamed/removed).
export function resolvePreferences(
  rows: ReadonlyArray<StoredPreferenceRow>,
): Record<NotificationCategory, ChannelPrefs> {
  const out = {} as Record<NotificationCategory, ChannelPrefs>;
  for (const category of NOTIFICATION_CATEGORIES) {
    out[category] = { ...CATEGORY_DEFAULTS[category] };
  }
  for (const row of rows) {
    if (isNotificationCategory(row.category)) {
      out[row.category] = { app: row.appEnabled, email: row.emailEnabled };
    }
  }
  return out;
}

// Effective channels for a raw notification type given a member's resolved
// preferences. Unknown type → app-only, never email.
export function channelsForType(
  type: string,
  resolved: Record<NotificationCategory, ChannelPrefs>,
): ChannelPrefs {
  const category = categoryForType(type);
  if (category === null) return { app: true, email: false };
  return resolved[category];
}
