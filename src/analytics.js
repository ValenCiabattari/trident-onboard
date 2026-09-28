(function setupTridentAnalytics() {
  const config = window.TRIDENT_ANALYTICS_CONFIG || {};
  const measurementId = String(config.measurementId || "").trim();
  const isConfigured = /^G-[A-Z0-9]+$/i.test(measurementId);
  const consentKey = "trident-analytics-consent-v1";
  let enabled = false;
  let loadPromise = null;

  function consentState() {
    try {
      return localStorage.getItem(consentKey);
    } catch {
      return null;
    }
  }

  function saveConsent(value) {
    try {
      localStorage.setItem(consentKey, value);
    } catch {}
  }

  function queueGtag() {
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag() {
      window.dataLayer.push(arguments);
    };
  }

  function loadGoogleAnalytics() {
    if (!isConfigured) return Promise.resolve(false);
    if (loadPromise) return loadPromise;

    queueGtag();
    window.gtag("consent", "default", {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    window.gtag("consent", "update", { analytics_storage: "granted" });
    window.gtag("js", new Date());
    window.gtag("config", measurementId, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });

    loadPromise = new Promise((resolve) => {
      const script = document.createElement("script");
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.head.append(script);
    });
    enabled = true;
    return loadPromise;
  }

  function disableAnalytics() {
    enabled = false;
    if (window.gtag) {
      window.gtag("consent", "update", { analytics_storage: "denied" });
    }
  }

  function track(eventName, parameters = {}) {
    if (!enabled || !window.gtag) return;
    window.gtag("event", eventName, parameters);
  }

  window.tridentAnalytics = {
    configured: isConfigured,
    track,
  };

  document.addEventListener("DOMContentLoaded", () => {
    const banner = document.querySelector("#analyticsConsent");
    const preferences = document.querySelector("#analyticsPreferencesBtn");
    const accept = document.querySelector("#analyticsAcceptBtn");
    const decline = document.querySelector("#analyticsDeclineBtn");
    if (!isConfigured || !banner || !preferences || !accept || !decline) return;

    preferences.hidden = false;
    const choice = consentState();
    if (choice === "granted") loadGoogleAnalytics();
    else if (choice !== "denied") banner.hidden = false;

    preferences.addEventListener("click", () => { banner.hidden = false; });
    accept.addEventListener("click", () => {
      saveConsent("granted");
      banner.hidden = true;
      loadGoogleAnalytics();
    });
    decline.addEventListener("click", () => {
      saveConsent("denied");
      banner.hidden = true;
      disableAnalytics();
    });

    document.querySelector(".guide-button")?.addEventListener("click", () => {
      track("guide_opened", { guide_format: "pdf" });
    });
  });
}());
