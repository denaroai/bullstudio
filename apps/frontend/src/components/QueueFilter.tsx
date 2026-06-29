import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bullstudio/ui/components/select";
import { Layers } from "lucide-react";
import { queueKey } from "@/lib/queue-key";

const ALL_QUEUES_VALUE = "__all__";

export interface QueueFilterOption {
  key?: string;
  name: string;
  prefix?: string;
}

interface QueueFilterProps {
  hasMultiplePrefixes: boolean;
  isLoading: boolean;
  queues?: QueueFilterOption[];
  selectedQueueKey?: string;
  onQueueKeyChange: (queueKey?: string) => void;
}

export function QueueFilter({
  hasMultiplePrefixes,
  isLoading,
  queues,
  selectedQueueKey,
  onQueueKeyChange,
}: QueueFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        value={selectedQueueKey || ALL_QUEUES_VALUE}
        onValueChange={(value) =>
          onQueueKeyChange(value === ALL_QUEUES_VALUE ? undefined : value)
        }
        disabled={isLoading}
      >
        <SelectTrigger className="w-[250px] bg-card">
          <Layers className="size-4 mr-2 text-muted-foreground" />
          <SelectValue placeholder="Select queue" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_QUEUES_VALUE}>All queues</SelectItem>
          {queues?.map((queue) => (
            <SelectItem
              key={queueKey(queue.prefix ?? "", queue.name)}
              value={queueKey(queue.prefix ?? "", queue.name)}
            >
              <span className="font-mono">
                {hasMultiplePrefixes && (
                  <span className="text-muted-foreground mr-1">
                    {queue.prefix}/
                  </span>
                )}
                {queue.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
