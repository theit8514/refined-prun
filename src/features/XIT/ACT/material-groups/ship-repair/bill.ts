import { MaterialBill } from '@src/features/XIT/ACT/material-bill';

export function computeShipRepairBill(ship: PrunApi.Ship): MaterialBill {
  const bill: MaterialBill = {};
  for (const mat of ship.repairMaterials) {
    const ticker = mat.material.ticker;
    const existing = bill[ticker];
    if (existing !== undefined) {
      existing.quantity += mat.amount;
    } else {
      bill[ticker] = { quantity: mat.amount };
    }
  }
  return bill;
}
