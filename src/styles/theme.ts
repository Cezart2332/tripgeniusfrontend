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
      980: '#0d0f0d',
      960: '#121b14',
      940: '#18251b',
    },
    surface: {
      900: 'rgba(12, 17, 13, 0.82)',
      860: 'rgba(18, 27, 20, 0.74)',
      820: 'rgba(24, 37, 27, 0.62)',
    },
    text: {
      100: '#f3fff1',
      220: '#d3edcf',
      380: '#a9c8a3',
      500: '#7a9e74',
    },
    green: {
      300: '#5cf752',
      400: '#30f720',
      500: '#17f702',
      580: '#41a238',
      700: '#1a6013',
    },
    offroad: {
      accent: '#c9a227',
      accentSoft: 'rgba(201, 162, 39, 0.22)',
      accentGlow: 'rgba(232, 200, 120, 0.35)',
      line: 'rgba(201, 162, 39, 0.38)',
      surface: 'rgba(28, 32, 24, 0.82)',
    },
    danger: {
      500: '#db4a5b',
      400: '#f06a7a',
    },
    line: 'rgba(65, 162, 56, 0.42)',
    lineSoft: 'rgba(65, 162, 56, 0.18)',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },

  glass: {
    bg: 'rgba(18, 27, 20, 0.65)',
    border: 'rgba(65, 162, 56, 0.18)',
    blur: '12px',
    bgStrong: 'rgba(18, 27, 20, 0.85)',
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
    sm: '0 2px 8px rgba(0, 0, 0, 0.2)',
    md: '0 4px 16px rgba(0, 0, 0, 0.3)',
    lg: '0 8px 32px rgba(0, 0, 0, 0.4)',
    xl: '0 16px 48px rgba(0, 0, 0, 0.5)',
    glow: '0 0 20px rgba(23, 247, 2, 0.15)',
    glowGreen: '0 0 30px rgba(23, 247, 2, 0.2), 0 0 60px rgba(23, 247, 2, 0.08)',
    glowGold: '0 0 30px rgba(201, 162, 39, 0.2), 0 0 60px rgba(201, 162, 39, 0.08)',
    topbar: '0 4px 24px rgba(0, 0, 0, 0.4)',
    bottomNav: '0 -4px 24px rgba(0, 0, 0, 0.5)',
  },

  typography: {
    fontFamily: "'Lexend', 'Segoe UI', -apple-system, sans-serif",
    headingFamily: "'Lexend', 'Segoe UI', -apple-system, sans-serif",
    h1: 'clamp(1.8rem, 4.2vw, 2.8rem)',
    h2: 'clamp(1.25rem, 2vw, 1.6rem)',
    h3: 'clamp(1rem, 1.3vw, 1.15rem)',
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

export default theme
