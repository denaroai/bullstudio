export class ReadOnlyDashboardError extends Error {
  constructor() {
    super("Read-only dashboards cannot mutate queues or jobs.");
    this.name = "ReadOnlyDashboardError";
  }
}
