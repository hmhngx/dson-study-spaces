const express = require('express');
const fs = require('fs');
const path = require('path');
const { getSupabase } = require('../db');
const { buildingSlug } = require('../utils/buildingSlug');

const router = express.Router();

function loadBuildingsStatic() {
  const filePath = path.join(__dirname, '../data/data.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

let BUILDINGS_STATIC;
function getBuildingsStatic() {
  if (!BUILDINGS_STATIC) {
    BUILDINGS_STATIC = loadBuildingsStatic();
  }
  return BUILDINGS_STATIC;
}

function isLibraryOpen(library, datetime) {
  const day = datetime.toLocaleString('en-US', { weekday: 'long' });
  if (!library.hours || !library.hours[day] || library.hours[day].length !== 2) return false;
  const hoursToday = library.hours[day];
  const [start, end] = hoursToday;
  if (start === '00:00' && end === '24:00') return true;
  const [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = end.split(':').map(Number);
  const startTime = startHour * 60 + startMinute;
  const endTime = endHour * 60 + endMinute;
  const currentTime = datetime.getHours() * 60 + datetime.getMinutes();
  return currentTime >= startTime && currentTime <= endTime;
}

function loadStaticBuildings() {
  const current = new Date();
  return getBuildingsStatic().map((building) => ({
    ...building,
    coords: building.coords ?? [40.2025, -77.1989],
    status: isLibraryOpen(building, current) ? 'Open' : 'Closed',
    image: building.image ?? building.image_url ?? null,
    slug: buildingSlug(building.name),
  }));
}

async function mergeSupabaseBuildingIds(buildings, logger) {
  try {
    const supabase = getSupabase();
    const { data: dbRows, error } = await supabase.from('buildings').select('id, name');
    if (error) {
      logger.warn('Building UUID lookup failed: %s', error.message);
      return buildings.map((b) => ({ ...b, id: b.slug }));
    }
    const idByName = new Map((dbRows ?? []).map((row) => [row.name, row.id]));
    return buildings.map((b) => ({
      ...b,
      id: idByName.get(b.name) ?? b.slug,
    }));
  } catch (err) {
    logger.warn('Building UUID merge skipped: %s', err.message);
    return buildings.map((b) => ({ ...b, id: b.slug }));
  }
}

function createBuildingsRouter(logger) {
  router.get('/', async (req, res) => {
    try {
      const staticBuildings = loadStaticBuildings();
      const data = await mergeSupabaseBuildingIds(staticBuildings, logger);
      res.set('Cache-Control', 'public, max-age=300');
      res.json({ data });
      logger.info('Successfully fetched building data');
    } catch (error) {
      logger.error(`Error processing data: ${error.message}`);
      res.status(500).json({ error: 'Failed to load data.' });
    }
  });

  return router;
}

module.exports = createBuildingsRouter;
