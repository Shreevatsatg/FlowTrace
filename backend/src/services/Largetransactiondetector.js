class LargeTransactionDetector {
  static THRESHOLD = 3000

  static detect(edges) {
    const rings = []
    // FIX: counter was a static class property that persisted across requests,
    // causing ring IDs to increment on every API call (RING_LT3000, LT3001, LT3039...).
    // Reset it locally inside detect() so every call starts fresh from 3000.
    let ringCounter = 3000

    for (const edge of edges) {
      if (edge.amount >= this.THRESHOLD) {
        rings.push({
          ring_id: `RING_LT${String(ringCounter++).padStart(3, '0')}`,
          members: [edge.source, edge.target],
          pattern_type: 'large_transaction',
          amount: edge.amount,
          timestamp: edge.timestamp,
          transaction_id: edge.transaction_id || undefined,
        })
      }
    }

    return rings
  }
}

module.exports = LargeTransactionDetector