import ELEC from '@src/features/XIT/ELEC/ELEC.vue';

function elecXitName(parameters: string[]) {
  const p0 = parameters[0]?.toUpperCase();
  if (p0 === 'REFRESH') {
    return 'REFRESH ELECTION DATA';
  }
  return 'ELECTIONS';
}

xit.add({
  command: 'ELEC',
  name: elecXitName,
  description:
    'Upcoming elections for planets you have bases on. Optional: REFRESH to queue ADM/COGC tile loads for the types enabled on the elections tile.',
  optionalParameters: 'REFRESH [COGC|GOV|ADM]',
  contextItems: parameters => {
    if (parameters[0]?.toUpperCase() === 'REFRESH') {
      return [{ cmd: 'XIT ELEC', label: 'Elections' }];
    }
    return [];
  },
  component: () => ELEC,
});
