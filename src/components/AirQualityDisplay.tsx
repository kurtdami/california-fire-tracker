import React from 'react';

interface AirQualityData {
  ParameterName: string;
  AQI: number;
  Category: {
    Name: string;
  };
}

interface AirQualityDisplayProps {
  airQualityData: AirQualityData[];
}

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

export default function AirQualityDisplay({ airQualityData }: AirQualityDisplayProps) {
  const { aqi, category } = getMainAQI(airQualityData);
  
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
            <div className="text-lg font-semibold">{getValueByParameter(airQualityData, 'PM2.5')}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-500">PM10</div>
            <div className="text-lg font-semibold">{getValueByParameter(airQualityData, 'PM10')}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-500">Ozone</div>
            <div className="text-lg font-semibold">{getValueByParameter(airQualityData, 'O3')}</div>
          </div>
        </div>
      </div>
    </div>
  );
} 