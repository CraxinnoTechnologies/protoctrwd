import { listFollowUps, followUpCounts } from "@/lib/follow-ups";
import LeadsDashboard from "./LeadsDashboard";

export const dynamic = "force-dynamic";

export default function Page() {
  const items = listFollowUps();
  const counts = followUpCounts();
  return <LeadsDashboard initialItems={items} initialCounts={counts} />;
}
