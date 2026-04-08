/**
 * Field Visibility Controller
 * 
 * Manages field visibility state and handles value change propagation.
 * Tracks which fields and groups are visible based on current field values.
 */

import type { DependencyGraph } from './dependency-analyzer'

export interface VisibilityState {
  fieldValues: Record<string, any>
  fieldVisibility: Map<string, boolean>
  groupVisibility: Map<string, boolean>
  lastUpdate: number
}

export interface VisibilityUpdate {
  changedFields: string[]
  changedGroups: string[]
  affectedFields: string[]
  transitionType: 'show' | 'hide' | 'update'
}

export class FieldVisibilityController {
  /**
   * Initialize visibility state from dependency graph and initial values
   */
  initialize(
    graph: DependencyGraph,
    initialValues: Record<string, any>
  ): VisibilityState {
    const fieldVisibility = new Map<string, boolean>()
    const groupVisibility = new Map<string, boolean>()

    // Calculate initial visibility for all fields
    for (const [fieldKey, node] of Array.from(graph.nodes.entries())) {
      if (!node.schema.uiShowWhen) {
        // Fields without conditions are always visible
        fieldVisibility.set(fieldKey, true)
      } else {
        // Evaluate condition
        const isVisible = this.evaluateFieldVisibility(
          node.schema.uiShowWhen,
          initialValues
        )
        fieldVisibility.set(fieldKey, isVisible)
      }
    }

    return {
      fieldValues: { ...initialValues },
      fieldVisibility,
      groupVisibility,
      lastUpdate: Date.now(),
    }
  }

  /**
   * Update visibility state when a field value changes
   */
  updateVisibility(
    state: VisibilityState,
    graph: DependencyGraph,
    fieldKey: string,
    newValue: any
  ): VisibilityUpdate {
    const changedFields: string[] = []
    const changedGroups: string[] = []
    const affectedFields: string[] = []

    // Update field value
    const oldValue = state.fieldValues[fieldKey]
    state.fieldValues[fieldKey] = newValue

    // Find all fields that depend on this field
    const node = graph.nodes.get(fieldKey)
    if (!node) {
      return {
        changedFields: [],
        changedGroups: [],
        affectedFields: [],
        transitionType: 'update',
      }
    }

    // Check each dependent field
    for (const dependentKey of node.dependents) {
      const dependentNode = graph.nodes.get(dependentKey)
      if (!dependentNode?.schema.uiShowWhen) continue

      const oldVisibility = state.fieldVisibility.get(dependentKey) || false
      const newVisibility = this.evaluateFieldVisibility(
        dependentNode.schema.uiShowWhen,
        state.fieldValues
      )

      if (oldVisibility !== newVisibility) {
        state.fieldVisibility.set(dependentKey, newVisibility)
        changedFields.push(dependentKey)
        affectedFields.push(dependentKey)

        // Recursively update dependent fields
        this.updateDependentFields(
          state,
          graph,
          dependentKey,
          affectedFields
        )
      }
    }

    state.lastUpdate = Date.now()

    // Determine transition type
    let transitionType: 'show' | 'hide' | 'update' = 'update'
    if (changedFields.length > 0) {
      const anyShown = changedFields.some(
        (key) => state.fieldVisibility.get(key) === true
      )
      const anyHidden = changedFields.some(
        (key) => state.fieldVisibility.get(key) === false
      )

      if (anyShown && !anyHidden) {
        transitionType = 'show'
      } else if (anyHidden && !anyShown) {
        transitionType = 'hide'
      }
    }

    return {
      changedFields,
      changedGroups,
      affectedFields,
      transitionType,
    }
  }

  /**
   * Recursively update dependent fields
   */
  private updateDependentFields(
    state: VisibilityState,
    graph: DependencyGraph,
    fieldKey: string,
    affectedFields: string[]
  ): void {
    const node = graph.nodes.get(fieldKey)
    if (!node) return

    for (const dependentKey of node.dependents) {
      const dependentNode = graph.nodes.get(dependentKey)
      if (!dependentNode?.schema.uiShowWhen) continue

      const oldVisibility = state.fieldVisibility.get(dependentKey) || false
      const newVisibility = this.evaluateFieldVisibility(
        dependentNode.schema.uiShowWhen,
        state.fieldValues
      )

      if (oldVisibility !== newVisibility) {
        state.fieldVisibility.set(dependentKey, newVisibility)
        affectedFields.push(dependentKey)

        // Continue recursion
        this.updateDependentFields(state, graph, dependentKey, affectedFields)
      }
    }
  }

  /**
   * Get all currently visible fields
   */
  getVisibleFields(state: VisibilityState): string[] {
    const visible: string[] = []
    for (const [fieldKey, isVisible] of Array.from(state.fieldVisibility.entries())) {
      if (isVisible) {
        visible.push(fieldKey)
      }
    }
    return visible
  }

  /**
   * Get visibility status for a specific field
   */
  getFieldVisibility(state: VisibilityState, fieldKey: string): boolean {
    return state.fieldVisibility.get(fieldKey) ?? true
  }

  /**
   * Evaluate field visibility based on uiShowWhen condition
   */
  private evaluateFieldVisibility(
    condition: any,
    values: Record<string, any>
  ): boolean {
    const { sibling, value, values: conditionValues, operator = 'equals' } = condition
    const actualValue = values[sibling]

    switch (operator) {
      case 'equals':
        return actualValue === value

      case 'not_equals':
        return actualValue !== value

      case 'in':
        return conditionValues ? conditionValues.includes(actualValue) : false

      case 'not_in':
        return conditionValues ? !conditionValues.includes(actualValue) : true

      case 'exists':
        return actualValue !== undefined && actualValue !== null && actualValue !== ''

      case 'not_exists':
        return actualValue === undefined || actualValue === null || actualValue === ''

      default:
        // Default behavior
        if (conditionValues) {
          return conditionValues.includes(actualValue)
        }
        return actualValue === value
    }
  }
}
