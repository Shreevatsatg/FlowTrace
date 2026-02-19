class LargeTransactionDetector {
  // Configurable threshold — $3000 is a common baseline;
  // real systems often use $10,000 (CTR threshold in the US)
  static THRESHOLD = 3000
  static ringCounter = 3000

  static detect(edges) {
    const rings = []

    for (const edge of edges) {
      if (edge.amount >= this.THRESHOLD) {
        rings.push({
          ring_id: `RING_LT${String(this.ringCounter++).padStart(3, '0')}`,
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