/** Routes that use a full-screen map and should not show app chrome (bottom nav, etc.). */
export function isFullscreenMapPath(pathname: string): boolean {
  if (pathname === '/map') return true
  if (pathname.startsWith('/navigation/')) return true
  if (pathname.startsWith('/offroad-navigation/')) return true
  if (/^\/app\/offroad\/[^/]+\/route\/(?:new|[^/]+\/edit)$/.test(pathname)) return true
  return false
}
