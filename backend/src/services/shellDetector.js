class ShellDetector {
  static detect(nodes, adjList) {
    const rings = []
    // Use a canonical sorted key to prevent permutation duplicates
    const detected = new Set()
    let ringCounter = 2000

    for (const [id, node] of nodes) {
      const totalTx = node.sentCount + node.receivedCount
      if (totalTx >= 2 && totalTx <= 3) {
        const chain = [id]

        const findChain = (current, depth) => {
          if (depth >= 3) {
            // FIX: use sorted join as canonical key — prevents A1->A2->A3 and A2->A3->A1 being treated as different rings
            const key = [...chain].sort().join(',')
            if (!detected.has(key)) {
              detected.add(key)
              rings.push({
                ring_id: `RING_L${String(ringCounter++).padStart(3, '0')}`,
                members: [...chain],
                pattern_type: 'layered_shell',
                depth,
              })
            }
            return
          }
          for (const next of (adjList.get(current) || [])) {
            if (!chain.includes(next)) {
              const nextNode = nodes.get(next)
              if (nextNode && nextNode.sentCount + nextNode.receivedCount <= 3) {
                chain.push(next)
                findChain(next, depth + 1)
                chain.pop()
              }
            }
          }
        }

        findChain(id, 1)
      }
    }

    return rings
  }
}

module.exports = ShellDetector