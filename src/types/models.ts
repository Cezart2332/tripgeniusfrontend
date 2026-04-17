export type MemberRole = 'owner' | 'admin' | 'member'
export type TripStatus =
  | 'Upcoming'
  | 'Started'
  | 'Finished'
  | 'upcoming'
  | 'active'
  | 'completed'


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
  username: string
  role: MemberRole
  avatarUrl: string
}

export interface TripTimelineStop {
  day: number
  date: string
  startingPoint: string
  endPoint: string
  fromCoords: [number, number]
  toCoords: [number, number]
  note: string
}

export interface Trip {
  id: string
  title: string
  description: string
  imageUrl: string
  status: TripStatus
  startingDate: string
  endingDate: string
  price: number
  currentMembers: number
  maxParticipants: number
  tags: string[]
  timelines: TripTimelineStop[]
  members: TripMember[]
  isUserMember: boolean
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
