/** AI advisor chat — full-bleed layout without bottom nav. */
export function isAiAdvisorPath(pathname: string): boolean {
  return pathname === '/app/ai' || pathname === '/ai'
}

/** Routes that use a full-screen map and should not show app chrome (bottom nav, etc.). */
export function isFullscreenMapPath(pathname: string): boolean {
  if (pathname === '/map') return true
  if (pathname.startsWith('/navigation/')) return true
  if (pathname.startsWith('/offroad-navigation/')) return true
  return false
}
