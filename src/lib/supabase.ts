import { createClient } from '@supabase/supabase-js';

// FORCE HARDCODED VALUES - DEBUGGING MODE
// We are ignoring process.env completely to rule out Vercel configuration errors.
const supabaseUrl = 'https://wammuxdrpyhppdyhsxam.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhbW11eGRycHlocHBkeWhzeGFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyMjU5NjYsImV4cCI6MjA4MTgwMTk2Nn0.am7bJAME3vsmCRMfI9hyw3bkEICmu9YbD1bWTceZf9U';

console.log('Initializing Supabase with Hardcoded Credentials...');
console.log('URL:', supabaseUrl);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
