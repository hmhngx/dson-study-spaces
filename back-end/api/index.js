const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const winston = require('winston');
const { Client } = require('@googlemaps/google-maps-services-js');
const helmet = require('helmet'); // Add this line to import helmet
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3002;

// Initialize Google Maps client
const googleMapsClient = new Client({});

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Middleware
app.use(express.json());
app.use(helmet()); // This line should now work

// Add root route for testing
app.get('/', (req, res) => {
  res.json({ message: "Welcome to the Dickinson Study Spaces Backend" });
});

// Router
const router = express.Router();

// Function to set CORS headers
const setCORSHeaders = (req, res) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:3000',
    'https://front-ai52oqdor-harrison-nguyens-projects.vercel.app/home',
    undefined 
  ];
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
};

// Handle OPTIONS requests for CORS preflight
app.options('/api/buildings', (req, res) => {
  console.log('Handling OPTIONS request for /api/buildings');
  setCORSHeaders(req, res);
  res.status(200).end();
});

// Function to check if a library is open
const isLibraryOpen = (library, datetime) => {
  const day = datetime.toLocaleString('en-US', { weekday: 'long' });
  if (!library.hours || !library.hours[day] || library.hours[day].length !== 2) return false;
  const hoursToday = library.hours[day];
  const [start, end] = hoursToday;
  if (start === "00:00" && end === "24:00") return true;
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  const startTime = startHour * 60 + startMinute;
  const endTime = endHour * 60 + endMinute;
  const currentTime = datetime.getHours() * 60 + datetime.getMinutes();
  return currentTime >= startTime && currentTime <= endTime;
};

// Function to geocode an address using Google Maps API
const geocodeAddress = async (address) => {
  if (!address || typeof address !== 'string') {
    logger.error(`Invalid address for geocoding: ${address}`);
    return null;
  }
  try {
    const response = await googleMapsClient.geocode({
      params: {
        address: address,
        key: process.env.GOOGLE_MAPS_API_KEY,
      },
    });
    if (response.data.status === 'OK' && response.data.results.length > 0) {
      const { lat, lng } = response.data.results[0].geometry.location;
      return [lat, lng];
    } else {
      throw new Error('No results found for address');
    }
  } catch (error) {
    logger.error(`Geocoding error for address ${address}: ${error.message}`);
    return null;
  }
};

// Function to calculate distance between two coordinates (simplified Vincenty)
const calculateDistance = ([lat1, lon1], [lat2, lon2]) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
};

// Function to load, enrich, and encode data
const loadData = async (userLat, userLng) => {
  const filePath = path.join(__dirname, 'data', 'data.json');
  try {
    console.log('Reading data.json from:', filePath);
    let jsonData;
    try {
      jsonData = await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.error(`data.json not found at ${filePath}`);
        return Buffer.from(JSON.stringify([])).toString('base64');
      }
      logger.error(`Error reading data.json: ${error.message}`);
      throw error;
    }

    console.log('Parsing data.json');
    let buildings;
    try {
      buildings = JSON.parse(jsonData);
    } catch (error) {
      logger.error(`Error parsing data.json: ${error.message}`);
      throw error;
    }
    console.log('Parsed buildings:', buildings.length, 'entries');
    const current = new Date();

    buildings = await Promise.all(
      buildings.map(async (building) => {
        try {
          if (!building.name) {
            logger.error('Building missing name:', building);
            return null;
          }
          // Use existing coords if provided, otherwise geocode the address
          let coords = building.coords;
          if (!coords && building.address) {
            console.log(`Geocoding address for ${building.name}: ${building.address}`);
            coords = await geocodeAddress(building.address);
            console.log(`Geocoded ${building.name} to:`, coords);
          }
          // Fallback to default coords if none are available
          coords = coords || [40.2025, -77.1989];

          const userCoords = userLat && userLng ? [parseFloat(userLat), parseFloat(userLng)] : null;
          const distance = userCoords && coords ? calculateDistance(userCoords, coords) : null;

          return {
            ...building,
            status: isLibraryOpen(building, current) ? "Open" : "Closed",
            coords: coords,
            distance: distance != null ? parseFloat(distance.toFixed(2)) : null,
            image: building.image || `https://maps.googleapis.com/maps/api/streetview?size=400x400&location=${encodeURIComponent(
              building.address || ''
            )}&key=${process.env.GOOGLE_MAPS_API_KEY}`,
          };
        } catch (error) {
          logger.error(`Error processing building ${building.name || 'unknown'}: ${error.message}`);
          return null;
        }
      })
    );

    buildings = buildings.filter(building => building !== null);
    console.log('Processed buildings:', buildings.length, 'entries');

    if (userLat && userLng) {
      buildings.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
    }

    return Buffer.from(JSON.stringify(buildings)).toString('base64');
  } catch (error) {
    logger.error(`Error in loadData: ${error.message}`);
    throw error;
  }
};

router.get('/', async (req, res) => {
  try {
    console.log('Handling GET request for /api/buildings');
    setCORSHeaders(req, res);
    const { lat, lng } = req.query;
    const encodedData = await loadData(lat, lng);
    res.set('Cache-Control', 'public, max-age=300');
    res.json({ data: encodedData });
    logger.info('Successfully fetched building data');
  } catch (error) {
    logger.error(`Error processing data: ${error.message}`);
    res.status(500).json({ error: 'Failed to load data.' });
  }
});

app.use('/api/buildings', (req, res, next) => {
  const authHeader = req.headers.authorization;
  console.log('Received Authorization Header:', authHeader);
  if (!authHeader || authHeader !== `Bearer ${process.env.API_KEY}`) {
    logger.warn('Unauthorized access attempt');
    setCORSHeaders(req, res);
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}, router);

// Start Server
app.listen(port, () => {
  logger.info(`Server running on port ${port}`);
  console.log('API_KEY:', process.env.API_KEY);
});