const API_BASE = 'https://api.opentripmap.com/0.1/en/places';
const API_KEY = import.meta.env.VITE_OPEN_TRIP_MAP;

export interface Place {
  xid: string;
  name: string;
  kinds: string;
  rate: number;
  point: {
    lon: number;
    lat: number;
  };
}

export const fetchPlacesInBBox = async (
  lonMin: number,
  latMin: number,
  lonMax: number,
  latMax: number,
  kinds: string = 'interesting_places'
): Promise<Place[]> => {
  if (!API_KEY) {
    console.error('VITE_OPEN_TRIP_MAP API key is missing');
    return [];
  }

  const url = `${API_BASE}/bbox?lon_min=${lonMin}&lat_min=${latMin}&lon_max=${lonMax}&lat_max=${latMax}&kinds=${kinds}&rate=2&limit=50&format=json&apikey=${API_KEY}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch places');
    }
    return response.json();
  } catch (error) {
    console.error('OpenTripMap fetch error:', error);
    throw error;
  }
};
