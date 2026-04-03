import type {
  AiSuggestion,
  ChatMessage,
  Trip,
  TripMember,
  TripTimelineStop,
  UserProfile,
} from '../types/models'

const formatDateOffset = (offset: number): string => {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return date.toISOString().split('T')[0]
}

const primaryTripMembers: TripMember[] = [
  {
    id: 'm1',
    name: 'Cezar Ionescu',
    role: 'owner',
    avatarUrl:
      'https://images.unsplash.com/photo-1521119989659-a83eee488004?auto=format&fit=crop&w=200&q=80',
    location: 'Bucharest',
  },
  {
    id: 'm2',
    name: 'Andra Pop',
    role: 'admin',
    avatarUrl:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
    location: 'Brasov',
  },
  {
    id: 'm3',
    name: 'Victor M.',
    role: 'member',
    avatarUrl:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
    location: 'Constanta',
  },
  {
    id: 'm4',
    name: 'Ana B.',
    role: 'member',
    avatarUrl:
      'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=200&q=80',
    location: 'Sibiu',
  },
]

const primaryTripTimeline: TripTimelineStop[] = [
  {
    day: 1,
    date: formatDateOffset(-1),
    from: 'Constanta',
    to: 'Bucharest',
    fromCoords: [28.6348, 44.1733],
    toCoords: [26.1025, 44.4268],
    note: 'Morning meetup near the old casino. Shared lunch stop at Cernavoda.',
  },
  {
    day: 2,
    date: formatDateOffset(0),
    from: 'Bucharest',
    to: 'Brasov',
    fromCoords: [26.1025, 44.4268],
    toCoords: [25.6061, 45.6579],
    note: 'Urban walk in the capital, then train to Brasov before sunset.',
  },
  {
    day: 3,
    date: formatDateOffset(1),
    from: 'Brasov',
    to: 'Sibiu',
    fromCoords: [25.6061, 45.6579],
    toCoords: [24.1256, 45.7983],
    note: 'Mountain viewpoints and a stop in Fagaras for local food.',
  },
  {
    day: 4,
    date: formatDateOffset(2),
    from: 'Sibiu',
    to: 'Cluj-Napoca',
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
    groupPreference: 'narrow',
    maxGroupSize: 8,
    budgetTier: 'medium',
    pace: 'balanced',
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
    destination: 'Romania',
    coverImage:
      'https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=900&q=80',
    status: 'active',
    startDate: formatDateOffset(-1),
    endDate: formatDateOffset(3),
    budgetPerPerson: 950,
    currentMembers: 6,
    maxMembers: 8,
    tags: ['adventure', 'roadtrip', 'nature'],
    timeline: primaryTripTimeline,
    members: primaryTripMembers,
  },
  {
    id: 'trip-danube',
    title: 'Danube City Mosaic',
    description:
      'Friendly city-hopping with museums, local food tastings, and optional evening meetups.',
    destination: 'Budapest and Vienna',
    coverImage:
      'https://images.unsplash.com/photo-1541849546-216549ae216d?auto=format&fit=crop&w=900&q=80',
    status: 'upcoming',
    startDate: formatDateOffset(8),
    endDate: formatDateOffset(13),
    budgetPerPerson: 1250,
    currentMembers: 5,
    maxMembers: 10,
    tags: ['city-break', 'culture', 'foodie'],
    timeline: [
      {
        day: 1,
        date: formatDateOffset(8),
        from: 'Budapest',
        to: 'Vienna',
        fromCoords: [19.0402, 47.4979],
        toCoords: [16.3738, 48.2082],
        note: 'Morning thermal baths, then train transfer.',
      },
      {
        day: 2,
        date: formatDateOffset(9),
        from: 'Vienna',
        to: 'Bratislava',
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
    destination: 'Apuseni',
    coverImage:
      'https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=900&q=80',
    status: 'upcoming',
    startDate: formatDateOffset(20),
    endDate: formatDateOffset(24),
    budgetPerPerson: 680,
    currentMembers: 4,
    maxMembers: 7,
    tags: ['nature', 'wellness', 'adventure'],
    timeline: [
      {
        day: 1,
        date: formatDateOffset(20),
        from: 'Cluj-Napoca',
        to: 'Padis',
        fromCoords: [23.5947, 46.7712],
        toCoords: [22.7124, 46.5736],
        note: 'Arrival and group orientation in camp.',
      },
      {
        day: 2,
        date: formatDateOffset(21),
        from: 'Padis',
        to: 'Cetatile Ponorului',
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
    destination: 'Split and Dubrovnik',
    coverImage:
      'https://images.unsplash.com/photo-1521336575822-6da63fb45455?auto=format&fit=crop&w=900&q=80',
    status: 'completed',
    startDate: formatDateOffset(-65),
    endDate: formatDateOffset(-58),
    budgetPerPerson: 1420,
    currentMembers: 9,
    maxMembers: 10,
    tags: ['city-break', 'nightlife', 'foodie'],
    timeline: [
      {
        day: 1,
        date: formatDateOffset(-65),
        from: 'Split',
        to: 'Dubrovnik',
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
    destination: 'Valencia and Alicante',
    coverImage:
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80',
    status: 'upcoming',
    startDate: formatDateOffset(15),
    endDate: formatDateOffset(22),
    budgetPerPerson: 1180,
    currentMembers: 7,
    maxMembers: 12,
    tags: ['city-break', 'foodie', 'roadtrip'],
    timeline: [
      {
        day: 1,
        date: formatDateOffset(15),
        from: 'Valencia',
        to: 'Alicante',
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
    const normalizedMemberName = member.name.trim().toLowerCase()

    return (
      member.id === userProfile.id ||
      normalizedMemberName === normalizedUserName ||
      normalizedMemberName.includes(normalizedUserName)
    )
  })
}
