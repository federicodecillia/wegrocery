import { redirect } from "next/navigation";

// The preferences live under the Profile (app/profilo); emails sent before still link here.
export default function OldNotificationSettingsPage() {
  redirect("/profilo/notifiche");
}
