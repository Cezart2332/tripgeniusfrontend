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
    // Light theme: numbers keep their legacy dark-theme names, but the scale is
    // inverted — bg.980 is the lightest page background.
    bg: {
      980: '#f7faf5',
      960: '#eff5eb',
      940: '#e4eede',
    },
    surface: {
      900: 'rgba(255, 255, 255, 0.92)',
      860: 'rgba(255, 255, 255, 0.82)',
      820: 'rgba(255, 255, 255, 0.68)',
    },
    text: {
      100: '#1c2b21',
      220: '#33473a',
      380: '#5b7263',
      500: '#84957f',
    },
    green: {
      300: '#43a86a',
      400: '#2e8d54',
      500: '#27804a',
      580: '#1e6b3d',
      700: '#14512e',
    },
    offroad: {
      accent: '#a8781f',
      accentSoft: 'rgba(168, 120, 31, 0.14)',
      accentGlow: 'rgba(168, 120, 31, 0.20)',
      line: 'rgba(168, 120, 31, 0.34)',
      surface: 'rgba(255, 253, 246, 0.90)',
      track: '#3f74b8',
      trackSoft: 'rgba(63, 116, 184, 0.30)',
      trackPointStroke: '#2c5687',
    },
    danger: {
      500: '#c93a4c',
      400: '#e0596b',
    },
    line: 'rgba(46, 141, 84, 0.32)',
    lineSoft: 'rgba(46, 141, 84, 0.14)',
    overlay: 'rgba(23, 34, 26, 0.42)',
  },

  glass: {
    bg: 'rgba(255, 255, 255, 0.74)',
    border: 'rgba(28, 43, 32, 0.10)',
    blur: '16px',
    bgStrong: 'rgba(255, 255, 255, 0.92)',
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
    sm: '0 2px 8px rgba(28, 43, 32, 0.06)',
    md: '0 8px 24px rgba(28, 43, 32, 0.09)',
    lg: '0 16px 40px rgba(28, 43, 32, 0.12)',
    xl: '0 24px 64px rgba(28, 43, 32, 0.15)',
    glow: '0 14px 36px rgba(46, 141, 84, 0.14)',
    glowGreen: '0 14px 34px rgba(46, 141, 84, 0.20)',
    glowGold: '0 14px 34px rgba(168, 120, 31, 0.20)',
    topbar: '0 10px 30px rgba(28, 43, 32, 0.08)',
    bottomNav: '0 -10px 30px rgba(28, 43, 32, 0.10)',
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
