import "./globalSetup";
import { setupRenderingContext } from 'ember-vitest';
import App from '../app/app';
import { describe, test, expect, beforeEach } from "vitest";
import { Text, Box, render } from "ember-tui";
import { rerender } from "@ember/test-helpers";
import { trackedObject } from "@ember/reactive/collections";
import { FakeTTY } from "ember-tui/test-utils/FakeTTY";
import * as fs from 'fs';
import * as path from 'path';

const logFile = path.join(process.cwd(), 'overlay-test-debug.log');
function log(msg: string) {
	fs.appendFileSync(logFile, msg + '\n');
}

describe('Overlay background bug reproduction', () => {
	let fakeTTY: FakeTTY;

	beforeEach(() => {
		fakeTTY = new FakeTTY();
		fakeTTY.rows = 1000;
		fakeTTY.columns = 200;
	});

	test('should apply background color across entire line with multiple text segments', async () => {
		await using ctx = await setupRenderingContext(App);
		const state = trackedObject({ showOverlay: false });

		await ctx.render(<template>
			<Box @flexDirection="row" @justifyContent="space-between" @paddingLeft={{1}}>
				{{! Left section }}
				<Box @flexDirection="row">
					<Text @color="cyan">Auto-approve: </Text>
					<Text @color="white" @bold={{true}}>off</Text>
				</Box>

				{{! Middle section }}
				<Box @flexDirection="row">
					<Text @color="cyan">Tokens left: </Text>
					<Text @color="white" @bold={{true}}>100%</Text>
					<Text @color="gray"> | </Text>
					<Text @color="yellow">$500.18</Text>
				</Box>

				{{! Right section }}
				<Box @flexDirection="row">
					<Text @color="magenta">Mode: </Text>
					<Text @color="white" @bold={{true}}>code</Text>
				</Box>
			</Box>

			{{#if state.showOverlay}}
				<Box
					@backgroundColor="cyan"
					@overlay={{true}}
					@position="absolute"
					@top={{0}}
					@left={{0}}
					@width={{200}}
					@height={{1}}
				/>
			{{/if}}
		</template>);

		// Initial render without overlay
		fakeTTY.clear();
		render(ctx.element, { stdout: fakeTTY as any });
		const output1 = fakeTTY.getCleanOutput();
		const raw1 = fakeTTY.getOutputSinceClear();

		log('=== INITIAL RENDER (no overlay) ===');
		log('Clean output: ' + output1);
		log('Raw output length: ' + raw1.length);

		// Verify initial render has text
		expect(output1.includes('Auto-approve')).toBe(true);
		expect(output1.includes('Tokens left')).toBe(true);
		expect(output1.includes('Mode')).toBe(true);

		// Add overlay - should apply cyan background across entire line
		fakeTTY.clear();
		state.showOverlay = true;
		await rerender();
		
		render(ctx.element, { stdout: fakeTTY as any });

		const output2 = fakeTTY.getCleanOutput();
		const raw2 = fakeTTY.getOutputSinceClear();

		log('\n=== AFTER ADDING OVERLAY ===');
		log('Clean output: ' + output2);
		log('Raw output: ' + JSON.stringify(raw2));
		log('Raw output length: ' + raw2.length);
		
		// Debug: What lines are being compared in updateLineMinimal?
		log('\n=== DIFF DEBUG ===');
		log('FakeTTY buffer line 0: ' + JSON.stringify(fakeTTY.buffer[0]?.map(c => c.char + (c.ansi ? `[${c.ansi}]` : '')).join('')));
		log('Number of buffer lines: ' + fakeTTY.buffer.length);

		// Text should still be present
		expect(output2.includes('Auto-approve')).toBe(true);
		expect(output2.includes('Tokens left')).toBe(true);
		expect(output2.includes('Mode')).toBe(true);

		// Check for cyan background code (46m)
		const cyanBgMatches = raw2.match(/\x1b\[46m/g);
		console.log('Cyan background occurrences:', cyanBgMatches?.length || 0);

		// The background should be applied across the entire line width
		// Count how many characters have the cyan background
		const tokens = raw2.split(/(\x1b\[[0-9;]*m)/);
		let inCyanBg = false;
		let charsWithCyanBg = 0;

		for (const token of tokens) {
			if (token === '\x1b[46m') {
				inCyanBg = true;
			} else if (token.match(/\x1b\[[0-9;]*m/)) {
				// Other ANSI code - check if it resets background
				if (token === '\x1b[0m' || token === '\x1b[49m') {
					inCyanBg = false;
				}
			} else if (inCyanBg) {
				charsWithCyanBg += token.length;
			}
		}

		console.log('Characters with cyan background:', charsWithCyanBg);
		console.log('Expected width:', 200);

		// The background should cover most of the line (at least 150 chars for a 200-width line)
		expect(charsWithCyanBg).toBeGreaterThanOrEqual(150);
	});
});
