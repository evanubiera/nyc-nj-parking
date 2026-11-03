/** Error codes recorded on failed runs (specs/03-data-model.md, `ingestion_run.error_code`). */
export type IngestionErrorCode =
  | 'upstream.timeout'
  | 'upstream.network'
  | 'upstream.http_status'
  | 'normalize.invalid_record'
  | 'run.abandoned'
  | 'run.unexpected';

/** An expected failure with a code. Its message is for developers and is never logged (ING-5). */
export class IngestionError extends Error {
  readonly code: IngestionErrorCode;

  constructor(code: IngestionErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'IngestionError';
    this.code = code;
  }
}

export function errorCodeOf(error: unknown): IngestionErrorCode {
  return error instanceof IngestionError ? error.code : 'run.unexpected';
}
