import { createGlobalStyle } from 'styled-components'

const GlobalStyles = createGlobalStyle`
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap');

  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  html {
    background-color: ${({ theme }) => theme.colors.bg[980]};
    overflow-y: auto;
    overflow-x: hidden;
    scroll-behavior: smooth;
    touch-action: pan-x pan-y;
    -webkit-text-size-adjust: 100%;
    height: 100%;
  }

  body {
    min-height: 100vh;
    min-height: 100dvh;
    font-family: ${({ theme }) => theme.typography.fontFamily};
    color: ${({ theme }) => theme.colors.text[100]};
    background:
      radial-gradient(circle at 18% 0%, rgba(143, 179, 106, 0.12), transparent 28rem),
      radial-gradient(circle at 92% 18%, rgba(192, 163, 91, 0.10), transparent 26rem),
      linear-gradient(180deg, ${({ theme }) => theme.colors.bg[960]}, ${({ theme }) => theme.colors.bg[980]} 38rem);
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
    background-image:
      linear-gradient(rgba(247, 243, 232, 0.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(247, 243, 232, 0.018) 1px, transparent 1px);
    background-size: 44px 44px;
    mask-image: linear-gradient(to bottom, rgba(0,0,0,0.8), transparent 78%);
    opacity: 0.55;
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

  button:focus-visible,
  a:focus-visible,
  input:focus-visible,
  textarea:focus-visible,
  select:focus-visible,
  [tabindex]:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.green[400]};
    outline-offset: 3px;
  }

  button:active,
  .btn:active,
  [role="button"]:active {
    transform: translateY(1px);
  }

  h1, h2, h3, h4, h5, h6, p {
    margin: 0;
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: ${({ theme }) => theme.typography.headingFamily};
    letter-spacing: 0;
    line-height: 1.15;
    text-wrap: balance;
  }

  h1 { font-size: ${({ theme }) => theme.typography.h1}; }
  h2 { font-size: ${({ theme }) => theme.typography.h2}; }
  h3 { font-size: ${({ theme }) => theme.typography.h3}; }

  p {
    line-height: 1.6;
    text-wrap: pretty;
  }

  input, textarea, select {
    font-family: inherit;
    color: inherit;
    -webkit-appearance: none;
    appearance: none;
  }

  input,
  textarea,
  select,
  button {
    font-variant-numeric: tabular-nums;
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

  .skip-link {
    position: fixed;
    top: 0.75rem;
    left: 0.75rem;
    z-index: 3000;
    transform: translateY(-160%);
    padding: 0.65rem 0.9rem;
    border-radius: ${({ theme }) => theme.radii.md};
    background: ${({ theme }) => theme.colors.text[100]};
    color: ${({ theme }) => theme.colors.bg[980]};
    font-weight: 700;
    transition: transform 0.18s ease;
  }

  .skip-link:focus {
    transform: translateY(0);
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
    border: 2px solid rgba(247, 243, 232, 0.95);
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
