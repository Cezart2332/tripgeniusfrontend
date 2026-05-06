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
  email: string,
  profileUrl: string,
  description: string,
  tags: string[],
  groupSize: number,
  notifications: Notification[],
  trips: Trip[]
}

export interface Notification {
  id: number,
  content: string,
  isRead?: boolean,
  read?: boolean,
  IsRead?: boolean,
  Read?: boolean,
  date?: string,
  createdAt?: string,
  CreatedAt?: string
}
export interface TripMember {
  id: string
  username: string
  role: MemberRole
  avatarUrl: string
  status: string
}

export interface CreateTimelineStop {
  day: number
  date: string
  startingPoint: string
  endPoint: string
  fromCoords: [number, number]
  toCoords: [number, number]
  note: string
}

export interface TimelineStop extends CreateTimelineStop {
  id: number
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
  timelines: TimelineStop[]
  members: TripMember[]
  history: TripHistory[]
  isUserMember: boolean
}


export interface ChatMessage {
  id: string
  content: string
  sentAt: string
  imageUrl: string
  username: string
  profileUrl: string
}

export interface TripHistory {
  id: number,
  date: string,
  content: string,
}

export interface AiSuggestion {
  id: string
  title: string
  source: 'TripGenius' | 'External'
  summary: string
  matchingTags: string[]
}
