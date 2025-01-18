import { useEffect, useState } from 'react'
import FingerprintJS from '@fingerprintjs/fingerprintjs'
import { LoadingSpinner } from '@/components/LoadingSpinner'

interface AirQualityData {
  ParameterName: string;
  AQI: number;
  Category: {
    Number: number;
    Name: string;
  };
  StateCode: string;
}

interface AirQualityDisplayProps {
  lat: number;
  lng: number;
}

interface CategoryInfo {
  color: string;
  textColor: string;
  message: string;
}

const AQI_CATEGORIES: Record<string, CategoryInfo> = {
  'Good': {
    color: 'text-green-500',
    textColor: 'text-green-700',
    message: 'Air quality is satisfactory. Outdoor activities are safe.'
  },
  'Moderate': {
    color: 'text-yellow-500',
    textColor: 'text-yellow-700',
    message: 'Air quality is acceptable. However, there may be a risk for some people, particularly those who are unusually sensitive to air pollution.'
  },
  'Unhealthy for Sensitive Groups': {
    color: 'text-orange-500',
    textColor: 'text-orange-700',
    message: 'Members of sensitive groups may experience health effects. The general public is less likely to be affected.'
  },
  'Unhealthy': {
    color: 'text-red-500',
    textColor: 'text-red-700',
    message: 'Some members of the general public may experience health effects; members of sensitive groups may experience more serious health effects.'
  },
  'Very Unhealthy': {
    color: 'text-purple-500',
    textColor: 'text-purple-700',
    message: 'Health alert: The risk of health effects is increased for everyone.'
  },
  'Hazardous': {
    color: 'text-rose-700',
    textColor: 'text-rose-900',
    message: 'Health warning: everyone may experience more serious health effects.'
  }
};

export default function AirQualityDisplay({ lat, lng }: AirQualityDisplayProps) {
  const [aqiData, setAqiData] = useState<AirQualityData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const getValueByParameter = (data: AirQualityData[], parameterName: string): string => {
    let measurement;
    if (parameterName === 'PM2.5') {
      // Try PM25 first (AQICN format), then PM2.5 (AirNow format)
      measurement = data.find(item => item.ParameterName === 'PM25' || item.ParameterName === 'PM2.5');
    } else {
      measurement = data.find(item => item.ParameterName === parameterName);
    }
    return measurement ? measurement.AQI.toString() : 'N/A';
  };

  const getMainAQI = (data: AirQualityData[]): { aqi: number; category: string; isInternational: boolean } => {
    if (!data || data.length === 0) {
      return { aqi: 0, category: 'Good', isInternational: false };
    }

    // Try PM25 first (AQICN format), then PM2.5 (AirNow format)
    const pm25Data = data.find(item => item.ParameterName === 'PM25' || item.ParameterName === 'PM2.5');
    
    if (pm25Data) {
      return { 
        aqi: pm25Data.AQI, 
        category: pm25Data.Category.Name,
        isInternational: pm25Data.StateCode === 'INT'
      };
    }

    // If no PM2.5 data, find the measurement with the highest AQI
    const highestAQI = data.reduce((max: AirQualityData | null, item: AirQualityData) => {
      return (!max || item.AQI > max.AQI) ? item : max;
    }, null);

    return highestAQI 
      ? {
          aqi: highestAQI.AQI,
          category: highestAQI.Category.Name,
          isInternational: highestAQI.StateCode === 'INT'
        }
      : { aqi: 0, category: 'Good', isInternational: false };
  };

  useEffect(() => {
    const fetchAQIData = async () => {
      try {
        setLoading(true);
        setError(null);
        const fp = await FingerprintJS.load()
        const { visitorId } = await fp.get()

        // First try with rounded coordinates for cache
        const roundedLat = Number(lat).toFixed(2);
        const roundedLng = Number(lng).toFixed(2);

        // Try cache first with rounded coordinates
        let response = await fetch(
          `/api/air-quality?lat=${roundedLat}&lng=${roundedLng}&type=cached`,
          {
            cache: 'force-cache',
          }
        );

        let data = await response.json();

        // If no data with rounded coordinates, try exact coordinates
        if (!response.ok || !data || (Array.isArray(data) && data.length === 0)) {
          console.log('No data with rounded coordinates, trying exact coordinates');
          response = await fetch(
            `/api/air-quality?lat=${lat}&lng=${lng}&type=exact`,
            {
              cache: 'no-store', // Don't cache exact coordinate requests
            }
          );
          data = await response.json();
        }

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch AQI data');
        }
        
        // Validate that we have valid data
        if (!Array.isArray(data) || data.length === 0) {
          throw new Error('No air quality data available for this location');
        }

        // Validate that we have valid AQI values
        const validData = data.filter(item => 
          item && 
          typeof item.AQI === 'number' && 
          !isNaN(item.AQI) &&
          item.Category?.Name
        );

        if (validData.length === 0) {
          throw new Error('No valid air quality measurements available');
        }

        setAqiData(validData);
      } catch (err) {
        console.error('AQI fetch error:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch AQI data');
        setAqiData([]); // Clear any previous data
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

  const { aqi, category, isInternational } = getMainAQI(aqiData);
  const categoryInfo = AQI_CATEGORIES[category] || AQI_CATEGORIES['Good'];

  return (
    <div className="flex justify-center w-full">
      <div className="bg-white rounded-lg px-5 py-4 shadow-lg max-w-[300px] w-full border border-gray-100 hover:border-gray-200 transition-all">
        <div className="flex justify-between items-center mb-1">
          <div className="text-lg font-semibold text-black">Current AQI</div>
          <div className="text-xs text-gray-400 italic">via {isInternational ? 'AQICN' : 'AirNow'}</div>
        </div>

        <div className="flex justify-between items-start">
          <div>
            <div className={`text-6xl font-bold ${categoryInfo.color} mb-0.5`}>{aqi}</div>
            <div className={`${categoryInfo.textColor}`}>{category}</div>
          </div>
          <div className="text-gray-700 text-xs text-left max-w-[160px] mt-1">
            {categoryInfo.message}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="text-center">
            <div className="text-sm text-gray-500">PM2.5</div>
            <div className="text-lg font-semibold">{getValueByParameter(aqiData, 'PM2.5') || getValueByParameter(aqiData, 'PM25')}</div>
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