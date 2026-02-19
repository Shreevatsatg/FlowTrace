class SmurfingDetector {
  // FIX: threshold of 10 was too high for realistic transaction graphs.
  // Lowered to 3 so fan-in patterns like B1,B2,B4 -> B3 are actually detected.
  // Also added TIME_WINDOW_MS so fan-in/out only counts transactions that happen
  // close together in time (a hallmark of smurfing), rather than any transaction ever.
  static FAN_IN_THRESHOLD = 3
  static FAN_OUT_THRESHOLD = 3
  static TIME_WINDOW_MS = 24 * 60 * 60 * 1000 // 24 hours

  static detect(nodes, edges) {
    const rings = []
    let ringCounter = 1000

    for (const [id] of nodes) {
      const incomingEdges = edges.filter(e => e.target === id)
      const outgoingEdges = edges.filter(e => e.source === id)

      // Fan-in: many senders → one account within a time window
      const fanInGroups = this._groupByTimeWindow(incomingEdges)
      for (const group of fanInGroups) {
        const uniqueSenders = [...new Set(group.map(e => e.source))]
        if (uniqueSenders.length >= this.FAN_IN_THRESHOLD) {
          // FIX: also capture downstream beneficiaries — accounts that receive
          // funds from the aggregator shortly after (B9 in the B3 smurfing case)
          const downstream = [...new Set(outgoingEdges.map(e => e.target))]

          rings.push({
            ring_id: `RING_S${String(ringCounter++).padStart(3, '0')}`,
            members: [id, ...uniqueSenders, ...downstream],
            pattern_type: 'smurfing_fan_in',
            aggregator: id,
            beneficiaries: downstream,
          })
        }
      }

      // Fan-out: one account → many receivers within a time window
      const fanOutGroups = this._groupByTimeWindow(outgoingEdges)
      for (const group of fanOutGroups) {
        const uniqueReceivers = [...new Set(group.map(e => e.target))]
        if (uniqueReceivers.length >= this.FAN_OUT_THRESHOLD) {
          rings.push({
            ring_id: `RING_S${String(ringCounter++).padStart(3, '0')}`,
            members: [id, ...uniqueReceivers],
            pattern_type: 'smurfing_fan_out',
            disperser: id,
          })
        }
      }
    }

    return rings
  }

  // Groups edges into windows where all transactions fall within TIME_WINDOW_MS of the earliest
  static _groupByTimeWindow(edges) {
    if (edges.length === 0) return []

    // Sort by timestamp ascending
    const sorted = [...edges].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    const groups = []
    let windowStart = new Date(sorted[0].timestamp).getTime()
    let currentGroup = []

    for (const edge of sorted) {
      const t = new Date(edge.timestamp).getTime()
      if (t - windowStart <= this.TIME_WINDOW_MS) {
        currentGroup.push(edge)
      } else {
        if (currentGroup.length > 0) groups.push(currentGroup)
        currentGroup = [edge]
        windowStart = t
      }
    }
    if (currentGroup.length > 0) groups.push(currentGroup)

    return groups
  }
}

module.exports = SmurfingDetector