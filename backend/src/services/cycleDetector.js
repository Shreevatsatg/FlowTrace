class CycleDetector {
  static detect(adjList, nodes) {
    const rings = []
    const seenKeys = new Map()
    let ringCounter = 1

    for (const start of nodes.keys()) {
      // FIX: visited was being passed by reference across sibling DFS branches,
      // causing some valid paths to be skipped. Now visited is derived fresh
      // from path at each call, ensuring siblings don't block each other.
      const dfs = (current, path) => {
        if (path.length > 5) return

        const neighbors = adjList.get(current) || []
        for (const next of neighbors) {
          if (next === start && path.length >= 3) {
            // Canonical key: sort members so A1->A2->A3 and A2->A3->A1 are the same ring
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
          } else if (!path.includes(next)) {
            // FIX: no separate visited set needed — path itself tracks visited nodes,
            // and we shouldn't prevent revisiting a node via a different sibling path
            path.push(next)
            dfs(next, path)
            path.pop()
          }
        }
      }

      dfs(start, [start])
    }

    return rings
  }
}

module.exports = CycleDetector