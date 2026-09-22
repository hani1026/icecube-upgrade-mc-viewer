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

Public GitHub Pages rendering and controls are checked after deployment; results will be recorded here.
