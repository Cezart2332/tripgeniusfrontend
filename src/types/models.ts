export type MemberRole = 'owner' | 'admin' | 'member'
export type TripStatus = 'upcoming' | 'active' | 'completed'
export type BudgetTier = 'low' | 'medium' | 'high'
export type Pace = 'chill' | 'balanced' | 'fast'
export type GroupPreference = 'narrow' | 'big'

export interface UserPreferences {
  tripTypes: string[]
  groupPreference: GroupPreference
  maxGroupSize: number
  budgetTier: BudgetTier
  pace: Pace
}

export interface UserProfile {
  id: string
  name: string
  email: string
  avatarUrl: string
  description: string
  preferences: UserPreferences
  pastTripIds: string[]
  futureTripIds: string[]
}

export interface TripMember {
  id: string
  name: string
  role: MemberRole
  avatarUrl: string
  location: string
}

export interface TripTimelineStop {
  day: number
  date: string
  from: string
  to: string
  fromCoords: [number, number]
  toCoords: [number, number]
  note: string
}

export interface Trip {
  id: string
  title: string
  description: string
  destination: string
  coverImage: string
  status: TripStatus
  startDate: string
  endDate: string
  budgetPerPerson: number
  currentMembers: number
  maxMembers: number
  tags: string[]
  timeline: TripTimelineStop[]
  members: TripMember[]
}

export interface ChatMessage {
  id: string
  author: string
  role: MemberRole
  content: string
  at: string
}

export interface AiSuggestion {
  id: string
  title: string
  source: 'TripGenius' | 'External'
  summary: string
  matchingTags: string[]
}
