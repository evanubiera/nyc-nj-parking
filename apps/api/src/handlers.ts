// One method per operationId in api/openapi.yaml (FND-2). fastify-openapi-glue calls these with `this`
// bound to the instance. A test checks that the methods and the contract's operations match exactly.
import type { Health } from '@parking/api-client';
import type { Sql } from '@parking/db';
import type { FastifyReply, FastifyRequest } from 'fastify';

const HEALTH_TIMEOUT_MS = 2_000;

export class Handlers {
  readonly #sql: Sql;

  constructor(sql: Sql) {
    this.#sql = sql;
  }

  /** FND-3 */
  async getHealth(_request: FastifyRequest, reply: FastifyReply): Promise<Health> {
    const up = await this.#databaseResponds();
    reply.code(up ? 200 : 503);
    return { status: up ? 'ok' : 'unavailable' };
  }

  async #databaseResponds(): Promise<boolean> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<false>((resolve) => {
      timer = setTimeout(() => resolve(false), HEALTH_TIMEOUT_MS);
    });
    try {
      const query = this.#sql`select 1 as up`.then(() => true as const);
      return await Promise.race([query, timeout]);
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }
}

/** The operation names Handlers implements, for the contract test. */
export const handlerOperationIds: readonly string[] = Object.getOwnPropertyNames(Handlers.prototype).filter(
  (name) => name !== 'constructor',
);
