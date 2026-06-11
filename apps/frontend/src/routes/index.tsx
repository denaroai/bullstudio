import { Button } from "@bullstudio/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@bullstudio/ui/components/empty";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { useEffect } from "react";
import { useTRPC } from "@/integrations/trpc/react";
import { queueRouteParam } from "@/lib/queue-key";

export const Route = createFileRoute("/")({ component: OverviewPage });

function OverviewPage() {
  const trpc = useTRPC();

  const navigate = Route.useNavigate();

  const { data: queues } = useQuery(trpc.queues.list.queryOptions());

  useEffect(() => {
    if (queues && queues.length > 0) {
      navigate({
        to: "/queues/$queueName",
        params: { queueName: queueRouteParam(queues[0]) },
      });
    }
  }, [queues, navigate]);

  if (queues && !queues.length) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No queues found</EmptyTitle>
          <EmptyDescription>
            It seems that you have not added any queues or we could not find
            them in your Redis. Connect some queues to get started.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button size="lg">
            <a
              href="https://bullstudio.dev/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2"
            >
              View docs <ExternalLink className="w-4 h-4" />
            </a>
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return null;
}
