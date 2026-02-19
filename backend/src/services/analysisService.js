const CSVParser = require('../utils/csvParser')
const GraphBuilder = require('../utils/graphBuilder')
const CycleDetector = require('./cycleDetector')
const SmurfingDetector = require('./smurfingDetector')
const ShellDetector = require('./shellDetector')
const LargeTransactionDetector = require('./largeTransactionDetector')
const ScoringService = require('./scoringService')

class AnalysisService {
  static async analyze(fileBuffer) {
    const startTime = performance.now()

    // Parse CSV
    const transactions = CSVParser.parse(fileBuffer)
    if (transactions.length === 0) {
      throw new Error('CSV contains no valid transactions')
    }

    // Build graph
    const { nodes, adjList, edges } = GraphBuilder.build(transactions)

    // Run detection algorithms
    const cycleRings = CycleDetector.detect(adjList, nodes)
    const smurfRings = SmurfingDetector.detect(nodes, edges)
    const shellRings = ShellDetector.detect(nodes, adjList)
    const largeTransactionRings = LargeTransactionDetector.detect(edges)
    const allRings = [...cycleRings, ...smurfRings, ...shellRings, ...largeTransactionRings]

    const processingTime = (performance.now() - startTime) / 1000

    return ScoringService.formatOutput(
      nodes, allRings, cycleRings, smurfRings, shellRings, largeTransactionRings, processingTime, edges
    )
  }
}

module.exports = AnalysisService