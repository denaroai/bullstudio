import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@bullstudio/ui/components/dialog";
import { Label } from "@bullstudio/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bullstudio/ui/components/select";
import { Switch } from "@bullstudio/ui/components/switch";
import { cn } from "@bullstudio/ui/lib/utils";
import { Monitor, Moon, Settings, Sun } from "lucide-react";
import { useId } from "react";
import { usePolling } from "@/components/PollingProvider";
import { type Theme, useTheme } from "@/components/ThemeProvider";

const intervalOptions = [2000, 5000, 10000, 30000];

const themeOptions: Array<{ icon: typeof Moon; label: string; value: Theme }> =
  [
    { icon: Moon, label: "Dark", value: "dark" },
    { icon: Sun, label: "Light", value: "light" },
    { icon: Monitor, label: "System", value: "system" },
  ];

function formatInterval(ms: number): string {
  return ms % 1000 === 0 ? `${ms / 1000}s` : `${ms}ms`;
}

export function SettingsDialog() {
  const { enabled, interval, canOverride, minInterval, setPreference } =
    usePolling();
  const { theme, setTheme } = useTheme();
  const autoRefreshId = useId();
  const intervalId = useId();

  // Always keep the current interval selectable, and drop presets faster than
  // the operator's floor so users can't poll below it.
  const options = Array.from(
    new Set([
      ...intervalOptions.filter((ms) => !minInterval || ms >= minInterval),
      ...(enabled ? [interval] : []),
    ]),
  ).sort((a, b) => a - b);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          title="Settings"
          className="flex h-8 w-full items-center justify-center gap-2 rounded-md text-sidebar-foreground/60 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/50 group-data-[collapsible=icon]:size-8"
        >
          <Settings className="size-4" />
          <span className="group-data-[collapsible=icon]:hidden">Settings</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Customize the dashboard's appearance and how it refreshes data from
            Redis.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <Label>Theme</Label>
            <div className="grid grid-cols-3 gap-1 rounded-md border bg-muted/45 p-1">
              {themeOptions.map((option) => {
                const Icon = option.icon;
                const active = option.value === theme;

                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-label={`Use ${option.label.toLowerCase()} theme`}
                    aria-pressed={active}
                    title={option.label}
                    onClick={() => setTheme(option.value)}
                    className={cn(
                      "flex h-7 w-9 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                      active && "bg-background text-foreground shadow-sm",
                    )}
                  >
                    <Icon className="size-3.5" />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor={autoRefreshId}>Auto-refresh</Label>
              <p className="text-muted-foreground text-sm">
                Poll Redis to keep live views current. Turn this off to reduce
                load on pay-per-command or shared Redis.
              </p>
            </div>
            <Switch
              id={autoRefreshId}
              checked={enabled}
              disabled={!canOverride}
              onCheckedChange={(checked) =>
                setPreference(checked ? interval : "off")
              }
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <Label htmlFor={intervalId}>Refresh interval</Label>
            <Select
              value={enabled ? String(interval) : undefined}
              disabled={!enabled || !canOverride}
              onValueChange={(value) => setPreference(Number(value))}
            >
              <SelectTrigger id={intervalId} className="w-32">
                <SelectValue placeholder="Off" />
              </SelectTrigger>
              <SelectContent>
                {options.map((ms) => (
                  <SelectItem key={ms} value={String(ms)}>
                    {formatInterval(ms)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!canOverride && (
            <p className="text-muted-foreground text-xs">
              Polling is managed by your administrator and can't be changed
              here.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
