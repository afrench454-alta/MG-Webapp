"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

import styles from "./install-app.module.css";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isAndroid() {
  if (typeof navigator === "undefined") return false;
  return /android/i.test(navigator.userAgent);
}

function isSamsungBrowser() {
  if (typeof navigator === "undefined") return false;
  return /samsungbrowser/i.test(navigator.userAgent);
}

export function InstallAppButton() {
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [showHint, setShowHint] = useState(false);
  const [iosDevice] = useState(isIos);
  const [androidDevice] = useState(isAndroid);
  const [samsungBrowser] = useState(isSamsungBrowser);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;
  if (!installEvent && !iosDevice && !androidDevice) return null;

  const androidHint = samsungBrowser
    ? "Open this page in Chrome, then tap Install app in the menu. Samsung’s Add to Home screen only saves a browser bookmark."
    : "In Chrome, open the menu and tap Install app. That puts Mow & Glow in your app drawer like a normal app, not a bookmark.";

  return (
    <div className={styles.wrap}>
      {installEvent ? (
        <button
          className={styles.button}
          type="button"
          onClick={async () => {
            await installEvent.prompt();
            const choice = await installEvent.userChoice;
            if (choice.outcome === "accepted") setInstalled(true);
            setInstallEvent(null);
          }}
        >
          <Download aria-hidden="true" size={16} />
          Install app
        </button>
      ) : (
        <button
          className={styles.button}
          type="button"
          onClick={() => setShowHint((current) => !current)}
        >
          <Download aria-hidden="true" size={16} />
          {iosDevice ? "Add to Home Screen" : "Install on this phone"}
        </button>
      )}
      {showHint || (!installEvent && androidDevice) ? (
        <p className={styles.hint}>
          {iosDevice
            ? "Open the Share menu, then choose Add to Home Screen."
            : androidHint}
        </p>
      ) : null}
    </div>
  );
}
