import type {
  AiSuggestion,
  ChatMessage,
  Trip,
  TripMember,
  TripTimelineStop,
} from '../types/models'

export interface UserPreferences {
  tripTypes: string[]
  maxGroupSize: number
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

const formatDateOffset = (offset: number): string => {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return date.toISOString().split('T')[0]
}

const primaryTripMembers: TripMember[] = [
  {
    id: 'm1',
    username: 'Cezar Ionescu',
    role: 'owner',
    avatarUrl:
      'https://images.unsplash.com/photo-1521119989659-a83eee488004?auto=format&fit=crop&w=200&q=80',

  },
  {
    id: 'm2',
    username: 'Andra Pop',
    role: 'admin',
    avatarUrl:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',

  },
  {
    id: 'm3',
    username: 'Victor M.',
    role: 'member',
    avatarUrl:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',

  },
  {
    id: 'm4',
    username: 'Ana B.',
    role: 'member',
    avatarUrl:
      'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=200&q=80',

  },
]

const primaryTripTimeline: TripTimelineStop[] = [
  {
    day: 1,
    date: formatDateOffset(-1),
    startingPoint: 'Constanta',
    endPoint: 'Bucharest',
    fromCoords: [28.6348, 44.1733],
    toCoords: [26.1025, 44.4268],
    note: 'Morning meetup near the old casino. Shared lunch stop at Cernavoda.',
  },
  {
    day: 2,
    date: formatDateOffset(0),
    startingPoint: 'Bucharest',
    endPoint: 'Brasov',
    fromCoords: [26.1025, 44.4268],
    toCoords: [25.6061, 45.6579],
    note: 'Urban walk in the capital, then train to Brasov before sunset.',
  },
  {
    day: 3,
    date: formatDateOffset(1),
    startingPoint: 'Brasov',
    endPoint: 'Sibiu',
    fromCoords: [25.6061, 45.6579],
    toCoords: [24.1256, 45.7983],
    note: 'Mountain viewpoints and a stop in Fagaras for local food.',
  },
  {
    day: 4,
    date: formatDateOffset(2),
    startingPoint: 'Sibiu',
    endPoint: 'Cluj-Napoca',
    fromCoords: [24.1256, 45.7983],
    toCoords: [23.5947, 46.7712],
    note: 'Wrap-up day with expenses review and final dinner in Cluj.',
  },
]

export const tripTypeOptions = [
  'adventure',
  'city-break',
  'nature',
  'roadtrip',
  'culture',
  'foodie',
  'wellness',
  'nightlife',
]

export const mockUserProfile: UserProfile = {
  id: 'm1',
  name: 'Cezar',
  email: 'cezar@example.com',
  avatarUrl:
    'https://images.unsplash.com/photo-1521119989659-a83eee488004?auto=format&fit=crop&w=300&q=80',
  description:
    'I enjoy mixed city + mountain trips, practical planning, and meeting people with strong positive energy.',
  preferences: {
    tripTypes: ['adventure', 'roadtrip', 'nature'],
    maxGroupSize: 8,
  },
  pastTripIds: ['trip-adria'],
  futureTripIds: ['trip-danube', 'trip-retreat'],
}

export const mockTrips: Trip[] = [
  {
    id: 'trip-carpathian',
    title: 'Carpathian Route Sprint',
    description:
      'A fast-paced roadtrip focused on mountain roads, city culture breaks, and shared planning.',
    imageUrl:
      'https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=900&q=80',
    status: 'active',
    startingDate: formatDateOffset(-1),
    endingDate: formatDateOffset(3),
    price: 950,
    currentMembers: 6,
    maxParticipants: 8,
    isUserMember: true,
    tags: ['adventure', 'roadtrip', 'nature'],
    timelines: primaryTripTimeline,
    members: primaryTripMembers,
  },
  {
    id: 'trip-danube',
    title: 'Danube City Mosaic',
    description:
      'Friendly city-hopping with museums, local food tastings, and optional evening meetups.',
    imageUrl:
      'https://images.unsplash.com/photo-1541849546-216549ae216d?auto=format&fit=crop&w=900&q=80',
    status: 'upcoming',
    startingDate: formatDateOffset(8),
    endingDate: formatDateOffset(13),
    price: 1250,
    currentMembers: 5,
    maxParticipants: 10,
    isUserMember: true,
    tags: ['city-break', 'culture', 'foodie'],
    timelines: [
      {
        day: 1,
        date: formatDateOffset(8),
        startingPoint: 'Budapest',
        endPoint: 'Vienna',
        fromCoords: [19.0402, 47.4979],
        toCoords: [16.3738, 48.2082],
        note: 'Morning thermal baths, then train transfer.',
      },
      {
        day: 2,
        date: formatDateOffset(9),
        startingPoint: 'Vienna',
        endPoint: 'Bratislava',
        fromCoords: [16.3738, 48.2082],
        toCoords: [17.1077, 48.1486],
        note: 'Museum day and Danube evening cruise.',
      },
    ],
    members: [primaryTripMembers[0], primaryTripMembers[1], primaryTripMembers[2]],
  },
  {
    id: 'trip-retreat',
    title: 'Forest Reset Camp',
    description:
      'Digital detox retreat with forest trails, journaling, and mindful group sessions.',
    imageUrl:
      'https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=900&q=80',
    status: 'upcoming',
    startingDate: formatDateOffset(20),
    endingDate: formatDateOffset(24),
    price: 680,
    currentMembers: 4,
    maxParticipants: 7,
    isUserMember: true,
    tags: ['nature', 'wellness', 'adventure'],
    timelines: [
      {
        day: 1,
        date: formatDateOffset(20),
        startingPoint: 'Cluj-Napoca',
        endPoint: 'Padis',
        fromCoords: [23.5947, 46.7712],
        toCoords: [22.7124, 46.5736],
        note: 'Arrival and group orientation in camp.',
      },
      {
        day: 2,
        date: formatDateOffset(21),
        startingPoint: 'Padis',
        endPoint: 'Cetatile Ponorului',
        fromCoords: [22.7124, 46.5736],
        toCoords: [22.6838, 46.5729],
        note: 'Guided cave route and team cooking challenge.',
      },
    ],
    members: [primaryTripMembers[1], primaryTripMembers[3]],
  },
  {
    id: 'trip-adria',
    title: 'Adriatic Social Week',
    description:
      'A completed summer itinerary focused on group activities, beaches, and night markets.',
    imageUrl:
      'https://images.unsplash.com/photo-1521336575822-6da63fb45455?auto=format&fit=crop&w=900&q=80',
    status: 'completed',
    startingDate: formatDateOffset(-65),
    endingDate: formatDateOffset(-58),
    price: 1420,
    currentMembers: 9,
    maxParticipants: 10,
    isUserMember: true,
    tags: ['city-break', 'nightlife', 'foodie'],
    timelines: [
      {
        day: 1,
        date: formatDateOffset(-65),
        startingPoint: 'Split',
        endPoint: 'Dubrovnik',
        fromCoords: [16.4402, 43.5081],
        toCoords: [18.0944, 42.6507],
        note: 'Coastal drive and evening old town walk.',
      },
    ],
    members: primaryTripMembers,
  },
  {
    id: 'trip-workation',
    title: 'Remote Work Seaside Loop',
    description:
      'A structured workation where mornings are for focus and afternoons are for exploring.',
    imageUrl:
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80',
    status: 'upcoming',
    startingDate: formatDateOffset(15),
    endingDate: formatDateOffset(22),
    price: 1180,
    currentMembers: 7,
    maxParticipants: 12,
    isUserMember: false,
    tags: ['city-break', 'foodie', 'roadtrip'],
    timelines: [
      {
        day: 1,
        date: formatDateOffset(15),
        startingPoint: 'Valencia',
        endPoint: 'Alicante',
        fromCoords: [-0.3763, 39.4699],
        toCoords: [-0.4907, 38.3452],
        note: 'Coworking sessions in the morning and beach social in the evening.',
      },
    ],
    members: [primaryTripMembers[1], primaryTripMembers[2], primaryTripMembers[3]],
  },
]

export const mockTripChat: ChatMessage[] = [
  {
    id: 'chat-1',
    author: 'Andra Pop',
    role: 'admin',
    content: 'Reminder: today we settle fuel costs in the app before dinner.',
    at: '09:20',
  },
  {
    id: 'chat-2',
    author: 'Victor M.',
    role: 'member',
    content: 'Can we push departure by 20 minutes? I am grabbing supplies.',
    at: '09:34',
  },
  {
    id: 'chat-3',
    author: 'Cezar Ionescu',
    role: 'owner',
    content: 'Perfect, updated timeline. Meeting point stays at the central station.',
    at: '09:36',
  },
]

export const aiKnowledgeTrips: AiSuggestion[] = [
  {
    id: 'ai-1',
    title: 'Nordic Fjord Digital Detox',
    source: 'External',
    summary:
      'A low-distraction 7-day route focused on nature, small teams, and mindful activities.',
    matchingTags: ['nature', 'wellness'],
  },
  {
    id: 'ai-2',
    title: 'Istanbul Culture Marathon',
    source: 'External',
    summary:
      'High-energy cultural route with historic landmarks, night bazaars, and group-friendly planning.',
    matchingTags: ['culture', 'foodie', 'city-break'],
  },
  {
    id: 'ai-3',
    title: 'Alpine Explorer Mini Convoy',
    source: 'TripGenius',
    summary:
      'A practical driving circuit for small groups that enjoy mountain roads and panoramic stops.',
    matchingTags: ['adventure', 'roadtrip', 'nature'],
  },
]

let runtimeCreatedTrips: Trip[] = []

export const getAllTrips = (): Trip[] => [...runtimeCreatedTrips, ...mockTrips]

export const addCreatedTrip = (trip: Trip): void => {
  runtimeCreatedTrips = [trip, ...runtimeCreatedTrips]
}

export const getTripById = (tripId: string): Trip | undefined =>
  getAllTrips().find((trip) => trip.id === tripId)

export const isUserInTrip = (trip: Trip, userProfile: UserProfile): boolean => {
  const profileTripIds = new Set([
    ...userProfile.pastTripIds,
    ...userProfile.futureTripIds,
  ])

  if (profileTripIds.has(trip.id)) {
    return true
  }

  const normalizedUserName = userProfile.name.trim().toLowerCase()

  return trip.members.some((member) => {
    const normalizedMemberName = member.username.trim().toLowerCase()

    return (
      member.id === userProfile.id ||
      normalizedMemberName === normalizedUserName ||
      normalizedMemberName.includes(normalizedUserName)
    )
  })
}
