// Starts one test database per Vitest run and hands its connection details to the test files.
import type { TestProject } from 'vitest/node';
import { startTestDatabase } from './testing.ts';

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const db = await startTestDatabase();
  project.provide('testDatabase', { url: db.url, max: db.max, kind: db.kind });
  return () => db.stop();
}
