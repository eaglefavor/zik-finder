// This is a new, simplified logic for notifications.
// It will run entirely on the client-side for clarity and ease of debugging.
// This script assumes the `views` column and `increment_lodge_view` RPC function from `reimplement_notifications.sql` exist.

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Lodge } from '@/lib/types';

// Define milestones
const MILESTONES = [10, 50, 100, 250, 500, 1000];

export function useLodgeViewTracker(lodgeId: string) {
  useEffect(() => {
    if (!lodgeId) return;

    let isMounted = true;

    const handleView = async () => {
      // 1. Increment the view count via RPC.
      // We don't need the return value, just that it executes.
      const { error: rpcError } = await supabase.rpc('increment_lodge_view', {
        p_lodge_id: lodgeId,
      });

      if (rpcError) {
        console.error('Error incrementing view:', rpcError.message);
        return;
      }
      
      // If component is unmounted after RPC, abort.
      if (!isMounted) return;

      // 2. Fetch the *new* view count directly from the database.
      const { data: lodgeData, error: selectError } = await supabase
        .from('lodges')
        .select('views, landlord_id, title')
        .eq('id', lodgeId)
        .single();
      
      if (selectError) {
        console.error('Error fetching new view count:', selectError.message);
        return;
      }

      if (!lodgeData) return;

      const { views, landlord_id, title } = lodgeData;

      // 3. Check if the new count is a milestone.
      if (MILESTONES.includes(views)) {
        console.log(`Milestone reached: ${views} views! Sending notification...`);
        // 4. If it is, insert a notification for the landlord.
        const { error: insertError } = await supabase
          .from('notifications')
          .insert({
            user_id: landlord_id,
            title: '🎉 Lodge View Milestone!',
            message: `Your lodge "${title}" has reached ${views} views! Keep up the good work.`,
            type: 'success',
            link: `/lodge/${lodgeId}`,
          });

        if (insertError) {
          console.error('Failed to insert milestone notification:', insertError.message);
        } else {
          console.log('Notification sent successfully!');
        }
      }
    };

    handleView();

    return () => {
      isMounted = false;
    };
  }, [lodgeId]);
}
