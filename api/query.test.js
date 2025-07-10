// To run: NODE_ENV=test node api/query.test.js
const assert = require('assert');
const queryHandler = require('./query.js');
const { updateCache, cachedData: getCachedData, lastCacheTime: getLastCacheTime, CACHE_DURATION_MS } = queryHandler.testExports;

// --- Mocking node-fetch ---
let mockCsvData = `stop_id;stop_name;trip_headsign;departure_time
1;ANTIGONE;MOSSON;10:00
2;RIVES DU LEZ;ODYSSEUM;10:05
3;ANTIGONE;PABLO PICASSO;10:10`;

const originalFetch = global.fetch; // Store original fetch if any
global.fetch = async (url) => {
  console.log(`Mock fetch called for URL: ${url}`);
  if (url.includes('TAM_MMM_TpsReel.csv')) {
    return {
      text: async () => {
        console.log("Mock fetch returning CSV data:\n", mockCsvData);
        return mockCsvData;
      },
    };
  }
  throw new Error(`Unhandled mock fetch URL: ${url}`);
};
// --- End Mocking node-fetch ---

// Helper to reset cache state for tests
function resetCacheState() {
  queryHandler.testExports.cachedData = null;
  queryHandler.testExports.lastCacheTime = 0;
  console.log("Cache state reset");
}

// Helper to simulate a request
async function simulateRequest(query) {
  let resData;
  const req = { query };
  const res = {
    json: (data) => {
      console.log("mock res.json called with:", data);
      resData = data;
    },
  };
  await queryHandler(req, res);
  return resData;
}

// --- Test Suite ---
async function runTests() {
  console.log("Starting tests...");

  // Test Case 1: Initial fetch and cache population
  await (async function testInitialFetch() {
    console.log("\n--- Test Case 1: Initial fetch and cache population ---");
    resetCacheState();
    mockCsvData = `stop_name;trip_headsign
ANTIGONE;MOSSON
RIVES DU LEZ;ODYSSEUM`;
    
    const result = await simulateRequest({ stop_name: 'ANTIGONE' });
    assert.ok(result.success, "Test Case 1 Failed: success should be true");
    assert.strictEqual(result.result.length, 1, "Test Case 1 Failed: Should find 1 matching stop");
    assert.strictEqual(result.result[0].trip_headsign, 'MOSSON', "Test Case 1 Failed: Incorrect trip_headsign");
    
    assert.ok(getCachedData() !== null, "Test Case 1 Failed: cachedData should be populated");
    assert.ok(getLastCacheTime() > 0, "Test Case 1 Failed: lastCacheTime should be updated");
    console.log("Test Case 1 Passed.");
  })();

  // Test Case 2: Serving from cache
  await (async function testServeFromCache() {
    console.log("\n--- Test Case 2: Serving from cache ---");
    // Cache should be populated from Test Case 1
    
    // Modify mockCsvData - this should NOT be fetched if cache works
    mockCsvData = `stop_name;trip_headsign
NEW DATA;SHOULD NOT APPEAR
OTHER DATA;ALSO NOT APPEAR`;

    const result = await simulateRequest({ stop_name: 'ANTIGONE' });
    assert.ok(result.success, "Test Case 2 Failed: success should be true");
    assert.strictEqual(result.result.length, 1, "Test Case 2 Failed: Should find 1 matching stop from cache");
    assert.strictEqual(result.result[0].trip_headsign, 'MOSSON', "Test Case 2 Failed: Incorrect trip_headsign from cache");
    console.log("Test Case 2 Passed.");
  })();

  // Test Case 3: Cache expiration and update
  await (async function testCacheExpiration() {
    console.log("\n--- Test Case 3: Cache expiration and update ---");
    // Manually expire cache
    queryHandler.testExports.lastCacheTime = Date.now() - CACHE_DURATION_MS - 1000; // Expire cache by setting time to past
    
    mockCsvData = `stop_name;trip_headsign
EXPIRED_ANTIGONE;NEW_MOSSON
EXPIRED_RIVES;NEW_ODYSSEUM`;

    const result = await simulateRequest({ stop_name: 'EXPIRED_ANTIGONE' });
    assert.ok(result.success, "Test Case 3 Failed: success should be true");
    assert.strictEqual(result.result.length, 1, "Test Case 3 Failed: Should find 1 matching stop after cache expiry");
    assert.strictEqual(result.result[0].trip_headsign, 'NEW_MOSSON', "Test Case 3 Failed: Incorrect trip_headsign after cache expiry");
    console.log("Test Case 3 Passed.");
  })();

  // Test Case 4: Correct filtering
  await (async function testFiltering() {
    console.log("\n--- Test Case 4: Correct filtering ---");
    resetCacheState(); // Reset for a clean slate
    mockCsvData = `stop_name;trip_headsign;line_id
ANTIGONE;MOSSON;1
RIVES DU LEZ;ODYSSEUM;1
ANTIGONE;PABLO PICASSO;2
GARES;MOSSON;1`;
    
    // Force cache update with this new data
    await queryHandler.testExports.updateCache();

    const result = await simulateRequest({ stop_name: 'ANTIGONE', trip_headsign: 'MOSSON' });
    assert.ok(result.success, "Test Case 4a Failed: success should be true");
    assert.strictEqual(result.result.length, 1, "Test Case 4a Failed: Should find 1 specific stop");
    assert.strictEqual(result.result[0].line_id, '1', "Test Case 4a Failed: Incorrect line_id for specific filter");

    const result2 = await simulateRequest({ line_id: '1' });
    assert.ok(result2.success, "Test Case 4b Failed: success should be true");
    assert.strictEqual(result2.result.length, 2, "Test Case 4b Failed: Should find 2 stops for line_id 1");
    
    const result3 = await simulateRequest({ stop_name: 'NONEXISTENT' });
    assert.ok(result3.success, "Test Case 4c Failed: success should be true for non-existent");
    assert.strictEqual(result3.result.length, 0, "Test Case 4c Failed: Should find 0 stops for non-existent name");

    console.log("Test Case 4 Passed.");
  })();


  console.log("\nAll tests completed.");
  // Restore original fetch if it was mocked
  if (originalFetch) global.fetch = originalFetch;
}

runTests().catch(err => {
  console.error("Test suite failed:", err);
  if (originalFetch) global.fetch = originalFetch; // Ensure fetch is restored on error
  process.exit(1);
});
