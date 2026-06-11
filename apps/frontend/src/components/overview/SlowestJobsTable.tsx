import type { OverviewMetricsResponse } from "@bullstudio/private-router";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bullstudio/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bullstudio/ui/components/table";
import { formatDuration } from "@bullstudio/ui/shared";
import { useNavigate } from "@tanstack/react-router";
import { DEFAULT_JOBS_SEARCH } from "@/lib/jobs";

type SlowJob = OverviewMetricsResponse["slowestJobs"][number];

type SlowestJobsTableProps = {
  jobs: SlowJob[];
  /**
   * Prefix-qualified route param for the queue these jobs belong to (the
   * overview is scoped to a single queue), so clicking through disambiguates
   * queues that share a name across prefixes.
   */
  queueParam: string;
};

export function SlowestJobsTable({ jobs, queueParam }: SlowestJobsTableProps) {
  const navigate = useNavigate();

  const handleJobClick = (job: SlowJob) => {
    navigate({
      to: "/queues/$queueName/jobs",
      params: { queueName: queueParam },
      search: { ...DEFAULT_JOBS_SEARCH, selected: job.id },
    });
  };

  return (
    <Card className="bg-card">
      <CardHeader>
        <CardTitle>Slowest Jobs</CardTitle>
        <CardDescription>Top 10 jobs by processing time</CardDescription>
      </CardHeader>
      <CardContent>
        {jobs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No completed jobs in this time range
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Job</TableHead>
                <TableHead>Queue</TableHead>
                <TableHead className="text-right">Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow
                  key={job.id}
                  className="cursor-pointer hover:bg-muted/60"
                  onClick={() => handleJobClick(job)}
                >
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">
                        {job.name}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {job.id}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-sm text-muted-foreground">
                      {job.queueName}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-mono text-sm text-amber-500">
                      {formatDuration(job.processingTimeMs)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
