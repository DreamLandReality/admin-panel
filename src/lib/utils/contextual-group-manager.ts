/**
 * Contextual Group Manager
 * 
 * Creates and manages contextual field groups based on dependency relationships.
 * Groups fields that share the same trigger field and condition value.
 */

import type { DependencyGraph, FieldSchema, ShowWhenCondition } from './dependency-analyzer'

export interface ContextualGroup {
  id: string
  triggerField: string | null // null for root groups
  triggerValue: any
  fields: GroupedField[]
  isVisible: boolean
  depth: number
  order: number
}

export interface GroupedField {
  fieldKey: string
  schema: FieldSchema
  order: number
  isVisible: boolean
  contextualGroup?: ContextualGroup // For nested groups
}

export class ContextualGroupManager {
  /**
   * Create contextual groups from dependency graph and current field values
   */
  createGroups(
    graph: DependencyGraph,
    currentValues: Record<string, any>,
    _properties: Record<string, FieldSchema>
  ): ContextualGroup[] {
    const groups: ContextualGroup[] = []
    const processedFields = new Set<string>()

    // Create root group for fields without dependencies
    const rootFields: GroupedField[] = []
    for (const fieldKey of graph.roots) {
      const node = graph.nodes.get(fieldKey)
      if (!node) continue

      rootFields.push({
        fieldKey,
        schema: node.schema,
        order: node.schema.uiOrder || 999,
        isVisible: true,
      })
      processedFields.add(fieldKey)
    }

    if (rootFields.length > 0) {
      rootFields.sort((a, b) => a.order - b.order)
      groups.push({
        id: 'root',
        triggerField: null,
        triggerValue: null,
        fields: rootFields,
        isVisible: true,
        depth: 0,
        order: 0,
      })
    }

    // Create contextual groups for dependent fields
    const triggerFieldGroups = new Map<string, Map<any, GroupedField[]>>()

    for (const [fieldKey, node] of Array.from(graph.nodes.entries())) {
      if (processedFields.has(fieldKey)) continue
      if (!node.schema.uiShowWhen) continue

      const { sibling, value, values } = node.schema.uiShowWhen
      
      // Determine which values this field should be grouped under
      const groupValues = values || (value !== undefined ? [value] : [])

      for (const groupValue of groupValues) {
        if (!triggerFieldGroups.has(sibling)) {
          triggerFieldGroups.set(sibling, new Map())
        }

        const valueGroups = triggerFieldGroups.get(sibling)!
        if (!valueGroups.has(groupValue)) {
          valueGroups.set(groupValue, [])
        }

        const isVisible = this.evaluateCondition(
          node.schema.uiShowWhen,
          currentValues[sibling]
        )

        valueGroups.get(groupValue)!.push({
          fieldKey,
          schema: node.schema,
          order: node.schema.uiOrder || 999,
          isVisible,
        })
      }

      processedFields.add(fieldKey)
    }

    // Convert trigger field groups to ContextualGroup objects
    let groupOrder = 1
    for (const [triggerField, valueGroups] of Array.from(triggerFieldGroups.entries())) {
      const triggerNode = graph.nodes.get(triggerField)
      const triggerDepth = triggerNode?.depth || 0

      for (const [triggerValue, fields] of Array.from(valueGroups.entries())) {
        fields.sort((a, b) => a.order - b.order)

        const currentValue = currentValues[triggerField]
        const isVisible = this.evaluateCondition(
          { sibling: triggerField, value: triggerValue },
          currentValue
        )

        groups.push({
          id: `${triggerField}:${String(triggerValue)}`,
          triggerField,
          triggerValue,
          fields,
          isVisible,
          depth: triggerDepth + 1,
          order: groupOrder++,
        })
      }
    }

    return groups
  }

  /**
   * Update group visibility based on field value changes
   */
  updateGroupVisibility(
    groups: ContextualGroup[],
    changedField: string,
    newValue: any
  ): void {
    for (const group of groups) {
      if (group.triggerField === changedField) {
        group.isVisible = this.evaluateCondition(
          { sibling: changedField, value: group.triggerValue },
          newValue
        )

        // Update field visibility within the group
        for (const field of group.fields) {
          field.isVisible = group.isVisible
        }
      }
    }
  }

  /**
   * Get all currently visible groups
   */
  getVisibleGroups(groups: ContextualGroup[]): ContextualGroup[] {
    return groups.filter((g) => g.isVisible)
  }

  /**
   * Evaluate a uiShowWhen condition against a value
   */
  private evaluateCondition(condition: ShowWhenCondition, actualValue: any): boolean {
    const { value, values, operator = 'equals' } = condition

    switch (operator) {
      case 'equals':
        return actualValue === value

      case 'not_equals':
        return actualValue !== value

      case 'in':
        return values ? values.includes(actualValue) : false

      case 'not_in':
        return values ? !values.includes(actualValue) : true

      case 'exists':
        return actualValue !== undefined && actualValue !== null && actualValue !== ''

      case 'not_exists':
        return actualValue === undefined || actualValue === null || actualValue === ''

      default:
        // Default behavior: check if value matches or is in values array
        if (values) {
          return values.includes(actualValue)
        }
        return actualValue === value
    }
  }
}
