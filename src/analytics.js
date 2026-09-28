(function setupTridentAnalytics() {
  const config = window.TRIDENT_ANALYTICS_CONFIG || {};
  const measurementId = String(config.measurementId || "").trim();
  const isConfigured = /^G-[A-Z0-9]+$/i.test(measurementId);
  let enabled = false;

  function queueGtag() {
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag() {
      window.dataLayer.push(arguments);
    };
  }

  function loadGoogleAnalytics() {
    if (!isConfigured || enabled) return;

    queueGtag();
    window.gtag("js", new Date());
    window.gtag("config", measurementId, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    document.head.append(script);
    enabled = true;
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
    loadGoogleAnalytics();

    document.querySelector(".guide-button")?.addEventListener("click", () => {
      track("guide_opened", { guide_format: "pdf" });
    });
  });
}());
