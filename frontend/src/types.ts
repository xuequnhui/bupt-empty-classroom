export type CampusCode = 'xitucheng' | 'shahe'

export interface CampusOption {
  value: CampusCode
  label: string
}

export interface TimeSlotOption {
  value: string
  label: string
}

export interface SearchFilters {
  campus: CampusCode
  date: string
  building: string
  floor: string
  timeSlots: string[]
}

export interface SummaryStats {
  total: number
  available: number
  busy: number
}

export interface ClassroomStatus {
  room: string
  status: 'available' | 'busy'
  capacity: number
  floor: string
  description: string
}

export interface SearchResponse {
  success: boolean
  message: string
  lastUpdatedAt?: string | null
  query: {
    campus: string
    campusCode: CampusCode
    building: string
    floor: string
    date: string
    timeSlots: string[]
  }
  summary: SummaryStats
  classrooms: ClassroomStatus[]
}
