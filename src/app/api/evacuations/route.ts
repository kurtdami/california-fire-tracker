import { NextResponse } from 'next/server';
import type { EvacuationData } from '@/types';

// Make this an Edge Function for better latency
export const runtime = 'edge';

export async function GET(request: Request) {
  const startTime = performance.now();
  const requestId = Math.random().toString(36).substring(7);

  try {
    console.log(`[Evac API] [${requestId}] Request received at ${new Date().toISOString()}`);
    
    const response = await fetch(
      process.env.NEXT_PUBLIC_EVACUATION_API_URL as string,
      {
        next: {
          revalidate: 3600, // Cache for 60 minutes
          tags: ['evacuations']
        },
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate'
        }
      }
    );

    if (!response.ok) {
      console.error(`[Evac API] [${requestId}] External API error: ${response.status} ${response.statusText}`);
      throw new Error('Failed to fetch evacuation data');
    }

    const data: EvacuationData = await response.json();
    const activeEvacuations = data.features.filter(
      (zone) => 
        zone.properties.zone_status === "Evacuation Order" && 
        zone.properties.zone_status_reason?.toLowerCase().indexOf('flooding') === -1
    );

    // Log performance and cache status
    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);
    const cacheStatus = response.headers.get('x-vercel-cache') || 'MISS';
    console.log(`[Evac API] [${requestId}] Completed in ${duration}ms | Cache: ${cacheStatus} | Active Zones: ${activeEvacuations.length}`);

    return NextResponse.json(
      { features: activeEvacuations },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate',
          'X-Response-Time': duration.toString(),
          'X-Cache-Status': cacheStatus
        },
      }
    );
  } catch (error) {
    console.error(`[Evac API] [${requestId}] Error:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch evacuation data' },
      { status: 500 }
    );
  }
} 