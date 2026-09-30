// Which database the integration tests use. Never DATABASE_URL by accident:
// the suite runs only when INT_TEST_DATABASE_URL is set (CI: a throwaway Neon
// branch), or when INT_TEST_USE_DATABASE_URL=1 says the DATABASE_URL already
// in the environment is a test database (e.g. the demo one, fake data only).
// Without either, every describeDb block is skipped.
const explicit = process.env.INT_TEST_DATABASE_URL?.trim();
const url = explicit || (process.env.INT_TEST_USE_DATABASE_URL === "1" ? process.env.DATABASE_URL?.trim() : "");

if (url) {
  if (/^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY?.trim() ?? "")) {
    throw new Error("integration tests refuse to run with a live Stripe key in the environment");
  }
  process.env.DATABASE_URL = url;
  process.env.INT_TEST_DB_READY = "1";
  // The tests write notifications: never let them become real emails or
  // real Stripe calls.
  delete process.env.RESEND_API_KEY;
  delete process.env.STRIPE_SECRET_KEY;
} else {
  delete process.env.INT_TEST_DB_READY;
  console.warn("[int] no test database configured: integration tests skipped");
}
