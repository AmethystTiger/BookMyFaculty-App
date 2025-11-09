#!/usr/bin/env node

// Script to apply Supabase migration for fixing rebooking constraint
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Error: Supabase credentials not found in environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runMigration() {
  try {
    console.log('🔄 Applying migration to fix rebooking constraint...\n');

    // Read the migration SQL
    const migrationSQL = readFileSync('supabase/migrations/20251109054035_fix_rebooking_constraint.sql', 'utf-8');
    
    // Extract the actual SQL commands (remove comments)
    const sqlCommands = migrationSQL
      .split('\n')
      .filter(line => !line.trim().startsWith('--') && line.trim())
      .join('\n');

    console.log('📝 Executing SQL:\n');
    console.log(sqlCommands);
    console.log('\n');

    // Execute via RPC if available, otherwise show instructions
    console.log('⚠️  Note: Direct SQL execution requires admin access.');
    console.log('📋 Please run this SQL in your Supabase SQL Editor:\n');
    console.log('1. Go to https://supabase.com/dashboard');
    console.log('2. Select your project');
    console.log('3. Navigate to SQL Editor');
    console.log('4. Paste and run this SQL:\n');
    console.log('```sql');
    console.log('-- Fix rebooking issue');
    console.log('ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_slot_id_key;');
    console.log('');
    console.log('CREATE UNIQUE INDEX IF NOT EXISTS appointments_slot_id_confirmed_unique');
    console.log('ON appointments(slot_id)');
    console.log('WHERE status = \'confirmed\';');
    console.log('```\n');
    console.log('✅ After running this SQL, you\'ll be able to rebook cancelled slots!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

runMigration();
