export class IntervalsHttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "IntervalsHttpError";
    this.status = status;
  }
}
