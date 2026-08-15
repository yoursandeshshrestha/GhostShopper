export interface OrgLocation {
  id: string
  name: string
  phone: string | null
  timezone: string | null
  country: string | null
  callFrequency: string | null
}

export interface LocationInput {
  name: string
  phone: string
  timezone: string
  country: string
  callFrequency: string
}

export const EMPTY_LOCATION_INPUT: LocationInput = {
  name: '',
  phone: '',
  timezone: '',
  country: '',
  callFrequency: '',
}
