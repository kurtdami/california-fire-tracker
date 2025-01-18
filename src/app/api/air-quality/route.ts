import { NextRequest, NextResponse } from 'next/server';

// Cache duration in seconds (1 hour = 3600 seconds)
const CACHE_DURATION = 3600;

// Add revalidate for Next.js route segment config
export const revalidate = CACHE_DURATION;

export const runtime = 'edge';

async function fetchAQICNData(latitude: string, longitude: string) {
  const apiKey = process.env.AQICN_API_KEY;
  if (!apiKey) {
    throw new Error('AQICN_API_KEY is not configured');
  }

  const url = `https://api.waqi.info/feed/geo:${latitude};${longitude}/?token=${apiKey}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`AQICN API error: ${response.status}`);
  }

  const data = await response.json();
  
  // Enhanced validation for AQICN data
  if (
    data.status === 'error' || 
    !data.data || 
    data.data === 'Unknown station' ||
    typeof data.data.aqi !== 'number' ||
    isNaN(data.data.aqi)
  ) {
    console.log('Invalid or missing AQICN data:', data);
    return null;
  }

  // Map AQI value to AirNow category
  let category = {
    Number: 1,
    Name: 'Good'
  };
  const aqi = data.data.aqi;
  if (aqi > 300) {
    category = { Number: 6, Name: 'Hazardous' };
  } else if (aqi > 200) {
    category = { Number: 5, Name: 'Very Unhealthy' };
  } else if (aqi > 150) {
    category = { Number: 4, Name: 'Unhealthy' };
  } else if (aqi > 100) {
    category = { Number: 3, Name: 'Unhealthy for Sensitive Groups' };
  } else if (aqi > 50) {
    category = { Number: 2, Name: 'Moderate' };
  }

  // Transform AQICN data to match AirNow format
  return [{
    DateObserved: data.data.time.iso.split('T')[0],
    HourObserved: parseInt(data.data.time.iso.split('T')[1].split(':')[0]),
    LocalTimeZone: data.data.time.tz,
    ReportingArea: data.data.city?.name || 'Unknown',
    StateCode: 'INT', // International
    Latitude: latitude,
    Longitude: longitude,
    ParameterName: data.data.dominentpol?.toUpperCase() || 'PM2.5',
    AQI: data.data.aqi,
    Category: category
  }];
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Get both rounded (for cache) and exact coordinates
    const roundedLat = searchParams.get('lat');
    const roundedLng = searchParams.get('lng');
    const exactLat = searchParams.get('exactLat');
    const exactLng = searchParams.get('exactLng');

    if (!roundedLat || !roundedLng || !exactLat || !exactLng) {
      return NextResponse.json(
        { error: 'Both rounded and exact coordinates are required' },
        { status: 400 }
      );
    }

    // Add check for API key
    const airNowApiKey = process.env.AIR_QUALITY_API_KEY;
    if (!airNowApiKey) {
      console.error('AIR_QUALITY_API_KEY is not configured');
      return NextResponse.json(
        { error: 'API configuration error' },
        { status: 500 }
      );
    }

    // Workflow:
    // 1. Try with rounded coordinates (cache check happens at Vercel edge)
    // 2. If no data, use exact coordinates
    // 3. If still no data, try AQICN fallback
    
    let airNowResponse;
    let airNowData;

    // Step 1: Try with rounded coordinates (Vercel edge will check cache)
    console.log('Checking cache with rounded coordinates:', { roundedLat, roundedLng });
    const roundedUrl = `https://www.airnowapi.org/aq/observation/latLong/current/?format=application/json&latitude=${roundedLat}&longitude=${roundedLng}&distance=25&API_KEY=${airNowApiKey}`;
    
    airNowResponse = await fetch(roundedUrl, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (airNowResponse.ok) {
      airNowData = await airNowResponse.json();
      if (airNowData && airNowData.length > 0) {
        console.log('Got data with rounded coordinates');
        return new NextResponse(JSON.stringify(airNowData), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=0',
            'CDN-Cache-Control': `public, s-maxage=${CACHE_DURATION}`,
            'Vercel-CDN-Cache-Control': `public, s-maxage=${CACHE_DURATION}, stale-while-revalidate=60`,
          },
        });
      }
    }

    // Step 2: No data with rounded coordinates, try exact coordinates
    console.log('No data with rounded coordinates, trying exact coordinates:', { exactLat, exactLng });
    const exactUrl = `https://www.airnowapi.org/aq/observation/latLong/current/?format=application/json&latitude=${exactLat}&longitude=${exactLng}&distance=25&API_KEY=${airNowApiKey}`;
    
    airNowResponse = await fetch(exactUrl, {
      headers: { 'Content-Type': 'application/json' }
    });

    if (airNowResponse.ok) {
      airNowData = await airNowResponse.json();
      if (airNowData && airNowData.length > 0) {
        console.log('Got data with exact coordinates');
        return new NextResponse(JSON.stringify(airNowData), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=0',
            'CDN-Cache-Control': `public, s-maxage=${CACHE_DURATION}`,
            'Vercel-CDN-Cache-Control': `public, s-maxage=${CACHE_DURATION}, stale-while-revalidate=60`,
          },
        });
      }
    }

    // Step 3: No AirNow data at all, try AQICN fallback
    console.log('No AirNow data available, trying AQICN fallback');
    try {
      const aqicnData = await fetchAQICNData(exactLat, exactLng);
      if (aqicnData) {
        console.log('Got AQICN data');
        return new NextResponse(JSON.stringify(aqicnData), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=0',
            'CDN-Cache-Control': `public, s-maxage=${CACHE_DURATION}`,
            'Vercel-CDN-Cache-Control': `public, s-maxage=${CACHE_DURATION}, stale-while-revalidate=60`,
          },
        });
      }
    } catch (aqicnError) {
      console.error('AQICN fallback failed:', aqicnError);
    }

    // No data from any source
    return NextResponse.json(
      { error: 'No air quality data available for this location' },
      { status: 404 }
    );

  } catch (error) {
    console.error('Error fetching air quality data:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch air quality data' },
      { status: 500 }
    );
  }
} 