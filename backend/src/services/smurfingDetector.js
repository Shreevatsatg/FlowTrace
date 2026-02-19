class SmurfingDetector {
  static detect(nodes, edges) {
    const rings = []
    let ringCounter = 1000

    for (const [id] of nodes) {
      // Fan-in: many senders → one account
      const uniqueSenders = [...new Set(edges.filter(e => e.target === id).map(e => e.source))]
      if (uniqueSenders.length >= 10) {
        rings.push({
          ring_id: `RING_S${String(ringCounter++).padStart(3, '0')}`,
          members: [id, ...uniqueSenders],
          pattern_type: 'smurfing_fan_in',
          aggregator: id,
        })
      }

      // Fan-out: one account → many receivers
      const uniqueReceivers = [...new Set(edges.filter(e => e.source === id).map(e => e.target))]
      if (uniqueReceivers.length >= 10) {
        rings.push({
          ring_id: `RING_S${String(ringCounter++).padStart(3, '0')}`,
          members: [id, ...uniqueReceivers],
          pattern_type: 'smurfing_fan_out',
          disperser: id,
        })
      }
    }

    return rings
  }
}

module.exports = SmurfingDetector