import SRC from '@src/features/XIT/SRC/SRC.vue';

xit.add({
  command: 'SRC',
  name: 'SHIP REPAIR CALCULATOR',
  description:
    'Collects blueprint test-flight data for ship repair calculations. Select origin, destination, and a VALID blueprint, then run the collection state machine.',
  component: () => SRC,
});
