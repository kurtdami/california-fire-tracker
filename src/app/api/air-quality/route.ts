import { NextRequest, NextResponse } from 'next/server';

const AIR_QUALITY_API_KEY = process.env.AIR_QUALITY_API_KEY;
const AIRNOW_BASE_URL = 'https://www.airnowapi.org/aq/observation/latLong/current';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const latitude = searchParams.get('latitude');
    const longitude = searchParams.get('longitude');

    if (!latitude || !longitude) {
      return NextResponse.json(
        { error: 'Latitude and longitude are required parameters' },
        { status: 400 }
      );
    }

    if (!AIR_QUALITY_API_KEY) {
      return NextResponse.json(
        { error: 'Air quality API key not configured' },
        { status: 500 }
      );
    }

    const params = new URLSearchParams({
      format: 'application/json',
      latitude: latitude,
      longitude: longitude,
      distance: '25',
      API_KEY: AIR_QUALITY_API_KEY
    });

    const response = await fetch(`${AIRNOW_BASE_URL}?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`AirNow API responded with status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Air quality API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch air quality data' },
      { status: 500 }
    );
  }
} 