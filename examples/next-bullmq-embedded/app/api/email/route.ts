import { emailQueue } from "@/lib/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const job = await emailQueue.add("welcome-email", {
    createdAt: new Date().toISOString(),
    recipient: "operator@example.com",
  });

  return Response.json({
    id: job.id,
    queue: emailQueue.name,
  });
}
