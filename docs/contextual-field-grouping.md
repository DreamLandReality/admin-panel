# Contextual Field Grouping

## Overview

The contextual field grouping system transforms the admin panel's right panel from a static, manually-organized interface into an intelligent, dependency-aware field renderer. By analyzing `uiShowWhen` relationships in field schemas, the system automatically groups related fields and presents them contextually based on user selections.

## Features

- **Automatic Dependency Detection**: Analyzes field schemas to build a dependency graph
- **Contextual Grouping**: Groups related fields that share the same trigger condition
- **Smart Visibility**: Shows/hides field groups based on current field values
- **Zero Configuration**: Works automatically with existing `uiShowWhen` conditions
- **Backward Compatible**: Falls back to static section rendering when no dependencies exist
- **Performance Optimized**: Efficient dependency analysis and visibility updates

## How It Works

### 1. Dependency Analysis

The system analyzes all fields with `uiShowWhen` conditions to build a dependency graph:

```typescript
{
  heroMediaType: {
    type: 'string',
    uiWidget: 'select',
    options: ['image', 'carousel', 'video']
  },
  backgroundImage: {
    type: 'string',
    uiWidget: 'imageUpload',
    uiShowWhen: {
      sibling: 'heroMediaType',
      value: 'image'
    }
  },
  heroVideo: {
    type: 'string',
    uiWidget: 'fileUpload',
    uiShowWhen: {
      sibling: 'heroMediaType',
      value: 'video'
    }
  }
}
```

### 2. Group Creation

Fields with the same trigger field and value are automatically grouped together:

- **Trigger Field**: `heroMediaType`
  - **Value: "image"** → Group: `backgroundImage`, `backgroundImageAlt`
  - **Value: "video"** → Group: `heroVideo`, `videoAutoplay`, `videoMuted`
  - **Value: "carousel"** → Group: `backgroundImageCarousel`

### 3. Contextual Rendering

Groups are rendered inline, immediately after their trigger field:

```
Media Section:
  ├─ Hero Media Type: [image ▼]
  │  ├─ Background Image
  │  └─ Image Alt Text
  └─ (other media fields)
```

When the user changes the selection:

```
Media Section:
  ├─ Hero Media Type: [video ▼]
  │  ├─ Hero Video
  │  ├─ Autoplay Video
  │  └─ Mute Video
  └─ (other media fields)
```

## Usage

### Basic Usage

Contextual grouping is automatically enabled in `SchemaFieldRenderer`:

```tsx
<SchemaFieldRenderer
  properties={schema.properties}
  data={sectionData}
  onChange={handleChange}
  // Contextual grouping works automatically!
/>
```

The system automatically detects `uiShowWhen` conditions and creates contextual groups. If no dependencies exist, it falls back to static section rendering.

### Debug Mode

Enable debug logging to see dependency analysis and group creation:

```tsx
import { useContextualGroups } from '@/hooks/use-contextual-groups'

const { groups, hasContextualGroups } = useContextualGroups({
  properties,
  data,
  debug: true, // Enable debug logging
})
```

## Field Schema Configuration

### Basic Structure

For trigger fields (dropdowns, toggles), use `uiSection` and `uiOrder`:

```json
{
  "heroMediaType": {
    "type": "string",
    "uiWidget": "select",
    "options": ["image", "video"],
    "uiSection": "media",
    "uiOrder": 10
  }
}
```

For dependent fields, only `uiShowWhen` is needed:

```json
{
  "backgroundImage": {
    "type": "string",
    "uiWidget": "imageUpload",
    "uiShowWhen": {
      "sibling": "heroMediaType",
      "value": "image"
    }
  }
}
```

The system automatically:
- Groups dependent fields together
- Places them after their trigger field
- Orders them by their schema definition order

### Supported uiShowWhen Operators

```typescript
interface ShowWhenCondition {
  sibling: string
  value?: any
  values?: any[]
  operator?: 'equals' | 'not_equals' | 'in' | 'not_in' | 'exists' | 'not_exists'
}
```

### Examples

**Simple equality:**
```json
{
  "uiShowWhen": {
    "sibling": "mediaType",
    "value": "image"
  }
}
```

**Multiple values:**
```json
{
  "uiShowWhen": {
    "sibling": "mediaType",
    "values": ["image", "carousel"]
  }
}
```

