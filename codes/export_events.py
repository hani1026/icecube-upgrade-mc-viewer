#!/usr/bin/env python3
"""Build a deterministic, stratified, unweighted gallery from native IceTray P frames."""
from pathlib import Path
from collections import Counter
import hashlib
import json
import math
import time
from icecube import dataio, dataclasses, simclasses, icetray

# CONFIG: edit these values, then run with the IceTray env-shell.
INPUT_ROOT = Path('/Volumes/T7/Data/IceCube_Upgrade/IC91')
OUTPUT_ROOT = Path(__file__).resolve().parents[1] / 'data'
GCD_NAME = 'GeoCalibDetectorStatus_ICUpgrade.v58.mixed.V1.i3.bz2'
DATASETS = {120029: 12, 121029: -12, 140029: 14, 141029: -14, 160029: 16, 161029: -16}
FILES_PER_DATASET = 30
EVENTS_PER_CELL = 2
ENERGY_EDGES = [1, 5, 15, 50, 150, 500.000001]
COSZEN_EDGES = [-1, -.6, -.2, .2, .6, 1.000001]
AZIMUTH_SECTORS = 4
SEED = 'upgrade-gallery-v1'


def finite(value):
    value = float(value)
    return value if math.isfinite(value) else None


def xyz(obj):
    return [finite(obj.x), finite(obj.y), finite(obj.z)]


def dump(path, data):
    path.write_text(json.dumps(data, separators=(',', ':'), allow_nan=False) + '\n')


