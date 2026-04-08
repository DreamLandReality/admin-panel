/**
 * useContextualGroups Hook
 * 
 * React hook that manages contextual field grouping state.
 * Handles dependency analysis, group creation, and visibility updates.
 */

import { useMemo, useCallback, useRef } from 'react'
import { DependencyAnalyzer } from '@/lib/utils/dependency-analyzer'
import { ContextualGroupManager } from '@/lib/utils/contextual-group-manager'
import { FieldVisibilityController } from '@/lib/utils/field-visibility-controller'
import type { FieldSchema } from '@/lib/utils/dependency-analyzer'
import type { ContextualGroup } from '@/lib/utils/contextual-group-manager'
import type { VisibilityState } from '@/lib/utils/field-visibility-controller'

interface UseContextualGroupsOptions {
  properties: Record<string, FieldSchema>
  data: Record<string, any>
  enableContextualGrouping?: boolean
  debug?: boolean
}

interface UseContextualGroupsResult {
  groups: ContextualGroup[]
  visibilityState: VisibilityState
  isFieldVisible: (fieldKey: string) => boolean
  updateFieldValue: (fieldKey: string, newValue: any) => void
  hasContextualGroups: boolean
}

export function useContextualGroups({
  properties,
  data,
  enableContextualGrouping = true,
  debug = false,
}: UseContextualGroupsOptions): UseContextualGroupsResult {
  const analyzer = useRef(new DependencyAnalyzer())
  const groupManager = useRef(new ContextualGroupManager())
  const visibilityController = useRef(new FieldVisibilityController())

  // Analyze dependencies and build graph
  const dependencyGraph = useMemo(() => {
    if (!enableContextualGrouping) return null

    const startTime = performance.now()
    const graph = analyzer.current.analyze(properties)
    const endTime = performance.now()

    if (debug) {
      console.log('[ContextualGroups] Dependency analysis completed in', endTime - startTime, 'ms')
      console.log('[ContextualGroups] Graph:', {
        nodes: graph.nodes.size,
        roots: graph.roots.length,
        topologicalOrder: graph.topologicalOrder,
      })
    }

    // Validate dependencies
    const validation = analyzer.current.validateDependencies(graph)
    if (!validation.valid) {
      console.error('[ContextualGroups] Validation errors:', validation.errors)
    }
    if (validation.warnings.length > 0) {
      console.warn('[ContextualGroups] Validation warnings:', validation.warnings)
    }

    return graph
  }, [properties, enableContextualGrouping, debug])

  // Initialize visibility state
  const visibilityState = useMemo(() => {
    if (!dependencyGraph) {
      return {
        fieldValues: { ...data },
        fieldVisibility: new Map(),
        groupVisibility: new Map(),
        lastUpdate: Date.now(),
      }
    }

    return visibilityController.current.initialize(dependencyGraph, data)
  }, [dependencyGraph, data])

  // Create contextual groups
  const groups = useMemo(() => {
    if (!enableContextualGrouping || !dependencyGraph) {
      return []
    }

    const startTime = performance.now()
    const createdGroups = groupManager.current.createGroups(
      dependencyGraph,
      data,
      properties
    )
    const endTime = performance.now()

    if (debug) {
      console.log('[ContextualGroups] Groups created in', endTime - startTime, 'ms')
      console.log('[ContextualGroups] Groups:', createdGroups.map(g => ({
        id: g.id,
        triggerField: g.triggerField,
        triggerValue: g.triggerValue,
        fieldCount: g.fields.length,
        isVisible: g.isVisible,
      })))
    }

    return createdGroups
  }, [dependencyGraph, data, properties, enableContextualGrouping, debug])

  // Check if field is visible
  const isFieldVisible = useCallback(
    (fieldKey: string): boolean => {
      if (!enableContextualGrouping) return true
      return visibilityController.current.getFieldVisibility(visibilityState, fieldKey)
    },
    [visibilityState, enableContextualGrouping]
  )

  // Update field value and recalculate visibility
  const updateFieldValue = useCallback(
    (fieldKey: string, newValue: any) => {
      if (!dependencyGraph) return

      const startTime = performance.now()
      const update = visibilityController.current.updateVisibility(
        visibilityState,
        dependencyGraph,
        fieldKey,
        newValue
      )
      const endTime = performance.now()

      if (debug) {
        console.log('[ContextualGroups] Visibility update in', endTime - startTime, 'ms')
        console.log('[ContextualGroups] Update:', update)
      }

      // Update group visibility
      groupManager.current.updateGroupVisibility(groups, fieldKey, newValue)
    },
    [dependencyGraph, visibilityState, groups, debug]
  )

  // Check if any contextual groups exist
  const hasContextualGroups = useMemo(() => {
    return groups.some((g) => g.triggerField !== null)
  }, [groups])

  return {
    groups,
    visibilityState,
    isFieldVisible,
    updateFieldValue,
    hasContextualGroups,
  }
}
