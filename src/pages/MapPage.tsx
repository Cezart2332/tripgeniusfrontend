import { useState, useEffect, useRef } from "react"
import { FiArrowLeft, FiTarget, FiDownloadCloud, FiLoader, FiAlertTriangle } from "react-icons/fi"
import { Link, useNavigate } from "react-router-dom"
import { useSelector } from "react-redux"
import styled, { keyframes } from 'styled-components'
import maplibregl from 'maplibre-gl'
import { ToastContainer } from "../components/shared/Toast"
import { useToast } from "../components/shared/useToast"
import { usePlaces } from "../hooks/usePlaces"
import { useMapTilePrefetch } from "../hooks/useMapTilePrefetch"
import { subscribeForNotifications } from "../utils/notifications"
import { OSM_STYLE } from "../map/osmStyle"
import { createMarkerElement, getPoiColor } from "../utils/mapMarkers"
import { prefetchWorldBase, isWorldMapCached } from "../utils/mapTileCache"
import type { User } from "../types/models"
import { MobileBottomNav } from "../components/layout/MobileBottomNav"

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
    const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null)
    const { toasts, addToast, removeToast } = useToast()
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

    useEffect(() => {
        if (!shouldRedirectToLogin) {
            return
        }

        addToast('You must be logged in to view the map. Redirecting to login...', 'info')

        const timeoutId = window.setTimeout(() => {
            navigate('/login', { replace: true })
        }, 2000)

        return () => {
            window.clearTimeout(timeoutId)
        }
    }, [shouldRedirectToLogin, navigate, addToast])

    useEffect(() => {
        if (!user) return
        void isWorldMapCached().then(setWorldMapCached)
    }, [user])

    useEffect(() => {
        if (!user || !mapContainer.current) return;

        map.current = new maplibregl.Map({
            container: mapContainer.current,
            style: OSM_STYLE,
            center: [12.4534, 41.9029],
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
            addToast('Success! Global base map cached for offline use.', 'success')
        } catch {
            addToast('Failed to download global map. Please try again.', 'error')
        } finally {
            setIsDownloading(false);
        }
    };

    if (!user) {
        return (
            <FullScreenCentered>
                <ToastContainer toasts={toasts} removeToast={removeToast} />
                <EmptyStateWrap>
                    <Sticker src="/newstickers/sticker5.png" alt="" />
                    <UnauthTitle>
                        <FiAlertTriangle style={{ color: 'var(--danger-500)' }} /> You are not logged in
                    </UnauthTitle>
                    <UnauthDesc>
                        Please log in to access the interactive safety map, explore locations, and download offline cached maps.
                    </UnauthDesc>
                    <PrimaryLink to="/login">
                        Go to login
                    </PrimaryLink>
                </EmptyStateWrap>
            </FullScreenCentered>
        )
    }

    return (
        <FullMapPage id="map-page">
            <ToastContainer toasts={toasts} removeToast={removeToast} />
            
            <MapOverlay>
                <MapHeaderBar>
                    <MapHeaderInner>
                        <MapHeaderRow>
                            <BackButton onClick={() => navigate(-1)}>
                                <FiArrowLeft size={24} />
                            </BackButton>
                            <SearchGroup>
                                <SearchIconPrefix>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                </SearchIconPrefix>
                                <AddressInput type="text" value={currentAddress} readOnly className="input" placeholder="Where to?" />
                            </SearchGroup>
                        </MapHeaderRow>
                        <ChipsRow>
                            <ExploreChip>🔍 Exploring {currentAddress.split(',')[0]}</ExploreChip>
                            {placesLoading && (
                                <LoadingChip>
                                    <SpinningLoader size={14} />
                                    Loading places...
                                </LoadingChip>
                            )}
                            {isPrefetching && !isDownloading && (
                                <LoadingChip>
                                    <SpinningLoader size={14} />
                                    Caching map…
                                </LoadingChip>
                            )}
                            {!worldMapCached && (
                            <DownloadChip 
                                onClick={downloadWorldwideBaseMap}
                                disabled={isDownloading}
                                $downloading={isDownloading}
                            >
                                {isDownloading ? (
                                    <>
                                        <SpinningLoader size={14} />
                                        Caching World {downloadProgress}%
                                    </>
                                ) : (
                                    <>
                                        <FiDownloadCloud size={14} />
                                        Download World Map
                                    </>
                                )}
                            </DownloadChip>
                            )}
                            {worldMapCached && (
                                <CachedChip>
                                    World map cached offline
                                </CachedChip>
                            )}
                        </ChipsRow>
                    </MapHeaderInner>
                </MapHeaderBar>
            </MapOverlay>

            <MapContainer ref={mapContainer} />

            <CenterUserBtn onClick={centerOnUser}>
                <FiTarget size={24} />
            </CenterUserBtn>

            <MobileBottomNav />
        </FullMapPage>
    )
}

const spinAnim = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`

const FullScreenCentered = styled.section`
  width: min(1200px, 100% - 2rem);
  margin: 0 auto;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: ${({ theme }) => theme.spacing.lg};
  padding-bottom: ${({ theme }) => theme.spacing['3xl']};

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    width: min(1200px, 100% - 1rem);
    padding-bottom: 7rem;
  }
`

const EmptyStateWrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
`

const Sticker = styled.img`
  width: 120px;
  margin-bottom: 1.5rem;
  display: block;
  margin-inline: auto;
`

const UnauthTitle = styled.h1`
  color: ${({ theme }) => theme.colors.text[100]};
  margin-bottom: 0.75rem;
  font-size: 1.8rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
`

