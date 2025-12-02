import "./globalSetup";
import { setupRenderingContext } from 'ember-vitest';
import { describe, test, expect as hardExpect, beforeEach } from "vitest";
import { Text, Box, Static, Spacer, render, FakeTTY, resetStaticCache } from "etui";
import { rerender } from "@ember/test-helpers";
import { trackedObject } from "@ember/reactive/collections";
import { clearScreen } from "etui/render/apply-term-updates";

const expect = hardExpect.soft;

interface Task {
  id: number;
  title: string;
}

describe("Static component integration test", () => {
  let fakeTTY: FakeTTY;

  beforeEach(() => {
		clearScreen();
    fakeTTY = new FakeTTY();
		fakeTTY.reset();
    resetStaticCache();
  });

  test("should render static tasks progressively without re-rendering old tasks", async () => {
    await using ctx = await setupRenderingContext();

    const state = trackedObject({ tasks: [] as Task[], counter: 0 });

    await ctx.render(<template>
		<Box @height="100%" @overflow="visible" @flexDirection="column" >
			<Text @bold={{true}} @color="cyan">Select a view (press 1, 2, 3, 4, or 5): {{this.selectedView}}</Text>
			<Text @color="green">[1] Colors Demo</Text>
			<Box flexDirection="column">
				<Static @items={{state.tasks}}>
					<:default as |task|>
						<Text color="green">✔ {{task.title}}</Text>
					</:default>
				</Static>
			</Box>
			<Spacer />
			<Box flexDirection="column">
				<Box marginTop={{1}}>
					<Text dimColor={{true}}>Completed tasks: {{state.tasks.length}} | Counter: {{state.counter}}</Text>
				</Box>
			</Box>
		</Box>
    </template>);

    // Initial render with no tasks
    render(ctx.element, { stdout: fakeTTY as any });

    // Add first task
    state.tasks = [...state.tasks, { id: 0, title: 'Task #1' }];
    await rerender();
    render(ctx.element, { stdout: fakeTTY as any });

    let output = fakeTTY.getCleanOutput();
    console.log('=== First render output ===');
    console.log(output);
    console.log('=== Buffer state ===');
    console.log('Buffer length:', fakeTTY.buffer.length);
    for (let i = 0; i < fakeTTY.buffer.length; i++) {
      const lineContent = fakeTTY.buffer[i].map(c => c.char).join('');
      if (lineContent.trim() || i < 5) {
        console.log(`Line ${i}: "${lineContent}"`);
      }
    }
    console.log('=== End output ===');
    expect(output).toContain('Task #1');
    expect(output).toContain('Completed tasks: 1');

    const firstTaskRenderCount = fakeTTY.output.length;
    fakeTTY.clear();

    // Add second task
    state.tasks = [...state.tasks, { id: 1, title: 'Task #2' }];
    await rerender();
    render(ctx.element, { stdout: fakeTTY as any });

    output = fakeTTY.getCleanOutput();
    expect(output).toContain('Task #2');
    expect(output).toContain('Completed tasks: 2');

    // Second render should write less (only new task + updated counter)
    const secondTaskRenderCount = fakeTTY.output.length;
    expect(secondTaskRenderCount - firstTaskRenderCount).toBeLessThan(firstTaskRenderCount);

    fakeTTY.clear();

    // Add third task
    state.tasks = [...state.tasks, { id: 2, title: 'Task #3' }];
    await rerender();
    render(ctx.element, { stdout: fakeTTY as any });

    output = fakeTTY.getCleanOutput();
    expect(output).toContain('Task #3');
    expect(output).toContain('Completed tasks: 3');
  });

  test("should update dynamic counter without re-rendering static tasks", async () => {
    await using ctx = await setupRenderingContext();

    const state = trackedObject({
      tasks: [
        { id: 0, title: 'Task #1' },
        { id: 1, title: 'Task #2' },
        { id: 2, title: 'Task #3' }
      ] as Task[],
      counter: 0
    });

    await ctx.render(<template>
      <Box flexDirection="column">
        <Static @items={{state.tasks}}>
          <:default as |task|>
            <Text color="green">✔ {{task.title}}</Text>
          </:default>
        </Static>
      </Box>
      <Spacer />
      <Box flexDirection="column">
        <Box marginTop={{1}}>
          <Text dimColor={{true}}>Completed tasks: {{state.tasks.length}} | Counter: {{state.counter}}</Text>
        </Box>
      </Box>
    </template>);

    render(ctx.element, { stdout: fakeTTY as any });

    let output = fakeTTY.getCleanOutput();
    expect(output).toContain('Task #1');
    expect(output).toContain('Task #2');
    expect(output).toContain('Task #3');
    expect(output).toContain('Counter: 0');

    fakeTTY.clear();

    // Update counter only (no new tasks)
    state.counter++;
    await rerender();
    render(ctx.element, { stdout: fakeTTY as any });

    output = fakeTTY.getCleanOutput();
    expect(output).toContain('Counter: 1');

    // Should have minimal output (only counter update)
    const counterUpdateOutput = fakeTTY.getVisibleOutput();
    // Should not re-render all tasks
    expect(counterUpdateOutput).not.toContain('Task #1');
    expect(counterUpdateOutput).not.toContain('Task #2');
    expect(counterUpdateOutput).not.toContain('Task #3');
  });

  test("should render all 10 tasks progressively", async () => {
    await using ctx = await setupRenderingContext();

    const state = trackedObject({ tasks: [] as Task[], counter: 0 });

    await ctx.render(<template>
      <Box flexDirection="column">
        <Static @items={{state.tasks}}>
          <:default as |task|>
            <Text color="green">✔ {{task.title}}</Text>
          </:default>
        </Static>
      </Box>
      <Spacer />
      <Box flexDirection="column">
        <Box marginTop={{1}}>
          <Text dimColor={{true}}>Completed tasks: {{state.tasks.length}} | Counter: {{state.counter}}</Text>
        </Box>
      </Box>
    </template>);

    render(ctx.element, { stdout: fakeTTY as any });

    // Add all 10 tasks
    for (let i = 0; i < 10; i++) {
      fakeTTY.clear();
      state.tasks = [...state.tasks, { id: i, title: `Task #${i + 1}` }];
      await rerender();
      render(ctx.element, { stdout: fakeTTY as any });

      const output = fakeTTY.getCleanOutput();
      expect(output).toContain(`Task #${i + 1}`);
      expect(output).toContain(`Completed tasks: ${i + 1}`);
    }

    // Final check - all tasks should be present
    fakeTTY.clear();
    state.counter++;
    await rerender();
    render(ctx.element, { stdout: fakeTTY as any });

    const finalOutput = fakeTTY.getCleanOutput();
    for (let i = 1; i <= 10; i++) {
      expect(finalOutput).toContain(`Task #${i}`);
    }
    expect(finalOutput).toContain('Completed tasks: 10');
  });

  test("should have checkmarks for all tasks", async () => {
    await using ctx = await setupRenderingContext();

    const state = trackedObject({
      tasks: [
        { id: 0, title: 'Task #1' },
        { id: 1, title: 'Task #2' },
        { id: 2, title: 'Task #3' },
        { id: 3, title: 'Task #4' },
        { id: 4, title: 'Task #5' }
      ] as Task[],
      counter: 0
    });

    await ctx.render(<template>
      <Box flexDirection="column">
        <Static @items={{state.tasks}}>
          <:default as |task|>
            <Text color="green">✔ {{task.title}}</Text>
          </:default>
        </Static>
      </Box>
      <Spacer />
      <Box flexDirection="column">
        <Box marginTop={{1}}>
          <Text dimColor={{true}}>Completed tasks: {{state.tasks.length}} | Counter: {{state.counter}}</Text>
        </Box>
      </Box>
    </template>);

    render(ctx.element, { stdout: fakeTTY as any });

    const output = fakeTTY.getCleanOutput();
    const checkmarkCount = (output.match(/✔/g) || []).length;
    expect(checkmarkCount).toBe(5);
  });

  test("should contain ANSI color codes for tasks", async () => {
    await using ctx = await setupRenderingContext();

    const state = trackedObject({
      tasks: [{ id: 0, title: 'Task #1' }] as Task[],
      counter: 0
    });

    await ctx.render(<template>
      <Box flexDirection="column">
        <Static @items={{state.tasks}}>
          <:default as |task|>
            <Text color="green">✔ {{task.title}}</Text>
          </:default>
        </Static>
      </Box>
      <Spacer />
      <Box flexDirection="column">
        <Box marginTop={{1}}>
          <Text dimColor={{true}}>Completed tasks: {{state.tasks.length}} | Counter: {{state.counter}}</Text>
        </Box>
      </Box>
    </template>);

    render(ctx.element, { stdout: fakeTTY as any });

    const output = fakeTTY.getFullOutput();
    // Should have green color code (32m)
    expect(output).toMatch(/\x1b\[32m/);
  });
});
