import { revalidatePath } from "next/cache";
import Link from "next/link";
import { emailQueue } from "@/lib/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Home() {
  const counts = await emailQueue.getJobCounts(
    "waiting",
    "active",
    "completed",
    "failed",
    "delayed",
  );

  async function enqueueSampleJob() {
    "use server";

    await emailQueue.add("welcome-email", {
      createdAt: new Date().toISOString(),
      recipient: "operator@example.com",
    });
    revalidatePath("/");
  }

  return (
    <main>
      <p className="eyebrow">Next.js host application</p>
      <h1>Bullstudio embedded dashboard test app</h1>
      <p className="lede">
        This page owns the BullMQ queue and mounts Bullstudio inside the App
        Router at one path. Add a sample job here, then inspect it in the
        embedded dashboard.
      </p>

      <div className="actions">
        <form action={enqueueSampleJob}>
          <button type="submit">Add sample job</button>
        </form>
        <Link className="button secondary" href="/ops/bullstudio">
          Open dashboard
        </Link>
      </div>

      <section className="counts" aria-label="Email queue job counts">
        {Object.entries(counts).map(([status, count]) => (
          <div className="count" key={status}>
            <strong>{count}</strong>
            <span>{status}</span>
          </div>
        ))}
      </section>

      <p className="note">
        The dashboard is protected with Basic Auth. Defaults are
        operator/change-me unless BULLSTUDIO_USERNAME and BULLSTUDIO_PASSWORD
        are set.
      </p>
    </main>
  );
}