const UnauthDesc = styled.p`
  color: ${({ theme }) => theme.colors.text[380]};
  margin-bottom: 1.5rem;
  max-width: 400px;
  margin-inline: auto;
  line-height: 1.5;
`

const PrimaryLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-weight: 600;
  border-radius: ${({ theme }) => theme.radii.pill};
  transition: all ${({ theme }) => theme.animation.duration.normal}s ${({ theme }) => theme.animation.easeOut.join(',')};
  min-height: 44px;
  min-width: 44px;
  white-space: nowrap;
  text-decoration: none;
  line-height: 1;
  padding: 0.65rem 1.5rem;
  background: linear-gradient(135deg, ${({ theme }) => theme.colors.green[580]}, ${({ theme }) => theme.colors.green[500]});
  color: #0a1e08;
  box-shadow: ${({ theme }) => theme.shadows.glowGreen};

  &:hover {
    background: linear-gradient(135deg, ${({ theme }) => theme.colors.green[500]}, ${({ theme }) => theme.colors.green[300]});
    transform: translateY(-1px);
  }
`

const FullMapPage = styled.section`
  height: 100dvh;
  position: relative;
  overflow: hidden;
`

const MapOverlay = styled.div`
  pointer-events: none;
  z-index: 10;
  position: absolute;
  inset: 0;
`

const MapHeaderBar = styled.div`
  padding-top: calc(0.75rem + env(safe-area-inset-top));
  pointer-events: none;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
`

const MapHeaderInner = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  pointer-events: none;
`

const MapHeaderRow = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 0.5rem;
  pointer-events: auto;
  padding-left: 1rem;
  padding-right: 1rem;
`

const BackButton = styled.button`
  margin-right: 0.75rem;
  color: ${({ theme }) => theme.colors.text[100]};
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(10px);
  width: 40px;
  height: 40px;
  padding: 0;
  min-width: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: none;
  cursor: pointer;
`

const SearchGroup = styled.div`
  flex-grow: 1;
  max-width: 600px;
  position: relative;
`

const SearchIconPrefix = styled.span`
  left: 0.85rem;
  top: 50%;
  transform: translateY(-50%);
  position: absolute;
  display: flex;
  align-items: center;
  color: ${({ theme }) => theme.colors.text[380]};
  z-index: 1;
`

const AddressInput = styled.input`
  font-size: 0.9rem;
  padding-left: 2.4rem;
  background: rgba(17, 34, 26, 0.85);
  backdrop-filter: blur(10px);
  border: 1px solid ${({ theme }) => theme.colors.lineSoft};
  height: 40px;
  border-radius: 12px;
  width: 100%;
  color: ${({ theme }) => theme.colors.text[100]};
  outline: none;

  &::placeholder { color: ${({ theme }) => theme.colors.text[500]}; }
`

const ChipsRow = styled.div`
  padding-left: 1rem;
  gap: 0.5rem;
  flex-wrap: nowrap;
  overflow-x: auto;
  padding-right: 1.5rem;
  pointer-events: auto;
  display: flex;
  -ms-overflow-style: none;
  scrollbar-width: none;

  &::-webkit-scrollbar { display: none; }
`

const ExploreChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.9rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  font-size: ${({ theme }) => theme.typography.bodySmall};
  font-weight: 600;
  background: rgba(23, 247, 2, 0.2);
  border: 1px solid ${({ theme }) => theme.colors.green[500]};
  color: ${({ theme }) => theme.colors.green[500]};
  white-space: nowrap;
`

const LoadingChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.9rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  font-size: ${({ theme }) => theme.typography.bodySmall};
  background: rgba(255,255,255,0.05);
  color: ${({ theme }) => theme.colors.text[220]};
  white-space: nowrap;
`

const DownloadChip = styled.button<{ $downloading: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.9rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  font-size: ${({ theme }) => theme.typography.bodySmall};
  font-weight: 600;
  background: ${({ $downloading }) => $downloading ? 'rgba(23, 247, 2, 0.4)' : 'rgba(23, 247, 2, 0.1)'};
  border: 1px solid ${({ theme }) => theme.colors.green[580]};
  color: ${({ theme }) => theme.colors.text[100]};
  white-space: nowrap;
  cursor: pointer;

  &:disabled { opacity: 0.7; }
`

const CachedChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.9rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  font-size: ${({ theme }) => theme.typography.bodySmall};
  font-weight: 600;
  background: rgba(23, 247, 2, 0.15);
  border: 1px solid ${({ theme }) => theme.colors.green[580]};
  color: ${({ theme }) => theme.colors.green[500]};
  white-space: nowrap;
`

const SpinningLoader = styled(FiLoader)`
  animation: ${spinAnim} 1s linear infinite;
`

const MapContainer = styled.div`
  position: absolute;
  inset: 0;
  background: #0d0f0d;
`

const CenterUserBtn = styled.button`
  background: ${({ theme }) => theme.colors.green[580]};
  color: #fff;
  border-radius: 50%;
  width: 50px;
  height: 50px;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 15px rgba(0,0,0,0.4);
  cursor: pointer;
  position: absolute;
  bottom: 2rem;
  right: 1.5rem;
  z-index: 20;
  transition: transform 0.2s ease, bottom 0.3s ease;

  &:hover { transform: scale(1.05); }

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    bottom: calc(75px + env(safe-area-inset-bottom)) !important;
    right: 1rem !important;
  }
`