**Boolean check:**
```json
{
  "uiShowWhen": {
    "sibling": "showBrochure",
    "value": true
  }
}
```

**Existence check:**
```json
{
  "uiShowWhen": {
    "sibling": "optionalField",
    "operator": "exists"
  }
}
```

## Architecture

### Core Components

1. **DependencyAnalyzer** (`lib/utils/dependency-analyzer.ts`)
   - Analyzes field schemas to build dependency graph
   - Detects cycles and validates dependencies
   - Performs topological sorting

2. **ContextualGroupManager** (`lib/utils/contextual-group-manager.ts`)
   - Creates contextual groups from dependency graph
   - Updates group visibility based on field changes
   - Evaluates uiShowWhen conditions

3. **FieldVisibilityController** (`lib/utils/field-visibility-controller.ts`)
   - Manages field visibility state
   - Handles cascading visibility updates
   - Tracks affected fields during changes

4. **useContextualGroups** (`hooks/use-contextual-groups.ts`)
   - React hook for managing contextual grouping state
   - Memoizes dependency analysis and group creation
   - Provides visibility checking and update functions

### Data Flow

```
Schema → DependencyAnalyzer → DependencyGraph
                                     ↓
                          ContextualGroupManager → Groups
                                     ↓
                          FieldVisibilityController → VisibilityState
                                     ↓
                          SchemaFieldRenderer → UI
```

## Performance

### Benchmarks

- **Dependency Analysis**: < 100ms for 100+ fields
- **Visibility Updates**: < 50ms for any change
- **Group Creation**: < 50ms for complex schemas

### Optimization Strategies

1. **Memoization**: Dependency graph and groups are memoized
2. **Incremental Updates**: Only affected fields are recalculated
3. **Efficient Data Structures**: Uses Maps for O(1) lookups
4. **Topological Sorting**: Ensures optimal field ordering

## Error Handling

### Invalid Sibling References

When a field references a non-existent sibling:
```
[DependencyAnalyzer] Field "backgroundImage" has uiShowWhen referencing non-existent sibling "heroType"
```
The field is treated as always visible.

### Circular Dependencies

When circular dependencies are detected:
```
[DependencyAnalyzer] Cycle detected involving field "fieldA"
Circular dependency detected: fieldA → fieldB → fieldA
```
The cycle is broken and an error is logged.

### Fallback Behavior

If dependency analysis fails, the system automatically falls back to static section rendering, ensuring the UI remains functional.

## Testing

### Unit Tests

Run the test suite:
```bash
npm test -- contextual-grouping.test.ts
```

### Manual Testing

1. Open a template with conditional fields (e.g., minimal-luxury hero section)
2. Change the "Hero Media Type" dropdown
3. Observe fields appearing/disappearing contextually
4. Check browser console for any warnings or errors

## Best Practices

1. **Use Consistent Naming**: Name related fields with common prefixes (e.g., `hero*`, `video*`)
2. **Logical Grouping**: Group fields that logically belong together under the same trigger
3. **Avoid Deep Nesting**: Keep dependency chains shallow (max 2-3 levels)
4. **Test Edge Cases**: Test with all possible trigger values
5. **Document Complex Dependencies**: Add comments for non-obvious relationships

## Troubleshooting

### Fields Not Grouping

**Problem**: Fields with `uiShowWhen` aren't grouping together.

**Solution**: Ensure fields have the same `sibling` and `value` in their `uiShowWhen` conditions.

### Groups Not Updating

**Problem**: Groups don't update when trigger field changes.

**Solution**: Check that the trigger field's `onChange` handler is properly connected.

### Performance Issues

**Problem**: UI feels sluggish with many fields.

**Solution**: Enable debug mode to identify bottlenecks, or disable contextual grouping for very large schemas.

## Future Enhancements

- [ ] Visual dependency graph viewer
- [ ] Advanced operators (regex, range checks)
- [ ] Group-level styling and animations
- [ ] Collapsible contextual groups
- [ ] Field search and filtering
- [ ] Keyboard navigation between groups

## References

- [Requirements Document](.kiro/specs/contextual-field-grouping/requirements.md)
- [Design Document](.kiro/specs/contextual-field-grouping/design.md)
- [Template Developer Guide](../../templates-library/TEMPLATE_DEVELOPER_GUIDE.md)
