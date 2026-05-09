import ELEC from '@src/features/XIT/ELEC/ELEC.vue';

function elecXitName(parameters: string[]) {
  const p0 = parameters[0]?.toUpperCase();
  if (p0 === 'REFRESH') {
    return 'REFRESH ELECTION DATA';
  }
  if (p0 === 'COGC') {
    return 'ELECTIONS (COGC)';
  }
  if (p0 === 'GOV' || p0 === 'ADM') {
    return 'ELECTIONS (ADM)';
  }
  return 'ELECTIONS';
}

xit.add({
  command: 'ELEC',
  name: elecXitName,
  description:
    'Upcoming elections for planets you have bases on. Optional: COGC, GOV, or ADM to filter the list; REFRESH (optional second: COGC, GOV, ADM) to queue matching tile loads.',
  optionalParameters: 'REFRESH [COGC|GOV|ADM] | COGC | GOV | ADM',
  contextItems: parameters => {
    const p0 = parameters[0]?.toUpperCase();
    if (p0 === 'REFRESH') {
      const p1 = parameters[1]?.toUpperCase();
      if (p1 === 'COGC') {
        return [{ cmd: 'XIT ELEC COGC', label: 'Elections COGC' }];
      }
      if (p1 === 'GOV' || p1 === 'ADM') {
        return [{ cmd: 'XIT ELEC GOV', label: 'Elections ADM' }];
      }
      return [{ cmd: 'XIT ELEC', label: 'All types' }];
    }
    if (p0 === 'COGC' || p0 === 'GOV' || p0 === 'ADM') {
      return [{ cmd: 'XIT ELEC', label: 'All types' }];
    }
    return [];
  },
  component: () => ELEC,
});
