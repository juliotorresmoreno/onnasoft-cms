import { readFileSync } from 'fs'
import { pool } from './db'

export async function runFullTextMigration() {
  console.log('Starting full-text migration...')
  const sql = readFileSync('./scripts/fulltext.sql', 'utf8')
  await pool.query(sql)

  console.log('Full-text migration completed successfully.')
}
