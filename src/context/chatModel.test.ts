import { describe, expect, it } from 'vitest';

import {
  applyStep,
  explainMessage,
  fixMessage,
  humanizeCheckError,
  messagesFromThread,
  optimizeMessage,
} from './chatModel';

describe('applyStep', () => {
  it('keeps first-seen order and the latest status, accumulating retry errors', () => {
    let steps = applyStep([], { node: 'generate_sql', status: 'start', label: 'Generating SQL' });
    steps = applyStep(steps, { node: 'generate_sql', status: 'ok', label: 'Generating SQL' });
    steps = applyStep(steps, { node: 'validate_sql', status: 'start', label: 'Validating' });
    steps = applyStep(steps, {
      node: 'validate_sql',
      status: 'retry',
      label: 'Validating',
      errors: ["UNKNOWN_COLUMN: column 'x' does not exist. Columns available: a, b"],
    });
    steps = applyStep(steps, { node: 'generate_sql', status: 'start', label: 'Generating SQL' });
    steps = applyStep(steps, { node: 'validate_sql', status: 'ok', label: 'Validating' });
    expect(steps.map((s) => [s.node, s.status])).toEqual([
      ['generate_sql', 'start'],
      ['validate_sql', 'ok'],
    ]);
    expect(steps[1].retried).toBe(true);
    expect(steps[1].errors).toHaveLength(1);
    expect(steps[0].retried).toBe(false);
  });

  it('marks a retry without errors (older backend)', () => {
    const steps = applyStep([], { node: 'execute_sql', status: 'retry', label: 'Running' });
    expect(steps[0]).toMatchObject({ retried: true, errors: [] });
  });
});

describe('humanizeCheckError', () => {
  it('drops the category and the hint after the first sentence', () => {
    expect(
      humanizeCheckError(
        "UNKNOWN_COLUMN: column 'revenue_total' does not exist. Columns available: Orders.OrderDate",
      ),
    ).toBe("Column 'revenue_total' does not exist");
    expect(humanizeCheckError('DESTRUCTIVE: Only read-only SELECT queries can be run.')).toBe(
      'Only read-only SELECT queries can be run',
    );
  });
});

describe('messagesFromThread', () => {
  it('rebuilds turns, refusals and last_sql without validation data', () => {
    const msgs = messagesFromThread(
      {
        messages: [
          { role: 'user', content: 'drop it' },
          { role: 'assistant', content: 'Read-only only.', intent: 'destructive', kind: 'refusal' },
          { role: 'user', content: 'Show customers' },
          { role: 'assistant', content: 'Lists customers.', intent: 'generate', sql: 'SELECT 1' },
        ],
        last_sql: 'SELECT 1',
      },
      'sqlite',
    );
    const [, refusal, , answer] = msgs;
    expect(refusal).toMatchObject({ refusal: { reason: 'destructive' } });
    expect(answer).toMatchObject({ request: 'Show customers', fromHistory: true });
    expect(answer.role === 'assistant' && answer.sql?.validation).toBeUndefined();
  });
});

describe('editor action messages (CHANGES-v2.md §4)', () => {
  const sql = 'SELECT *\nFROM Customers\nLIMIT 100;';

  it('wraps the editor SQL in a sql code fence', () => {
    expect(explainMessage(sql)).toBe(
      'Explain this query:\n```sql\nSELECT *\nFROM Customers\nLIMIT 100;\n```',
    );
    expect(optimizeMessage(`  ${sql}\n`)).toBe(
      'Optimize this query:\n```sql\nSELECT *\nFROM Customers\nLIMIT 100;\n```',
    );
  });

  it('appends the validator errors to a fix request', () => {
    expect(
      fixMessage('SELECT nope FROM Customers', [
        "UNKNOWN_COLUMN: column 'nope' does not exist.",
        'SYNTAX: x',
      ]),
    ).toBe(
      "Fix this query:\n```sql\nSELECT nope FROM Customers\n```\nError: UNKNOWN_COLUMN: column 'nope' does not exist.; SYNTAX: x",
    );
  });
});
