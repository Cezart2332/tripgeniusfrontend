export type MemberRole = 'owner' | 'admin' | 'member'
export type TripStatus = 'upcoming' | 'active' | 'completed'


export interface User {
    id: number,
    username: string,
    email:string,
    profileUrl: string,
    description: string,
    tags: string[],
    groupSize: number
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
