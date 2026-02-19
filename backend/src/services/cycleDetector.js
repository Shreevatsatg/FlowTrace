class CycleDetector {
  static detect(adjList, nodes) {
    const rings = []
    const seenKeys = new Map()
    let ringCounter = 1

    for (const start of nodes.keys()) {
      const dfs = (current, path, visited) => {
        if (path.length > 5) return
        const neighbors = adjList.get(current) || []
        for (const next of neighbors) {
          if (next === start && path.length >= 3) {
            const key = [...path].sort().join(',')
            if (!seenKeys.has(key)) {
              seenKeys.set(key, true)
              rings.push({
                ring_id: `RING_${String(ringCounter++).padStart(3, '0')}`,
                members: [...path],
                pattern_type: 'cycle',
                cycle_length: path.length,
              })
            }
          } else if (!visited.has(next) && !path.includes(next)) {
            visited.add(next)
            path.push(next)
            dfs(next, path, visited)
            path.pop()
            visited.delete(next)
          }
        }
      }
      dfs(start, [start], new Set([start]))
    }

    return rings
  }
}

module.exports = CycleDetector