import Component from '@glimmer/component';
import { Text, Box, Spacer } from 'ember-tui';
import { tracked } from '@glimmer/tracking';
import { readFileSync, readdirSync, writeFileSync, statSync } from 'fs';
import { join } from 'path';
import * as readline from 'readline';
import * as process from "node:process";
import { cursorTo, hideCursor, showCursor } from "ember-tui/render/apply-term-updates";

export default class FileEditorTemplate extends Component {
  @tracked mode: 'list' | 'edit' = 'list';
  @tracked files: string[] = [];
  @tracked selectedIndex = 0;
  @tracked currentFile: string | null = null;
  @tracked fileContent: string[] = [];
  @tracked cursorLine = 0;
  @tracked cursorCol = 0;
  @tracked scrollOffset = 0;
  @tracked statusMessage = '';

  maxVisibleLines = (process.stdout.rows || 22) - 3 - 7;

  constructor(owner: unknown, args: object) {
    super(owner, args);
    this.loadFileList();

    if (typeof document !== 'undefined') {
      document.addEventListener('keypress', this.handleKeyPress);
    }

		showCursor();
  }

  willDestroy() {
    super.willDestroy();
    if (typeof document !== 'undefined') {
      document.removeEventListener('keypress', this.handleKeyPress);
    }
		hideCursor();
  }

  loadFileList() {
    try {
      const cwd = process.cwd();
      const entries = readdirSync(cwd);
      this.files = entries.filter(entry => {
        try {
          const stat = statSync(join(cwd, entry));
          return stat.isFile() && !entry.startsWith('.');
        } catch {
          return false;
        }
      }).sort();
      this.selectedIndex = 0;7
    } catch (error) {
      this.statusMessage = `Error loading files: ${error.message}`;
    }
  }

  loadFile(filename: string) {
    try {
      const cwd = process.cwd();
      const content = readFileSync(join(cwd, filename), 'utf-8');
      this.fileContent = content.split('\n');
      this.currentFile = filename;
      this.cursorLine = 0;
      this.cursorCol = 0;
      this.scrollOffset = 0;
      this.mode = 'edit';
      this.statusMessage = `Loaded: ${filename}`;
      // Show cursor when entering edit mode
      process.stdout.write('\x1b[?25h');
      setTimeout(() => this.updateTerminalCursor(), 100);
    } catch (error) {
      this.statusMessage = `Error loading file: ${error.message}`;
    }
  }

  saveFile() {
    if (!this.currentFile) return;

    try {
      const cwd = process.cwd();
      const content = this.fileContent.join('\n');
      writeFileSync(join(cwd, this.currentFile), content, 'utf-8');
      this.statusMessage = `Saved: ${this.currentFile}`;
    } catch (error) {
      this.statusMessage = `Error saving file: ${error.message}`;
    }
  }

  handleKeyPress = (event: any) => {
    const key = event.key;




    // Ctrl+X - back to file list
    if (event.ctrlKey && key === 'x') {
      if (this.mode === 'edit') {
        this.mode = 'list';
        this.currentFile = null;
        this.loadFileList();
      }
      return;
    }

    // Ctrl+S - save file
    if (event.ctrlKey && key === 's') {
      if (this.mode === 'edit') {
        this.saveFile();
      }
      return;
    }

    if (this.mode === 'list') {
      this.handleListMode(key);
    } else if (this.mode === 'edit') {
      this.handleEditMode(key, event);
    }
  }

  handleListMode(key: string) {
    // Arrow up

    if (key === '\u001b[A') {
      if (this.selectedIndex > 0) {
        this.selectedIndex--;
      }
    }
    // Arrow down
    else if (key === '\u001b[B') {
      if (this.selectedIndex < this.files.length - 1) {
        this.selectedIndex++;
      }
    }
    // Enter
    else if (key === '\r' || key === '\n') {
      if (this.files[this.selectedIndex]) {
        this.loadFile(this.files[this.selectedIndex]);
      }
    }
  }

