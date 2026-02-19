const csv = require('csv-parse/sync')

class CSVParser {
  static parse(buffer) {
    const records = csv.parse(buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    })
    return records.filter(r => r.transaction_id && r.sender_id && r.receiver_id)
  }
}

module.exports = CSVParser