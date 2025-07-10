const fetch = require('node-fetch')
const parse = require('csv-parse/sync').parse

// Vercel Serverless Function Behavior:
// This in-memory cache is per function instance.
// Data will be cached within a single warm instance of the function.
// Cold starts or different instances will have separate caches.
// For persistent, shared caching and true background updates on Vercel,
// consider using Vercel KV and Vercel Cron Jobs.
let cachedData = null;
let lastCacheTime = 0;

const TAM_DATA_ENDPOINT = "http://data.montpellier3m.fr/sites/default/files/ressources/TAM_MMM_TpsReel.csv"

const updateCache = async () => {
  console.log("Updating cache...");
  try {
    const tamCSV = await (await fetch(TAM_DATA_ENDPOINT)).text();
    const records = parse(tamCSV, {
      columns: true,
      skip_empty_lines: true,
      delimiter: ';',
    });
    cachedData = records;
    lastCacheTime = Date.now();
    console.log("Cache updated successfully.");
  } catch (error) {
    console.error("Error updating cache:", error);
    // Depending on requirements, we might want to re-throw or handle differently
    throw error; // Re-throw so the main handler knows update failed
  }
};

// Attempt to pre-warm the cache when the function instance starts.
updateCache();

const CACHE_DURATION_MS = 60 * 1000; // 1 minute

module.exports = async (req, res) => {
  let result;
  const filters = req.query;

  try {
    if (cachedData !== null && (Date.now() - lastCacheTime < CACHE_DURATION_MS)) {
      console.log("Serving from cache...");
      try {
        result = cachedData.filter(r =>
          Object.keys(filters).every(key => r[key] == filters[key].toUpperCase())
        );
      } catch (e) {
        console.error("Error filtering from cache:", e);
        return res.json({ success: false, error: "Error processing cached data" });
      }
    } else {
      console.log("Cache stale or empty, updating...");
      await updateCache(); // This will throw if update fails
      // After update, cachedData should be populated (or an error thrown)
      if (!cachedData) { // Should not happen if updateCache throws on error, but as a safeguard
        console.error("Cache update failed to populate data.");
        return res.json({ success: false, error: "Failed to retrieve data." });
      }
      try {
        result = cachedData.filter(r =>
          Object.keys(filters).every(key => r[key] == filters[key].toUpperCase())
        );
      } catch (e) {
        console.error("Error filtering after cache update:", e);
        return res.json({ success: false, error: "Error processing updated data" });
      }
    }
    res.json({
      success: true,
      result: result,
    });
  } catch (error) {
    // This will catch errors from updateCache() or any other unexpected errors
    console.error("Overall error in handler:", error);
    res.json({
      success: false,
      error: error.message || "An unexpected server error occurred.",
    });
  }
};

// (async () => {
// const mockReq = { query: {"stop_name": "ANTIGONE", "trip_headsign": "MOSSON" } };
// const mockRes = { json: (data) => console.log(JSON.stringify(data, null, 2)) };
// await module.exports(mockReq, mockRes);
// await module.exports(mockReq, mockRes); // To test cache
// })();

if (process.env.NODE_ENV === 'test') {
  module.exports.testExports = {
    updateCache,
    get cachedData() { return cachedData; },
    set cachedData(value) { cachedData = value; },
    get lastCacheTime() { return lastCacheTime; },
    set lastCacheTime(value) { lastCacheTime = value; },
    CACHE_DURATION_MS
  };
}
