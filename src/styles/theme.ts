import type { DefaultTheme } from 'styled-components'

declare module 'styled-components' {
  export interface DefaultTheme {
    colors: {
      bg: {
        980: string
        960: string
        940: string
      }
      surface: {
        900: string
        860: string
        820: string
      }
      text: {
        100: string
        220: string
        380: string
        500: string
      }
      green: {
        300: string
        400: string
        500: string
        580: string
        700: string
      }
      offroad: {
        accent: string
        accentSoft: string
        accentGlow: string
        line: string
        surface: string
        track: string
        trackSoft: string
        trackPointStroke: string
      }
      danger: {
        500: string
        400: string
      }
      line: string
      lineSoft: string
      overlay: string
    }
    glass: {
      bg: string
      border: string
      blur: string
      bgStrong: string
    }
    spacing: {
      xs: string
      sm: string
      md: string
      lg: string
      xl: string
      '2xl': string
      '3xl': string
    }
    radii: {
      sm: string
      md: string
      lg: string
      xl: string
      pill: string
      full: string
    }
    shadows: {
      sm: string
      md: string
      lg: string
      xl: string
      glow: string
      glowGreen: string
      glowGold: string
      topbar: string
      bottomNav: string
    }
    typography: {
      fontFamily: string
      headingFamily: string
      h1: string
      h2: string
      h3: string
      body: string
      bodySmall: string
      caption: string
      eyebrow: string
      lead: string
    }
    animation: {
      easeOut: [number, number, number, number]
      easeInOut: [number, number, number, number]
      duration: {
        fast: number
        normal: number
        slow: number
      }
    }
    breakpoints: {
      mobile: string
      tablet: string
      desktop: string
      wide: string
    }
  }
}

const theme: DefaultTheme = {
  colors: {
    bg: {
      980: '#10120f',
      960: '#171a15',
      940: '#20251e',
    },
    surface: {
      900: 'rgba(20, 24, 18, 0.88)',
      860: 'rgba(28, 33, 25, 0.78)',
      820: 'rgba(39, 46, 35, 0.66)',
    },
    text: {
      100: '#f7f3e8',
      220: '#ddd8c8',
      380: '#aaa795',
      500: '#7e8270',
    },
    green: {
      300: '#c8dba3',
      400: '#a8c77b',
      500: '#8fb36a',
      580: '#668a4b',
      700: '#385330',
    },
    offroad: {
      accent: '#c0a35b',
      accentSoft: 'rgba(192, 163, 91, 0.20)',
      accentGlow: 'rgba(208, 178, 109, 0.25)',
      line: 'rgba(192, 163, 91, 0.36)',
      surface: 'rgba(33, 35, 28, 0.84)',
      track: '#6d93c7',
      trackSoft: 'rgba(109, 147, 199, 0.34)',
      trackPointStroke: '#375f95',
    },
    danger: {
      500: '#db4a5b',
      400: '#f06a7a',
    },
    line: 'rgba(143, 179, 106, 0.38)',
    lineSoft: 'rgba(143, 179, 106, 0.16)',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },

  glass: {
    bg: 'rgba(28, 33, 25, 0.68)',
    border: 'rgba(247, 243, 232, 0.10)',
    blur: '16px',
    bgStrong: 'rgba(20, 24, 18, 0.88)',
  },

  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },

  radii: {
    sm: '0.5rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.25rem',
    pill: '999px',
    full: '50%',
  },

  shadows: {
    sm: '0 2px 8px rgba(5, 7, 4, 0.22)',
    md: '0 8px 24px rgba(5, 7, 4, 0.30)',
    lg: '0 16px 40px rgba(5, 7, 4, 0.38)',
    xl: '0 24px 64px rgba(5, 7, 4, 0.48)',
    glow: '0 18px 48px rgba(143, 179, 106, 0.12)',
    glowGreen: '0 18px 46px rgba(143, 179, 106, 0.18)',
    glowGold: '0 18px 46px rgba(192, 163, 91, 0.18)',
    topbar: '0 18px 48px rgba(5, 7, 4, 0.34)',
    bottomNav: '0 -18px 48px rgba(5, 7, 4, 0.42)',
  },

  typography: {
    fontFamily: "'Outfit', 'Lexend', 'Segoe UI', -apple-system, sans-serif",
    headingFamily: "'Outfit', 'Lexend', 'Segoe UI', -apple-system, sans-serif",
    h1: '2.65rem',
    h2: '1.55rem',
    h3: '1.12rem',
    body: '0.925rem',
    bodySmall: '0.8125rem',
    caption: '0.75rem',
    eyebrow: '0.6875rem',
    lead: '1.05rem',
  },

  animation: {
    easeOut: [0.22, 1, 0.36, 1],
    easeInOut: [0.4, 0, 0.2, 1],
    duration: {
      fast: 0.15,
      normal: 0.3,
      slow: 0.5,
    },
  },

  breakpoints: {
    mobile: '850px',
    tablet: '1120px',
    desktop: '1260px',
    wide: '1600px',
  },
}

/** MapLibre paint colors for offroad GPS tracks (shared across map views). */
export const offroadMapTrackColors = {
  line: theme.colors.offroad.track,
  pointStroke: theme.colors.offroad.trackPointStroke,
} as const

export default theme
