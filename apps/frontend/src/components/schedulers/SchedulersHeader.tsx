import { Button } from "@bullstudio/ui/components/button";
import { Plus, RefreshCw } from "lucide-react";
import Header from "@/components/Header";

interface SchedulersHeaderProps {
  canCreate: boolean;
  isFetching: boolean;
  mutationsEnabled: boolean;
  onCreate: () => void;
  onRefresh: () => void;
}

export function SchedulersHeader({
  canCreate,
  isFetching,
  mutationsEnabled,
  onCreate,
  onRefresh,
}: SchedulersHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <Header title="Schedulers" />
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isFetching}
          className="bg-card"
        >
          <RefreshCw
            className={`size-4 mr-2 ${isFetching ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
        <Button
          size="sm"
          disabled={!canCreate}
          title={
            !mutationsEnabled
              ? "Schedulers are read-only for this dashboard"
              : canCreate
                ? undefined
                : "Select a single queue to create a scheduler"
          }
          onClick={onCreate}
        >
          <Plus className="size-4 mr-2" />
          New scheduler
        </Button>
      </div>
    </div>
  );
}
