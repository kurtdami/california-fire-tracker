import { NextResponse } from 'next/server';
import type { FireData } from '@/types';

// Add this to make it an Edge Function
export const runtime = 'edge';

export async function GET(request: Request) {
  const startTime = performance.now();
  const requestId = Math.random().toString(36).substring(7);

  try {
    console.log(`[Fires API] [${requestId}] Request received at ${new Date().toISOString()}`);
    
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_FIRE_API_URL}?inactive=true`,
      {
        next: {
          revalidate: 3600,
          tags: ['fires']
        },
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate'
        }
      }
    );

    if (!response.ok) {
      console.error(`[Fires API] [${requestId}] External API error: ${response.status} ${response.statusText}`);
      throw new Error('Failed to fetch fire data');
    }

    const data: FireData = await response.json();
    const activeFires = data.features.filter(
      (fire) => fire.properties.IsActive
    );

    // Log performance and cache status
    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);
    const cacheStatus = response.headers.get('x-vercel-cache') || 'MISS';
    console.log(`[Fires API] [${requestId}] Completed in ${duration}ms | Cache: ${cacheStatus} | Active Fires: ${activeFires.length}`);

    return NextResponse.json(
      { features: activeFires },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate',
          'X-Response-Time': duration.toString(),
          'X-Cache-Status': cacheStatus
        },
      }
    );
  } catch (error) {
    console.error(`[Fires API] [${requestId}] Error:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch fire data' },
      { status: 500 }
    );
  }
} 