const LOCATION_CSV_TEMPLATE = `Location Name,Phone Number,Timezone,Country,Call Frequency
Downtown Flagship,+1 212 555 0101,America/New_York,United States,Weekly
Brooklyn Heights,+1 718 555 0102,America/New_York,United States,Bi-weekly
Chicago Loop,+1 312 555 0103,America/Chicago,United States,Monthly`

export function downloadLocationCsvTemplate() {
  const blob = new Blob([LOCATION_CSV_TEMPLATE], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'ghostshopper_locations_template.csv'
  link.click()
  URL.revokeObjectURL(url)
}
