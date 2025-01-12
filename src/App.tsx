/// <reference types="react" />
import React, { useEffect, useState } from 'react';
import { RefreshCw, AlertTriangle, Flame, LogOut } from 'lucide-react';
import { LoadingSpinner } from './components/LoadingSpinner';
import { calculateDistance } from './utils/distance';
import type { FireData, FireFeature, EvacuationData, EvacuationFeature } from './types';

function App() {
  const [location, setLocation] = useState<GeolocationPosition | null>(null);
  const [locationError, setLocationError] = useState<string>('');
  const [fireData, setFireData] = useState<FireFeature[]>([]);
  const [evacuationData, setEvacuationData] = useState<EvacuationFeature[]>([]);
  const [loading, setLoading] = useState(true);
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
  } | null>(null);

  const fetchFireData = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        'https://corsproxy.io/?https://incidents.fire.ca.gov/umbraco/api/IncidentApi/GeoJsonList?inactive=true'
      );
      if (!response.ok) throw new Error('Failed to fetch fire data');
      
      const data: FireData = await response.json();
      const activeFires = data.features.filter(
        (fire: FireFeature) => fire.properties.IsActive
      );
      setFireData(activeFires);
      setError('');
    } catch (err) {
      console.error('Fire data fetch error:', err);
      setError('Failed to fetch fire data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchEvacuationData = async () => {
    try {
      const response = await fetch(
        'https://rdipowerplatformfd-e5hhgqaahef7fbdr.a02.azurefd.net/evacuations/evacuations-gj.json'
      );
      if (!response.ok) throw new Error('Failed to fetch evacuation data');
      
      const data: EvacuationData = await response.json();
      console.log('First evacuation zone data:', data.features[0]?.properties);
      console.log('Sample last_updated type:', typeof data.features[0]?.properties.last_updated);
      const activeEvacuations = data.features.filter(
        (zone: EvacuationFeature) => zone.properties.zone_status === "Evacuation Order"
      );
      setEvacuationData(activeEvacuations);
    } catch (err) {
      console.error('Evacuation data fetch error:', err);
      setError((prev: string) => prev ? `${prev}. Also failed to fetch evacuation data` : 'Failed to fetch evacuation data');
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
      const startTime = performance.now();
      let totalPoints = 0;

      const zones = evacuationData.map((zone: EvacuationFeature) => {
        const points = zone.geometry.coordinates[0];
        totalPoints += points.length;
        const distances = points.map(([lon, lat]: [number, number]) => 
          calculateDistance(
            location.coords.latitude,
            location.coords.longitude,
            lat,
            lon
          )
        );
        return {
          zone,
          distance: Math.min(...distances)
        };
      });

      const closest = zones.reduce((prev: { zone: EvacuationFeature; distance: number }, current: { zone: EvacuationFeature; distance: number }) => 
        prev.distance < current.distance ? prev : current
      );

      const endTime = performance.now();
      setComputationStats({
        totalPoints,
        computationTime: endTime - startTime
      });

      setClosestEvacZone(closest);
    }
  }, [location, evacuationData]);

  const handleRefresh = () => {
    getLocation();
    fetchFireData();
    fetchEvacuationData();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 p-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Flame className="text-red-500" />
              California Fire Tracker
            </h1>
            <LoadingSpinner />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Flame className="text-red-500" />
              California Fire Tracker
            </h1>
            <button
              onClick={handleRefresh}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Refresh data"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {locationError && (
            <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
              {locationError}
            </div>
          )}

          <div className="text-sm text-gray-400 mb-4 italic">
            Note: Evacuation zone distances are more accurate as they consider the actual affected area boundaries.
          </div>

          {closestEvacZone && (
            <div className={`rounded-lg p-6 mb-4 ${
              closestEvacZone.distance <= 5 
                ? 'bg-red-100 border-2 border-red-500' 
                : 'bg-blue-50 border-2 border-blue-200'
            }`}>
              {closestEvacZone.distance <= 5 ? (
                <div className="flex items-center gap-2 text-red-600 font-bold mb-4">
                  <LogOut />
                  EVACUATION ORDER NEARBY!
                </div>
              ) : (
                <div className="flex items-center gap-2 text-blue-600 font-bold mb-4">
                  <LogOut />
                  Monitoring Nearby Evacuation Orders
                </div>
              )}
              <h2 className="text-xl font-semibold mb-2">
                Nearest Evacuation Zone
              </h2>
              <div className={`space-y-2 ${
                closestEvacZone.distance <= 5 
                  ? 'text-red-900' 
                  : 'text-blue-900'
              }`}>
                <p><strong>Zone Name:</strong> {closestEvacZone.zone.properties.zone_id} ({closestFire?.fire.properties.Name || 'Unknown Fire'})</p>
                <p><strong>Distance:</strong> {closestEvacZone.distance.toFixed(1)} miles</p>
                <p><strong>Status:</strong> {closestEvacZone.zone.properties.zone_status}</p>
                <p><strong>Updated:</strong> {(() => {
                  const timestamp = closestEvacZone.zone.properties.last_updated;
                  if (!timestamp) return 'Not available';
                  try {
                    const date = new Date(timestamp);
                    return date.toLocaleString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZoneName: 'short'
                    });
                  } catch (e) {
                    console.error('Error parsing timestamp:', e);
                    return 'Invalid timestamp';
                  }
                })()}</p>
              </div>
            </div>
          )}

          {closestFire && (
            <div className="rounded-lg p-6 mb-4 bg-gray-50 border-2 border-gray-200">
              <h2 className="text-xl font-semibold mb-2">
                Nearest Active Fire
              </h2>
              <div className="space-y-2 text-gray-900">
                <p><strong>Name:</strong> {closestFire.fire.properties.Name}</p>
                <p><strong>Distance:</strong> {closestFire.distance.toFixed(1)} miles</p>
                <p><strong>Location:</strong> {closestFire.fire.properties.Location}</p>
                <p><strong>County:</strong> {closestFire.fire.properties.County}</p>
                <p><strong>Acres Burned:</strong> {closestFire.fire.properties.AcresBurned.toLocaleString()}</p>
                <p><strong>Containment:</strong> {closestFire.fire.properties.PercentContained}%</p>
                <p><strong>Started:</strong> {new Date(closestFire.fire.properties.Started).toLocaleDateString()}</p>
              </div>
            </div>
          )}

          <div className="text-sm text-gray-500 space-y-1">
            <div>
              Showing data for {fireData.length} active fires and {evacuationData.length} evacuation zones in California
            </div>
            {computationStats && (
              <div className="text-xs text-gray-400">
                Calculated distances to {computationStats.totalPoints.toLocaleString()} evacuation zone points in {computationStats.computationTime.toFixed(2)}ms
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;