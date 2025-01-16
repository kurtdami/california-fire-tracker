import { useEffect, useState } from 'react'
import FingerprintJS from '@fingerprintjs/fingerprintjs'
import { LoadingSpinner } from '@/components/LoadingSpinner'

interface AirQualityData {
  ParameterName: string;
  AQI: number;
  Category: {
    Name: string;
  };
}

interface AirQualityDisplayProps {
  lat: number;
  lng: number;
}

export default function AirQualityDisplay({ lat, lng }: AirQualityDisplayProps) {
  const [aqiData, setAqiData] = useState<AirQualityData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const getValueByParameter = (data: AirQualityData[], parameterName: string): string => {
    const measurement = data.find(item => item.ParameterName === parameterName);
    return measurement ? measurement.AQI.toString() : 'N/A';
  };

  const getMainAQI = (data: AirQualityData[]): { aqi: number; category: string } => {
    const pm25Data = data.find(item => item.ParameterName === 'PM2.5');
    return pm25Data 
      ? { aqi: pm25Data.AQI, category: pm25Data.Category.Name }
      : { aqi: 0, category: 'N/A' };
  };

  useEffect(() => {
    const fetchAQIData = async () => {
      try {
        setLoading(true);
        const fp = await FingerprintJS.load()
        const { visitorId } = await fp.get()

        const response = await fetch(
          `/api/air-quality?lat=${lat}&lng=${lng}&deviceId=${visitorId}`,
          {
            cache: 'force-cache',
          }
        )

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch AQI data');
        }

        const data = await response.json();
        setAqiData(data);
      } catch (err) {
        console.error('AQI fetch error:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch AQI data');
      } finally {
        setLoading(false);
      }
    };

    if (lat && lng) {
      fetchAQIData();
    }
  }, [lat, lng]);

  if (loading) return <div className="flex justify-center w-full"><LoadingSpinner /></div>;
  if (error) return <div className="text-red-500">Error: {error}</div>;
  if (!aqiData.length) return <div>No air quality data available</div>;

  const { aqi, category } = getMainAQI(aqiData);

  return (
    <div className="flex justify-center w-full">
      <div className="bg-white rounded-lg px-5 py-4 shadow-lg max-w-[300px] w-full border border-gray-100 hover:border-gray-200 transition-all">
        <div className="flex justify-between items-center mb-1">
          <div className="text-lg font-semibold text-black">Current AQI</div>
          <div className="text-xs text-gray-500">via AirNow</div>
        </div>

        <div className="flex justify-between items-start">
          <div>
            <div className="text-6xl font-bold text-green-500 mb-0.5">{aqi}</div>
            <div className="text-gray-600">{category}</div>
          </div>
          <div className="text-gray-700 text-xs text-left max-w-[160px] mt-1">
            Air quality is satisfactory.
            Outdoor activities are safe.
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="text-center">
            <div className="text-sm text-gray-500">PM2.5</div>
            <div className="text-lg font-semibold">{getValueByParameter(aqiData, 'PM2.5')}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-500">PM10</div>
            <div className="text-lg font-semibold">{getValueByParameter(aqiData, 'PM10')}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-500">Ozone</div>
            <div className="text-lg font-semibold">{getValueByParameter(aqiData, 'O3')}</div>
          </div>
        </div>
      </div>
    </div>
  );
} 