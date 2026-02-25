# OTEL Telemetry Addon - Quick Start

## Setup Complete ✅

The addon has been created and built successfully:
- ✅ Addon code: `.storybook/addons/otel-telemetry/`
- ✅ Built dist files: `.storybook/addons/otel-telemetry/dist/`
- ✅ Registered in Storybook: `.storybook/main.ts`
- ✅ Canvas schema: `.principal-views/task-workflow-lifecycle.otel.canvas`
- ✅ Instrumented story: `src/stories/TaskWorkflowLifecycle.instrumented.stories.tsx`

## How to Use

### 1. Start Storybook

```bash
npm run storybook
```

### 2. Open the Instrumented Story

Navigate to: **Stories > TaskWorkflowLifecycle (Instrumented) > With Telemetry**

### 3. View Telemetry

1. Look for the **"OTEL Telemetry"** panel at the bottom of Storybook (next to Actions, Controls, etc.)
2. Interact with the story:
   - Click on tasks
   - Drag tasks between columns
   - Open task details
3. Watch telemetry spans appear in real-time in the panel

### 4. Export Telemetry

Click the **"Export JSON"** button in the telemetry panel to download captured spans.

## What Gets Captured Automatically

The addon's decorator automatically captures:

- **Story Lifecycle**
  - `story.mounted` - When the story renders
  - `story.unmounted` - When the story is removed

That's it for automatic capture! For more detailed telemetry, you can manually instrument your components.

## Manual Instrumentation (Optional)

To capture custom events, you can use the telemetry addon API:

```typescript
import { TelemetryCollector } from '../../.storybook/addons/otel-telemetry/dist';

// In your component or story
const span = TelemetryCollector.startSpan('my-operation', {
  'operation.type': 'user-action',
});

// Add events
TelemetryCollector.addEvent(span, 'button.clicked', {
  'button.id': 'submit',
});

// End span
TelemetryCollector.endSpan(span);
```

## Telemetry Panel Features

- **Timeline View**: Shows all spans chronologically with attributes and events
- **Canvas View**: (Coming soon) Will visualize execution flow on interactive canvas
- **Clear Button**: Clears all captured telemetry
- **Export Button**: Downloads telemetry as JSON

## Example: Instrumenting Event Emitters

If you want to capture events from your event bus:

```typescript
import { TelemetryCollector } from '../../.storybook/addons/otel-telemetry/dist';

// Wrap your event emitter
const originalEmit = events.emit.bind(events);
events.emit = (event: any) => {
  // Create a span for this event
  const span = TelemetryCollector.startSpan(event.type, {
    'event.source': event.source,
  });

  // Add event details
  TelemetryCollector.addEvent(span, event.type, event.payload);
  TelemetryCollector.endSpan(span);

  // Call original emit
  return originalEmit(event);
};
```

## Next Steps

### 1. Add Canvas Visualization

Edit `.storybook/addons/otel-telemetry/src/components/TelemetryPanel.tsx` to use your GraphRenderer in the canvas view:

```typescript
// Import GraphRenderer and TraceToCanvas from principal-view
import { GraphRenderer } from '@principal-ai/principal-view-react';
import { traceToCanvas } from '@principal-ai/principal-view-core';

// In the Canvas view section:
const canvas = traceToCanvas({
  exportedAt: new Date().toISOString(),
  serviceName: 'Storybook',
  spanCount: spans.length,
  spans: spans.map(span => ({
    // Convert TelemetrySpan to TraceSpan format
    ...span,
    traceId: 'story-trace',
    spanId: span.id,
    kind: 'INTERNAL',
  })),
});

return <GraphRenderer canvas={canvas} />;
```

### 2. Validate Against Schema

Load the canvas schema and validate events:

```typescript
import canvas from '../../../.principal-views/task-workflow-lifecycle.otel.canvas';
import { EventValidator } from '@principal-ai/principal-view-core';

const validator = new EventValidator(canvas);
// Validate spans as they're captured
```

### 3. Share the Addon

This addon can be published to npm or shared across projects:

```bash
cd .storybook/addons/otel-telemetry
npm publish
```

## Troubleshooting

### Panel not appearing

1. **Rebuild the addon:**
   ```bash
   cd .storybook/addons/otel-telemetry
   npm run build
   cd ../../..
   ```

2. **Restart Storybook:**
   ```bash
   npm run storybook
   ```

### No telemetry showing

1. Verify the panel is open (bottom tabs)
2. Check browser console for errors
3. Ensure you're viewing a story (not docs)

### TypeScript errors

1. Rebuild the addon: `cd .storybook/addons/otel-telemetry && npm run build`
2. Restart your IDE
3. Check that `dist/` directory exists

## Architecture

```
Story renders
    ↓
withTelemetry decorator wraps it
    ↓
Creates root span "Story: Title/Name"
    ↓
Story component runs normally
    ↓
(Optional) Manual instrumentation adds spans/events
    ↓
All spans sent to manager via channel
    ↓
TelemetryPanel displays in real-time
```

## Files Created

- `.storybook/addons/otel-telemetry/` - Addon source code
  - `src/collector.ts` - Span collection logic
  - `src/decorator.tsx` - Story wrapper
  - `src/manager.tsx` - Manager UI registration
  - `src/components/TelemetryPanel.tsx` - Panel UI
  - `src/constants.ts` - Shared constants
  - `src/preset.ts` - Storybook preset config
  - `dist/` - Compiled JavaScript
- `.principal-views/task-workflow-lifecycle.otel.canvas` - Event schema
- `src/stories/TaskWorkflowLifecycle.instrumented.stories.tsx` - Example story
- `TELEMETRY_SETUP.md` - Detailed documentation
- `TELEMETRY_QUICKSTART.md` - This file

## Resources

- [Storybook Addons Documentation](https://storybook.js.org/docs/react/addons/introduction)
- [OpenTelemetry Concepts](https://opentelemetry.io/docs/concepts/)
- Principal View Core Library Documentation
