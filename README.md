# IceCube Upgrade MC explorer

[Open the viewer](https://hani1026.github.io/icecube-upgrade-mc-viewer/) · [Sampling coverage](https://hani1026.github.io/icecube-upgrade-mc-viewer/coverage.html)

A browser gallery of **2,368 native IC91 Upgrade GENIE Monte Carlo events**, with stored particle truth and `SplitInIcePulses` in the matching GCD geometry. No reconstruction or browser-generated events. This repository is independent of the earlier illustrative [event viewer](https://github.com/hani1026/icecube-event-viewer).

Select flavor, neutrino/antineutrino, CC/NC, energy, zenith direction and azimuth. The timeline plays actual pulse times relative to the primary interaction. Use Event / Detector / Ice column to change the camera; drag to orbit, scroll or pinch to zoom, and shift-drag to pan. Copy link preserves the exact event.

## What is shown

- Geometry: `GeoCalibDetectorStatus_ICUpgrade.v58.mixed.V1.i3.bz2`; 5,854 optical modules, 15,378 PMT channels. Native GCD Cartesian metres, with +z upward.
- Ice surface z = 1,948.07 m and bedrock z = −861.93 m come from the GCD (`DepthAtZ0`, `BedrockZ`), giving **2,810 m** ice thickness. The local 1.9 km square column and 200 m rock slice illustrate surrounding material, not mapped terrain.
- Solid mint lines: finite charged-lepton segments recorded in `I3MCTree`. Positions, directions, lengths and speeds use native values; no spatial enlargement. Dark summary parents are omitted from the drawing to avoid double-drawing propagated child segments.
- White vertex and pale shower points: stored locations, not an inferred shower extent. Electron/tau lengths can be absent (`NaN` in i3, `null` in JSON); no trajectory or tau decay is invented. Many tau CC records in this production contain a tau with no stored length or decay daughters.
- Dashed neutrino line: a **direction guide of arbitrary display length**, not a recorded incoming flight path, production height, or interaction-to-surface segment. IceCube `dir.x/y/z` is used directly; `coszen = cos(zenith)` has the opposite sign to propagation-vector z.
- Pulse markers: all native PMT pulse entries retained in JSON, combined by optical module only for drawing. Marker size follows cumulative charge; marker color follows the module's earliest pulse in the full event window. Point/line widths are screen glyphs, not physical sensor or shower dimensions. Data are never rescaled spatially.
- Full recorded time window, including early/late noise-like pulses. Time zero is `MCInIcePrimary.time`; negative times are allowed. Playback retains cumulative charge, not instantaneous photon illumination.
- Dust band: schematic 2,000–2,100 m depth overlay, not an extracted ice-model profile. It changes visibility only. Attenuation/scattering in pulses remain those already present in the production MC; the viewer does not apply extra attenuation.

## Sample and provenance

| Dataset | Primary | CC | NC |
|---|---|---:|---:|
| 120029 | νe | 200 | 196 |
| 121029 | anti-νe | 200 | 191 |
| 140029 | νμ | 200 | 197 |
| 141029 | anti-νμ | 200 | 198 |
| 160029 | ντ | 193 | 200 |
| 161029 | anti-ντ | 193 | 200 |

The input drive contained 15,079 GENIE files. The export scans 30 evenly spaced files from each sorted dataset list: **180 files / 132,035 Physics frames**. Selection requires `QuesoL3_Bool`, `QuesoL4_Bool`, and `QuesoL3_Vars_cleaned_num_hits_fid_vol >= 7`. Primary PDG is verified against each dataset; `InteractionType` 1/2 supplies CC/NC. There are 83,009 eligible candidates, 49,011 failed Queso selections, and 15 unexpected interaction-code-0 records excluded explicitly.

Sampling cells are sign/flavor × CC/NC × 5 energy bins (1, 5, 15, 50, 150, 500 GeV) × 5 equal cos(zenith) bins × 4 azimuth sectors. Each cell retains up to two events with the smallest seeded SHA256 priority. **1,194 of 1,200 cells are populated**; empty or single-event cells are reported, not filled synthetically. The balanced sample is **not flux weighted** and must not be used as an event-rate or detector-efficiency distribution. No physics weights are mixed between datasets.

MuonGun `130028` / `131029` and noise `880028` folders on this drive were empty, so this gallery contains neutrinos and antineutrinos only. Native neutrino-event noise remains in `SplitInIcePulses`.

- [Metadata](data/metadata.json): configuration, cuts, units and diagnostics.
- [Manifest](data/manifest.json): exact relative input paths, sizes, SHA256 hashes and frame counts.
- [Coverage](data/coverage.json): candidate and selected counts for every cell.
- [Catalogue](data/catalogue.json): lightweight filter index and per-event SHA256 hashes.
- [Validation](data/validation.json): independent exact comparison against the native i3 frames and GCD.

Each lazy-loaded `data/events/<id>.json` contains event-header identifiers, source file, primary, full parent-linked truth tree and every pulse as `[channel_index, time_ns, charge_PE, width_ns, flags]`. Channel indices resolve through `geometry.json`, which preserves module and PMT positions. No event or pulse truncation is applied. All finite native values use full JSON precision; nonfinite truth values are explicit nulls. Large raw i3 files are not included.

## Rebuild and verify

Requires a compatible IceTray environment with `dataio`, `dataclasses`, `simclasses` and `icetray`. Edit the top CONFIG in `codes/export_events.py` and `codes/validate_export.py` to point to the MC drive, then run both using your IceTray `env-shell.sh` and its Python:

```sh
/path/to/icetray/build/env-shell.sh /path/to/icetray/python codes/export_events.py
/path/to/icetray/build/env-shell.sh /path/to/icetray/python codes/validate_export.py
node tests.cjs
```

The exporter follows the inspected Upgrade MC production reference (`Transformer_For_Upgrade/legacy/01_data_check/00_upgrade_mc_reference.md`) for P-frame cuts and schema. The validator reads every selected event back from its native source and checks exact primary, full tree including parent indices, every pulse field, GCD module/PMT positions and file hashes. Browser UI checks are recorded in `verification.md`.

For local development, serve this folder over HTTP (JSON is fetched, so opening `index.html` as `file://` is not supported):

```sh
python3 -m http.server 8000
```

GitHub Pages publishes the root of `main` with `.nojekyll`. No build step, runtime server, external CDN, login, or analytics. Three.js r152 is vendored with its [MIT license](vendor/THREE-LICENSE.txt). MC provenance remains as documented above; no new license for the input MC is asserted.
