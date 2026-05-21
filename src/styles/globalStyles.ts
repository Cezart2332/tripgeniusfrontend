import { createGlobalStyle } from 'styled-components'

const GlobalStyles = createGlobalStyle`
  @import url('https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700;800&display=swap');

  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  html {
    background-color: ${({ theme }) => theme.colors.bg[980]};
    overflow-y: auto;
    overflow-x: hidden;
    touch-action: pan-x pan-y;
    -webkit-text-size-adjust: 100%;
    height: 100%;
  }

  body {
    min-height: 100vh;
    min-height: 100dvh;
    font-family: ${({ theme }) => theme.typography.fontFamily};
    color: ${({ theme }) => theme.colors.text[100]};
    background: ${({ theme }) => theme.colors.bg[980]};
    background-attachment: fixed;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    overflow: visible;
    padding-top: env(safe-area-inset-top);
    padding-left: env(safe-area-inset-left);
    padding-right: env(safe-area-inset-right);
    padding-bottom: env(safe-area-inset-bottom);
    position: relative;
  }

  body::before {
    content: '';
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    background-image: radial-gradient(rgba(207, 255, 236, 0.09) 0.6px, transparent 0.6px);
    background-size: 3.2px 3.2px;
    opacity: 0.12;
  }

  body::after {
    content: '';
    position: fixed;
    width: 50vw;
    height: 50vw;
    left: -10vw;
    bottom: -18vw;
    pointer-events: none;
    z-index: 0;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(23, 247, 2, 0.12), transparent 64%);
    filter: blur(14px);
    animation: orb-drift 22s ease-in-out infinite;
  }

  @keyframes orb-drift {
    0%, 100% { transform: translate(0, 0) scale(1); }
    25% { transform: translate(3vw, -2vw) scale(1.08); }
    50% { transform: translate(-1vw, -4vw) scale(0.94); }
    75% { transform: translate(-3vw, 1vw) scale(1.04); }
  }

  #root {
    min-height: 100vh;
    min-height: 100dvh;
    height: auto !important;
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
  }

  a {
    color: inherit;
    text-decoration: none;
    -webkit-tap-highlight-color: transparent;
  }

  button, .btn, .nav-link, [role="button"] {
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
    cursor: pointer;
    font-family: inherit;
    border: none;
    outline: none;
  }

  h1, h2, h3, h4, h5, h6, p {
    margin: 0;
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: ${({ theme }) => theme.typography.headingFamily};
    letter-spacing: -0.025em;
    line-height: 1.15;
  }

  h1 { font-size: ${({ theme }) => theme.typography.h1}; }
  h2 { font-size: ${({ theme }) => theme.typography.h2}; }
  h3 { font-size: ${({ theme }) => theme.typography.h3}; }

  p { line-height: 1.55; }

  input, textarea, select {
    font-family: inherit;
    color: inherit;
    -webkit-appearance: none;
    appearance: none;
  }

  img {
    max-width: 100%;
    display: block;
  }

  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  ::-webkit-scrollbar-track {
    background: transparent;
  }

  ::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.green[700]};
    border-radius: 3px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: ${({ theme }) => theme.colors.green[580]};
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .custom-marker-wrapper {
    cursor: pointer;
  }

  .custom-map-marker {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid rgba(243, 255, 241, 0.95);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
  }

  .marker-icon-inner {
    width: 17px;
    height: 17px;
    color: #f3fff1;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }

  .marker-icon-inner svg {
    width: 100%;
    height: 100%;
    display: block;
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    ::-webkit-scrollbar {
      width: 3px;
      height: 3px;
    }
  }
`

export default GlobalStyles
