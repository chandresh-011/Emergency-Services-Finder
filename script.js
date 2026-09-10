/* =========================================================
   BEACON — Emergency Services Finder
   script.js

   Uses only free, key-less services so the project runs
   out of the box:
     - Browser Geolocation API  -> user's live position
     - Leaflet.js + OpenStreetMap tiles -> the map
     - Overpass API (OSM data)  -> nearby hospitals / police / pharmacies
     - Google Maps URL scheme   -> turn-by-turn directions (no key needed)
     - auth.js (localStorage)   -> accounts, sessions
     - localStorage             -> per-user favorite contacts
     - Notification API         -> local (client-side) alerts,
                                   NOT true server push notifications
   ========================================================= */

(() => {
  "use strict";

  /* ---------- AUTH GUARD ---------- */
  // index.html already redirects before load if there's no session,
  // but this is a second safety net in case script.js ever runs
  // on a page without that inline guard.
  if (window.BeaconAuth) BeaconAuth.requireAuth();
  const session = window.BeaconAuth ? BeaconAuth.getSession() : null;

  /* ---------- CONFIG ---------- */
  const CONFIG = {
    defaultRadius: 5000,
    emergencyNumber: "112", // India's unified emergency number — change per country/course requirement
    overpassEndpoints: [
      "https://overpass-api.de/api/interpreter",
      "https://overpass.kumi.systems/api/interpreter"
    ],
    sosCountdownSeconds: 3
  };

  const TYPE_META = {
    hospital: { label: "Hospital", color: "#D8402E", icon: crossIcon() },
    police:   { label: "Police",   color: "#2E5FA3", icon: shieldIcon() },
    pharmacy: { label: "Pharmacy", color: "#1E8A5C", icon: pillIcon() }
  };

  /* ---------- STATE ---------- */
  const state = {
    map: null,
    youMarker: null,
    accuracyCircle: null,
    markersLayer: null,
    userLocation: null,      // { lat, lng, accuracy }
    places: [],               // all fetched places
    activeFilter: "all",
    radius: CONFIG.defaultRadius,
    watchId: null,
    sosTimer: null,
    sosSecondsLeft: CONFIG.sosCountdownSeconds,
    favorites: []              // this user's saved contacts
  };

  /* ---------- DOM ---------- */
  const $ = (id) => document.getElementById(id);
  const els = {
    statusPill: $("statusPill"),
    statusDot: $("statusDot"),
    statusText: $("statusText"),
    locateBtn: $("locateBtn"),
    hudLat: $("hudLat"),
    hudLng: $("hudLng"),
    hudAcc: $("hudAcc"),
    hudTime: $("hudTime"),
    filters: $("filters"),
    radiusSelect: $("radiusSelect"),
    resultsList: $("resultsList"),
    emptyState: $("emptyState"),
    locationHelp: $("locationHelp"),

    // user menu
    userMenuBtn: $("userMenuBtn"),
    userDropdown: $("userDropdown"),
    userNameLabel: $("userNameLabel"),
    userEmailLabel: $("userEmailLabel"),
    userAvatar: $("userAvatar"),
    openFavoritesBtn: $("openFavoritesBtn"),
    logoutBtn: $("logoutBtn"),

    // SOS
    sosBtn: $("sosBtn"),

    // step 1: choice
    sosChoiceModal: $("sosChoiceModal"),
    choiceFavorites: $("choiceFavorites"),
    choiceCall: $("choiceCall"),
    choiceCallNumber: $("choiceCallNumber"),
    sosChoiceCancel: $("sosChoiceCancel"),

    // step 2a: send to favorites
    favSendModal: $("favSendModal"),
    favSendList: $("favSendList"),
    favSendEmpty: $("favSendEmpty"),
    favSendConfirm: $("favSendConfirm"),
    favSendCancel: $("favSendCancel"),
    favSendManage: $("favSendManage"),
    favWhatsAppBtn: $("favWhatsAppBtn"),

    // step 2b: call confirm
    modal: $("sosModal"),
    sosCountdown: $("sosCountdown"),
    sosCountdownTitle: $("sosCountdownTitle"),
    sosNumberDisplay: $("sosNumberDisplay"),
    sosConfirmNow: $("sosConfirmNow"),
    sosCancel: $("sosCancel"),
    sosShareLoc: $("sosShareLoc"),

    // favorites manager
    favModal: $("favModal"),
    favForm: $("favForm"),
    favName: $("favName"),
    favPhone: $("favPhone"),
    favFormError: $("favFormError"),
    favList: $("favList"),
    favModalClose: $("favModalClose"),

    toast: $("toast")
  };

  els.sosNumberDisplay.textContent = CONFIG.emergencyNumber;
  els.choiceCallNumber.textContent = CONFIG.emergencyNumber;

  /* ---------- INIT ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    initUserMenu();
    loadFavorites();
    initMap();
    bindEvents();
    locateUser(); // auto-start on load; user can also press "Find services near me"

  });

  function bindEvents() {
    els.locateBtn.addEventListener("click", locateUser);

    els.radiusSelect.addEventListener("change", (e) => {
      state.radius = Number(e.target.value);
      if (state.userLocation) fetchNearbyPlaces();
    });

    els.filters.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      [...els.filters.children].forEach((c) => c.classList.remove("chip--active"));
      chip.classList.add("chip--active");
      state.activeFilter = chip.dataset.filter;
      renderResults();
      renderMarkers();
    });

    /* ---- SOS: step 1 choice ---- */
    els.sosBtn.addEventListener("click", openSosChoiceModal);
    els.sosChoiceCancel.addEventListener("click", closeSosChoiceModal);
    els.sosChoiceModal.addEventListener("click", (e) => {
      if (e.target === els.sosChoiceModal) closeSosChoiceModal();
    });
    els.choiceFavorites.addEventListener("click", () => {
      closeSosChoiceModal();
      openFavSendModal();
    });
    els.choiceCall.addEventListener("click", () => {
      closeSosChoiceModal();
      openSosModal();
    });

    /* ---- SOS: step 2a send to favorites ---- */
    els.favSendCancel.addEventListener("click", closeFavSendModal);
    els.favSendModal.addEventListener("click", (e) => {
      if (e.target === els.favSendModal) closeFavSendModal();
    });
    els.favSendConfirm.addEventListener("click", sendSosSmsToFavorites);
    els.favWhatsAppBtn.addEventListener("click", shareViaWhatsApp);
    els.favSendManage.addEventListener("click", () => {
      closeFavSendModal();
      openFavModal();
    });

    /* ---- SOS: step 2b call confirm ---- */
    els.sosCancel.addEventListener("click", closeSosModal);
    els.sosConfirmNow.addEventListener("click", triggerCall);
    els.sosShareLoc.addEventListener("click", shareLocation);
    els.modal.addEventListener("click", (e) => {
      if (e.target === els.modal) closeSosModal();
    });

    /* ---- Favorites manager ---- */
    els.openFavoritesBtn.addEventListener("click", () => {
      closeUserDropdown();
      openFavModal();
    });
    els.favModalClose.addEventListener("click", closeFavModal);
    els.favModal.addEventListener("click", (e) => {
      if (e.target === els.favModal) closeFavModal();
    });
    els.favForm.addEventListener("submit", handleAddFavorite);

    /* ---- User menu / logout ---- */
    els.logoutBtn.addEventListener("click", () => {
      if (window.BeaconAuth) BeaconAuth.logout();
    });
  }

  /* =========================================================
     USER MENU
     ========================================================= */
  function initUserMenu() {
    if (!session) return;
    const initial = (session.name || session.email || "U").trim().charAt(0).toUpperCase();
    els.userAvatar.textContent = initial || "U";
    els.userNameLabel.textContent = session.name || "Account";
    els.userEmailLabel.textContent = session.email || "";

    els.userMenuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = els.userDropdown.classList.toggle("user-menu__dropdown--open");
      els.userMenuBtn.setAttribute("aria-expanded", String(isOpen));
    });
    document.addEventListener("click", closeUserDropdown);
  }

  function closeUserDropdown() {
    els.userDropdown.classList.remove("user-menu__dropdown--open");
    els.userMenuBtn.setAttribute("aria-expanded", "false");
  }

  /* =========================================================
     FAVORITE CONTACTS (per-user, stored in localStorage)
     ========================================================= */
  function favoritesKey() {
    return `beacon_favorites_${session ? session.id : "guest"}`;
  }

  function loadFavorites() {
    try {
      state.favorites = JSON.parse(localStorage.getItem(favoritesKey())) || [];
    } catch {
      state.favorites = [];
    }
  }

  function saveFavorites() {
    localStorage.setItem(favoritesKey(), JSON.stringify(state.favorites));
  }

  function handleAddFavorite(e) {
    e.preventDefault();
    els.favFormError.textContent = "";

    const name = els.favName.value.trim();
    const phone = els.favPhone.value.trim();

    if (!name) { els.favFormError.textContent = "Please enter a name."; return; }
    if (!/^[0-9+\-()\s]{7,}$/.test(phone)) { els.favFormError.textContent = "Please enter a valid phone number."; return; }

    state.favorites.push({ id: `f_${Date.now()}`, name, phone });
    saveFavorites();
    els.favForm.reset();
    renderFavList();
    showToast(`${name} added to favorites.`);
  }

  function removeFavorite(id) {
    state.favorites = state.favorites.filter((f) => f.id !== id);
    saveFavorites();
    renderFavList();
  }

  function renderFavList() {
    if (!state.favorites.length) {
      els.favList.innerHTML = `<p class="fav-list__empty">No favorite contacts yet. Add someone above.</p>`;
      return;
    }
    els.favList.innerHTML = state.favorites.map((f) => `
      <div class="fav-item">
        <div>
          <p class="fav-item__name">${escapeHtml(f.name)}</p>
          <p class="fav-item__phone">${escapeHtml(f.phone)}</p>
        </div>
        <button class="fav-item__remove" data-remove-fav="${f.id}" aria-label="Remove ${escapeHtml(f.name)}">&times;</button>
      </div>
    `).join("");

    els.favList.querySelectorAll("[data-remove-fav]").forEach((btn) => {
      btn.addEventListener("click", () => removeFavorite(btn.dataset.removeFav));
    });
  }

  function openFavModal() {
    renderFavList();
    els.favModal.setAttribute("aria-hidden", "false");
  }
  function closeFavModal() {
    els.favModal.setAttribute("aria-hidden", "true");
  }

  /* =========================================================
     MAP
     ========================================================= */
  function initMap() {
    state.map = L.map("map", { zoomControl: true }).setView([20.5937, 78.9629], 5);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(state.map);

    state.markersLayer = L.layerGroup().addTo(state.map);
  }

  function placeYouMarker(lat, lng, accuracy) {
    if (state.youMarker) {
      state.youMarker.setLatLng([lat, lng]);
    } else {
      state.youMarker = L.marker([lat, lng], {
        icon: L.divIcon({ className: "", html: '<div class="you-marker"></div>', iconSize: [18, 18] }),
        zIndexOffset: 1000
      }).addTo(state.map).bindPopup("You are here");
    }

    if (state.accuracyCircle) {
      state.accuracyCircle.setLatLng([lat, lng]).setRadius(accuracy || 0);
    } else {
      state.accuracyCircle = L.circle([lat, lng], {
        radius: accuracy || 0,
        color: "#0C6E68",
        fillColor: "#0C6E68",
        fillOpacity: 0.08,
        weight: 1
      }).addTo(state.map);
    }
  }

  function renderMarkers() {
    state.markersLayer.clearLayers();
    const list = filteredPlaces();
    list.forEach((p) => {
      const meta = TYPE_META[p.type];
      const icon = L.divIcon({
        className: "",
        html: `<div class="pin pin--${p.type}">${meta.icon}</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 26]
      });
      const marker = L.marker([p.lat, p.lng], { icon }).addTo(state.markersLayer);
      marker.bindPopup(popupHtml(p));
    });
  }

  function popupHtml(p) {
    const meta = TYPE_META[p.type];
    return `
      <strong>${escapeHtml(p.name)}</strong><br/>
      <span style="color:${meta.color}; font-weight:600; font-size:.75rem; text-transform:uppercase;">${meta.label}</span><br/>
      ${p.address ? `${escapeHtml(p.address)}<br/>` : ""}
      ${p.distance != null ? `${formatDistance(p.distance)} away` : ""}
    `;
  }

  /* =========================================================
     GEOLOCATION (one-shot + real-time tracking)
     ========================================================= */
  function locateUser() {
    if (!("geolocation" in navigator)) {
      handleLocationFailure("Your browser does not support location services.");
      return;
    }

    setStatus("locating", "Locating you\u2026");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        handlePosition(pos);
        startWatching();
        state.map.setView([pos.coords.latitude, pos.coords.longitude], 14);
        fetchNearbyPlaces();
      },
      (err) => {
        handleLocationFailure(geoErrorMessage(err));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  function startWatching() {
    if (state.watchId != null) return; // already tracking
    state.watchId = navigator.geolocation.watchPosition(
      (pos) => handlePosition(pos),
      () => { /* keep last known location on transient watch errors */ },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
  }

  function handlePosition(pos) {
    const { latitude, longitude, accuracy } = pos.coords;
    state.userLocation = { lat: latitude, lng: longitude, accuracy };
    placeYouMarker(latitude, longitude, accuracy);
    updateHud(latitude, longitude, accuracy);
    setStatus("live", "Location active");
    if (els.locationHelp) els.locationHelp.hidden = true;
    if (state.places.length) {
      recomputeDistances();
      renderResults();
    }
  }

  function handleLocationFailure(message) {
    state.userLocation = null;
    setStatus("error", "Location permission needed");
    if (els.locationHelp) {
      els.locationHelp.hidden = false;
      els.locationHelp.innerHTML = `<span>${escapeHtml(message)} Please allow location access and try again.</span><button type="button" id="retryLocationBtn">Try again</button>`;
      const retry = $("retryLocationBtn");
      if (retry) retry.addEventListener("click", locateUser);
    }
    renderEmpty("Location is required to search nearby emergency services.");
    showToast(message);
  }

  function updateHud(lat, lng, accuracy) {
    els.hudLat.textContent = lat.toFixed(5);
    els.hudLng.textContent = lng.toFixed(5);
    els.hudAcc.textContent = accuracy != null ? `\u00B1${Math.round(accuracy)} m` : "\u2014";
    els.hudTime.textContent = new Date().toLocaleTimeString();
  }

  function setStatus(kind, text) {
    els.statusPill.classList.remove("status-pill--live", "status-pill--error");
    if (kind === "live") els.statusPill.classList.add("status-pill--live");
    if (kind === "error") els.statusPill.classList.add("status-pill--error");
    els.statusText.textContent = text;
  }

  function geoErrorMessage(err) {
    switch (err.code) {
      case err.PERMISSION_DENIED:
        return "Location access was denied.";
      case err.POSITION_UNAVAILABLE:
        return "Your location is temporarily unavailable.";
      case err.TIMEOUT:
        return "Location request timed out.";
      default:
        return "Couldn't get your current location.";
    }
  }

  /* =========================================================
     OVERPASS (nearby places)
     ========================================================= */
  async function fetchNearbyPlaces() {
    if (!state.userLocation) return;
    setResultsLoading();

    const { lat, lng } = state.userLocation;
    const radius = state.radius;

    const query = `
      [out:json][timeout:25];
      (
        node["amenity"="hospital"](around:${radius},${lat},${lng});
        way["amenity"="hospital"](around:${radius},${lat},${lng});
        node["amenity"="police"](around:${radius},${lat},${lng});
        way["amenity"="police"](around:${radius},${lat},${lng});
        node["amenity"="pharmacy"](around:${radius},${lat},${lng});
        way["amenity"="pharmacy"](around:${radius},${lat},${lng});
      );
      out center tags;
    `;

    let data = null;
    let lastError = null;

    for (const endpoint of CONFIG.overpassEndpoints) {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: query
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        data = await res.json();
        break;
      } catch (e) {
        lastError = e;
      }
    }

    if (!data) {
      console.error(lastError);
      showToast("Couldn't reach the places service. Check your connection and try again.");
      renderEmpty("We couldn't load nearby services right now. Try again in a moment.");
      return;
    }

    state.places = (data.elements || [])
      .map(elementToPlace)
      .filter(Boolean);

    recomputeDistances();
    renderResults();
    renderMarkers();
  }

  function elementToPlace(el) {
    const tags = el.tags || {};
    const type = tags.amenity;
    if (!TYPE_META[type]) return null;

    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (lat == null || lng == null) return null;

    return {
      id: `${el.type}/${el.id}`,
      type,
      name: tags.name || `Unnamed ${TYPE_META[type].label}`,
      address: buildAddress(tags),
      phone: tags.phone || tags["contact:phone"] || null,
      lat,
      lng,
      distance: null
    };
  }

  function buildAddress(tags) {
    const parts = [
      [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" "),
      tags["addr:suburb"],
      tags["addr:city"]
    ].filter(Boolean);
    return parts.join(", ");
  }

  function recomputeDistances() {
    if (!state.userLocation) return;
    state.places.forEach((p) => {
      p.distance = haversine(state.userLocation.lat, state.userLocation.lng, p.lat, p.lng);
    });
    state.places.sort((a, b) => a.distance - b.distance);
  }

  function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function formatDistance(m) {
    return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
  }

  /* =========================================================
     RESULTS LIST
     ========================================================= */
  function filteredPlaces() {
    if (state.activeFilter === "all") return state.places;
    return state.places.filter((p) => p.type === state.activeFilter);
  }

  function setResultsLoading() {
    els.resultsList.innerHTML = `
      <div class="empty-state">
        <p>Searching nearby\u2026</p>
        <p class="empty-state__sub">Pulling live data from OpenStreetMap for a ${(state.radius / 1000).toFixed(0)} km radius.</p>
      </div>`;
  }

  function renderEmpty(message) {
    els.resultsList.innerHTML = `
      <div class="empty-state">
        <p>${escapeHtml(message)}</p>
      </div>`;
  }

  function renderResults() {
    const list = filteredPlaces();

    if (!list.length) {
      renderEmpty("No matching services found in this radius. Try a wider search radius.");
      return;
    }

    els.resultsList.innerHTML = list.map(cardHtml).join("");

    // wire up action buttons (delegate)
    els.resultsList.querySelectorAll("[data-directions]").forEach((btn) => {
      btn.addEventListener("click", () => openDirections(btn.dataset.lat, btn.dataset.lng));
    });
  }

  function cardHtml(p) {
    const meta = TYPE_META[p.type];
    return `
      <article class="card">
        <div class="card__top">
          <span class="card__type card__type--${p.type}">${meta.label}</span>
          <span class="card__distance">${p.distance != null ? formatDistance(p.distance) : ""}</span>
        </div>
        <h3 class="card__name">${escapeHtml(p.name)}</h3>
        ${p.address ? `<p class="card__address">${escapeHtml(p.address)}</p>` : `<p class="card__address">Address not listed on OpenStreetMap</p>`}
        ${p.phone ? `<p class="card__phone">${escapeHtml(p.phone)}</p>` : ""}
        <div class="card__actions">
          <button class="btn btn--primary" data-directions data-lat="${p.lat}" data-lng="${p.lng}">Directions</button>
          ${p.phone ? `<a class="btn btn--ghost" href="tel:${p.phone.replace(/\s+/g, "")}">Call</a>` : ""}
        </div>
      </article>`;
  }

  function openDirections(lat, lng) {
    const origin = state.userLocation ? `${state.userLocation.lat},${state.userLocation.lng}` : "";
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${lat},${lng}&travelmode=driving`;
    window.open(url, "_blank", "noopener");
  }

  /* =========================================================
     SOS FLOW — STEP 1: choose favorites vs call
     ========================================================= */
  function openSosChoiceModal() {
    els.sosChoiceModal.setAttribute("aria-hidden", "false");
  }
  function closeSosChoiceModal() {
    els.sosChoiceModal.setAttribute("aria-hidden", "true");
  }

  /* =========================================================
     SOS FLOW — STEP 2A: send location to favorites
     ========================================================= */
  function openFavSendModal() {
    renderFavSendList();
    els.favSendModal.setAttribute("aria-hidden", "false");
  }
  function closeFavSendModal() {
    els.favSendModal.setAttribute("aria-hidden", "true");
  }

  function renderFavSendList() {
    if (!state.favorites.length) {
      els.favSendList.innerHTML = "";
      els.favSendEmpty.style.display = "block";
      els.favSendConfirm.disabled = true;
      return;
    }
    els.favSendEmpty.style.display = "none";
    els.favSendConfirm.disabled = false;

    els.favSendList.innerHTML = state.favorites.map((f) => `
      <label class="fav-send-row">
        <input type="checkbox" value="${f.id}" checked />
        <span>
          <span class="fav-item__name">${escapeHtml(f.name)}</span>
          <span class="fav-item__phone">${escapeHtml(f.phone)}</span>
        </span>
      </label>
    `).join("");
  }

  function buildEmergencyMessage(prefix = "EMERGENCY: I need help.") {
    if (!state.userLocation) return null;
    const { lat, lng } = state.userLocation;
    const mapsLink = `https://www.google.com/maps?q=${lat},${lng}`;
    return `${prefix} My current location: ${mapsLink}`;
  }

  function getSelectedFavoriteContacts() {
    const selectedIds = [...els.favSendList.querySelectorAll("input[type=checkbox]:checked")]
      .map((cb) => cb.value);

    return state.favorites.filter((f) => selectedIds.includes(f.id));
  }

  function sendSosSmsToFavorites() {
    if (!state.userLocation) {
      showToast("Find your location first, then try SOS sharing again.");
      return;
    }

    const selected = getSelectedFavoriteContacts();

    if (!selected.length) {
      showToast("Select at least one contact.");
      return;
    }

    const message = buildEmergencyMessage(
      "SOS ALERT: I need immediate help."
    );

    /*
      Browsers cannot silently send an SMS. The sms: URI opens the
      phone's SMS composer with the recipient and message pre-filled.
      The user must press Send.
    */
    const contact = selected[0];
    const smsUrl =
      `sms:${encodeURIComponent(contact.phone)}?body=${encodeURIComponent(message)}`;

    closeFavSendModal();
    window.location.href = smsUrl;

    if (selected.length === 1) {
      showToast(`SOS SMS prepared for ${contact.name}. Press Send to send it.`);
    } else {
      showToast(
        `SOS SMS prepared for ${contact.name}. For multiple contacts, repeat for the others.`
      );
    }
  }

  function openShareOptions(message, selected = []) {
    if (navigator.share) {
      navigator.share({ title: "Emergency location", text: message })
        .then(() => showToast("Sharing options opened."))
        .catch(() => showToast("Sharing was cancelled."));
      return;
    }

    const phone = selected[0]?.phone || "";
    const smsUrl = `sms:${encodeURIComponent(phone)}?body=${encodeURIComponent(message)}`;
    window.location.href = smsUrl;
    showToast("SMS composer opened. Review and send the message.");
  }

  function shareViaWhatsApp() {
    if (!state.userLocation) {
      showToast("Find your location first.");
      return;
    }
    const message = buildEmergencyMessage();
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener");
  }

  /* =========================================================
     SOS FLOW — STEP 2B: call emergency number
     ========================================================= */
  function openSosModal() {
    els.modal.setAttribute("aria-hidden", "false");
    state.sosSecondsLeft = CONFIG.sosCountdownSeconds;
    updateCountdownText();

    clearInterval(state.sosTimer);
    state.sosTimer = setInterval(() => {
      state.sosSecondsLeft -= 1;
      if (state.sosSecondsLeft <= 0) {
        clearInterval(state.sosTimer);
        triggerCall();
        return;
      }
      updateCountdownText();
    }, 1000);
  }

  function updateCountdownText() {
    els.sosCountdown.textContent = state.sosSecondsLeft;
  }

  function closeSosModal() {
    clearInterval(state.sosTimer);
    els.modal.setAttribute("aria-hidden", "true");
  }

  function triggerCall() {
    clearInterval(state.sosTimer);
    els.modal.setAttribute("aria-hidden", "true");
    window.location.href = `tel:${CONFIG.emergencyNumber}`;
    showToast(`Dialing ${CONFIG.emergencyNumber}\u2026`);
    notifyLocal("Calling emergency services", `Dialing ${CONFIG.emergencyNumber}.`);
  }

  function shareLocation() {
    if (!state.userLocation) {
      showToast("Find your location first.");
      return;
    }
    openShareOptions(buildEmergencyMessage("I need help."));
    closeSosModal();
  }

  /* =========================================================
     NOTIFICATIONS
     Local, permission-based alerts via the browser Notification
     API. This fires only while Beacon is open in this browser —
     it is NOT true push (which would need a backend + service
     worker + a push service), but it's a reasonable client-only
     stand-in for confirming SOS actions happened.
     ========================================================= */
  function requestNotificationPermission() {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }

  function notifyLocal(title, body) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    try {
      new Notification(title, { body, icon: undefined });
    } catch {
      // Some browsers (notably iOS Safari web apps) don't support this — fail silently.
    }
  }

  /* =========================================================
     TOAST
     ========================================================= */
  let toastTimer = null;
  function showToast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add("toast--show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove("toast--show"), 3800);
  }

  /* ---------- helpers ---------- */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function crossIcon() {
    return '<svg viewBox="0 0 24 24" fill="white"><path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7V3Z"/></svg>';
  }
  function shieldIcon() {
    return '<svg viewBox="0 0 24 24" fill="white"><path d="M12 2 4 5v6c0 5 3.4 9 8 11 4.6-2 8-6 8-11V5l-8-3Z"/></svg>';
  }
  function pillIcon() {
    return '<svg viewBox="0 0 24 24" fill="white"><path d="M4.5 4.5a5.5 5.5 0 0 1 7.8 0l7.2 7.2a5.5 5.5 0 1 1-7.8 7.8l-7.2-7.2a5.5 5.5 0 0 1 0-7.8Zm3.9 3.9-3.2 3.2 6.2 6.2 3.2-3.2Z"/></svg>';
  }
})();