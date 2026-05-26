require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in back-end/.env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function seedBuildings() {
  const dataPath = path.resolve(__dirname, '../api/data/data.json');
  const raw = fs.readFileSync(dataPath, 'utf-8');
  const buildings = JSON.parse(raw);

  const mappedData = buildings.map((item) => ({
    name: item.name,
    latitude: item.coords[0],
    longitude: item.coords[1],
    address: item.address,
    hours: item.hours,
    rating: item.rating,
    image_url: item.image,
  }));

  console.log(`Seeding ${mappedData.length} buildings into Supabase...`);

  const { data, error } = await supabase
    .from('buildings')
    .upsert(mappedData, { onConflict: 'name' });

  if (error) {
    console.error('Seed failed:', error.message);
    process.exit(1);
  }

  console.log(`Successfully seeded ${mappedData.length} buildings.`);
}

seedBuildings();
