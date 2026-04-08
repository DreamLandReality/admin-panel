#!/usr/bin/env tsx
/**
 * Run SQL migration directly against Supabase database
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment
config({ path: path.join(__dirname, '../../.env.local') })

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[ERROR] Missing Supabase credentials')
  process.exit(1)
}

const migrationFile = process.argv[2]

if (!migrationFile) {
  console.error('[ERROR] Missing migration file')
  console.error('\nUsage:')
  console.error('  npx tsx run-migration.ts <migration-file.sql>')
  console.error('\nExample:')
  console.error('  npx tsx run-migration.ts 005_add_template_preview_image.sql')
  process.exit(1)
}

const migrationPath = path.join(__dirname, migrationFile)

if (!fs.existsSync(migrationPath)) {
  console.error(`[ERROR] Migration file not found: ${migrationFile}`)
  process.exit(1)
}

const sql = fs.readFileSync(migrationPath, 'utf-8')

console.log(`[MIGRATION] Running migration: ${migrationFile}`)
console.log('')

async function run() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // Run raw SQL
  const { error } = await supabase.rpc('exec_sql', { sql_query: sql })

  if (error) {
    // If exec_sql doesn't exist, try direct query
    console.log('[WARNING]  exec_sql function not available, trying direct query...')

    // For simple ALTER TABLE commands, we can try using the REST API
    // But this won't work for all SQL. Let's output instructions instead.
    console.log('')
    console.log('[ERROR] Unable to run migration automatically')
    console.log('')
    console.log('Please run this migration manually:')
    console.log('1. Go to: https://supabase.com/dashboard/project/_/sql')
    console.log('2. Paste and run the following SQL:')
    console.log('')
    console.log('─'.repeat(60))
    console.log(sql)
    console.log('─'.repeat(60))
    console.log('')
    process.exit(1)
  }

  console.log('[SUCCESS] Migration completed successfully!')
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
