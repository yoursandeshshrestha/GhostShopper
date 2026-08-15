export type CsvLocationColumn =
  | 'name'
  | 'phone'
  | 'timezone'
  | 'country'
  | 'callFrequency'
  | 'skip'

export const CSV_LOCATION_FIELDS: { key: CsvLocationColumn; label: string }[] = [
  { key: 'name', label: 'Location Name' },
  { key: 'phone', label: 'Phone Number' },
  { key: 'timezone', label: 'Timezone' },
  { key: 'country', label: 'Country' },
  { key: 'callFrequency', label: 'Call Frequency' },
  { key: 'skip', label: 'Skip' },
]

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let current: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const next = text[i + 1]

    if (char === '"' && inQuotes && next === '"') {
      cell += '"'
      i += 1
      continue
    }
    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (char === ',' && !inQuotes) {
      current.push(cell.trim())
      cell = ''
      continue
    }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1
      current.push(cell.trim())
      if (current.some((value) => value.length > 0)) rows.push(current)
      current = []
      cell = ''
      continue
    }
    cell += char
  }

  current.push(cell.trim())
  if (current.some((value) => value.length > 0)) rows.push(current)
  return rows
}

export function guessLocationMapping(headers: string[]): CsvLocationColumn[] {
  return headers.map((header) => {
    const value = header.toLowerCase()
    if (value.includes('name') || value.includes('location')) return 'name'
    if (value.includes('phone') || value.includes('tel')) return 'phone'
    if (value.includes('time')) return 'timezone'
    if (value.includes('country') || value.includes('nation')) return 'country'
    if (value.includes('frequen') || value.includes('cadence')) {
      return 'callFrequency'
    }
    return 'skip'
  })
}

export function mapCsvRowsToLocations(
  rows: string[][],
  mapping: CsvLocationColumn[]
) {
  const nameIndex = mapping.indexOf('name')
  if (nameIndex < 0) {
    return { rows: [], error: 'Map at least one column to Location Name' }
  }

  const mapped = rows
    .map((row) => ({
      name: row[nameIndex] ?? '',
      phone: row[mapping.indexOf('phone')] ?? '',
      timezone: row[mapping.indexOf('timezone')] ?? '',
      country: row[mapping.indexOf('country')] ?? '',
      callFrequency: row[mapping.indexOf('callFrequency')] ?? '',
    }))
    .filter((row) => row.name.trim())

  if (mapped.length === 0) {
    return { rows: [], error: 'No valid location rows found' }
  }

  return { rows: mapped, error: null }
}

export function parseLocationCsvFile(text: string) {
  const parsed = parseCsv(text)
  if (parsed.length < 2) {
    return {
      error: 'CSV needs a header row and at least one data row',
      headers: [] as string[],
      rows: [] as string[][],
      mapping: [] as CsvLocationColumn[],
    }
  }

  const [headers, ...rows] = parsed
  return {
    error: null,
    headers,
    rows,
    mapping: guessLocationMapping(headers),
  }
}
