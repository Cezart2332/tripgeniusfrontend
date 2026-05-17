export function getPoiColor(kinds: string): string {
  if (kinds.includes('foods')) return '#d97706'
  if (kinds.includes('accomodations')) return '#3b82f6'
  if (kinds.includes('amusements')) return '#ec4899'
  if (kinds.includes('sport')) return '#06b6d4'
  if (kinds.includes('tourist_facilities')) return '#f59e0b'
  if (kinds.includes('historic') || kinds.includes('architecture')) return '#8b5cf6'
  return '#41a238'
}

export function getMarkerIcon(kinds: string): string {
  if (kinds.includes('foods'))
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8V21M2 21V19C2 15.6863 4.68629 13 8 13V13C11.3137 13 14 15.6863 14 19V21M16 8C16 3.58172 19.5817 0 24 0V8H16Z"/></svg>'
  if (kinds.includes('accomodations'))
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>'
  if (kinds.includes('amusements'))
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>'
  if (kinds.includes('sport'))
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>'
  if (kinds.includes('tourist_facilities'))
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
  if (kinds.includes('historic') || kinds.includes('architecture'))
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M3 10h18M5 10V7a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3M7 10v4M11 10v4M15 10v4M19 10v4M3 14h18M5 14v7M19 14v7"></path></svg>'
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>'
}

export function createMarkerElement(
  color: string,
  kinds: string,
  isSpecial?: 'start' | 'end',
): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'custom-marker-wrapper'

  let icon = getMarkerIcon(kinds)
  if (isSpecial === 'start') {
    icon =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3l14 9-14 9V3z"></path></svg>'
  } else if (isSpecial === 'end') {
    icon =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>'
  }

  el.innerHTML = `
    <div class="custom-map-marker" style="background-color: ${color}">
      <div class="marker-icon-inner">${icon}</div>
    </div>
  `
  return el
}
