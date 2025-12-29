// This is a new, simplified logic for notifications.
// It will run entirely on the client-side for clarity and ease of debugging.
// This script assumes the `views` column and `increment_lodge_view` RPC function from `reimplement_notifications.sql` exist.

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAppContext } from '@/lib/context';

// Define milestones
const MILESTONES = [10, 50, 100, 250, 500, 1000];

export function useLodgeViewTracker(lodgeId: string) {
  const { user } = useAppContext();

  useEffect(() => {
    if (!lodgeId) return;

    let isMounted = true;

    const handleView = async () => {
      // 1. Increment the view count via RPC.
      const { error: rpcError } = await supabase.rpc('increment_lodge_view', {
        p_lodge_id: lodgeId,
      });

      if (rpcError) {
        console.error('Error incrementing view:', rpcError.message);
        return;
      }
      
      if (!isMounted) return;

      // 2. Fetch lodge data for milestones and recommendations
      const { data: lodgeData, error: selectError } = await supabase
        .from('lodges')
        .select('views, landlord_id, title, location')
        .eq('id', lodgeId)
        .single();
      
      if (selectError || !lodgeData) return;

      const { views, landlord_id, title, location } = lodgeData;

      // --- Logic A: Landlord Milestone Notifications ---
      if (MILESTONES.includes(views)) {
        await supabase
          .from('notifications')
          .insert({
            user_id: landlord_id,
            title: '🎉 Lodge View Milestone!',
            message: `Your lodge "${title}" has reached ${views} views! Keep up the good work.`,
            type: 'success',
            link: `/lodge/${lodgeId}`,
          });
      }

      // --- Logic B: Student Recommendations (Similar Lodges) ---
      // Only for logged-in students viewing other people's lodges
      if (user && user.id !== landlord_id) {
        try {
          // 1. Track view history in localStorage
          const historyKey = 'zik_view_history';
          const sentRecsKey = 'zik_rec_sent_locations';
          
          const rawHistory = localStorage.getItem(historyKey);
          const history: { id: string; location: string }[] = rawHistory ? JSON.parse(rawHistory) : [];
          
          // Add current view if not already there
          if (!history.find(h => h.id === lodgeId)) {
            history.push({ id: lodgeId, location });
            localStorage.setItem(historyKey, JSON.stringify(history.slice(-20))); // Keep last 20
          }

          // 2. Check if we should recommend
          const areaViews = history.filter(h => h.location === location);
          const rawSentRecs = localStorage.getItem(sentRecsKey);
          const sentRecs: string[] = rawSentRecs ? JSON.parse(rawSentRecs) : [];

          if (areaViews.length >= 3 && !sentRecs.includes(location)) {
            // Find a high-performing lodge in the same area not yet viewed
            const viewedIds = history.map(h => h.id);
            const { data: rec } = await supabase
              .from('lodges')
              .select('id, title, location')
              .eq('location', location)
              .not('id', 'in', `(${viewedIds.join(',')})`)
              .order('views', { ascending: false })
              .limit(1)
              .single();

            if (rec) {
              // Send recommendation notification to the student
              await supabase.from('notifications').insert({
                user_id: user.id,
                title: 'Still looking? 🧐',
                message: `Students interested in ${location} also liked "${rec.title}". Check it out!`,
                type: 'info',
                link: `/lodge/${rec.id}`
              });

              // Mark as sent for this location to avoid spamming
              sentRecs.push(location);
              localStorage.setItem(sentRecsKey, JSON.stringify(sentRecs));
            }
          }
        } catch (err) {
          console.error('Recommendation engine error:', err);
        }
      }
    };

    handleView();

    return () => {
      isMounted = false;
    };
  }, [lodgeId, user]);
}
