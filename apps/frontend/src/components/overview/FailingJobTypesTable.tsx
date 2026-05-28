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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@bullstudio/ui/components/tooltip";
import { Badge } from "@bullstudio/ui/components/badge";
import dayjs from "@bullstudio/dayjs";
import type { OverviewMetricsResponse } from "@bullstudio/private-router";

type FailingJobType = OverviewMetricsResponse["failingJobTypes"][number];

type FailingJobTypesTableProps = {
  jobTypes: FailingJobType[];
};

export function FailingJobTypesTable({ jobTypes }: FailingJobTypesTableProps) {
  return (
    <Card className="bg-card">
      <CardHeader>
        <CardTitle>Most Failing Job Types</CardTitle>
        <CardDescription>
          Jobs grouped by name with highest failure counts
        </CardDescription>
      </CardHeader>
      <CardContent>
        {jobTypes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No failed jobs in this time range
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Job Type</TableHead>
                <TableHead>Queue</TableHead>
                <TableHead className="text-right">
                  Failures
                </TableHead>
                <TableHead className="text-right">
                  Last Failed
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobTypes.map((jobType) => (
                <TableRow key={`${jobType.queueName}:${jobType.name}`}>
                  <TableCell>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="font-medium text-foreground cursor-help">
                            {jobType.name}
                          </span>
                        </TooltipTrigger>
                        {jobType.lastFailedReason && (
                          <TooltipContent
                            side="top"
                            className="max-w-xs"
                          >
                            <p className="text-xs font-mono break-all">
                              {jobType.lastFailedReason}
                            </p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-sm text-muted-foreground">
                      {jobType.queueName}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="destructive" className="font-mono">
                      {jobType.failureCount}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-sm text-muted-foreground">
                      {dayjs(jobType.lastFailedAt).fromNow()}
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
