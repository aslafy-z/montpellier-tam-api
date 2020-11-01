const fetch = require('node-fetch')
const parse = require('csv-parse/lib/sync')

const fetchAndFilter = async (stop, direction) => {
  const res = await fetch("http://data.montpellier3m.fr/sites/default/files/ressources/TAM_MMM_TpsReel.csv")
  const tamCSV = await res.text()

  const records = parse(tamCSV, {
    columns: true,
    skip_empty_lines: true,
    delimiter: ';',
  })

  return records.filter(r =>
      (!stop || r.stop_name == stop.toUpperCase()) &&
      (!direction || r.trip_headsign == direction.toUpperCase())
  )
}

module.exports = async (req, res) => {
  let result;

  try {
    result = await fetchAndFilter(req.query.stop, req.query.direction)
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
// 	console.log(await fetchAndFilter("ANTIGONE", "MOSSON"))
// })();
