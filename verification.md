# Verification

## Source and geometry checks

`codes/validate_export.py` reopens every selected native P frame and compares exact values, independently of the exporter. The full report is in `data/validation.json`.

- 2,368 events, 325,537 pulses, 26,591 truth particles: exact match.
- 5,854 optical modules and 15,378 PMT positions: exact GCD match.
- Queso cuts, MC primary, CC/NC, directions and full truth parent indices checked for every event.
- Event JSON SHA256 values checked against the catalogue; native source files and GCD checked against the manifest.
- No pulse truncation; unavailable truth lengths remain null.

`node tests.cjs` passes event integrity, coverage, native coordinate/direction conventions, 1,559 renderable finite lepton segments, and prevention of invented or double-drawn tracks. `node --check app.js` passes.

## Previous UI browser checks (before the original-style restoration)

Verified on the public HTTPS site in the Codex browser (desktop 1280 × 720 and responsive 390 × 844):

- The 3D detector, native pulse markers, recorded muon paths, dashed direction guide, ice column and bedrock render successfully.
- All 12 flavor/sign/interaction combinations load real events; energy, cos(zenith), and azimuth filters narrow the catalogue.
- An intentionally empty anti-ντ CC cell (1–5 GeV, cos θ −1 to −0.6, azimuth 180–270°) shows no event and disables event navigation; widening energy restores real data.
- For event `141029-000862-903-0`, the midpoint slider shows 85 / 118 pulses at +1.70 µs. Switching the dust overlay off retains the same time and pulse count.
- Play restarts at early pulses and advances the actual event timeline. The play/pause label is synchronized with its state. Versioned app assets prevent a cached older script from surviving an update.
- Event details for `161029-000096-1055-0` show the source file, 68 pulses / 50 channels, 14 truth particles and zero stored finite lepton segments; no tau path is invented.
- Copy link reports success. Reloading its event hash restores the identical event. The browser automation clipboard readback did not return content, so clipboard contents were not independently verified.
- Mobile layout keeps the scene and timeline above the vertically scrollable filters, with Options always expanded; the temporary viewport override was reset.
- Browser error-log inspection returned no errors during category/filter checks.

The checks validate a representative set of visible interactions. The exact native-data validator covers all exported events, separately from browser rendering.

## Original-style revision

- Full-data tests: 2,368 event payload SHA256 values remain unchanged; all 325,537 pulses preserved.
- Native finite paths remain 1,559. The endpoint fallback produces no extra segments for these source records.
- 144 combinations of particle/sign/interaction, energy extremes and zenith directions return correctly classified, distance-ranked native events.
- Endpoint tests verify zero displacement for shared birth vertices, preservation of a 1 mm tau displacement, proper parent identity for neutrino-to-tau connections, rejection of ambiguous endpoints, and suppression of duplicate propagated tracks.
- The public revision restores the original segmented controls, energy/zenith sliders, glass panel, full canvas and compact playback bar. Desktop screenshot comparison used the original published viewer as the reference.
- Changing electron-neutrino / 100 GeV / 60° selects the nearest native event; its actual energy and zenith are shown separately. Electron event details show Δr = 0 and Δt = 0. The focused scene displays a colored e+ marker at the shared recorded birth point.
- `node scene.test.cjs` builds real Three.js scene objects on the CPU, checks exact native track endpoints for all three flavors, Earth/Detector visibility and theme rebuilding. WebGL rendering is checked separately in the public browser.
- Event selection no longer rewrites the URL for every slider change: embedded-browser navigation was resetting the requested controls. Explicit Copy link / Event link still encode the current event.

## Incoming neutrino animation (v5)

- Back-extrapolate the final 2,000 m along the normalized primary propagation vector; use c = 0.299792458 m/ns and the stored interaction time as the endpoint. This path is explicitly a direction extrapolation, separate from stored truth segments.
- A moving flavor-colored ν marker and dashed trail disappear at the interaction; recorded daughter markers and pulses retain their original times and positions. Replay and scrubbing reconstruct the same incoming position.
- All 2,368 event checksums and 325,537 pulses passed the existing integrity checks. Added checks cover incoming endpoints, direction, length and time of flight for every event. Three.js scene checks cover start, midpoint, arrival and rewind for all three flavors.
- Local browser inspection of event 120029-000879-751-0 at t = −4,172 ns shows the incoming νe marker below the detector on its upward flight, with no interaction marker yet.
