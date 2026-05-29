export class QueueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QueueError";
  }
}

export class ConnectionNotFoundError extends QueueError {
  constructor(connectionId: string) {
    super(`Connection not found: ${connectionId}`);
    this.name = "ConnectionNotFoundError";
  }
}

export class ConnectionFailedError extends QueueError {
  constructor(connectionId: string, reason?: string) {
    super(`Connection failed: ${connectionId}${reason ? ` - ${reason}` : ""}`);
    this.name = "ConnectionFailedError";
  }
}

export class NotConnectedError extends QueueError {
  constructor() {
    super("Not connected to Redis");
    this.name = "NotConnectedError";
  }
}

export class JobNotFoundError extends QueueError {
  constructor(queueName: string, jobId: string) {
    super(`Job ${jobId} not found in queue ${queueName}`);
    this.name = "JobNotFoundError";
  }
}

export class QueueNotFoundError extends QueueError {
  constructor(queueName: string) {
    super(`Queue not found: ${queueName}`);
    this.name = "QueueNotFoundError";
  }
}
