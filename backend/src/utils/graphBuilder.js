class GraphBuilder {
  static build(transactions) {
    const nodes = new Map()
    const adjList = new Map()
    const edges = []

    transactions.forEach(tx => {
      const { sender_id, receiver_id, amount, timestamp } = tx
      const amt = parseFloat(amount) || 0

      ;[sender_id, receiver_id].forEach(id => {
        if (!nodes.has(id)) {
          nodes.set(id, { id, sentCount: 0, receivedCount: 0, totalSent: 0, totalReceived: 0, timestamps: [] })
        }
        if (!adjList.has(id)) adjList.set(id, [])
      })

      const sNode = nodes.get(sender_id)
      sNode.sentCount++
      sNode.totalSent += amt
      sNode.timestamps.push(timestamp)

      const rNode = nodes.get(receiver_id)
      rNode.receivedCount++
      rNode.totalReceived += amt
      rNode.timestamps.push(timestamp)

      adjList.get(sender_id).push(receiver_id)
      edges.push({ source: sender_id, target: receiver_id, amount: amt, timestamp })
    })

    return { nodes, adjList, edges }
  }
}

module.exports = GraphBuilder