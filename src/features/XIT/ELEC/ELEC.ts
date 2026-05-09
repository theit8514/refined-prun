import ELEC from '@src/features/XIT/ELEC/ELEC.vue';

xit.add({
  command: 'ELEC',
  name: parameters =>
    parameters[0]?.toUpperCase() === 'REFRESH' ? 'REFRESH ELECTION DATA' : 'ELECTIONS',
  description:
    'Upcoming elections for planets you have bases on. Use XIT ELEC REFRESH to queue ADM/COGC loads per planet.',
  optionalParameters: 'REFRESH',
  contextItems: parameters =>
    parameters[0]?.toUpperCase() === 'REFRESH' ? [{ cmd: 'XIT ELEC' }] : [],
  component: () => ELEC,
});
