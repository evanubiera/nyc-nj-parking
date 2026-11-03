import type { TransactionSql } from '@parking/db';
import type { UpstreamHttp } from '../http.ts';

/** What the `source` table and the Sources page show (ATT-3). Proper names and URLs, not UI text. */
export interface SourceMetadata {
  /** Stable ID, matching the Admitted table in specs/06-sources.md (ING-6). */
  id: string;
  publisher: string;
  title: string;
  datasetUrl: string;
  termsUrl: string;
  /** Exact wording, only where the publisher requires a credit line. */
  creditText: string | null;
  /** What we change, as codes the web app turns into text. */
  modificationCodes: readonly string[];
}

export interface FetchedData {
  body: Uint8Array;
  contentType: string;
  /** The source's own "data updated" time, when its metadata gives one. */
  upstreamUpdatedAt: Date | null;
}

export interface StoredSnapshot extends FetchedData {
  id: number;
  fetchedAt: Date;
}

export interface ApplyResult {
  rowsRead: number;
  rowsWritten: number;
  rowsWithdrawn: number;
}

export interface SourceDefinition extends SourceMetadata {
  /** Cron expression in America/New_York, such as '15 4 * * *' for 04:15 daily. */
  schedule: string;
  fetch(http: UpstreamHttp): Promise<FetchedData>;
  /**
   * Normalizes the snapshot and writes facilities, inside the run's transaction (ING-3). Throw an
   * IngestionError with a code to fail the run; everything written here is then rolled back.
   */
  apply(tx: TransactionSql, snapshot: StoredSnapshot): Promise<ApplyResult>;
}
