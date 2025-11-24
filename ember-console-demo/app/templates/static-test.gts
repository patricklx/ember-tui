import { template } from '@ember/template-compiler';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { Box, Text, Static } from 'ember-console';

interface Task {
  id: number;
  title: string;
  color: string;
}

export default class StaticTest extends Component {
  @tracked tasks: Task[] = [];
  @tracked counter = 0;

  constructor(owner: unknown, args: any) {
    super(owner, args);

    // Add tasks progressively - schedule after initial render
    setTimeout(() => {
      let taskId = 0;
      const addTask = () => {
        if (taskId < 10) {
          this.tasks = [...this.tasks, {
            id: taskId,
            title: `Task #${taskId + 1}`
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
    <Box flexDirection="column">
      {{! Static section - tasks that don't change once rendered }}
      <Static>
        {{#each this.tasks as |task|}}
          <Box key={{task.id}}>
            <Text color={{this.randomColor}}>✔ {{task.title}}</Text>
          </Box>
        {{/each}}
      </Static>

      {{! Dynamic section - updates continuously }}
      <Box marginTop={{1}}>
        <Text dimColor={{true}}>Completed tasks: {{this.tasks.length}} | Counter: {{this.counter}}</Text>
      </Box>
    </Box>
  </template>
}
