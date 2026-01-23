import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseAnonKey } from '@/lib/supabase';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  
  if (!query) {
    return NextResponse.json({ data: [] });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // Perform a robust search using 'or' filter for multiple columns
  // Note: For production, a Full Text Search (FTS) index on a dedicated column is better,
  // but 'ilike' is sufficient for this scale.
  const { data, error } = await supabase
    .from('lodges')
    .select('id, title, price, location, image_urls, units:lodge_units(name, price, available_units)')
    .eq('status', 'available')
    .or(`title.ilike.%${query}%,location.ilike.%${query}%,description.ilike.%${query}%`)
    .limit(20);

  if (error) {
    console.error('Search API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
