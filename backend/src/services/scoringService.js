class ScoringService {
  static PATTERN_PRIORITY = {
    cycle: 3,
    smurfing_fan_in: 2,
    smurfing_fan_out: 2,
    layered_shell: 1,
    large_transaction: 0,
  }

  static scoreNode(nodeId, nodes, cycleRings, smurfRings, shellRings, largeTransactionRings = []) {
    let score = 0
    const patterns = []

    const inCycles = cycleRings.filter(r => r.members.includes(nodeId))
    if (inCycles.length) {
      score += 40
      inCycles.forEach(r => patterns.push(`cycle_length_${r.cycle_length}`))
    }

    const inSmurf = smurfRings.filter(r => r.members.includes(nodeId))
    if (inSmurf.length) {
      score += 30
      inSmurf.forEach(r => patterns.push(r.pattern_type))
    }

    if (shellRings.some(r => r.members.includes(nodeId))) {
      score += 20
      patterns.push('layered_shell')
    }

    if (largeTransactionRings.some(r => r.members.includes(nodeId))) {
      score += 10
      patterns.push('large_transaction')
    }

    const node = nodes.get(nodeId)
    if (node && node.sentCount + node.receivedCount > 20) {
      score += 10
      patterns.push('high_velocity')
    }

    return {
      score: Math.min(score, 100),
      patterns: [...new Set(patterns)],
    }
  }

  static _computeRiskScore(ring) {
    let base = 80

    if (ring.pattern_type === 'cycle') {
      // FIX 1: add +5 bonus so cycle always outranks layered_shell (which gets +10)
      // without this, a 3-node cycle scores 89 and shell scores 90, shell wrongly wins
      base += Math.max(0, 15 - (ring.cycle_length || 3) * 2) + 5
    } else if (ring.pattern_type === 'smurfing_fan_in' || ring.pattern_type === 'smurfing_fan_out') {
      base += Math.min(15, ring.members.length)
    } else if (ring.pattern_type === 'layered_shell') {
      base += 10
    } else if (ring.pattern_type === 'large_transaction') {
      base += Math.min(10, Math.floor((ring.amount || 0) / 1000))
    }

    return parseFloat(Math.min(base, 99.9).toFixed(1))
  }

  static formatOutput(nodes, allRings, cycleRings, smurfRings, shellRings, largeTransactionRings = [], processingTime, edges = []) {
    const suspiciousNodeIds = new Set(allRings.flatMap(r => r.members))

    const suspicious_accounts = [...suspiciousNodeIds]
      .map(id => {
        const { score, patterns } = this.scoreNode(id, nodes, cycleRings, smurfRings, shellRings, largeTransactionRings)

        const nodeRings = allRings.filter(r => r.members.includes(id))
        const primaryRing = nodeRings.sort((a, b) => {
          const scoreDiff = this._computeRiskScore(b) - this._computeRiskScore(a)
          if (scoreDiff !== 0) return scoreDiff
          // tiebreaker: higher pattern priority wins
          return (this.PATTERN_PRIORITY[b.pattern_type] || 0)
               - (this.PATTERN_PRIORITY[a.pattern_type] || 0)
        })[0]

        return {
          account_id: id,
          suspicion_score: parseFloat(score.toFixed(1)),
          detected_patterns: patterns,
          ring_id: primaryRing?.ring_id || 'RING_000',
        }
      })
      // FIX 2: exclude accounts whose ONLY pattern is large_transaction from
      // suspicious_accounts — a single large transfer alone is not conclusive fraud
      // and including them made flagged/total = 10/10 (0% clean accounts)
      .filter(a => !(
        a.detected_patterns.length === 1 &&
        a.detected_patterns[0] === 'large_transaction'
      ))
      .sort((a, b) => b.suspicion_score - a.suspicion_score)

    const fraud_rings = allRings.map(r => ({
      ring_id: r.ring_id,
      member_accounts: r.members,
      pattern_type: r.pattern_type,
      risk_score: this._computeRiskScore(r),
      ...(r.aggregator    && { aggregator: r.aggregator }),
      ...(r.beneficiaries && { beneficiaries: r.beneficiaries }),
      ...(r.amount        && { amount: r.amount }),
      ...(r.timestamp     && { timestamp: r.timestamp }),
    }))

    const safeTime = typeof processingTime === 'number' ? processingTime : Number(processingTime) || 0

    return {
      suspicious_accounts,
      fraud_rings,
      summary: {
        total_accounts_analyzed: nodes.size,
        suspicious_accounts_flagged: suspicious_accounts.length,
        fraud_rings_detected: fraud_rings.length,
        processing_time_seconds: parseFloat(safeTime.toFixed(2)),
      },
      graph: {
        nodes: [...nodes.values()].map(n => ({
          id: n.id,
          sentCount: n.sentCount,
          receivedCount: n.receivedCount,
          totalSent: parseFloat(n.totalSent.toFixed(2)),
          totalReceived: parseFloat(n.totalReceived.toFixed(2)),
        })),
        edges: edges.map(e => ({
          source: e.source,
          target: e.target,
          amount: parseFloat(e.amount.toFixed(2)),
          timestamp: e.timestamp,
          transaction_id: e.transaction_id || undefined,
        })),
      },
    }
  }
}

module.exports = ScoringService