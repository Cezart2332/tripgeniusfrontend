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
  startDay: number
  endDay: number
  startingPoint: string
  endPoint: string
  fromCoords: [number, number]
  toCoords: [number, number]
  note: string
  activities: TripActivityRequest[]
}

export interface TripActivityRequest {
  name: string
  description: string
  link?: string
  cost?: number
  type: ActivityType
}

export const ActivityType = {
  Attraction: 0,
  Food: 1,
  Accommodation: 2,
  Transport: 3,
  Other: 4,
} as const

export type ActivityType = typeof ActivityType[keyof typeof ActivityType]

export const ActivityTypeLabels: Record<ActivityType, string> = {
  [ActivityType.Attraction]: 'Attraction',
  [ActivityType.Food]: 'Food',
  [ActivityType.Accommodation]: 'Accommodation',
  [ActivityType.Transport]: 'Transport',
  [ActivityType.Other]: 'Other',
}

export interface TripActivity extends TripActivityRequest {
  id: number
}

export interface TimelineStop extends CreateTimelineStop {
  id: number
  date: string
  activities: TripActivity[]
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

export type RouteSource = 'Imported' | 'Drawn' | 'AiGenerated'

export interface GeoJsonLineString {
  type: 'LineString'
  coordinates: [number, number, number?][]
}

export interface OffroadRoute {
  id: number
  startDay: number
  endDay: number
  name: string
  note: string
  trackGeoJson: string
  source: RouteSource | string
  distanceMeters: number
  elevationGainMeters: number
}

export interface OffroadTrip {
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
  routes: OffroadRoute[]
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

export interface AiTripPlannerRequest {
  description: string
  durationDays: number
  interests: string[]
  budget: number
  startingPoint: string
  maxParticipants: number
}

export interface AiOffroadPlannerRequest {
  description: string
  durationDays: number
  interests: string[]
  budget: number
  region: string
  maxParticipants: number
  difficultyLevel: 'Easy' | 'Moderate' | 'Hard' | 'Expert'
}
