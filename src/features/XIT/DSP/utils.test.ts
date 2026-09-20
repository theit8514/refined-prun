import { beforeEach, describe, expect, it, vi } from 'vitest';
import { computeResupplyBill } from '@src/features/XIT/ACT/material-groups/resupply/bill';
import { computeRepairBill } from '@src/features/XIT/ACT/material-groups/repair/bill';
import { combinedBaseBill, DispatchBaseConfig, fitDaysForShip } from './utils';

vi.mock('@src/features/XIT/ACT/material-groups/resupply/bill', () => ({
  computeResupplyBill: vi.fn(),
}));
vi.mock('@src/features/XIT/ACT/material-groups/repair/bill', () => ({
  computeRepairBill: vi.fn(),
}));
vi.mock('@src/infrastructure/prun-api/data/ships', () => ({ shipsStore: {} }));
vi.mock('@src/infrastructure/prun-api/data/exchanges', () => ({ exchangesStore: {} }));
vi.mock('@src/infrastructure/prun-api/data/warehouses', () => ({ warehousesStore: {} }));
vi.mock('@src/infrastructure/prun-api/data/storage', () => ({ storagesStore: {} }));
vi.mock('@src/infrastructure/prun-api/data/materials', () => ({
  materialsStore: { getByTicker: vi.fn() },
}));
vi.mock('@src/infrastructure/prun-api/data/addresses', () => ({
  getLocationLineFromAddress: vi.fn(),
  isSameAddress: vi.fn(),
}));
vi.mock('@src/infrastructure/shell/config', () => ({ default: {} }));

function createConfig(): DispatchBaseConfig {
  return {
    ship: 'ship1',
    resupply: true,
    repair: false,
    days: 10,
    repThreshold: 55,
    repAdvance: 1,
    materialFilter: 'All',
    cxBuy: true,
    offloadJson: false,
    agent: false,
  };
}

describe('DSP material exclusions', () => {
  beforeEach(() => {
    vi.mocked(computeResupplyBill).mockReset();
    vi.mocked(computeRepairBill).mockReset();
  });

  it('passes per-base exclusions to resupply without filtering repair materials', () => {
    vi.mocked(computeResupplyBill).mockReturnValue({ RAT: { quantity: 10 } });
    vi.mocked(computeRepairBill).mockReturnValue({ SIO: { quantity: 2 } });
    const config = createConfig();
    config.repair = true;

    const bill = combinedBaseBill('ANT', config, {} as PrunApi.Site, ['SIO']);

    expect(computeResupplyBill).toHaveBeenCalledWith(
      { type: 'Resupply', useBaseInv: true, exclusions: ['SIO'] },
      'ANT',
      10,
      'All',
    );
    expect(bill).toEqual({
      RAT: { quantity: 10 },
      SIO: { quantity: 2 },
    });
  });

  it('uses each base exclusions when fitting resupply days to a ship', () => {
    vi.mocked(computeResupplyBill).mockReturnValue({});
    const first = createConfig();
    const second = createConfig();
    const bases = [
      {
        naturalId: 'ANT',
        config: first,
        site: {} as PrunApi.Site,
        exclusions: ['SIO'],
      },
      {
        naturalId: 'BEN',
        config: second,
        site: {} as PrunApi.Site,
        exclusions: ['H2O'],
      },
    ];
    const cargoStore = {
      weightCapacity: 100,
      weightLoad: 0,
      volumeCapacity: 100,
      volumeLoad: 0,
    } as PrunApi.Store;

    fitDaysForShip('ship1', bases, cargoStore);

    const calls = vi.mocked(computeResupplyBill).mock.calls;
    expect(calls.some(([data, planet]) => planet === 'ANT' && data.exclusions?.[0] === 'SIO')).toBe(
      true,
    );
    expect(calls.some(([data, planet]) => planet === 'BEN' && data.exclusions?.[0] === 'H2O')).toBe(
      true,
    );
  });
});
