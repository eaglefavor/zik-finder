
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { lodgeData, units } = body;
    const authHeader = request.headers.get('Authorization');

    if (!lodgeData || !authHeader) {
      return NextResponse.json({ error: 'Missing lodgeData or Authorization header' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    // 1. Verify User
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Insert with Service Role (Atomic-ish)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false }
    });

    // Handle Lodge Insert
    let { data: newLodge, error: lodgeError } = await supabaseAdmin
      .from('lodges')
      .insert({ ...lodgeData, landlord_id: user.id })
      .select()
      .single();

    // Legacy fallback (landmark column issue)
    if (lodgeError) {
      console.warn('API: Falling back to legacy lodge insert:', lodgeError.message);
      const { landmark: _landmark, ...legacyData } = lodgeData;
      const fallback = await supabaseAdmin
        .from('lodges')
        .insert({ ...legacyData, landlord_id: user.id })
        .select()
        .single();
      
      newLodge = fallback.data;
      lodgeError = fallback.error;
    }

    if (lodgeError || !newLodge) {
        throw lodgeError || new Error('Failed to create lodge');
    }

    // 3. Handle Units
    if (units && units.length > 0) {
      const unitsToInsert = units.map((u: Record<string, unknown>) => ({ ...u, lodge_id: newLodge.id }));
      const { error: unitError } = await supabaseAdmin.from('lodge_units').insert(unitsToInsert);
      if (unitError) console.error('API: Error adding units:', unitError);
    } else {
      // Default standard unit
      const { error: unitError } = await supabaseAdmin
        .from('lodge_units')
        .insert({
          lodge_id: newLodge.id,
          name: 'Standard Room',
          price: lodgeData.price,
          total_units: 1,
          available_units: 1,
          image_urls: lodgeData.image_urls
        });
      if (unitError) console.error('API: Error creating default unit:', unitError);
    }

    return NextResponse.json({ success: true, lodgeId: newLodge.id });

  } catch (error: unknown) {
    console.error('API Lodge Create Error:', error);
    return NextResponse.json({ 
        error: error instanceof Error ? error.message : 'Internal Server Error' 
    }, { status: 500 });
  }
}
