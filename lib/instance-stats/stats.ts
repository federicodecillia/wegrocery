// What /api/instance-stats answers the FlyLabs Console (Playbook 7.10,
// flylabs-kit registry/console): the same envelope in every app, the app's
// own numbers in counts. Counts and states only: no name, email, customer
// content, amount or balance, no variable value.
export type ConfigItemStatus = "ok" | "missing" | "warning" | "off";

export type InstanceStats = {
  // The app's id in the Console: "stellar", "wegrocery", ...
  app: string;
  // The same release as /api/health.
  version: string;
  generatedAt: string;
  // When the installation started serving (first migration or first customer).
  installedAt: string | null;
  databaseBytes: number | null;
  // The app's counts, by name, in camelCase: the Console shows any name it
  // does not know as it is.
  counts: Record<string, number>;
  // The configuration status of the staff panel and `npm run doctor`
  // (Playbook 7.5): ids and states, never values.
  config: { id: string; status: ConfigItemStatus }[];
  // The migrations this database lacks (Playbook 6.3).
  pendingMigrations: string[];
};