def sha256(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def load_geometry():
    stream = dataio.I3File(str(INPUT_ROOT / GCD_NAME))
    geometry = None
    while stream.more():
        frame = stream.pop_frame()
        if frame.Stop != icetray.I3Frame.Geometry:
            continue
        modules, module_lookup = [], {}
        for key, geo in frame['I3ModuleGeoMap'].items():
            if int(geo.module_type) not in (20, 40, 110, 120):
                continue
            module_lookup[(key.string, key.om)] = len(modules)
            detector = 'Upgrade' if key.string >= 87 else 'DeepCore' if key.string >= 79 else 'IceCube'
            modules.append([key.string, key.om, *xyz(geo.pos), int(geo.module_type), detector])
        channels, channel_lookup = [], {}
        for key, geo in frame['I3Geometry'].omgeo.items():
            if (key.string, key.om) not in module_lookup:
                continue
            channel_lookup[(key.string, key.om, key.pmt)] = len(channels)
            channels.append([module_lookup[(key.string, key.om)], key.pmt, *xyz(geo.position), int(geo.omtype)])
        geometry = dict(modules=modules, channels=channels, surface_z=frame['DepthAtZ0'].value,
                        bedrock_z=frame['BedrockZ'].value, source=GCD_NAME,
                        module_fields=['string','om','x_m','y_m','z_m','type','detector'],
                        channel_fields=['module_index','pmt','x_m','y_m','z_m','type'])
        break
    stream.close()
    assert geometry is not None
    return geometry, channel_lookup


def particle_record(particle, parent):
    return dict(parent=parent, pdg=particle.pdg_encoding, type=str(particle.type),
                shape=str(particle.shape), energy=finite(particle.energy),
                pos=xyz(particle.pos), dir=xyz(particle.dir), time=finite(particle.time),
                length=finite(particle.length), speed=finite(particle.speed))


def extract_event(frame, event_id, source, dataset, cell, channel_lookup):
    primary = frame['MCInIcePrimary']
    header = frame['I3EventHeader']
    tree = frame['I3MCTree']
    particles = list(tree)
    lookup = {(p.id.majorID, p.id.minorID): i for i, p in enumerate(particles)}
    truth = []
    for particle in particles:
        parent = tree.parent(particle) if tree.has_parent(particle) else None
        parent_index = lookup[(parent.id.majorID, parent.id.minorID)] if parent is not None else None
        truth.append(particle_record(particle, parent_index))
    pulse_map = dataclasses.I3RecoPulseSeriesMap.from_frame(frame, 'SplitInIcePulses')
    pulses = []
    for key, series in pulse_map.items():
        channel = channel_lookup.get((key.string, key.om, key.pmt))
        if channel is None:
            return None, 'unknown_pulse_channel'
        for pulse in series:
            if not all(math.isfinite(v) for v in [pulse.time, pulse.charge, pulse.width]):
                return None, 'nonfinite_pulse'
            pulses.append([channel, pulse.time, pulse.charge, pulse.width, int(pulse.flags)])
    if not pulses:
        return None, 'empty_pulses'
    pulses.sort(key=lambda row: row[1])
    event = dict(id=event_id, dataset=dataset, source=source,
                 header=dict(run=header.run_id, subrun=header.sub_run_id, event=header.event_id,
                             subevent=header.sub_event_id, stream=header.sub_event_stream),
                 primary=particle_record(primary, None), interaction=int(frame['I3MCWeightDict']['InteractionType']),
                 zenith=primary.dir.zenith, azimuth=primary.dir.azimuth,
                 coszen=math.cos(primary.dir.zenith), cell=cell, truth=truth, pulses=pulses)
    return event, None


def bin_index(value, edges):
    return next((i for i in range(len(edges)-1) if edges[i] <= value < edges[i+1]), None)


def process_files(channel_lookup):
    selected, counts, diagnostics, manifest, inventories = {}, Counter(), Counter(), [], {}
    started = time.monotonic()
    required = ['QuesoL3_Bool','QuesoL4_Bool','QuesoL3_Vars_cleaned_num_hits_fid_vol',
                'MCInIcePrimary','I3MCWeightDict','I3MCTree','SplitInIcePulses','I3EventHeader']
    for dataset, expected_pdg in DATASETS.items():
        files = sorted((INPUT_ROOT/'genie'/str(dataset)).glob('*.i3.zst'))
        files = [p for p in files if not p.name.startswith('._')]
        inventories[str(dataset)] = len(files)
        nfiles = min(FILES_PER_DATASET, len(files))
        indices = sorted({round(i*(len(files)-1)/max(nfiles-1, 1)) for i in range(nfiles)})
        for sequence, index in enumerate(indices):
            path = files[index]
            relative = str(path.relative_to(INPUT_ROOT))
            stream = dataio.I3File(str(path))
            file_stats = Counter()
            while stream.more():
                frame = stream.pop_frame()
                if frame.Stop != icetray.I3Frame.Physics:
                    continue
                file_stats['p_frames'] += 1
                missing = [key for key in required if key not in frame]
                if missing:
                    file_stats['missing_keys'] += 1
                    for key in missing:
                        diagnostics['missing_key:' + key] += 1
                    continue
                if not (frame['QuesoL3_Bool'].value and frame['QuesoL4_Bool'].value and
                        frame['QuesoL3_Vars_cleaned_num_hits_fid_vol'].value >= 7):
                    file_stats['failed_queso'] += 1
                    continue
                primary = frame['MCInIcePrimary']
                if primary.pdg_encoding != expected_pdg:
                    file_stats['pdg_mismatch'] += 1
                    continue
                interaction = frame['I3MCWeightDict']['InteractionType']
                if interaction not in (1, 2):
                    diagnostics['unexpected_interaction:' + str(interaction)] += 1
                    file_stats['unexpected_interaction'] += 1
                    continue
                core = [primary.energy, primary.time, primary.dir.zenith, primary.dir.azimuth,
                        primary.pos.x,primary.pos.y,primary.pos.z]
                if not all(math.isfinite(value) for value in core):
                    file_stats['nonfinite_primary'] += 1
                    continue
                energy_bin = bin_index(primary.energy, ENERGY_EDGES)
                coszen_bin = bin_index(math.cos(primary.dir.zenith), COSZEN_EDGES)
                if energy_bin is None or coszen_bin is None:
                    file_stats['outside_bins'] += 1
                    continue
                azimuth_bin = min(AZIMUTH_SECTORS-1, int((primary.dir.azimuth % (2*math.pi))/(2*math.pi)*AZIMUTH_SECTORS))
                cell = [expected_pdg, int(interaction), energy_bin, coszen_bin, azimuth_bin]
                key = ','.join(map(str, cell))
                counts[key] += 1
                file_stats['eligible'] += 1
                header = frame['I3EventHeader']
                event_id = f'{dataset}-{path.stem.split("_")[-1].split(".")[0]}-{header.event_id}-{header.sub_event_id}'
                score = hashlib.sha256(f'{SEED}:{relative}:{event_id}:{header.sub_event_stream}'.encode()).hexdigest()
                bucket = selected.setdefault(key, [])
                if len(bucket) >= EVENTS_PER_CELL and score >= bucket[-1][0]:
                    continue
                event, error = extract_event(frame, event_id, relative, dataset, cell, channel_lookup)
                if error:
                    diagnostics[error] += 1
                    continue
                bucket.append((score, event))
                bucket.sort(key=lambda pair: pair[0])
                del bucket[EVENTS_PER_CELL:]
            stream.close()
            diagnostics.update(file_stats)
            manifest.append(dict(path=relative, dataset=dataset, bytes=path.stat().st_size,
                                 sha256=sha256(path), **file_stats))
            print(f'{dataset} file {sequence+1}/{nfiles}: {dict(file_stats)}; selected={sum(len(x) for x in selected.values())}; {time.monotonic()-started:.1f}s', flush=True)
    return [event for key in sorted(selected) for _,event in selected[key]], counts, diagnostics, manifest, inventories


def save_outputs(geometry, events, counts, diagnostics, manifest, inventories):
    (OUTPUT_ROOT/'events').mkdir(parents=True, exist_ok=True)
    dump(OUTPUT_ROOT/'geometry.json', geometry)
    catalogue = []
    quality = Counter()
    for event in events:
        path = OUTPUT_ROOT/'events'/f'{event["id"]}.json'
        dump(path, event)
        pulses, primary = event['pulses'], event['primary']
        catalogue.append(dict(id=event['id'], dataset=event['dataset'], pdg=primary['pdg'],
                              interaction=event['interaction'], energy=primary['energy'],
                              coszen=event['coszen'], azimuth=event['azimuth'], cell=event['cell'],
                              pulses=len(pulses), channels=len({p[0] for p in pulses}),
                              charge=sum(p[2] for p in pulses), sha256=sha256(path)))
        for particle in event['truth']:
            quality['truth_particles'] += 1
            if particle['length'] is None:
                quality['truth_missing_length'] += 1
            for field in ['energy','time','speed']:
                if particle[field] is None:
                    quality['truth_nonfinite_' + field] += 1
            if None in particle['pos'] or None in particle['dir']:
                quality['truth_nonfinite_position_or_direction'] += 1
        quality['pulses'] += len(pulses)
    occupancy = Counter(','.join(map(str, e['cell'])) for e in events)
    cells = []
    for pdg in DATASETS.values():
        for interaction in [1,2]:
            for energy in range(len(ENERGY_EDGES)-1):
                for coszen in range(len(COSZEN_EDGES)-1):
                    for azimuth in range(AZIMUTH_SECTORS):
                        cell = [pdg,interaction,energy,coszen,azimuth]
                        key = ','.join(map(str, cell))
                        cells.append(dict(cell=cell, eligible=counts[key], selected=occupancy[key]))
    for key in ['missing_keys','pdg_mismatch','nonfinite_primary','outside_bins','unknown_pulse_channel','nonfinite_pulse','empty_pulses']:
        diagnostics.setdefault(key,0)
    metadata = dict(schema_version=1, source='IC91 GENIE level4 Queso', pulse_key='SplitInIcePulses',
                    tree_key='I3MCTree', primary_key='MCInIcePrimary', energy_unit='GeV',
                    position_unit='m', time_unit='ns', charge_unit='PE',
                    pulse_fields=['channel_index','time_ns','charge_PE','width_ns','flags'],
                    selection=['Physics frames','QuesoL3_Bool','QuesoL4_Bool','QuesoL3_Vars_cleaned_num_hits_fid_vol >= 7'],
                    sampling=dict(seed=SEED, method='lowest deterministic SHA256 priorities per cell',
                                  events_per_cell=EVENTS_PER_CELL, files_per_dataset=FILES_PER_DATASET,
                                  energy_edges=ENERGY_EDGES, coszen_edges=COSZEN_EDGES,
                                  azimuth_sectors=AZIMUTH_SECTORS, weighted=False),
                    inventory=inventories, processed_files=len(manifest), events=len(events),
                    occupied_cells=sum(c['selected']>0 for c in cells), total_cells=len(cells),
                    diagnostics=dict(diagnostics), selected_quality=dict(quality), truncated_events=0,
                    gcd=dict(file=GCD_NAME, sha256=sha256(INPUT_ROOT/GCD_NAME)),
                    unavailable_categories=['MuonGun: T7 directories empty','Noise-only: T7 directory empty'],
                    truth_limitations=['Missing or nonfinite particle length is null; no trajectory is inferred.',
                                       'Direction guide is not a recorded neutrino flight path.',
                                       'Dark lepton parents are not drawn over their propagated child segments.',
                                       'All pulses retained, including noise and photons before/after primary time.',
                                       'Balanced gallery, not a flux-weighted population or detector-efficiency measurement.'])
    dump(OUTPUT_ROOT/'catalogue.json', catalogue)
    dump(OUTPUT_ROOT/'metadata.json', metadata)
    dump(OUTPUT_ROOT/'coverage.json', cells)
    dump(OUTPUT_ROOT/'manifest.json', manifest)
    print(json.dumps(metadata, indent=2), flush=True)


def main():
    geometry, channel_lookup = load_geometry()
    events, counts, diagnostics, manifest, inventories = process_files(channel_lookup)
    save_outputs(geometry, events, counts, diagnostics, manifest, inventories)


if __name__ == '__main__':
    main()
