import { useState, useEffect, useRef } from "react"
import { FiArrowLeft, FiTarget, FiDownloadCloud, FiLoader } from "react-icons/fi"
import { useNavigate } from "react-router-dom"
import maplibregl from 'maplibre-gl'
import { FeedbackToast } from "../components/FeedbackToast"
import type { FeedbackToastState } from "../components/FeedbackToast"
import { usePlaces } from "../hooks/usePlaces"
import { useMapTilePrefetch } from "../hooks/useMapTilePrefetch"
import { subscribeForNotifications } from "../utils/notifications"
import { OSM_STYLE } from "../map/osmStyle"
import { createMarkerElement, getPoiColor } from "../utils/mapMarkers"
import { prefetchWorldBase, isWorldMapCached } from "../utils/mapTileCache"

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
    const { isPrefetching } = useMapTilePrefetch(mapInstance)
    const [worldMapCached, setWorldMapCached] = useState(false)

    useEffect(() => {
        void isWorldMapCached().then(setWorldMapCached)
    }, [])

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
        if (isDownloading || worldMapCached) return;

        await subscribeForNotifications();
        
        setIsDownloading(true);
        setDownloadProgress(0);

        try {
            await prefetchWorldBase(5, {
                onProgress: (done, total) => {
                    setDownloadProgress(Math.round((done / total) * 100));
                },
            });

            if (Notification.permission === 'granted') {
                new Notification("TripGenius Maps", {
                    body: "Worldwide base map is now available offline!",
                    icon: "/pwa-192x192.png"
                });
            }

            const cachedNow = await isWorldMapCached()
            setWorldMapCached(cachedNow)
            setToast({
                id: Date.now(),
                message: `Success! Global base map cached for offline use.`,
                tone: 'success'
            });
        } catch {
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
                            {isPrefetching && !isDownloading && (
                                <span className="chip" style={{ background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <FiLoader className="spin" size={14} />
                                    Caching map…
                                </span>
                            )}
                            {!worldMapCached && (
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
                            )}
                            {worldMapCached && (
                                <span className="chip" style={{ background: 'rgba(23, 247, 2, 0.15)', border: '1px solid var(--green-580)', color: 'var(--green-500)' }}>
                                    World map cached offline
                                </span>
                            )}
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
