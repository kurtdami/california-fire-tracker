'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, AlertTriangle, Flame } from 'lucide-react';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import AirQualityDisplay from '@/components/AirQualityDisplay';
import { calculateDistance } from '@/utils/distance';
import type { FireData, FireFeature, EvacuationData, EvacuationFeature } from '@/types';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';

// Debug function to check if Tailwind classes are being processed
const debugStyles = () => {
  console.log('Checking Tailwind processing...');
  const testElement = document.createElement('div');
  testElement.className = 'bg-red-500 p-4 m-4 rounded-lg';
  testElement.textContent = 'Test Element';
  document.body.appendChild(testElement);
  const styles = window.getComputedStyle(testElement);
  console.log('Test element styles:', {
    backgroundColor: styles.backgroundColor,
    padding: styles.padding,
    margin: styles.margin,
    borderRadius: styles.borderRadius
  });
  document.body.removeChild(testElement);
};

export default function Home() {
  // Add useEffect for debugging
  useEffect(() => {
    console.log('Component mounted');
    debugStyles();
    console.log('Current CSS classes loaded:', document.styleSheets);
  }, []);

  const [location, setLocation] = useState<GeolocationPosition | null>(null);
  const [locationError, setLocationError] = useState<string>('');
  const [fireData, setFireData] = useState<FireFeature[]>([]);
  const [evacuationData, setEvacuationData] = useState<EvacuationFeature[]>([]);
  const [loading, setLoading] = useState(true);
  // Add component-specific loading states
  const [loadingFires, setLoadingFires] = useState(true);
  const [loadingEvac, setLoadingEvac] = useState(true);
  const [error, setError] = useState<string>('');
  const [computationStats, setComputationStats] = useState<{
    totalPoints: number;
    computationTime: number;
  } | null>(null);
  const [closestFire, setClosestFire] = useState<{
    fire: FireFeature;
    distance: number;
  } | null>(null);
  const [closestEvacZone, setClosestEvacZone] = useState<{
    zone: EvacuationFeature;
    distance: number;
    associatedFire: FireFeature | null;
  } | null>(null);

  const fetchFireData = async () => {
    try {
      setLoadingFires(true);
      const response = await fetch('/api/fires');
      if (!response.ok) throw new Error('Failed to fetch fire data');
      
      const data: FireData = await response.json();
      setFireData(data.features);
      setError('');
    } catch (err) {
      console.error('Fire data fetch error:', err);
      setError('Failed to fetch fire data. Please try again.');
    } finally {
      setLoadingFires(false);
    }
  };

  const fetchEvacuationData = async () => {
    try {
      setLoadingEvac(true);
      const response = await fetch('/api/evacuations');
      if (!response.ok) throw new Error('Failed to fetch evacuation data');
      
      const data: EvacuationData = await response.json();
      setEvacuationData(data.features);
    } catch (err) {
      console.error('Evacuation data fetch error:', err);
      setError((prev) => prev ? `${prev}. Also failed to fetch evacuation data` : 'Failed to fetch evacuation data');
    } finally {
      setLoadingEvac(false);
    }
  };

  const getLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }

    // Clear any existing location error when starting a new request
    setLocationError('');
    
    let errorTimeoutId: NodeJS.Timeout;
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (errorTimeoutId) clearTimeout(errorTimeoutId);
        setLocation(position);
        setLocationError('');
      },
      (error) => {
        // Add a longer delay and only show error after initial data is loaded
        errorTimeoutId = setTimeout(() => {
          // Only show error if we still don't have location AND initial data is loaded
          if (!location && fireData.length > 0 && evacuationData.length > 0) {
            switch (error.code) {
              case error.PERMISSION_DENIED:
                setLocationError('Location permission denied. Please enable location services to see air quality data.');
                break;
              case error.POSITION_UNAVAILABLE:
                setLocationError('Location information is unavailable.');
                break;
              case error.TIMEOUT:
                setLocationError('Location request timed out.');
                break;
              default:
                setLocationError('Unable to retrieve your location. Please ensure location services are enabled.');
            }
          }
        }, 5000);  // Increased to 5 second delay before showing errors
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );

    // Set a timeout to show the error message only if geolocation takes too long
    const timeoutId = setTimeout(() => {
      if (!location && fireData.length > 0 && evacuationData.length > 0) {
        setLocationError('Unable to retrieve your location. Please ensure location services are enabled.');
      }
    }, 15000); // Increased to 15 second timeout

    return () => {
      if (errorTimeoutId) clearTimeout(errorTimeoutId);
      clearTimeout(timeoutId);
    };
  };

  // Set overall loading state based on component loading states
  useEffect(() => {
    setLoading(loadingFires || loadingEvac);
  }, [loadingFires, loadingEvac]);

  useEffect(() => {
    let mounted = true;

    const fetchInitialData = async () => {
      try {
        await Promise.all([
          fetchFireData(),
          fetchEvacuationData()
        ]);
      } catch (error) {
        console.error('Error fetching initial data:', error);
      }
    };

    getLocation();
    fetchInitialData();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (location && fireData.length > 0) {
      const fires = fireData.map((fire: FireFeature) => ({
        fire,
        distance: calculateDistance(
          location.coords.latitude,
          location.coords.longitude,
          fire.geometry.coordinates[1],
          fire.geometry.coordinates[0]
        ),
      }));

      const closest = fires.reduce((prev: { fire: FireFeature; distance: number }, current: { fire: FireFeature; distance: number }) => 
        prev.distance < current.distance ? prev : current
      );

      setClosestFire(closest);
    }
  }, [location, fireData]);

  useEffect(() => {
    if (location && evacuationData.length > 0) {
      const startTime = Date.now();
      let totalPoints = 0;

      // First find the closest evacuation zone to the user
      const zones = evacuationData.map((zone: EvacuationFeature) => {
        const points = zone.geometry.coordinates[0];
        totalPoints += points.length;
        
        // Find the closest point in this zone to the user
        let minDistance = Infinity;
        let closestPoint: [number, number] | null = null;
        
        points.forEach(([lon, lat]: [number, number]) => {
          const distance = calculateDistance(
            location.coords.latitude,
            location.coords.longitude,
            lat,
            lon
          );
          if (distance < minDistance) {
            minDistance = distance;
            closestPoint = [lon, lat];
          }
        });
        
        return {
          zone,
          distance: minDistance,
          closestPoint
        };
      });

      const closestZone = zones.reduce((prev, current) => 
        prev.distance < current.distance ? prev : current
      );

      // Use the closest point to find the nearest active fire
      if (fireData.length > 0 && closestZone.closestPoint) {
        let closestFireToZone = null;
        let minDistanceToFire = Infinity;

        const [lon, lat] = closestZone.closestPoint as [number, number];
        
        fireData.forEach(fire => {
          if (!fire.properties.Final) {
            const distanceToFire = calculateDistance(
              lat,
              lon,
              fire.properties.Latitude,
              fire.properties.Longitude
            );
            if (distanceToFire < minDistanceToFire) {
              minDistanceToFire = distanceToFire;
              closestFireToZone = fire;
            }
          }
        });

        setClosestEvacZone({
          zone: closestZone.zone,
          distance: closestZone.distance,
          associatedFire: closestFireToZone
        });
      } else {
        setClosestEvacZone({
          zone: closestZone.zone,
          distance: closestZone.distance,
          associatedFire: null
        });
      }

      const endTime = Date.now();
      setComputationStats({
        totalPoints,
        computationTime: endTime - startTime
      });
    }
  }, [location, evacuationData, fireData]);

  const handleRefresh = async () => {
    try {
      setLoading(true);
      getLocation();
      await Promise.all([
        fetchFireData(),
        fetchEvacuationData()
      ]);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Modify the initial loading check to only apply on first load
  const isInitialLoading = loading && !fireData.length && !evacuationData.length;

  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-gray-100 p-4">
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow p-8">
          <div className="flex items-center gap-2">
            <Flame className="text-red-500" />
            <h1 className="text-2xl">California Fire Tracker</h1>
          </div>
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  // Use actual logic for warning
  const showWarning = closestEvacZone && closestEvacZone.distance < 1;

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-4 p-0">
      <div className="max-w-7xl mx-auto">
        <div className="lg:grid lg:grid-cols-2 lg:gap-4">
          {/* Left Column - Information */}
          <div className="bg-white rounded-lg shadow-md p-4 mb-4 lg:mb-0 mx-4 sm:mx-0">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Flame className="text-red-500" />
                <h1 className="text-2xl font-semibold">California Fire Tracker</h1>
              </div>
              <button
                onClick={handleRefresh}
                className="p-2 rounded hover:bg-gray-100"
                aria-label="Refresh data"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>

            {locationError && !location && fireData.length > 0 && evacuationData.length > 0 && (
              <div className="text-red-700 mb-4 p-3 bg-red-50 rounded-lg border border-red-200">
                {locationError}
              </div>
            )}

            {/* Air Quality Section */}
            {location && (
              <div className="mb-4">
                {loading ? (
                  <div className="bg-white border border-gray-200 rounded-lg p-3">
                    <h3 className="text-xl font-bold mb-3">Air Quality</h3>
                    <div className="flex justify-center w-full">
                      <LoadingSpinner />
                    </div>
                  </div>
                ) : (
                  <AirQualityDisplay 
                    lat={location.coords.latitude}
                    lng={location.coords.longitude}
                  />
                )}
              </div>
            )}

            <p className="text-gray-400 text-xs italic mb-4">
              Note: Evacuation zone distances are more accurate as they consider the actual affected area boundaries.
            </p>

            {/* Evacuation Zones Section */}
            {loadingEvac ? (
              <div className="bg-gray-100 border border-gray-300 rounded-lg p-3 mb-4">
                <h3 className="text-xl font-bold mb-3">Evacuation Zones</h3>
                <div className="flex justify-center w-full">
                  <LoadingSpinner />
                </div>
              </div>
            ) : (
              <>
                {error && (
                  <div className="text-red-700 mb-4 flex items-center gap-2">
                    <AlertTriangle className="text-red-700" />
                    {error}
                  </div>
                )}

                {showWarning && closestEvacZone && (
                  <div className="bg-red-100 border-2 border-red-600 rounded-lg p-3 mb-4">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="text-red-600" />
                      <h2 className="text-red-600 font-bold text-lg uppercase">EVACUATION ORDER NEARBY!</h2>
                    </div>

                    <h3 className="text-xl font-bold mb-3">Nearest Evacuation Zone</h3>

                    <div className="space-y-2 text-sm pl-3">
                      <p className="flex">
                        <span className="text-red-800 font-bold">Zone Name:</span>
                        <span className="ml-2 text-red-800">{closestEvacZone.zone.properties.zone_id} (Eaton Fire)</span>
                      </p>
                      <p className="flex">
                        <span className="text-red-800 font-bold">Distance:</span>
                        <span className="ml-2 text-red-800">{closestEvacZone.distance.toFixed(1)} miles</span>
                      </p>
                      <p className="flex">
                        <span className="text-red-800 font-bold">Status:</span>
                        <span className="ml-2 text-red-800">{closestEvacZone.zone.properties.zone_status}</span>
                      </p>
                      <p className="flex">
                        <span className="text-red-800 font-bold">Updated:</span>
                        <span className="ml-2 text-red-800">{new Date(closestEvacZone.zone.properties.last_updated).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: 'numeric',
                          timeZoneName: 'short'
                        })}</span>
                      </p>
                    </div>
                  </div>
                )}

                {closestEvacZone && !showWarning && (
                  <div className="bg-[#e0f2ff] border border-[#3b82f6] rounded-lg p-3 mb-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[#3b82f6]">🔔</span>
                      <h2 className="text-[#3b82f6] font-bold">Monitoring Nearby Evacuation Orders</h2>
                    </div>

                    <h3 className="text-xl font-bold mb-3">Nearest Evacuation Zone</h3>

                    <div className="space-y-2 text-sm pl-3">
                      <p className="flex">
                        <span className="text-[#3b82f6] font-bold">Zone Name:</span>
                        <span className="ml-2">{closestEvacZone.zone.properties.zone_id} (Eaton Fire)</span>
                      </p>
                      <p className="flex">
                        <span className="text-[#3b82f6] font-bold">Distance:</span>
                        <span className="ml-2">{closestEvacZone.distance.toFixed(1)} miles</span>
                      </p>
                      <p className="flex">
                        <span className="text-[#3b82f6] font-bold">Status:</span>
                        <span className="ml-2">{closestEvacZone.zone.properties.zone_status}</span>
                      </p>
                      <p className="flex">
                        <span className="text-[#3b82f6] font-bold">Updated:</span>
                        <span className="ml-2">{new Date(closestEvacZone.zone.properties.last_updated).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: 'numeric',
                          timeZoneName: 'short'
                        })}</span>
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Fires Section */}
            {loadingFires ? (
              <div className="bg-gray-100 border border-gray-300 rounded-lg p-3 mb-4">
                <h3 className="text-xl font-bold mb-3">Active Fires</h3>
                <div className="flex justify-center w-full">
                  <LoadingSpinner />
                </div>
              </div>
            ) : (
              closestFire && (
                <div className="bg-gray-100 border border-gray-300 rounded-lg p-3 mb-4">
                  <h3 className="text-xl font-bold mb-3">Nearest Active Fire</h3>
                  
                  <div className="space-y-2 text-sm pl-3">
                    <p className="flex">
                      <span className="font-bold">Name:</span>
                      <span className="ml-2">{closestFire.fire.properties.Name}</span>
                    </p>
                    <p className="flex">
                      <span className="font-bold">Distance:</span>
                      <span className="ml-2">{closestFire.distance.toFixed(1)} miles</span>
                    </p>
                    <p className="flex">
                      <span className="font-bold">Location:</span>
                      <span className="ml-2">Near {closestFire.fire.properties.Location}</span>
                    </p>
                    <p className="flex">
                      <span className="font-bold">County:</span>
                      <span className="ml-2">{closestFire.fire.properties.County}</span>
                    </p>
                    <p className="flex">
                      <span className="font-bold">Acres Burned:</span>
                      <span className="ml-2">{closestFire.fire.properties.AcresBurned.toLocaleString()}</span>
                    </p>
                    <p className="flex">
                      <span className="font-bold">Containment:</span>
                      <span className="ml-2">{closestFire.fire.properties.PercentContained}%</span>
                    </p>
                    <p className="flex">
                      <span className="font-bold">Started:</span>
                      <span className="ml-2">{new Date(closestFire.fire.properties.Started).toLocaleDateString('en-US', {
                        month: 'numeric',
                        day: 'numeric',
                        year: 'numeric'
                      })}</span>
                    </p>
                  </div>
                </div>
              )
            )}

            <p className="text-gray-400 text-xs border-t border-gray-100 pt-3 mt-2">
              Showing data for {fireData.filter(f => f.properties.IsActive).length} active fires and {evacuationData.length} fire-related evacuation zones in California
              <br />
              Calculated distances to {computationStats?.totalPoints.toLocaleString()} evacuation zone points in {computationStats?.computationTime.toFixed(1)}ms
            </p>
          </div>

          {/* Right Column - Map */}
          <div className="bg-white sm:rounded-lg sm:shadow-md sm:p-4 p-0 h-full flex flex-col justify-center lg:mx-0 mx-2 mb-4">
            <h3 className="text-xl font-bold mb-3 flex items-center justify-center">
              <Flame className="mr-2 text-red-500" />
              Active Fire Map
            </h3>
            <div className="w-full h-[32rem] sm:h-[38rem] overflow-hidden sm:rounded-lg rounded-none flex items-center justify-center bg-white">
              <iframe 
                width="100%" 
                height="100%" 
                frameBorder="0" 
                scrolling="no" 
                allowFullScreen 
                src="https://arcg.is/0PyWqy1"
                className="sm:rounded-lg rounded-none"
              />
            </div>
          </div>
        </div>
      </div>
      <Analytics />
      <SpeedInsights />
    </div>
  );
}
