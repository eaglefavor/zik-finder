import { MetadataRoute } from 'next'
import { supabase } from '@/lib/supabase'

export const revalidate = 3600 // Revalidate every hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://zik-finder.vercel.app' // Update this to your custom domain if you have one

  // Fetch all available lodges to generate dynamic routes
  const { data: lodges } = await supabase
    .from('lodges')
    .select('id, updated_at')
    .eq('status', 'available')
    .order('updated_at', { ascending: false })
    .limit(1000)

  const lodgeUrls = (lodges || []).map((lodge) => ({
    url: `${baseUrl}/lodge/${lodge.id}`,
    lastModified: new Date(lodge.updated_at || new Date()),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/search`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/market`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    ...lodgeUrls,
  ]
}
