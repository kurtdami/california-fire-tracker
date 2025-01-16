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
  const [airQualityData, setAirQualityData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // Add component-specific loading states
  const [loadingFires, setLoadingFires] = useState(true);
  const [loadingEvac, setLoadingEvac] = useState(true);
  const [loadingAqi, setLoadingAqi] = useState(true);
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

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation(position);
        setLocationError('');
      },
      (error) => {
        setLocationError('Unable to retrieve your location');
        console.error('Geolocation error:', error);
      }
    );
  };

  const fetchAirQualityData = async (latitude: number, longitude: number) => {
    try {
      setLoadingAqi(true);
      const response = await fetch(
        `/api/air-quality?lat=${latitude}&lng=${longitude}`,
        {
          cache: 'force-cache'
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch air quality data');
      }

      const data = await response.json();
      setAirQualityData(data);
      return data;
    } catch (error) {
      console.error('Air quality data fetch error:', error);
      setError((prev) => prev ? `${prev}. Also failed to fetch air quality data` : 'Failed to fetch air quality data');
      throw error;
    } finally {
      setLoadingAqi(false);
    }
  };

  // Set overall loading state based on component loading states
  useEffect(() => {
    setLoading(loadingFires || loadingEvac || loadingAqi);
  }, [loadingFires, loadingEvac, loadingAqi]);

  useEffect(() => {
    getLocation();
    fetchFireData();
    fetchEvacuationData();
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

  useEffect(() => {
    if (location) {
      fetchAirQualityData(location.coords.latitude, location.coords.longitude);
    }
  }, [location]);

  const handleRefresh = () => {
    getLocation();
    fetchFireData();
    fetchEvacuationData();
    if (location) {
      fetchAirQualityData(location.coords.latitude, location.coords.longitude);
    }
  };

  if (loading) {
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
    <div className="min-h-screen bg-gray-50 p-4">
      <Analytics />
      <SpeedInsights />
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
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

        {/* Add Air Quality Display with its own loading state */}
        {location && (
          <div className="mb-6">
            {loadingAqi ? (
              <div className="flex justify-center w-full">
                <LoadingSpinner />
              </div>
            ) : (
              <AirQualityDisplay 
                lat={location.coords.latitude}
                lng={location.coords.longitude}
              />
            )}
          </div>
        )}

        <p className="text-gray-400 text-xs italic mb-6">
          Note: Evacuation zone distances are more accurate as they consider the actual affected area boundaries.
        </p>

        {/* Rest of the JSX with component-specific loading states */}
        {loadingFires || loadingEvac ? (
          <div className="flex justify-center w-full my-4">
            <LoadingSpinner />
          </div>
        ) : (
          <>
            {error && (
              <div className="text-red-700 mb-4 flex items-center gap-2">
                <AlertTriangle className="text-red-700" />
                {error}
              </div>
            )}

            {locationError && (
              <div className="text-red-700 mb-4">
                {locationError}
              </div>
            )}

            {showWarning && closestEvacZone && (
              <div className="bg-red-100 border-2 border-red-600 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="text-red-600" />
                  <h2 className="text-red-600 font-bold text-lg uppercase">EVACUATION ORDER NEARBY!</h2>
                </div>

                <h3 className="text-xl font-bold mb-4">Nearest Evacuation Zone</h3>

                <div className="space-y-2 text-sm pl-4">
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
              <div className="bg-[#e0f2ff] border border-[#3b82f6] rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-[#3b82f6]">🔔</span>
                  <h2 className="text-[#3b82f6] font-bold">Monitoring Nearby Evacuation Orders</h2>
                </div>

                <h3 className="text-xl font-bold mb-4">Nearest Evacuation Zone</h3>

                <div className="space-y-2 text-sm pl-4">
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

            {closestFire && (
              <div className="bg-gray-100 border border-gray-300 rounded-lg p-4 mb-4">
                <h3 className="text-xl font-bold mb-4">Nearest Active Fire</h3>
                
                <div className="space-y-2 text-sm pl-4">
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
            )}

            <p className="text-gray-400 text-xs">
              Showing data for {fireData.filter(f => f.properties.IsActive).length} active fires and {evacuationData.length} fire-related evacuation zones in California
              <br />
              Calculated distances to {computationStats?.totalPoints.toLocaleString()} evacuation zone points in {computationStats?.computationTime.toFixed(1)}ms
            </p>
          </>
        )}
      </div>
    </div>
  );
}
