/**
 * Regression test for: unicode char removed + bg color changed → last space retains old bg.
 * Uses real chalk ANSI codes matching the ClickBox component.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { vi } from 'vitest';
import chalk from 'chalk';
// Force 24-bit color in non-TTY test environment
chalk.level = 3;
import { tokenize, styledCharsFromTokens, styledCharsToString } from '@alcalzone/ansi-tokenize';
import type { StyledChar } from '@alcalzone/ansi-tokenize';
import colorize from '../src/dom/colorize';
import {
  findDiffSegments,
  render,
  resetState,
  enableDebugLogging,
  disableDebugLogging,
} from '../src/render/apply-term-updates';
import { FakeTTY } from '../src/test-utils/FakeTTY';
import ElementNode from '../src/dom/nodes/ElementNode';
import { extractLines } from '../src/render/collect-lines';

vi.mock('../src/render/collect-lines', () => ({ extractLines: vi.fn(), resetOutputBuffer: vi.fn() }));

const INNER = 28; // box inner width (30 - 2 borders)
const COLORS = ['#1a1a2e','#4a0e8f','#0e4a8f','#0e8f4a','#8f4a0e','#8f0e4a'];
const LABELS = ['Click me!','Nice!','Again!','Keep going!','On fire! 🔥','Legend! 🏆'];

function buildLabelLine(bgColor: string, label: string): string {
  const bgLine = colorize(' '.repeat(INNER), bgColor, 'background');
  const bgCells = styledCharsFromTokens(tokenize(bgLine));
  while (bgCells.length < INNER) bgCells.push({ type:'char',value:' ',fullWidth:false,styles:[] });

  const styledLabel = chalk.white.bold(label);
  const labelCells = styledCharsFromTokens(tokenize(styledLabel));
  const labelVisual = labelCells.reduce((a,c)=>a+(c.fullWidth?2:1),0);
  const leftPad = Math.floor((INNER - labelVisual) / 2);

  const result = [...bgCells];
  let col = leftPad;
  for (const c of labelCells) {
    if (col >= INNER) break;
    result[col] = c;
    const w = c.fullWidth ? 2 : 1;
    if (w > 1 && col+1 < INNER) result[col+1] = { type:'char',value:'',fullWidth:false,styles:c.styles };
    col += w;
  }
  return styledCharsToString(result);
}

// ─── Integration test via render() ───────────────────────────────────────────
describe('unicode-bg-removal: render integration', () => {
  let fakeTTY: FakeTTY;
  let origProcess: typeof process;
  const mockExtractLines = extractLines as any;

  beforeEach(() => {
    fakeTTY = new FakeTTY();
    origProcess = global.process;
    (global as any).process = { ...origProcess, stdout: fakeTTY as any,
      stderr: origProcess.stderr, stdin: origProcess.stdin };
    resetState();
    mockExtractLines.mockReset();
    enableDebugLogging();
  });
  afterEach(() => {
    (global as any).process = origProcess;
    disableDebugLogging();
  });

  function renderLine(line: string) {
    const root = new ElementNode('div');
    mockExtractLines.mockReturnValue({  dynamic: [line] });
    render(root, global.process);
  }

  /**
   * For a single-line render, parse the terminal state by replaying the raw output.
   * Returns: array of { value, bgCode } for each visual column.
   */
  function terminalColState(rawOutput: string): { value: string; bgCode: string }[] {
    // Naive parser: step through raw bytes, track cursor col and active bg
    const cols: { value: string; bgCode: string }[] = Array(INNER).fill(null).map(()=>({value:' ',bgCode:''}));
    let curCol = 0;
    let activeBg = '';
    let i = 0;
    while (i < rawOutput.length) {
      if (rawOutput[i] === '\x1b' && rawOutput[i+1] === '[') {
        // find end of sequence
        let j = i+2;
        while (j < rawOutput.length && !/[A-Za-z]/.test(rawOutput[j])) j++;
        const seq = rawOutput.slice(i, j+1);
        // cursor position: \x1b[row;colH
        const cursorMatch = seq.match(/^\x1b\[(\d+);(\d+)H$/);
        if (cursorMatch) {
          curCol = parseInt(cursorMatch[2]) - 1; // 1-based
        }
        // bg color codes: 4x or 10x or 48;2;R;G;B
        const bgMatch = seq.match(/^\x1b\[((4[0-9]|10[0-7]|48;2;\d+;\d+;\d+))m$/);
        if (bgMatch) activeBg = seq;
        // reset codes
        if (seq === '\x1b[0m' || seq === '\x1b[49m') activeBg = '';
        i = j+1;
      } else if (rawOutput[i] === '\x1b') {
        i++;
      } else {
        // regular char
        const ch = rawOutput[i];
        if (curCol >= 0 && curCol < INNER) {
          cols[curCol] = { value: ch, bgCode: activeBg };
        }
        curCol++;
        i++;
      }
    }
    return cols;
  }

  it('last bg-space updates correctly after emoji removal (5→0 transition)', () => {
    // Render state 5: "Legend! 🏆" with COLORS[5]
    const line5 = buildLabelLine(COLORS[5], LABELS[5]);
    renderLine(line5);

    // Render state 0: "Click me!" with COLORS[0]
    const line0 = buildLabelLine(COLORS[0], LABELS[0]);
    fakeTTY.clear();
    renderLine(line0);

    const raw = fakeTTY.getOutputSinceClear();
    console.log('\n5→0 raw update:', JSON.stringify(raw).slice(0, 200));

    // The update must write the new bg (COLORS[0])
    const newBgSample = colorize(' ', COLORS[0], 'background');
    const newBgCode = newBgSample.match(/(\x1b\[[^m]+m)/)?.[1] ?? '';
    console.log('Expected new bg code:', JSON.stringify(newBgCode));

    expect(raw).toContain(newBgCode);

    // The last written position (col 27) should have the new bg
    const cols = terminalColState(raw);
    console.log('Last col state:', cols[INNER-1]);
    expect(cols[INNER-1].bgCode).toBe(newBgCode);
  });

  it('last bg-space updates correctly: 4→5 (fire→legend, both emoji)', () => {
    const line4 = buildLabelLine(COLORS[4], LABELS[4]);
    renderLine(line4);
    const line5 = buildLabelLine(COLORS[5], LABELS[5]);
    fakeTTY.clear();
    renderLine(line5);

    const raw = fakeTTY.getOutputSinceClear();
    const newBgSample = colorize(' ', COLORS[5], 'background');
    const newBgCode = newBgSample.match(/(\x1b\[[^m]+m)/)?.[1] ?? '';

    expect(raw).toContain(newBgCode);
  });
});

// ─── findDiffSegments unit test ───────────────────────────────────────────────
describe('unicode-bg-removal: findDiffSegments coverage', () => {
  it('all visual cols covered with correct bg when emoji removed and bg changes', () => {
    for (let from = 0; from < COLORS.length; from++) {
      const to = (from + 1) % COLORS.length;
      const oldLine = buildLabelLine(COLORS[from], LABELS[from]);
      const newLine = buildLabelLine(COLORS[to], LABELS[to]);

      enableDebugLogging();
      const segs = findDiffSegments(oldLine, newLine);
      disableDebugLogging();

      // Build visual-col map for what SHOULD change
      const oldParsed = styledCharsFromTokens(tokenize(oldLine));
      const newParsed = styledCharsFromTokens(tokenize(newLine));

      const oldByCol = new Map<number, StyledChar>();
      let ov = 0;
      for (const c of oldParsed) { oldByCol.set(ov, c); ov += c.fullWidth ? 2 : 1; }

      const newByCol = new Map<number, StyledChar>();
      let nv = 0;
      for (const c of newParsed) { newByCol.set(nv, c); nv += c.fullWidth ? 2 : 1; }

      // Cols that need updating
      const needsUpdate: number[] = [];
      for (let col = 0; col < 28; col++) {
        const oc = oldByCol.get(col);
        const nc = newByCol.get(col);
        const oa = oc?.styles.map((s:any)=>s.code||'').join('') ?? '';
        const na = nc?.styles.map((s:any)=>s.code||'').join('') ?? '';
        if ((oc?.value ?? '') !== (nc?.value ?? '') || oa !== na) needsUpdate.push(col);
      }

      // Cols covered by segments
      const covered = new Set<number>();
      for (const seg of segs) {
        if (seg.text === '') continue;
        const chars = styledCharsFromTokens(tokenize(seg.text));
        const vl = chars.reduce((a,c)=>a+(c.fullWidth?2:1),0);
        for (let c = seg.start; c < seg.start + vl; c++) covered.add(c);
      }

      const missing = needsUpdate.filter(col => !covered.has(col));
      if (missing.length > 0) {
        console.log(`BUG ${from}→${to}: missing cols=${missing}`);
        console.log(`  OLD: ${JSON.stringify(oldLine).slice(0,80)}`);
        console.log(`  NEW: ${JSON.stringify(newLine).slice(0,80)}`);
      }
      expect(missing).toEqual([]);
    }
  });
});