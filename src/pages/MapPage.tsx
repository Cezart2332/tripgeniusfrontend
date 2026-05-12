import { useState, useEffect, useRef } from "react"
import { FiArrowLeft, FiTarget, FiDownloadCloud, FiLoader } from "react-icons/fi"
import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import maplibregl from 'maplibre-gl'
import { FeedbackToast } from "../components/FeedbackToast"
import type { FeedbackToastState } from "../components/FeedbackToast"

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

// Tile utility functions
const lon2tile = (lon: number, zoom: number) => Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
const lat2tile = (lat: number, zoom: number) => Math.floor(((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * Math.pow(2, zoom));

export function MapPage() {
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null)
    const [isDownloading, setIsDownloading] = useState(false)
    const [downloadProgress, setDownloadProgress] = useState(0)
    const [toast, setToast] = useState<FeedbackToastState | null>(null)
    const navigate = useNavigate();
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<maplibregl.Map | null>(null);
    const userMarker = useRef<maplibregl.Marker | null>(null);

    useEffect(() => {
        if (!mapContainer.current) return;

        map.current = new maplibregl.Map({
            container: mapContainer.current,
            style: OSM_STYLE,
            center: [12.4534, 41.9029], // Vatican City
            zoom: 14,
            cooperativeGestures: true
        });

        map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

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
            }
        });

        return () => {
            navigator.geolocation.clearWatch(watchId);
            map.current?.remove();
        };
    }, []);

    const centerOnUser = () => {
        if (userLocation && map.current) {
            map.current.flyTo({
                center: [userLocation[1], userLocation[0]],
                zoom: 16
            });
        }
    };

    const downloadOfflineMap = async () => {
        if (!map.current || isDownloading) return;

        const bounds = map.current.getBounds();
        const minZoom = Math.floor(map.current.getZoom());
        const maxZoom = Math.min(minZoom + 2, 18);
        
        setIsDownloading(true);
        setDownloadProgress(0);

        try {
            const cache = await caches.open('map-tiles');
            const tileUrls: string[] = [];

            for (let z = minZoom; z <= maxZoom; z++) {
                const xMin = lon2tile(bounds.getWest(), z);
                const xMax = lon2tile(bounds.getEast(), z);
                const yMin = lat2tile(bounds.getNorth(), z);
                const yMax = lat2tile(bounds.getSouth(), z);

                for (let x = xMin; x <= xMax; x++) {
                    for (let y = yMin; y <= yMax; y++) {
                        tileUrls.push(`https://basemaps.cartocdn.com/dark_all/${z}/${x}/${y}.png`);
                        // Also cache Retina tiles if applicable
                        tileUrls.push(`https://basemaps.cartocdn.com/dark_all/${z}/${x}/${y}@2x.png`);
                    }
                }
            }

            // Cap at 200 tiles to prevent massive downloads
            const finalUrls = tileUrls.slice(0, 200);
            let downloaded = 0;

            for (const url of finalUrls) {
                try {
                    const response = await fetch(url);
                    if (response.ok) {
                        await cache.put(url, response);
                    }
                } catch (e) {
                    console.warn('Failed to cache tile:', url);
                }
                downloaded++;
                setDownloadProgress(Math.round((downloaded / finalUrls.length) * 100));
            }

            setToast({
                id: Date.now(),
                message: `Success! ${finalUrls.length} map tiles cached for offline use.`,
                tone: 'success'
            });
        } catch (err) {
            setToast({
                id: Date.now(),
                message: 'Failed to download map tiles. Please try again.',
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
                <div className="map-header-bar" style={{ paddingTop: '2rem', pointerEvents: 'auto' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <button onClick={() => navigate(-1)} className="btn btn-ghost btn-sm" style={{ marginRight: '1rem', color: 'var(--text-100)', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)' }}>
                                <FiArrowLeft size={24} />
                            </button>
                            <div className="input-group" style={{ flexGrow: 1, maxWidth: '600px' }}>
                                <span className="input-prefix" style={{ left: '1rem', top: '50%', transform: 'translateY(-50%)', position: 'absolute', color: 'var(--text-380)' }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                </span>
                                <input type="text" value="Near the Vatican City" readOnly className="input" placeholder="Where to?" style={{ fontSize: '1rem', paddingLeft: '2.8rem', background: 'rgba(17, 34, 26, 0.85)', backdropFilter: 'blur(10px)', border: '1px solid var(--line-soft)' }} />
                            </div>
                        </div>
                        <div className="chip-row" style={{ paddingLeft: '0.5rem', gap: '0.5rem', flexWrap: 'nowrap', overflowX: 'auto', paddingRight: '2rem' }}>
                            <span className="chip" style={{ background: 'rgba(23, 247, 2, 0.2)', border: '1px solid var(--green-500)', color: 'var(--green-500)' }}>🔍 Explore Nearby</span>
                            <button 
                                onClick={downloadOfflineMap}
                                disabled={isDownloading}
                                className="chip" 
                                style={{ 
                                    background: isDownloading ? 'rgba(255,255,255,0.1)' : 'rgba(23, 247, 2, 0.1)', 
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
                                        Caching {downloadProgress}%
                                    </>
                                ) : (
                                    <>
                                        <FiDownloadCloud size={14} />
                                        Download Offline
                                    </>
                                )}
                            </button>
                            <span className="chip" style={{ background: 'rgba(255,255,255,0.08)' }}>🛡️ Safety Score</span>
                        </div>
                    </div>
                </div>
            </div>

            <div ref={mapContainer} style={{ position: 'absolute', inset: 0, background: '#0d0f0d' }}></div>

            <button 
                onClick={centerOnUser}
                style={{
                    position: 'absolute',
                    bottom: '18rem',
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

            <div className="map-cards-container" style={{ paddingBottom: '2rem', pointerEvents: 'none' }}>
                <div style={{ display: 'flex', gap: '1rem', width: '100%', overflowX: 'auto', padding: '0 1rem', pointerEvents: 'auto' }}>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="card"
                        style={{ minWidth: '280px', background: 'rgba(17, 34, 26, 0.9)', backdropFilter: 'blur(20px)', border: '1px solid var(--line-soft)', padding: '1rem' }}
                    >
                        <h2 className="h4" style={{ marginBottom: '0.5rem', fontSize: '1rem' }}>Visible Area Summary</h2>
                        <div className="metric-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--green-500)' }}>98%</span>
                                <div className="small-label" style={{ fontSize: '0.65rem', opacity: 0.6, textTransform: 'uppercase' }}>Coverage</div>
                            </div>
                            <div>
                                <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f59e0b' }}>34</span>
                                <div className="small-label" style={{ fontSize: '0.65rem', opacity: 0.6, textTransform: 'uppercase' }}>Density</div>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="card"
                        style={{ minWidth: '280px', background: 'rgba(17, 34, 26, 0.9)', backdropFilter: 'blur(20px)', border: '1px solid var(--line-soft)', padding: '1rem' }}
                    >
                        <h2 className="h4" style={{ marginBottom: '1rem', fontSize: '1rem' }}>Live Heatmap</h2>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <span className="chip" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', background: 'rgba(23, 247, 2, 0.2)', color: 'var(--green-500)' }}>Safe</span>
                            <span className="chip" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' }}>Moderate</span>
                            <span className="chip" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}>Caution</span>
                        </div>
                    </motion.div>
                </div>
            </div>

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