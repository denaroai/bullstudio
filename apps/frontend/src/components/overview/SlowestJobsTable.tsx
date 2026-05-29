import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@bullstudio/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bullstudio/ui/components/table";
import { useNavigate } from "@tanstack/react-router";
import type { OverviewMetricsResponse } from "@bullstudio/private-router";
import { formatDuration } from "@bullstudio/ui/shared";

type SlowJob = OverviewMetricsResponse["slowestJobs"][number];

type SlowestJobsTableProps = {
  jobs: SlowJob[];
};

export function SlowestJobsTable({ jobs }: SlowestJobsTableProps) {
  const navigate = useNavigate();

  const handleJobClick = (job: SlowJob) => {
    navigate({
      to: "/jobs/$jobId",
      params: { jobId: job.id },
      search: { queueName: job.queueName },
    });
  };

  return (
    <Card className="bg-card">
      <CardHeader>
        <CardTitle>Slowest Jobs</CardTitle>
        <CardDescription>
          Top 10 jobs by processing time
        </CardDescription>
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
                <TableHead className="text-right">
                  Duration
                </TableHead>
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