  handleEditMode(key: string, event: any) {
    // Arrow keys
    if (key === '\u001b[A') { // Up
      if (this.cursorLine > 0) {
        this.cursorLine--;
        this.cursorCol = Math.min(this.cursorCol, this.fileContent[this.cursorLine].length);
        this.adjustScroll();
      }
    } else if (key === '\u001b[B') { // Down
      if (this.cursorLine < this.fileContent.length - 1) {
        this.cursorLine++;
        this.cursorCol = Math.min(this.cursorCol, this.fileContent[this.cursorLine].length);
        this.adjustScroll();
      }
    } else if (key === '\u001b[C') { // Right
      const currentLine = this.fileContent[this.cursorLine];
      if (this.cursorCol < currentLine.length) {
        this.cursorCol++;
      } else if (this.cursorLine < this.fileContent.length - 1) {
        this.cursorLine++;
        this.cursorCol = 0;
        this.adjustScroll();
      }
    } else if (key === '\u001b[D') { // Left
      if (this.cursorCol > 0) {
        this.cursorCol--;
      } else if (this.cursorLine > 0) {
        this.cursorLine--;
        this.cursorCol = this.fileContent[this.cursorLine].length;
        this.adjustScroll();
      }
    }
    // Backspace
    else if (key === '\u007f' || key === '\b') {
      const currentLine = this.fileContent[this.cursorLine];
      if (this.cursorCol > 0) {
        const newLine = currentLine.slice(0, this.cursorCol - 1) + currentLine.slice(this.cursorCol);
        this.fileContent[this.cursorLine] = newLine;
        this.cursorCol--;
      } else if (this.cursorLine > 0) {
        const prevLine = this.fileContent[this.cursorLine - 1];
        this.cursorCol = prevLine.length;
        this.fileContent[this.cursorLine - 1] = prevLine + currentLine;
        this.fileContent.splice(this.cursorLine, 1);
        this.cursorLine--;
        this.adjustScroll();
      }
      this.fileContent = [...this.fileContent];
    }
    // Enter
    else if (key === '\r' || key === '\n') {
      const currentLine = this.fileContent[this.cursorLine];
      const beforeCursor = currentLine.slice(0, this.cursorCol);
      const afterCursor = currentLine.slice(this.cursorCol);
      this.fileContent[this.cursorLine] = beforeCursor;
      this.fileContent.splice(this.cursorLine + 1, 0, afterCursor);
      this.cursorLine++;
      this.cursorCol = 0;
      this.adjustScroll();
      this.fileContent = [...this.fileContent];
    }
    // Regular characters
    else if (key.length === 1 && !event.ctrlKey) {
      const currentLine = this.fileContent[this.cursorLine];
      const newLine = currentLine.slice(0, this.cursorCol) + key + currentLine.slice(this.cursorCol);
      this.fileContent[this.cursorLine] = newLine;
      this.cursorCol++;
      this.fileContent = [...this.fileContent];
    }
    this.updateTerminalCursor();
  }

  adjustScroll() {
    if (this.cursorLine < this.scrollOffset) {
      this.scrollOffset = this.cursorLine;
    } else if (this.cursorLine >= this.scrollOffset + this.maxVisibleLines) {
      this.scrollOffset = this.cursorLine - this.maxVisibleLines + 1;
    }
    this.updateTerminalCursor();
  }

  updateTerminalCursor() {
    if (this.mode !== 'edit') return;

    // Calculate terminal position
    // Header takes 3 lines: title, status, separator
    const headerLines = 3;
    const lineNumberWidth = String(this.fileContent.length).length + 2; // ": " after number
    const visualLine = this.cursorLine - this.scrollOffset;
    const terminalRow = headerLines + visualLine;
    const terminalCol = lineNumberWidth + this.cursorCol;

    // Move cursor to position
		cursorTo(terminalRow, terminalCol);
  }

	get visibleLines() {
		return this.fileContent.slice(this.scrollOffset, this.scrollOffset + this.maxVisibleLines);
	}

  <template>
		{{#if (eq this.mode "list")}}
			<Text @bold={{true}} @color="cyan">File Editor - Select a file</Text>
			<Text>---</Text>
			{{#each this.files as |file index|}}
				{{#if (eq index this.selectedIndex)}}
					<Text @color="yellow" @bold={{true}}>> {{file}}</Text>
				{{else}}
					<Text @color="white">  {{file}}</Text>
				{{/if}}
			{{/each}}
			<Box @borderStyle="single" @borderColor="gray" @paddingX={{1}}>
				<Text @color="gray">↑↓: Navigate | Enter: Open | Ctrl+B: Back to menu</Text>
			</Box>
		{{else}}
			<Text @bold={{true}} @color="cyan">Editing: {{this.currentFile}}</Text>
			<Text @color="gray">Line {{this.cursorLine}}, Col {{this.cursorCol}} | Scroll: {{this.scrollOffset}}</Text>
			<Text>---</Text>
			{{#each this.visibleLines as |line lineIndex|}}
				<Text @preFormatted={{true}} @color="white">{{add this.scrollOffset lineIndex 1}}: {{line}}</Text>
			{{/each}}
			{{#if this.statusMessage}}
				<Text @color="green">{{this.statusMessage}}</Text>
			{{/if}}
			<Spacer></Spacer>
			<Box @borderStyle="single" @borderColor="gray" @paddingX={{1}}>
				<Text @color="gray">Ctrl+S: Save | Ctrl+X: File list</Text>
			</Box>
		{{/if}}
  </template>
}

const add = (a, b) => a + b;
const eq = (a, b) => a === b;
