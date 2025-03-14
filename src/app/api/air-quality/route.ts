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
    const latitude = searchParams.get('lat');
    const longitude = searchParams.get('lng');
    const requestType = searchParams.get('type') || 'check-cache';

    if (!latitude || !longitude) {
      return NextResponse.json(
        { error: 'Latitude and longitude are required' },
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

    // Fetch from AirNow API
    const airNowUrl = `https://www.airnowapi.org/aq/observation/latLong/current/?format=application/json&latitude=${latitude}&longitude=${longitude}&distance=25&API_KEY=${airNowApiKey}`;
    
    console.log(`Fetching ${requestType} air quality data:`, { latitude, longitude });
    
    const airNowResponse = await fetch(airNowUrl, {
      headers: { 'Content-Type': 'application/json' }
    });

    if (!airNowResponse.ok) {
      const errorText = await airNowResponse.text();
      console.error('AirNow API error response:', errorText);
      throw new Error(`Failed to fetch air quality data: ${airNowResponse.status} ${errorText}`);
    }

    const airNowData = await airNowResponse.json();

    // If AirNow returns data, use it
    if (airNowData && airNowData.length > 0) {
      console.log('Got AirNow data');
      return new NextResponse(JSON.stringify(airNowData), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          // Cache headers for fresh data (from exact coordinates)
          ...(requestType === 'fetch-fresh' ? {
            'Cache-Control': 'public, max-age=0',
            'CDN-Cache-Control': `public, s-maxage=${CACHE_DURATION}`,
            'Vercel-CDN-Cache-Control': `public, s-maxage=${CACHE_DURATION}, stale-while-revalidate=60`,
          } : {
            'Cache-Control': 'no-store', // Don't cache check-cache responses
          }),
        },
      });
    }

    // If no AirNow data, try AQICN
    console.log('No AirNow data available, trying AQICN fallback');
    try {
      const aqicnData = await fetchAQICNData(latitude, longitude);
      if (aqicnData) {
        console.log('Got AQICN data');
        return new NextResponse(JSON.stringify(aqicnData), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            // Cache headers for fresh data (from exact coordinates)
            ...(requestType === 'fetch-fresh' ? {
              'Cache-Control': 'public, max-age=0',
              'CDN-Cache-Control': `public, s-maxage=${CACHE_DURATION}`,
              'Vercel-CDN-Cache-Control': `public, s-maxage=${CACHE_DURATION}, stale-while-revalidate=60`,
            } : {
              'Cache-Control': 'no-store', // Don't cache check-cache responses
            }),
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