// @vitest-environment node
// Checks that the lint rules behind WEB-1 and WEB-3 still fire, including with ESLint plugins whose
// peer ranges we've widened (pnpm-workspace.yaml).
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const eslint = new ESLint({ cwd: root });

async function rulesBroken(code: string, file: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: `${root}${file}` });
  return (result?.messages ?? []).map((message) => message.ruleId ?? message.message);
}

describe('web lint rules', () => {
  it('WEB-1 rejects literal text in JSX', async () => {
    const code = `export function Banner() { return <p>Parking near you</p>; }\n`;

    expect(await rulesBroken(code, 'apps/web/src/components/Banner.tsx')).toContain('react/jsx-no-literals');
  });

  it('WEB-1 rejects literal text in props people see or hear', async () => {
    const code = `export function Logo() { return <img src="/logo.svg" alt="City parking" />; }\n`;

    expect(await rulesBroken(code, 'apps/web/src/components/Logo.tsx')).toContain('no-restricted-syntax');
  });

  it('WEB-1 allows class names and other props that are not text', async () => {
    const code = `export function Box() { return <div className="box" data-state="ok" />; }\n`;

    expect(await rulesBroken(code, 'apps/web/src/components/Box.tsx')).toEqual([]);
  });

  it('WEB-3 rejects fetch outside services', async () => {
    const code = `export async function load() { return fetch('/api/health'); }\n`;

    expect(await rulesBroken(code, 'apps/web/src/hooks/useLoad.ts')).toContain('no-restricted-globals');
  });

  it('WEB-3 rejects importing the API client outside services', async () => {
    const code = `import { createApiClient } from '@parking/api-client';\nexport const client = createApiClient();\n`;

    expect(await rulesBroken(code, 'apps/web/src/components/Thing.tsx')).toContain('no-restricted-imports');
  });

  it('WEB-3 allows the API client in services', async () => {
    const code = `import { createApiClient } from '@parking/api-client';\nexport const client = createApiClient();\n`;

    expect(await rulesBroken(code, 'apps/web/src/services/thing.ts')).toEqual([]);
  });
});
