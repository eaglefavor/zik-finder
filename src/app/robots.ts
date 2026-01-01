import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://zik-finder.vercel.app' // Update this to your custom domain if you have one

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/profile/', '/api/', '/reset-password/', '/forgot-password/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
