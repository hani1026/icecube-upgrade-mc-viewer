#!/usr/bin/env python3
"""Independent, exact comparison of every exported event against its source P frame."""
from pathlib import Path
from collections import defaultdict, Counter
import hashlib
import json
import math
from icecube import dataio, dataclasses, simclasses, icetray

# CONFIG
INPUT_ROOT = Path('/Volumes/T7/Data/IceCube_Upgrade/IC91')
DATA_ROOT = Path(__file__).resolve().parents[1] / 'data'
REPORT_PATH = DATA_ROOT / 'validation.json'


def load_inputs():
    catalogue = json.loads((DATA_ROOT/'catalogue.json').read_text())
    geometry = json.loads((DATA_ROOT/'geometry.json').read_text())
    groups = defaultdict(dict)
    for entry in catalogue:
        path = DATA_ROOT/'events'/f'{entry["id"]}.json'
        assert hashlib.sha256(path.read_bytes()).hexdigest() == entry['sha256']
        event = json.loads(path.read_text())
        assert entry['id'] == event['id']
        header = event['header']
        key = (header['run'], header['subrun'], header['event'], header['subevent'], header['stream'])
        assert key not in groups[event['source']]
        groups[event['source']][key] = event
    return catalogue, geometry, groups


def equivalent(value, stored):
    return (stored is None and not math.isfinite(value)) or value == stored


def check_particle(particle, saved):
    assert particle.pdg_encoding == saved['pdg']
    assert str(particle.type) == saved['type'] and str(particle.shape) == saved['shape']
    for key in ['energy','time','length','speed']:
        assert equivalent(float(getattr(particle,key)), saved[key]), key
    for native, name in [(particle.pos,'pos'),(particle.dir,'dir')]:
        assert all(equivalent(float(getattr(native,axis)), value) for axis,value in zip(['x','y','z'],saved[name]))


def process(catalogue, geometry, groups):
    stats = Counter()
    manifest = {item['path']:item for item in json.loads((DATA_ROOT/'manifest.json').read_text())}
    metadata = json.loads((DATA_ROOT/'metadata.json').read_text())
    with (INPUT_ROOT/geometry['source']).open('rb') as raw:
        assert hashlib.file_digest(raw,'sha256').hexdigest() == metadata['gcd']['sha256']
    channel_lookup = {}
    for i, channel in enumerate(geometry['channels']):
        module = geometry['modules'][channel[0]]
        channel_lookup[(module[0],module[1],channel[1])] = i
    gcd = dataio.I3File(str(INPUT_ROOT/geometry['source']))
    while gcd.more():
        frame = gcd.pop_frame()
        if frame.Stop != icetray.I3Frame.Geometry:
            continue
        assert frame['DepthAtZ0'].value == geometry['surface_z']
        assert frame['BedrockZ'].value == geometry['bedrock_z']
        modules = {(m[0],m[1]):m for m in geometry['modules']}
        for key, module in frame['I3ModuleGeoMap'].items():
            if (key.string,key.om) not in modules:
                continue
            stored = modules[(key.string,key.om)]
            assert [module.pos.x,module.pos.y,module.pos.z] == stored[2:5]
            stats['modules_verified'] += 1
        for key, omgeo in frame['I3Geometry'].omgeo.items():
            if (key.string,key.om,key.pmt) not in channel_lookup:
                continue
            row = geometry['channels'][channel_lookup[(key.string,key.om,key.pmt)]]
            assert [omgeo.position.x,omgeo.position.y,omgeo.position.z] == row[2:5]
            stats['channels_verified'] += 1
        break
    gcd.close()
    for index, (relative, wanted) in enumerate(groups.items()):
        with (INPUT_ROOT/relative).open('rb') as raw:
            assert hashlib.file_digest(raw,'sha256').hexdigest() == manifest[relative]['sha256']
        stats['source_hashes_verified'] += 1
        stream = dataio.I3File(str(INPUT_ROOT/relative))
        found = set()
        while stream.more():
            frame = stream.pop_frame()
            if frame.Stop != icetray.I3Frame.Physics:
                continue
            h = frame['I3EventHeader']
            key = (h.run_id,h.sub_run_id,h.event_id,h.sub_event_id,h.sub_event_stream)
            if key not in wanted:
                continue
            assert key not in found
            found.add(key)
            event = wanted[key]
            assert frame['QuesoL3_Bool'].value and frame['QuesoL4_Bool'].value
            assert frame['QuesoL3_Vars_cleaned_num_hits_fid_vol'].value >= 7
            check_particle(frame['MCInIcePrimary'],event['primary'])
            assert frame['I3MCWeightDict']['InteractionType'] == event['interaction']
            assert math.cos(frame['MCInIcePrimary'].dir.zenith) == event['coszen']
            assert frame['MCInIcePrimary'].dir.azimuth == event['azimuth']
            tree = frame['I3MCTree']
            particles = list(tree)
            assert len(particles) == len(event['truth'])
            ids = {(p.id.majorID,p.id.minorID):i for i,p in enumerate(particles)}
            for particle, saved in zip(particles,event['truth']):
                check_particle(particle,saved)
                parent = tree.parent(particle) if tree.has_parent(particle) else None
                assert saved['parent'] == (ids[(parent.id.majorID,parent.id.minorID)] if parent is not None else None)
            native = dataclasses.I3RecoPulseSeriesMap.from_frame(frame,'SplitInIcePulses')
            original = []
            for omkey,pulses in native.items():
                channel = channel_lookup[(omkey.string,omkey.om,omkey.pmt)]
                original.extend([[channel,p.time,p.charge,p.width,int(p.flags)] for p in pulses])
            assert sorted(original) == sorted(event['pulses'])
            assert event['pulses'] == sorted(event['pulses'],key=lambda p:p[1])
            stats['events_verified'] += 1
            stats['pulses_verified'] += len(original)
            stats['truth_particles_verified'] += len(particles)
        stream.close()
        assert len(found) == len(wanted), relative
        if index % 30 == 0:
            print(f'Validated {index+1}/{len(groups)} files: {stats["events_verified"]} events',flush=True)
    assert stats['events_verified'] == len(catalogue)
    assert stats['modules_verified'] == len(geometry['modules'])
    assert stats['channels_verified'] == len(geometry['channels'])
    stats['source_files_verified'] = len(groups)
    return dict(status='passed', comparisons='Exact native values; null only for nonfinite truth scalars',
                failures=0, **stats)


def save_outputs(report):
    REPORT_PATH.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))


def main():
    save_outputs(process(*load_inputs()))


if __name__ == '__main__':
    main()
