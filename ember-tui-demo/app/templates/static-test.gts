import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { Box, Text, Static, Spacer } from 'ember-tui';

interface Task {
  id: number;
  title: string;
  color: string;
}

class StaticTest extends Component {
	// @ts-expect-error - decorator syntax issue in .gts files
  @tracked tasks: Task[] = [];
	// @ts-expect-error - decorator syntax issue in .gts files
  @tracked counter = 0;

  constructor(owner: unknown, args: any) {
		// @ts-expect-error - Owner type mismatch
    super(owner, args);

    // Add tasks progressively - schedule after initial render
    setTimeout(() => {
      let taskId = 0;
      const addTask = () => {
        if (taskId < 10) {
          this.tasks = [...this.tasks, {
            id: taskId,
            title: `Task #${taskId + 1}`,
            color: 'green'
          }];
          taskId++;
          setTimeout(addTask, 500);
        }
      };

      addTask();
    }, 100);

    // Update counter continuously - schedule after initial render
    setTimeout(() => {
      setInterval(() => {
        this.counter++;
      }, 100);
    }, 100);
  }

  get randomColor() {
    return this.tasks && Math.random() < 0.5 ? 'green' : 'red';
  }

  <template>
		{{! Static section - tasks that don't change once rendered }}
		{{! @glint-expect-error: ElementNode vs Element type mismatch }}
		<Box flexDirection="column" >
			<Static @items={{this.tasks}}>
				<:default as |task|>
					{{! @glint-expect-error: ElementNode vs Element type mismatch }}
					<Text color={{this.randomColor}}>✔ {{task.title}}</Text>
				</:default>
			</Static>
		</Box>

		<Spacer></Spacer>

		{{! @glint-expect-error: ElementNode vs Element type mismatch }}
    <Box flexDirection="column">
      {{! Dynamic section - updates continuously }}
			{{! @glint-expect-error: ElementNode vs Element type mismatch }}
      <Box marginTop={{1}}>
				{{! @glint-expect-error: ElementNode vs Element type mismatch }}
        <Text dimColor={{true}}>Completed tasks: {{this.tasks.length}} | Counter: {{this.counter}}</Text>
      </Box>
    </Box>
  </template>
}

// eslint-disable-next-line ember/no-test-import-export
export default StaticTest;
