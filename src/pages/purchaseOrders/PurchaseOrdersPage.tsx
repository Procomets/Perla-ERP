import React from 'react';
import { PurchaseOrder } from '../../types/po';
import { Vendor } from '../../types/vendor';
import { InwardEntry, OutwardEntry } from '../../types/inwardOutward';
import { PurchaseOrdersContainer } from './PurchaseOrdersContainer';

interface PurchaseOrdersPageProps {
  pos?: PurchaseOrder[];
  vendors?: Vendor[];
  inwards?: InwardEntry[];
  outwards?: OutwardEntry[];
  onAddPo?: (newPo: PurchaseOrder) => void;
  onUpdatePo?: (updatedPo: PurchaseOrder) => void;
}

export const PurchaseOrdersPage: React.FC<PurchaseOrdersPageProps> = ({
  pos,
  vendors,
  inwards,
  outwards,
  onAddPo,
  onUpdatePo
}) => {
  return (
    <PurchaseOrdersContainer
      initialPOs={pos}
      initialVendors={vendors}
      inwards={inwards}
      outwards={outwards}
      onAddPo={onAddPo}
      onUpdatePo={onUpdatePo}
    />
  );
};
