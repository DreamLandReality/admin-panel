/**
 * Dependency Analyzer
 * 
 * Analyzes field schemas to extract dependency relationships and build a directed graph.
 * Detects cycles and validates dependencies for the contextual field grouping system.
 */

export interface ShowWhenCondition {
  sibling: string
  value?: any
  values?: any[]
  operator?: 'equals' | 'not_equals' | 'in' | 'not_in' | 'exists' | 'not_exists'
}

export interface FieldSchema {
  type: string
  uiShowWhen?: ShowWhenCondition
  uiSection?: string
  uiOrder?: number
  uiLabel?: string
  properties?: Record<string, FieldSchema>
  [key: string]: any
}

export interface FieldNode {
  fieldKey: string
  schema: FieldSchema
  dependents: string[] // Fields that depend on this field
  dependencies: string[] // Fields this field depends on
  depth: number // Nesting level in dependency tree
}

export interface DependencyEdge {
  from: string // Trigger field
  to: string // Dependent field
  condition: ShowWhenCondition
  weight: number // For ordering multiple dependencies
}

export interface DependencyGraph {
  nodes: Map<string, FieldNode>
  edges: Map<string, DependencyEdge[]>
  roots: string[] // Fields with no dependencies
  topologicalOrder: string[]
}

export interface CyclicDependency {
  cycle: string[]
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export class DependencyAnalyzer {
  /**
   * Analyze field schemas to build a dependency graph
   */
  analyze(properties: Record<string, FieldSchema>): DependencyGraph {
    const nodes = new Map<string, FieldNode>()
    const edges = new Map<string, DependencyEdge[]>()

    // First pass: Create nodes for all fields
    for (const [fieldKey, schema] of Object.entries(properties)) {
      if (!schema) continue

      nodes.set(fieldKey, {
        fieldKey,
        schema,
        dependents: [],
        dependencies: [],
        depth: 0,
      })
    }

    // Second pass: Build edges from uiShowWhen relationships
    for (const [fieldKey, schema] of Object.entries(properties)) {
      if (!schema?.uiShowWhen) continue

      const { sibling } = schema.uiShowWhen
      const targetNode = nodes.get(fieldKey)
      const siblingNode = nodes.get(sibling)

      if (!siblingNode) {
        console.warn(
          `[DependencyAnalyzer] Field "${fieldKey}" has uiShowWhen referencing non-existent sibling "${sibling}"`
        )
        continue
      }

      if (!targetNode) continue

      // Add dependency relationship
      targetNode.dependencies.push(sibling)
      siblingNode.dependents.push(fieldKey)

      // Create edge
      const edge: DependencyEdge = {
        from: sibling,
        to: fieldKey,
        condition: schema.uiShowWhen,
        weight: schema.uiOrder || 999,
      }

      if (!edges.has(sibling)) {
        edges.set(sibling, [])
      }
      edges.get(sibling)!.push(edge)
    }

    // Calculate depths and find roots
    const roots: string[] = []
    for (const [fieldKey, node] of Array.from(nodes.entries())) {
      if (node.dependencies.length === 0) {
        roots.push(fieldKey)
      }
    }

    // Calculate depth for each node using BFS
    this.calculateDepths(nodes, roots)

    // Generate topological order
    const topologicalOrder = this.topologicalSort(nodes, edges)

    return {
      nodes,
      edges,
      roots,
      topologicalOrder,
    }
  }

  /**
   * Calculate depth for each node in the dependency tree
   */
  private calculateDepths(nodes: Map<string, FieldNode>, roots: string[]): void {
    const visited = new Set<string>()
    const queue: Array<{ key: string; depth: number }> = roots.map((key) => ({
      key,
      depth: 0,
    }))

    while (queue.length > 0) {
      const { key, depth } = queue.shift()!

      if (visited.has(key)) continue
      visited.add(key)

      const node = nodes.get(key)
      if (!node) continue

      node.depth = depth

      // Add dependents to queue with increased depth
      for (const dependent of node.dependents) {
        queue.push({ key: dependent, depth: depth + 1 })
      }
    }
  }

  /**
   * Perform topological sort on the dependency graph
   */
  private topologicalSort(
    nodes: Map<string, FieldNode>,
    edges: Map<string, DependencyEdge[]>
  ): string[] {
    const result: string[] = []
    const visited = new Set<string>()
    const visiting = new Set<string>()

    const visit = (key: string): boolean => {
      if (visited.has(key)) return true
      if (visiting.has(key)) {
        // Cycle detected
        console.error(`[DependencyAnalyzer] Cycle detected involving field "${key}"`)
        return false
      }

      visiting.add(key)

      const node = nodes.get(key)
      if (node) {
        // Visit dependencies first
        for (const dep of node.dependencies) {
          if (!visit(dep)) return false
        }
      }

      visiting.delete(key)
      visited.add(key)
      result.push(key)

      return true
    }

    // Visit all nodes
    for (const key of Array.from(nodes.keys())) {
      if (!visited.has(key)) {
        visit(key)
      }
    }

    return result
  }

  /**
   * Detect circular dependencies in the graph
   */
  detectCycles(graph: DependencyGraph): CyclicDependency[] {
    const cycles: CyclicDependency[] = []
    const visited = new Set<string>()
    const recursionStack = new Set<string>()
    const currentPath: string[] = []

    const dfs = (key: string): boolean => {
      visited.add(key)
      recursionStack.add(key)
      currentPath.push(key)

      const node = graph.nodes.get(key)
      if (node) {
        for (const dependent of node.dependents) {
          if (!visited.has(dependent)) {
            if (dfs(dependent)) return true
          } else if (recursionStack.has(dependent)) {
            // Cycle found
            const cycleStart = currentPath.indexOf(dependent)
            const cycle = currentPath.slice(cycleStart)
            cycles.push({
              cycle,
              message: `Circular dependency detected: ${cycle.join(' → ')} → ${dependent}`,
            })
            return true
          }
        }
      }

      currentPath.pop()
      recursionStack.delete(key)
      return false
    }

    for (const key of Array.from(graph.nodes.keys())) {
      if (!visited.has(key)) {
        dfs(key)
      }
    }

    return cycles
  }

  /**
   * Validate the dependency graph
   */
  validateDependencies(graph: DependencyGraph): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Check for cycles
    const cycles = this.detectCycles(graph)
    if (cycles.length > 0) {
      errors.push(...cycles.map((c) => c.message))
    }

    // Check for invalid sibling references
    for (const [fieldKey, node] of Array.from(graph.nodes.entries())) {
      if (node.schema.uiShowWhen) {
        const { sibling } = node.schema.uiShowWhen
        if (!graph.nodes.has(sibling)) {
          warnings.push(
            `Field "${fieldKey}" references non-existent sibling "${sibling}" in uiShowWhen`
          )
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }
}
