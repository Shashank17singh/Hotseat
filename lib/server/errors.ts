import type { ApiErrorBody } from "../types";

const STATUS: Record<ApiErrorBody["code"], number> = {
  no_key: 503,
  rate_limited: 429,
  upstream: 502,
  invalid: 400,
  too_large: 413,
  unreadable: 422,
  unknown: 500,
};

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorBody["code"],
    message: string,
    readonly retryAfterSec?: number,
  ) {
    super(message);
  }

  get status() {
    return STATUS[this.code];
  }

  toBody(): ApiErrorBody {
    return { code: this.code, message: this.message, retryAfterSec: this.retryAfterSec };
  }
}
