import { getAnalyticsKpis } from "@/lib/admin/analytics-queries";
import { AdminAnalyticsClient } from "./admin-analytics-client";

export default async function AdminAnalyticsPage() {
  const kpis = await getAnalyticsKpis(30);
  return <AdminAnalyticsClient kpis={kpis} />;
}
