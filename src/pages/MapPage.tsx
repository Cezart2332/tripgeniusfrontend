import { useState, useEffect, useRef } from "react"
import { FiArrowLeft, FiTarget, FiDownloadCloud, FiLoader } from "react-icons/fi"
import { useNavigate } from "react-router-dom"
import maplibregl from 'maplibre-gl'
import { FeedbackToast } from "../components/FeedbackToast"
import type { FeedbackToastState } from "../components/FeedbackToast"
import { usePlaces } from "../hooks/usePlaces"

const OSM_STYLE: any = {
    version: 8,
    sources: {
        osm: {
            type: 'raster',
            tiles: ['https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors, © CARTO',
        },
    },
    layers: [
        {
            id: 'osm',
            type: 'raster',
            source: 'osm',
        },
    ],
}

// Map Marker logic
const getPoiColor = (kinds: string) => {
    if (kinds.includes('foods')) return '#d97706'; 
    if (kinds.includes('accomodations')) return '#3b82f6';
    if (kinds.includes('amusements')) return '#ec4899';
    if (kinds.includes('sport')) return '#06b6d4';
    if (kinds.includes('tourist_facilities')) return '#f59e0b';
    if (kinds.includes('historic') || kinds.includes('architecture')) return '#8b5cf6';
    return '#41a238';
}

const getMarkerIcon = (kinds: string) => {
    if (kinds.includes('foods')) return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8V21M2 21V19C2 15.6863 4.68629 13 8 13V13C11.3137 13 14 15.6863 14 19V21M16 8C16 3.58172 19.5817 0 24 0V8H16Z"/></svg>';
    if (kinds.includes('accomodations')) return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>';
    if (kinds.includes('amusements')) return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>';
    if (kinds.includes('sport')) return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>';
    if (kinds.includes('tourist_facilities')) return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
    if (kinds.includes('historic') || kinds.includes('architecture')) return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M3 10h18M5 10V7a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3M7 10v4M11 10v4M15 10v4M19 10v4M3 14h18M5 14v7M19 14v7"></path></svg>';
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>';
}

const createMarkerElement = (color: string, kinds: string) => {
    const el = document.createElement('div');
    el.className = 'custom-marker-wrapper';
    el.innerHTML = `
      <div class="custom-map-marker" style="background-color: ${color}">
        <div class="marker-icon-inner">${getMarkerIcon(kinds)}</div>
      </div>
    `;
    return el;
};

export function MapPage() {
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null)
    const [isDownloading, setIsDownloading] = useState(false)
    const [downloadProgress, setDownloadProgress] = useState(0)
    const [currentAddress, setCurrentAddress] = useState("Locating...")
    const [toast, setToast] = useState<FeedbackToastState | null>(null)
    const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null)
    const navigate = useNavigate();
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<maplibregl.Map | null>(null);
    const userMarker = useRef<maplibregl.Marker | null>(null);
    const poiMarkersRef = useRef<maplibregl.Marker[]>([]);
    const hasAutoCentered = useRef(false);

    const { places, loading: placesLoading } = usePlaces(mapInstance)

    useEffect(() => {
        if (!mapContainer.current) return;

        map.current = new maplibregl.Map({
            container: mapContainer.current,
            style: OSM_STYLE,
            center: [12.4534, 41.9029], // Vatican City
            zoom: 14,
            cooperativeGestures: true
        });

        map.current.addControl(new maplibregl.NavigationControl(), 'bottom-right');
        setMapInstance(map.current);

        const watchId = navigator.geolocation.watchPosition((position) => {
            const coords: [number, number] = [position.coords.longitude, position.coords.latitude];
            setUserLocation([position.coords.latitude, position.coords.longitude]);

            if (map.current) {
                if (!userMarker.current) {
                    const el = document.createElement('div');
                    el.className = 'user-dot-marker';
                    userMarker.current = new maplibregl.Marker({ element: el })
                        .setLngLat(coords)
                        .addTo(map.current);
                } else {
                    userMarker.current.setLngLat(coords);
                }

                if (!hasAutoCentered.current) {
                    map.current.flyTo({ center: coords, zoom: 15 });
                    hasAutoCentered.current = true;
                    // Attempt reverse geocoding
                    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}`)
                        .then(res => res.json())
                        .then(data => {
                            if (data.display_name) {
                                const parts = data.display_name.split(',');
                                setCurrentAddress(parts[0] + (parts[1] ? ', ' + parts[1] : ''));
                            }
                        })
                        .catch(() => setCurrentAddress("Current Location"));
                }
            }
        });

        return () => {
            navigator.geolocation.clearWatch(watchId);
            map.current?.remove();
        };
    }, []);

    useEffect(() => {
        if (!mapInstance) return;

        poiMarkersRef.current.forEach(m => m.remove());
        poiMarkersRef.current = [];

        places.filter(p => p.name).forEach(place => {
            const popup = new maplibregl.Popup({ offset: 25 }).setHTML(
                `<div style="color: #2c332b; padding: 5px;">
                  <strong style="display: block; margin-bottom: 4px;">${place.name}</strong>
                  <small style="color: #666; text-transform: capitalize;">${place.kinds.replace(/_/g, ' ')}</small>
                </div>`
            )

            const el = createMarkerElement(getPoiColor(place.kinds), place.kinds);
            const marker = new maplibregl.Marker({ element: el })
                .setLngLat([place.point.lon, place.point.lat])
                .setPopup(popup)
                .addTo(mapInstance);

            poiMarkersRef.current.push(marker);
        });
    }, [places, mapInstance]);

    const centerOnUser = () => {
        if (userLocation && map.current) {
            map.current.flyTo({
                center: [userLocation[1], userLocation[0]],
                zoom: 16
            });
        }
    };

    const downloadWorldwideBaseMap = async () => {
        if (isDownloading) return;

        // Request notification permission
        if (Notification.permission === 'default') {
            await Notification.requestPermission();
        }
        
        setIsDownloading(true);
        setDownloadProgress(0);

        try {
            const cache = await caches.open('map-tiles-cache');
            const tileUrls: string[] = [];

            // Z0 to Z5 covers the whole world in ~1365 tiles
            for (let z = 0; z <= 5; z++) {
                const maxCoord = Math.pow(2, z) - 1;
                for (let x = 0; x <= maxCoord; x++) {
                    for (let y = 0; y <= maxCoord; y++) {
                        tileUrls.push(`https://basemaps.cartocdn.com/dark_all/${z}/${x}/${y}.png`);
                    }
                }
            }

            let downloaded = 0;
            const batchSize = 10;
            
            for (let i = 0; i < tileUrls.length; i += batchSize) {
                const batch = tileUrls.slice(i, i + batchSize);
                await Promise.all(batch.map(async (url) => {
                    try {
                        const response = await fetch(url, { mode: 'cors' });
                        if (response.ok) {
                            await cache.put(url, response);
                        }
                    } catch (e) {
                        // Silent skip for individual tiles
                    }
                }));
                downloaded += batch.length;
                setDownloadProgress(Math.round((downloaded / tileUrls.length) * 100));
            }

            if (Notification.permission === 'granted') {
                new Notification("TripGenius Maps", {
                    body: "Worldwide base map is now available offline!",
                    icon: "/pwa-192x192.png"
                });
            }

            setToast({
                id: Date.now(),
                message: `Success! Global base map cached for offline use.`,
                tone: 'success'
            });
        } catch (err) {
            setToast({
                id: Date.now(),
                message: 'Failed to download global map. Please try again.',
                tone: 'error'
            });
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <section className="page full-map-page" id="map-page" style={{ height: '100dvh', position: 'relative', overflow: 'hidden' }}>
            <FeedbackToast toast={toast} clearToast={() => setToast(null)} />
            
            <div className="map-overlay" style={{ pointerEvents: 'none', zIndex: 10 }}>
                <div className="map-header-bar" style={{ paddingTop: '2rem', pointerEvents: 'none' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', pointerEvents: 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem', pointerEvents: 'auto' }}>
                            <button onClick={() => navigate(-1)} className="btn btn-ghost btn-sm" style={{ marginRight: '1rem', color: 'var(--text-100)', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)' }}>
                                <FiArrowLeft size={24} />
                            </button>
                            <div className="input-group" style={{ flexGrow: 1, maxWidth: '600px' }}>
                                <span className="input-prefix" style={{ left: '1rem', top: '50%', transform: 'translateY(-50%)', position: 'absolute', color: 'var(--text-380)' }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                </span>
                                <input type="text" value={currentAddress} readOnly className="input" placeholder="Where to?" style={{ fontSize: '1rem', paddingLeft: '2.8rem', background: 'rgba(17, 34, 26, 0.85)', backdropFilter: 'blur(10px)', border: '1px solid var(--line-soft)' }} />
                            </div>
                        </div>
                        <div className="chip-row" style={{ paddingLeft: '0.5rem', gap: '0.5rem', flexWrap: 'nowrap', overflowX: 'auto', paddingRight: '2rem', pointerEvents: 'auto' }}>
                            <span className="chip" style={{ background: 'rgba(23, 247, 2, 0.2)', border: '1px solid var(--green-500)', color: 'var(--green-500)' }}>🔍 Exploring {currentAddress.split(',')[0]}</span>
                            {placesLoading && (
                                <span className="chip" style={{ background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <FiLoader className="spin" size={14} />
                                    Loading places...
                                </span>
                            )}
                            <button 
                                onClick={downloadWorldwideBaseMap}
                                disabled={isDownloading}
                                className="chip" 
                                style={{ 
                                    background: isDownloading ? 'rgba(23, 247, 2, 0.4)' : 'rgba(23, 247, 2, 0.1)', 
                                    border: '1px solid var(--green-580)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    color: 'var(--text-100)'
                                }}
                            >
                                {isDownloading ? (
                                    <>
                                        <FiLoader className="spin" size={14} />
                                        Caching World {downloadProgress}%
                                    </>
                                ) : (
                                    <>
                                        <FiDownloadCloud size={14} />
                                        Download World Map
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div ref={mapContainer} style={{ position: 'absolute', inset: 0, background: '#0d0f0d' }}></div>

            <button 
                onClick={centerOnUser}
                style={{
                    position: 'absolute',
                    bottom: '4rem',
                    right: '1.5rem',
                    zIndex: 20,
                    width: '50px',
                    height: '50px',
                    borderRadius: '50%',
                    background: 'var(--green-580)',
                    color: '#fff',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
                    cursor: 'pointer'
                }}
            >
                <FiTarget size={24} />
            </button>

            <style>{`
                .user-dot-marker {
                    width: 18px;
                    height: 18px;
                    background: var(--green-500);
                    border: 3px solid white;
                    border-radius: 50%;
                    box-shadow: 0 0 15px var(--green-500);
                }
                .full-map-page .map-cards-container {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    z-index: 15;
                }
                #map-page .input-group {
                    position: relative;
                }
                .spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </section>
    )
}