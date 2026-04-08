# Contextual Field Grouping - Quick Start Guide

## What is it?

Contextual field grouping automatically organizes related form fields based on their dependencies. When a user selects an option, only the relevant fields for that option appear, grouped together.

## Example

**Before (Static Sections):**
```
Media Section:
- Hero Media Type: [Select ▼]
- Background Image
- Image Alt Text
- Carousel Images
- Hero Video
- Autoplay Video
- Mute Video
```
All fields visible, cluttered interface.

**After (Contextual Grouping):**
```
Media Section:
- Hero Media Type: [image ▼]
  ↳ Background Image
  ↳ Image Alt Text
```
Only relevant fields shown, clean interface.

## How to Use

### 1. It Just Works™

Simply add `uiShowWhen` to your field schema:

```json
{
  "heroMediaType": {
    "type": "string",
    "uiWidget": "select",
    "options": ["image", "video"]
  },
  "backgroundImage": {
    "type": "string",
    "uiWidget": "imageUpload",
    "uiShowWhen": {
      "sibling": "heroMediaType",
      "value": "image"
    }
  },
  "heroVideo": {
    "type": "string",
    "uiWidget": "fileUpload",
    "uiShowWhen": {
      "sibling": "heroMediaType",
      "value": "video"
    }
  }
}
```

That's it! The system automatically:
- Detects that `backgroundImage` and `heroVideo` depend on `heroMediaType`
- Groups them by their trigger value
- Shows/hides them based on the current selection
- No need for `uiSection` or `uiOrder` on dependent fields!

### 2. Multiple Values

Show a field for multiple trigger values:

```json
{
  "mediaFile": {
    "type": "string",
    "uiWidget": "fileUpload",
    "uiShowWhen": {
      "sibling": "mediaType",
      "values": ["image", "video"]
    }
  }
}
```

### 3. Boolean Conditions

Show a field when a toggle is enabled:

```json
{
  "showBrochure": {
    "type": "boolean",
    "uiWidget": "toggle"
  },
  "brochureFile": {
    "type": "string",
    "uiWidget": "fileUpload",
    "uiShowWhen": {
      "sibling": "showBrochure",
      "value": true
    }
  }
}
```

### 4. Advanced Operators

```json
{
  "optionalField": {
    "type": "string",
    "uiShowWhen": {
      "sibling": "requiredField",
      "operator": "exists"
    }
  }
}
```

Available operators:
- `equals` (default)
- `not_equals`
- `in`
- `not_in`
- `exists`
- `not_exists`

## Common Patterns

### Media Type Selector

```json
{
  "mediaType": {
    "type": "string",
    "uiWidget": "select",
    "options": ["image", "video", "3d-model"]
  },
  "imageUrl": {
    "type": "string",
    "uiWidget": "imageUpload",
    "uiShowWhen": { "sibling": "mediaType", "value": "image" }
  },
  "videoUrl": {
    "type": "string",
    "uiWidget": "fileUpload",
    "uiShowWhen": { "sibling": "mediaType", "value": "video" }
  },
  "modelUrl": {
    "type": "string",
    "uiWidget": "fileUpload",
    "uiShowWhen": { "sibling": "mediaType", "value": "3d-model" }
  }
}
```

### Optional Feature Toggle

```json
{
  "enableFeature": {
    "type": "boolean",
    "uiWidget": "toggle"
  },
  "featureConfig": {
    "type": "object",
    "properties": { /* ... */ },
    "uiShowWhen": { "sibling": "enableFeature", "value": true }
  }
}
```

### Cascading Dependencies

```json
{
  "level1": {
    "type": "string",
    "uiWidget": "select",
    "options": ["option-a", "option-b"]
  },
  "level2": {
    "type": "string",
    "uiWidget": "select",
    "options": ["sub-1", "sub-2"],
    "uiShowWhen": { "sibling": "level1", "value": "option-a" }
  },
  "level3": {
    "type": "string",
    "uiShowWhen": { "sibling": "level2", "value": "sub-1" }
  }
}
```

## Debugging

Enable debug mode to see what's happening:

```tsx
import { useContextualGroups } from '@/hooks/use-contextual-groups'

const { groups, hasContextualGroups } = useContextualGroups({
  properties,
  data,
  debug: true, // Enable debug logging
})
```

Check the browser console for:
- Dependency analysis timing
- Group creation details
- Visibility updates
- Validation warnings

## Disabling

Contextual grouping is always enabled. If your schema has no `uiShowWhen` conditions, the system automatically falls back to static section rendering.

## Best Practices

### ✅ Do

- Use consistent naming for related fields
- Group logically related fields under the same trigger
- Keep dependency chains shallow (2-3 levels max)
- Test all trigger value combinations

### ❌ Don't

- Create circular dependencies (A depends on B, B depends on A)
- Reference non-existent sibling fields
- Create deeply nested dependencies (4+ levels)
- Mix contextual and non-contextual fields in the same logical group

## Troubleshooting

### Fields Not Grouping

**Problem**: Fields with `uiShowWhen` aren't appearing together.

**Check**:
1. Do they have the same `sibling` field?
2. Do they have the same `value` or are in the same `values` array?
3. Are they in the same `uiSection`?

### Groups Not Updating

**Problem**: Changing the trigger field doesn't show/hide groups.

**Check**:
1. Is the `onChange` handler properly connected?
2. Is the data object being updated?
3. Check browser console for errors

### Performance Issues

**Problem**: UI feels slow with many fields.

**Solution**:
1. Enable debug mode to identify bottlenecks
2. Reduce number of conditional fields
3. Simplify dependency chains
4. Consider disabling contextual grouping for very large schemas

## Examples in Templates

Check these templates for real-world examples:

- **minimal-luxury**: Hero section with media type switching
- **noir-luxury**: Tour section with multiple media types

## Need Help?

- Read the [full documentation](./contextual-field-grouping.md)
- Check the [implementation summary](../.kiro/specs/contextual-field-grouping/implementation-summary.md)
- Review the [design document](../.kiro/specs/contextual-field-grouping/design.md)

## Quick Reference

```typescript
// Basic condition
{
  "uiShowWhen": {
    "sibling": "fieldName",
    "value": "expectedValue"
  }
}

// Multiple values
{
  "uiShowWhen": {
    "sibling": "fieldName",
    "values": ["value1", "value2"]
  }
}

// With operator
{
  "uiShowWhen": {
    "sibling": "fieldName",
    "operator": "exists"
  }
}
```

That's it! Start using contextual field grouping to create cleaner, more intuitive forms.
