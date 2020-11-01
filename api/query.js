const fetch = require('node-fetch')
const parse = require('csv-parse/lib/sync')

const TAM_DATA_ENDPOINT = "http://data.montpellier3m.fr/sites/default/files/ressources/TAM_MMM_TpsReel.csv"

const fetchAndFilter = async (filters) => {
  const tamCSV = await (await fetch(TAM_DATA_ENDPOINT)).text()
  const records = parse(tamCSV, {
    columns: true,
    skip_empty_lines: true,
    delimiter: ';',
  })
  return records.filter(r =>
    Object.keys(filters).every(key => r[key] == filters[key].toUpperCase())
  )
}

module.exports = async (req, res) => {
  let result;

  try {
    result = await fetchAndFilter(req.query)
  } catch (error) {
    res.json({
      success: false,
      error: error,
    })
  }

  res.json({
    success: true,
    result: result,
  })
}

// (async () => {
// 	console.log(await fetchAndFilter({"stop_name": "ANTIGONE", "trip_headsign": "MOSSON" }))
// })();
