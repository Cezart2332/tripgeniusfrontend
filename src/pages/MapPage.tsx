import { useState, useEffect, useRef } from "react"
import { FiArrowLeft, FiTarget, FiDownloadCloud, FiLoader, FiAlertTriangle, FiHome, FiMap, FiCpu, FiSettings } from "react-icons/fi"
import { Link, NavLink, useNavigate } from "react-router-dom"
import { useSelector } from "react-redux"
import maplibregl from 'maplibre-gl'
import { FeedbackToast } from "../components/FeedbackToast"
import type { FeedbackToastState } from "../components/FeedbackToast"
import { usePlaces } from "../hooks/usePlaces"
import { useMapTilePrefetch } from "../hooks/useMapTilePrefetch"
import { subscribeForNotifications } from "../utils/notifications"
import { OSM_STYLE } from "../map/osmStyle"
import { createMarkerElement, getPoiColor } from "../utils/mapMarkers"
import { prefetchWorldBase, isWorldMapCached } from "../utils/mapTileCache"
import type { User } from "../types/models"
import { getAvatarUrl } from "../utils/userUtils"

interface AuthStoreState {
    auth: {
        user: User | null
        token: string | null
    }
}

export function MapPage() {
    const user = useSelector((state: AuthStoreState) => state.auth.user)
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

    const shouldRedirectToLogin = !user

    // Redirect unauthenticated users in 2 seconds
    useEffect(() => {
        if (!shouldRedirectToLogin) {
            return
        }

        setToast({
            id: Date.now(),
            message: 'You must be logged in to view the map. Redirecting to login...',
            tone: 'info',
        })

        const timeoutId = window.setTimeout(() => {
            navigate('/login', { replace: true })
        }, 2000)

        return () => {
            window.clearTimeout(timeoutId)
        }
    }, [shouldRedirectToLogin, navigate])

    useEffect(() => {
        if (!user) return
        void isWorldMapCached().then(setWorldMapCached)
    }, [user])

    useEffect(() => {
        if (!user || !mapContainer.current) return;

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
    }, [user]);

    useEffect(() => {
        if (!user || !mapInstance) return;

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
    }, [user, places, mapInstance]);

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

    // If user is not logged in, render the clean, premium unauthenticated screen
    if (!user) {
        return (
            <section className="page container" style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FeedbackToast toast={toast} clearToast={() => setToast(null)} />
                <div className="discovery-empty-state" style={{ textCombineUpright: 'none' }}>
                    <img src="/newstickers/sticker5.png" alt="" className="discovery-empty-sticker" style={{ width: '120px', marginBottom: '1.5rem', display: 'block', marginInline: 'auto' }} />
                    <h1 style={{ color: 'var(--text-100)', marginBottom: '0.75rem', fontSize: '1.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                        <FiAlertTriangle style={{ color: 'var(--danger-500)' }} /> You are not logged in
                    </h1>
                    <p style={{ color: 'var(--text-380)', marginBottom: '1.5rem', maxWidth: '400px', marginInline: 'auto', lineHeight: 1.5 }}>
                        Please log in to access the interactive safety map, explore locations, and download offline cached maps.
                    </p>
                    <Link className="btn btn-primary" to="/login">
                        Go to login
                    </Link>
                </div>
            </section>
        )
    }

    return (
        <section className="page full-map-page" id="map-page" style={{ height: '100dvh', position: 'relative', overflow: 'hidden' }}>
            <FeedbackToast toast={toast} clearToast={() => setToast(null)} />
            
            <div className="map-overlay" style={{ pointerEvents: 'none', zIndex: 10 }}>
                <div className="map-header-bar" style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))', pointerEvents: 'none' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', pointerEvents: 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem', pointerEvents: 'auto', paddingLeft: '1rem', paddingRight: '1rem' }}>
                            <button onClick={() => navigate(-1)} className="btn btn-ghost btn-sm" style={{ marginRight: '0.75rem', color: 'var(--text-100)', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', width: '40px', height: '40px', padding: 0, minWidth: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <FiArrowLeft size={24} />
                            </button>
                            <div className="input-group" style={{ flexGrow: 1, maxWidth: '600px', position: 'relative' }}>
                                <span className="input-prefix" style={{ left: '0.85rem', top: '50%', transform: 'translateY(-50%)', position: 'absolute', color: 'var(--text-380)', display: 'flex', alignItems: 'center' }}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                </span>
                                <input type="text" value={currentAddress} readOnly className="input" placeholder="Where to?" style={{ fontSize: '0.9rem', paddingLeft: '2.4rem', background: 'rgba(17, 34, 26, 0.85)', backdropFilter: 'blur(10px)', border: '1px solid var(--line-soft)', height: '40px', borderRadius: '12px' }} />
                            </div>
                        </div>
                        <div className="chip-row" style={{ paddingLeft: '1rem', gap: '0.5rem', flexWrap: 'nowrap', overflowX: 'auto', paddingRight: '1.5rem', pointerEvents: 'auto' }}>
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
                className="center-user-btn"
                style={{
                    background: 'var(--green-580)',
                    color: '#fff',
                    borderRadius: '50%',
                    width: '50px',
                    height: '50px',
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

            {/* Mobile Bottom Navigation (mirrors AppLayout.tsx for full tab integration) */}
            <nav className="bottom-nav" aria-label="Mobile navigation">
                <NavLink to="/app" end className={({ isActive }) => isActive ? 'bottom-nav-link is-active' : 'bottom-nav-link'}>
                    <FiHome aria-hidden="true" />
                    <span>Home</span>
                </NavLink>
                <NavLink to="/map" className={({ isActive }) => isActive ? 'bottom-nav-link is-active' : 'bottom-nav-link'}>
                    <FiMap aria-hidden="true" />
                    <span>Map</span>
                </NavLink>
                {user && (
                    <NavLink to="/app/ai" className={({ isActive }) => isActive ? 'bottom-nav-link is-active' : 'bottom-nav-link'}>
                        <FiCpu aria-hidden="true" />
                        <span>AI</span>
                    </NavLink>
                )}
                <NavLink to="/app/profile" className={({ isActive }) => isActive ? 'bottom-nav-link is-active' : 'bottom-nav-link'}>
                    <img
                        src={getAvatarUrl(user.username, user.profileUrl)}
                        alt=""
                        style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <span>Profile</span>
                </NavLink>
                <NavLink to="/app/settings" className={({ isActive }) => isActive ? 'bottom-nav-link is-active' : 'bottom-nav-link'}>
                    <FiSettings aria-hidden="true" />
                    <span>Settings</span>
                </NavLink>
            </nav>

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
                .center-user-btn {
                    position: absolute;
                    bottom: 2rem;
                    right: 1.5rem;
                    z-index: 20;
                    transition: transform 0.2s ease, bottom 0.3s ease;
                }
                .center-user-btn:hover {
                    transform: scale(1.05);
                }
                .full-map-page .chip-row::-webkit-scrollbar {
                    display: none;
                }
                .full-map-page .chip-row {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                @media (max-width: 850px) {
                    .center-user-btn {
                        bottom: calc(75px + env(safe-area-inset-bottom)) !important;
                        right: 1rem !important;
                    }
                    .full-map-page .maplibregl-ctrl-bottom-right {
                        bottom: calc(70px + env(safe-area-inset-bottom)) !important;
                        right: 1rem !important;
                    }
                }
            `}</style>
        </section>
    )
}
