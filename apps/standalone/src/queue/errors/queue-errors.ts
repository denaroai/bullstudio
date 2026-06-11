export class QueueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QueueError";
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
