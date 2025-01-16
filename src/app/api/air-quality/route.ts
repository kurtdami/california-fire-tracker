import { NextRequest, NextResponse } from 'next/server';

// Cache duration in seconds (1 hour = 3600 seconds)
const CACHE_DURATION = 3600;

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const latitude = searchParams.get('lat');
    const longitude = searchParams.get('lng');

    if (!latitude || !longitude) {
      return NextResponse.json(
        { error: 'Latitude and longitude are required parameters' },
        { status: 400 }
      );
    }

    // Add check for API key
    const apiKey = process.env.AIR_QUALITY_API_KEY;
    if (!apiKey) {
      console.error('AIR_QUALITY_API_KEY is not configured');
      return NextResponse.json(
        { error: 'API configuration error' },
        { status: 500 }
      );
    }

    // Create a unique cache key based on coordinates
    // Round coordinates to 1 decimal place to create a ~4 mile grid
    const roundedLat = Number(latitude).toFixed(1); // ~4.3 miles at equator
    const roundedLng = Number(longitude).toFixed(1);
    const cacheKey = `aqi-${roundedLat}-${roundedLng}`;

    console.log('Cache grid coordinates:', { roundedLat, roundedLng });
    console.log('Original coordinates:', { latitude, longitude });

    const url = `https://www.airnowapi.org/aq/observation/latLong/current/?format=application/json&latitude=${latitude}&longitude=${longitude}&distance=25&API_KEY=${apiKey}`;

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
      next: {
        revalidate: CACHE_DURATION,
        tags: [cacheKey] // Add cache tag for this specific location
      }
    });

    console.log('AirNow API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('AirNow API error response:', errorText);
      throw new Error(`Failed to fetch air quality data: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log('AirNow API data received:', data);

    return new NextResponse(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        // Use Vary header to ensure cache varies by location
        'Vary': 'x-vercel-ip-latitude, x-vercel-ip-longitude',
        // Cache for 30 minutes
        'Cache-Control': 'max-age=0',
        'CDN-Cache-Control': `public, s-maxage=${CACHE_DURATION}, stale-while-revalidate`,
        'Vercel-CDN-Cache-Control': `public, s-maxage=${CACHE_DURATION}, stale-while-revalidate`,
      },
    });

  } catch (error) {
    console.error('Error fetching air quality data:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch air quality data' },
      { status: 500 }
    );
  }
} 