import { describe, expect, it } from 'vitest';

import { csvField, toCsv, toTsv } from './csv';

describe('csvField', () => {
  it('leaves plain values unquoted', () => {
    expect(csvField('Priya')).toBe('Priya');
    expect(csvField(98500)).toBe('98500');
    expect(csvField(12.5)).toBe('12.5');
    expect(csvField(true)).toBe('true');
  });

  it('quotes fields containing commas', () => {
    expect(csvField('Wong, Mei')).toBe('"Wong, Mei"');
  });

  it('doubles embedded quotes and wraps the field', () => {
    expect(csvField('Daniel "Danny" Brooks')).toBe('"Daniel ""Danny"" Brooks"');
  });

  it('quotes fields containing line breaks', () => {
    expect(csvField('line 1\nline 2')).toBe('"line 1\nline 2"');
    expect(csvField('a\r\nb')).toBe('"a\r\nb"');
  });

  it('writes null and undefined as empty fields', () => {
    expect(csvField(null)).toBe('');
    expect(csvField(undefined)).toBe('');
  });

  it('does not quote apostrophes or empty strings', () => {
    expect(csvField("O'Brien")).toBe("O'Brien");
    expect(csvField('')).toBe('');
  });
});

describe('toCsv', () => {
  it('writes a header and rows separated by CRLF', () => {
    const csv = toCsv(
      ['id', 'name', 'note'],
      [
        [1, 'Wong, Mei', null],
        [2, 'Say "hi"', 'multi\nline'],
      ],
    );
    expect(csv).toBe('id,name,note\r\n1,"Wong, Mei",\r\n2,"Say ""hi""","multi\nline"');
  });

  it('escapes column names too', () => {
    expect(toCsv(['a,b'], [])).toBe('"a,b"');
  });

  it('keeps a row of nulls as empty fields', () => {
    expect(toCsv(['a', 'b', 'c'], [[null, null, null]])).toBe('a,b,c\r\n,,');
  });
});

describe('toTsv', () => {
  it('joins with tabs and newlines, flattening whitespace inside values', () => {
    expect(
      toTsv(
        ['id', 'note'],
        [
          [1, 'a\tb'],
          [2, null],
          [3, 'multi\nline'],
        ],
      ),
    ).toBe('id\tnote\n1\ta b\n2\t\n3\tmulti line');
  });
});
