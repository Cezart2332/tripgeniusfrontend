import { motion } from 'framer-motion';
import { FiX } from 'react-icons/fi';

interface PWAInstallPopupProps {
  show: boolean;
  isIos: boolean;
  onDismiss: () => void;
  onInstall: () => void;
}

export function PWAInstallPopup({ show, isIos, onDismiss, onInstall }: PWAInstallPopupProps) {
  if (!show) return null;

  return (
    <div className="pwa-popup-overlay">
      <motion.div
        className="pwa-popup-card"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
      >
        <button className="pwa-close-btn" onClick={onDismiss} aria-label="Close">
          <FiX />
        </button>

        <div className="pwa-icon-circle">
          <img src="/pwa-192x192.png" alt="App Icon" />
        </div>

        {isIos ? (
          <>
            <h2>Add to Home Screen</h2>
            <p>Install TripGenius on your iPhone for a native experience.</p>

            <div className="ios-guide-carousel" data-lenis-prevent>
              <div className="ios-guide-step">
                <img src="/iospwaguide/1.jpeg" alt="Step 1" />
                <p>1. Tap the <strong>Share</strong> button in the browser bar.</p>
              </div>
              <div className="ios-guide-step">
                <img src="/iospwaguide/2.jpeg" alt="Step 2" />
                <p>2. Scroll down and find <strong>"Add to Home Screen"</strong>.</p>
              </div>
              <div className="ios-guide-step">
                <img src="/iospwaguide/3.jpeg" alt="Step 3" />
                <p>3. Confirm by tapping <strong>"Add"</strong> in the top right.</p>
              </div>
            </div>

            <p className="swipe-hint">Swipe to see next step →</p>
          </>
        ) : (
          <>
            <h2>Install TripGenius</h2>
            <p>This app can be installed into your phone for faster access and offline support.</p>
            <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: '1.5rem' }} onClick={onInstall}>
              Install App
            </button>
          </>
        )}

        {!isIos && (
          <button className="btn btn-ghost" style={{ marginTop: '0.5rem', width: '100%' }} onClick={onDismiss}>
            Maybe later
          </button>
        )}
      </motion.div>
    </div>
  );
}
