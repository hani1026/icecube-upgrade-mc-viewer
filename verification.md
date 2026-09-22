# Verification

## Source and geometry checks

`codes/validate_export.py` reopens every selected native P frame and compares exact values, independently of the exporter. The full report is in `data/validation.json`.

- 2,368 events, 325,537 pulses, 26,591 truth particles: exact match.
- 5,854 optical modules and 15,378 PMT positions: exact GCD match.
- Queso cuts, MC primary, CC/NC, directions and full truth parent indices checked for every event.
- Event JSON SHA256 values checked against the catalogue; native source files and GCD checked against the manifest.
- No pulse truncation; unavailable truth lengths remain null.

`node tests.cjs` passes event integrity, coverage, native coordinate/direction conventions, 1,559 renderable finite lepton segments, and prevention of invented or double-drawn tracks. `node --check app.js` passes.

## Browser checks

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
