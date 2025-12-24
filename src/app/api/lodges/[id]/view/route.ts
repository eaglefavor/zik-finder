import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wammuxdrpyhppdyhsxam.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhbW11eGRycHlocHBkeWhzeGFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyMjU5NjYsImV4cCI6MjA4MTgwMTk2Nn0.am7bJAME3vsmCRMfI9hyw3bkEICmu9YbD1bWTceZf9U';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> } // Correct type for Next.js 15+ params
) {
  const resolvedParams = await params;
  const id = resolvedParams.id;

  if (!id) {
    return NextResponse.json({ error: 'Missing lodge ID' }, { status: 400 });
  }

  const { error } = await supabase.rpc('increment_lodge_views', { row_id: id });

  if (error) {
    console.error('Error incrementing views:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
