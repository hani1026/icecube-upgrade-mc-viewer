#!/usr/bin/env python3
"""Audit stored birth vertices; parent-to-child displacement belongs to the parent."""
from pathlib import Path
from collections import defaultdict
import json
import math

# CONFIG
DATA_ROOT = Path(__file__).resolve().parents[1] / 'data'
OUTPUT_PATH = DATA_ROOT / 'vertex-audit.json'


def load_inputs():
    catalogue = json.loads((DATA_ROOT/'catalogue.json').read_text())
    return [json.loads((DATA_ROOT/'events'/f'{entry["id"]}.json').read_text()) for entry in catalogue]


def process(events):
    groups = defaultdict(lambda: dict(nodes=0, coincident=0, displaced=0, with_daughters=0, maximum_distance_m=0, maximum_abs_delta_time_ns=0))
    examples = {}
    for event in events:
        tree = event['truth']
        for index, particle in enumerate(tree):
            if abs(particle['pdg']) not in (11,15) or particle['parent'] is None:
                continue
            parent = tree[particle['parent']]
            key = f'abs_pdg_{abs(parent["pdg"])}_to_{abs(particle["pdg"])}'
            distance = math.dist(parent['pos'],particle['pos'])
            stats = groups[key]
            stats['nodes'] += 1
            stats['coincident'] += distance <= 1e-6
            stats['displaced'] += distance > 1e-6
            stats['with_daughters'] += any(p['parent']==index for p in tree)
            stats['maximum_distance_m'] = max(stats['maximum_distance_m'],distance)
            stats['maximum_abs_delta_time_ns'] = max(stats['maximum_abs_delta_time_ns'],abs(particle['time']-parent['time']))
            if key not in examples or (distance>0 and examples[key]['distance_m']==0):
                examples[key] = dict(event=event['id'], source=event['source'], parent_type=parent['type'],
                                     child_type=particle['type'], parent_position_m=parent['pos'],
                                     child_position_m=particle['pos'], distance_m=distance,
                                     delta_time_ns=particle['time']-parent['time'])
    return dict(events=len(events), groups=dict(groups), examples=examples,
                interpretation='A stored child position is its birth site. Displacement from a parent start describes the parent-to-birth connection, not the child flight after birth. Coincident endpoints give zero length.')


def save_outputs(report):
    OUTPUT_PATH.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report['groups'],indent=2))


def main():
    save_outputs(process(load_inputs()))


if __name__ == '__main__':
    main()
