# California Fire Tracker 🔥

A real-time web application that helps users track active fires and evacuation orders in California based on their current location.

## Features

- 📍 Real-time distance calculation to nearest fires and evacuation zones
- ⚠️ Immediate alerts for evacuation orders within 5 miles
- 🗺️ Accurate distance measurements using evacuation zone boundaries
- 🔄 Live data updates from official California fire and evacuation sources
- 📱 Responsive design for both desktop and mobile devices
- ⚡ Fast computation of distances to thousands of boundary points
- 🕒 Timestamp tracking for latest evacuation order updates

## Technical Stack

- **Frontend Framework**: React with TypeScript
- **Styling**: Tailwind CSS
- **Build Tool**: Vite
- **Icons**: Lucide React
- **Data Sources**:
  - California Fire Incidents API
  - Evacuation Zones API

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm (v9 or higher)

### Installation

1. Clone the repository
```bash
git clone https://github.com/kurtdami/california-fire-tracker.git
cd california-fire-tracker
```

2. Install dependencies
```bash
npm install
```

3. Start the development server
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

### Building for Production

```bash
npm run build
```

## How It Works

The application:
1. Retrieves user's current location (with permission)
2. Fetches active fire data from California Fire Incidents API
3. Fetches evacuation order data from Evacuation Zones API
4. Calculates distances to nearest fires and evacuation zones
5. Displays warnings if evacuation zones are within 5 miles
6. Updates data periodically to ensure latest information

## Performance

- Efficiently processes thousands of evacuation zone boundary points
- Displays computation statistics for transparency
- Optimized distance calculations for quick results

## Privacy

- Location data is used only for distance calculations
- No personal data is stored or transmitted
- All calculations are performed client-side

## License

Private repository - All rights reserved

## Acknowledgments

- California Fire Incidents API
- Evacuation Zones API
- React and Vite communities
- Tailwind CSS team 