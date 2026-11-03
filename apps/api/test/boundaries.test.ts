// Checks that the lint rules behind ING-1 and FND-6 still fire.
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const eslint = new ESLint({ cwd: root });

async function rulesBroken(code: string, file: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: `${root}${file}` });
  return (result?.messages ?? []).map((message) => message.ruleId ?? message.message);
}

describe('boundaries', () => {
  it('ING-1 rejects fetch in the API', async () => {
    const code = `export async function lookup() { return fetch('https://data.cityofnewyork.us/resource/x.json'); }\n`;

    expect(await rulesBroken(code, 'apps/api/src/lookup.ts')).toContain('no-restricted-globals');
  });

  it('ING-1 rejects HTTP client modules in the API', async () => {
    const code = `import { request } from 'node:https';\nexport const get = request;\n`;

    expect(await rulesBroken(code, 'apps/api/src/lookup.ts')).toContain('no-restricted-imports');
  });

  it('FND-6 rejects the API importing the worker', async () => {
    const code = `import { runSource } from '../../worker/src/run.ts';\nexport const run = runSource;\n`;

    expect(await rulesBroken(code, 'apps/api/src/thing.ts')).toContain('no-restricted-imports');
  });

  it('FND-6 rejects the worker importing the API', async () => {
    const code = `import { buildApp } from '../../api/src/app.ts';\nexport const build = buildApp;\n`;

    expect(await rulesBroken(code, 'apps/worker/src/thing.ts')).toContain('no-restricted-imports');
  });

  it('FND-6 allows both to import shared packages', async () => {
    const code = `import { connect } from '@parking/db';\nexport const open = connect;\n`;

    expect(await rulesBroken(code, 'apps/api/src/thing.ts')).toEqual([]);
    expect(await rulesBroken(code, 'apps/worker/src/thing.ts')).toEqual([]);
  });
});
