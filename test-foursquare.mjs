// Run with: node test-foursquare.mjs YOUR_API_KEY
import https from 'https';

const apiKey = process.argv[2];
if (!apiKey) { console.error('Usage: node test-foursquare.mjs <API_KEY>'); process.exit(1); }

const params = new URLSearchParams({
  query: 'ramen',
  near: 'Ottawa',
  categories: '13065',
  limit: '3',
  fields: 'fsq_place_id,name,location',
});

const options = {
  hostname: 'places-api.foursquare.com',
  path: `/places/search?${params}`,
  method: 'GET',
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'X-Places-Api-Version': '2025-06-17',
    Accept: 'application/json',
  },
  timeout: 10000,
};

console.log(`GET https://${options.hostname}${options.path}`);
console.log('Headers:', JSON.stringify(options.headers, null, 2));

const req = https.request(options, (res) => {
  const chunks = [];
  res.on('data', c => chunks.push(c));
  res.on('end', () => {
    const body = Buffer.concat(chunks).toString();
    console.log(`\nStatus: ${res.statusCode}`);
    console.log('Response headers:', JSON.stringify(res.headers, null, 2));
    console.log('Body:', body.slice(0, 1000));
  });
});
req.on('timeout', () => { console.error('TIMEOUT after 10s'); req.destroy(); });
req.on('error', e => console.error('ERROR:', e));
req.end();
