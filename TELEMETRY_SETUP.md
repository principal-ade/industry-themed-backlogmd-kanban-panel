# OTEL Telemetry in Storybook

This project uses a custom Storybook addon to capture and visualize OpenTelemetry data from story interactions.

## Setup

### 1. Build the Addon

```bash
cd .storybook/addons/otel-telemetry
npm install
npm run build
```

### 2. Start Storybook

```bash
npm run storybook
```

### 3. Open the Instrumented Story

Navigate to: **Stories > TaskWorkflowLifecycle (Instrumented) > With Telemetry**

## How It Works

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    STORYBOOK STORY                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  TaskWorkflowLifecycle Component                    │   │
│  │  - Wraps panels with telemetry hooks                │   │
│  │  - Instruments event emitter                        │   │
│  │  - Creates spans for lifecycle phases               │   │
│  └────────────────┬────────────────────────────────────┘   │
│                   │ Captures spans/events                   │
│                   ▼                                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Telemetry Addon Decorator                          │   │
│  │  - Wraps story automatically                        │   │
│  │  - Creates root span                                │   │
│  │  - Provides telemetry context                       │   │
│  └────────────────┬────────────────────────────────────┘   │
│                   │ Sends via channel                       │
└───────────────────┼─────────────────────────────────────────┘
                    ▼
┌─────────────────────────────────────────────────────────────┐
│            STORYBOOK MANAGER UI                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  OTEL Telemetry Panel                               │   │
│  │  - Displays spans in real-time                      │   │
│  │  - Timeline view (chronological)                    │   │
│  │  - Canvas view (flow visualization)                 │   │
│  │  - Export to JSON                                   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### What Gets Captured

1. **Story Lifecycle**
   - `story.mounted`: When story renders
   - `story.unmounted`: When story is removed

2. **Context Initialization**
   - `context.initialized`: Panel context setup
   - File system operations (`fs.exists`, `fs.readFile`, `fs.writeFile`)

3. **Kanban Lifecycle**
   - `kanban.loading`: Starting data load
   - `kanban.loaded`: Data loaded with task counts

4. **User Interactions**
   - `task.selected`: User clicks a task
   - `task.moved`: User drags task to different column
   - `task.deselected`: User closes task detail

5. **Task Mutations**
   - `task.created`: New task created
   - `task.updated`: Task modified
   - `task.deleted`: Task removed
   - `task.assign.to.claude`: Task assigned to Claude

6. **Panel Focus**
   - `panel.focused`: Panel receives focus

## Viewing Telemetry

### Timeline View

Shows spans chronologically with:
- Span name and duration
- Attributes (key-value pairs)
- Events within each span
- Error status and messages

### Canvas View (Coming Soon)

Will visualize the execution flow on an interactive canvas using the GraphRenderer component.

## Manual Instrumentation

### In Story Components

```typescript
import { useTelemetry, useTelemetrySpan } from '../.storybook/addons/otel-telemetry/dist/decorator';

function MyComponent() {
  const { rootSpan } = useTelemetry();
  const span = useTelemetrySpan('my-component', {
    'component.type': 'feature',
  });

  // Add events to the span
  const handleClick = () => {
    TelemetryCollector.addEvent(span, 'button.clicked', {
      'button.id': 'submit',
    });
  };

  return <button onClick={handleClick}>Click me</button>;
}
```

### Instrumenting Event Emitters

```typescript
import { TelemetryCollector } from '../.storybook/addons/otel-telemetry/dist/collector';

// Wrap the emit function
const originalEmit = events.emit.bind(events);
events.emit = (event: any) => {
  if (span) {
    TelemetryCollector.addEvent(span, event.type, {
      'event.source': event.source,
    });
  }
  return originalEmit(event);
};
```

## Exporting Telemetry

1. Interact with the story to generate telemetry
2. Open the "OTEL Telemetry" panel
3. Click "Export JSON"
4. Save the file

The exported JSON contains all captured spans and can be:
- Imported into the principal-view-core library for visualization
- Analyzed with custom scripts
- Converted to `.otel.canvas` format
- Compared across different test runs

## Canvas Schema

The `.principal-views/task-workflow-lifecycle.otel.canvas` file defines the expected events for your lifecycle.

To validate events against this schema:
1. Export telemetry JSON from Storybook
2. Load it into principal-view-core's event validator
3. Validate against the canvas schema

```typescript
import { EventValidator } from '@principal-ai/principal-view-core';
import canvas from './.principal-views/task-workflow-lifecycle.otel.canvas';

const validator = new EventValidator(canvas);
const result = validator.validateSpan(span, nodeId);
if (!result.isValid) {
  console.error('Validation errors:', result.errors);
}
```

## Next Steps

### 1. Implement Canvas Visualization

Update `TelemetryPanel.tsx` to use your GraphRenderer:

```typescript
import { GraphRenderer } from '@principal-ai/principal-view-react';
import { spansToCanvas } from './utils/spansToCanvas';

// In canvas view:
const canvas = spansToCanvas(spans);
return <GraphRenderer canvas={canvas} />;
```

### 2. Add Event Schema Validation

Load the `.otel.canvas` file and validate events in real-time:

```typescript
import canvas from '../../../.principal-views/task-workflow-lifecycle.otel.canvas';
import { EventValidator } from '@principal-ai/principal-view-core';

const validator = new EventValidator(canvas);
// Validate each event as it's captured
```

### 3. Connect to Backend

Export spans in OTLP format and send to:
- OpenTelemetry Collector
- Sentry
- Custom analytics backend

### 4. Automated Testing

Use telemetry in tests:

```typescript
it('should emit correct events during lifecycle', async () => {
  render(<Story />);

  // Interact with component
  await userEvent.click(screen.getByText('Select Task'));

  // Assert telemetry
  const spans = TelemetryCollector.getSpans();
  expect(spans).toContainEqual(
    expect.objectContaining({
      name: 'task-selection',
      events: expect.arrayContaining([
        expect.objectContaining({
          name: 'task.selected',
        }),
      ]),
    })
  );
});
```

## Troubleshooting

### Addon not appearing

1. Check that addon is built: `cd .storybook/addons/otel-telemetry && npm run build`
2. Verify registration in `.storybook/main.ts`
3. Verify decorator in `.storybook/preview.ts`
4. Restart Storybook

### No telemetry appearing

1. Check that story has telemetry enabled (it's on by default)
2. Verify you're using the instrumented story
3. Check browser console for errors
4. Ensure `useTelemetry()` hook is called inside story component

### TypeScript errors

1. Run `npm run build` in the addon directory
2. Check that `dist/` directory exists
3. Restart your IDE

## Resources

- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Storybook Addon Guide](https://storybook.js.org/docs/react/addons/introduction)
- [Principal View Core Library](../../../principal-view-core-library)
- Canvas Schema: `.principal-views/task-workflow-lifecycle.otel.canvas`
