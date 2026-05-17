import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function readInitialShowPopup(isIos: boolean, isStandalone: boolean): boolean {
  if (localStorage.getItem('pwa_prompt_dismissed')) return false
  if (isStandalone) return false
  return isIos
}

export function usePWAInstall() {
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window);
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isMobileDevice = isIos || isAndroid;
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in window.navigator && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone));

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPopup, setShowInstallPopup] = useState(() =>
    readInitialShowPopup(isIos, isStandalone),
  );

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);

      const dismissed = localStorage.getItem('pwa_prompt_dismissed');
      if (!dismissed && !isStandalone && isMobileDevice) {
        setShowInstallPopup(true);
      }
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [isStandalone, isMobileDevice]);

  const dismissPopup = () => {
    localStorage.setItem('pwa_prompt_dismissed', 'true');
    setShowInstallPopup(false);
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  return {
    showInstallPopup,
    dismissPopup,
    handleInstallClick,
    isIos,
    deferredPrompt
  };
}
