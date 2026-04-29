import { getAllMembers } from "@/lib/db/queries";
import { SociForm, SociList } from "./soci-form";

export async function TabSoci() {
  const members = await getAllMembers();

  return (
    <div className="space-y-4">
      <SociForm />
      <SociList
        members={members.map((m) => ({
          memberId: m.memberId,
          fullName: m.fullName,
          email: m.email,
          aliasEmail: m.aliasEmail ?? null,
          role: m.role,
          active: m.active,
        }))}
      />
    </div>
  );
}
