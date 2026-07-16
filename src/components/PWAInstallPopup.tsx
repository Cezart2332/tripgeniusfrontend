import { motion } from 'framer-motion';
import { FiX } from 'react-icons/fi';
import styled from 'styled-components';

interface PWAInstallPopupProps {
  show: boolean;
  isIos: boolean;
  onDismiss: () => void;
  onInstall: () => void;
}

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(23, 34, 26, 0.45);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
`

const Card = styled(motion.div)`
  position: relative;
  background:
    linear-gradient(145deg, rgba(28, 43, 32, 0.055), rgba(28, 43, 32, 0.02)),
    ${({ theme }) => theme.colors.surface[900]};
  border: 1px solid ${({ theme }) => theme.glass.border};
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: ${({ theme }) => theme.radii.xl};
  padding: ${({ theme }) => theme.spacing.xl};
  max-width: 400px;
  width: 100%;
  text-align: center;
  box-shadow: ${({ theme }) => theme.shadows.xl};

  h2 {
    font-size: ${({ theme }) => theme.typography.h2};
    color: ${({ theme }) => theme.colors.text[100]};
    margin-bottom: ${({ theme }) => theme.spacing.sm};
  }

  p {
    font-size: ${({ theme }) => theme.typography.bodySmall};
    color: ${({ theme }) => theme.colors.text[380]};
    margin-bottom: ${({ theme }) => theme.spacing.md};
  }
`

const CloseBtn = styled.button`
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  width: 32px;
  height: 32px;
  border-radius: ${({ theme }) => theme.radii.md};
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(28, 43, 32, 0.06);
  color: ${({ theme }) => theme.colors.text[380]};
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(28, 43, 32, 0.12);
    color: ${({ theme }) => theme.colors.text[100]};
  }
`

const IconCircle = styled.div`
  width: 72px;
  height: 72px;
  border-radius: ${({ theme }) => theme.radii.full};
  background: ${({ theme }) => theme.glass.bg};
  border: 1px solid ${({ theme }) => theme.colors.line};
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto ${({ theme }) => theme.spacing.md};
  box-shadow: ${({ theme }) => theme.shadows.glowGreen};

  img {
    width: 44px;
    height: 44px;
    border-radius: ${({ theme }) => theme.radii.md};
  }
`

const IosGuideCarousel = styled.div`
  display: flex;
  gap: 0.75rem;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scroll-snap-type: x mandatory;
  padding-bottom: 0.5rem;
  margin-bottom: 0.5rem;
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
  }
`

const IosGuideStep = styled.div`
  flex: 0 0 100%;
  scroll-snap-align: start;
  text-align: center;

  img {
    width: 100%;
    height: auto;
    max-height: 200px;
    object-fit: contain;
    border-radius: ${({ theme }) => theme.radii.md};
    border: 1px solid ${({ theme }) => theme.colors.lineSoft};
    margin-bottom: 0.5rem;
  }

  p {
    font-size: ${({ theme }) => theme.typography.caption};
    color: ${({ theme }) => theme.colors.text[380]};
    margin: 0;

    strong {
      color: ${({ theme }) => theme.colors.text[100]};
    }
  }
`

const SwipeHint = styled.p`
  font-size: ${({ theme }) => theme.typography.eyebrow};
  color: ${({ theme }) => theme.colors.text[500]};
`

const InstallBtn = styled.button`
  width: 100%;
  margin-top: 1.5rem;
  padding: 0.9rem 1.5rem;
  font-size: ${({ theme }) => theme.typography.body};
  font-weight: 700;
  border: none;
  border-radius: ${({ theme }) => theme.radii.lg};
  background: linear-gradient(140deg, ${({ theme }) => theme.colors.green[400]}, ${({ theme }) => theme.colors.offroad.accent});
  color: ${({ theme }) => theme.colors.bg[980]};
  cursor: pointer;
  transition: background 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    box-shadow: ${({ theme }) => theme.shadows.glowGold};
  }
`

const LaterBtn = styled.button`
  margin-top: 0.5rem;
  width: 100%;
  padding: 0.6rem 1rem;
  font-size: ${({ theme }) => theme.typography.bodySmall};
  font-weight: 500;
  border: none;
  border-radius: ${({ theme }) => theme.radii.lg};
  background: rgba(28, 43, 32, 0.06);
  color: ${({ theme }) => theme.colors.text[380]};
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: rgba(28, 43, 32, 0.12);
    color: ${({ theme }) => theme.colors.text[100]};
  }
`

export function PWAInstallPopup({ show, isIos, onDismiss, onInstall }: PWAInstallPopupProps) {
  if (!show) return null;

  return (
    <Overlay>
      <Card
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
      >
        <CloseBtn onClick={onDismiss} aria-label="Close">
          <FiX />
        </CloseBtn>

        <IconCircle>
          <img src="/pwa-192x192.png" alt="App Icon" />
        </IconCircle>

        {isIos ? (
          <>
            <h2>Add to Home Screen</h2>
            <p>Install TripGenius on your iPhone for a native experience.</p>

            <IosGuideCarousel data-lenis-prevent>
              <IosGuideStep>
                <img src="/iospwaguide/1.jpeg" alt="Step 1" />
                <p>1. Tap the <strong>Share</strong> button in the browser bar.</p>
              </IosGuideStep>
              <IosGuideStep>
                <img src="/iospwaguide/2.jpeg" alt="Step 2" />
                <p>2. Scroll down and find <strong>"Add to Home Screen"</strong>.</p>
              </IosGuideStep>
              <IosGuideStep>
                <img src="/iospwaguide/3.jpeg" alt="Step 3" />
                <p>3. Confirm by tapping <strong>"Add"</strong> in the top right.</p>
              </IosGuideStep>
            </IosGuideCarousel>

            <SwipeHint>Swipe to see next step →</SwipeHint>
          </>
        ) : (
          <>
            <h2>Install TripGenius</h2>
            <p>This app can be installed into your phone for faster access and offline support.</p>
            <InstallBtn onClick={onInstall}>
              Install App
            </InstallBtn>
          </>
        )}

        {!isIos && (
          <LaterBtn onClick={onDismiss}>
            Maybe later
          </LaterBtn>
        )}
      </Card>
    </Overlay>
  );
}
