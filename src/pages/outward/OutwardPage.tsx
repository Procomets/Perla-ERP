import React from 'react';
import { PurchaseOrder } from '../../types/po';
import { InwardEntry } from '../../types/inward';
import { OutwardEntry } from '../../types/outward';
import { Vendor } from '../../types/vendor';
import { OutwardContainer } from './OutwardContainer';

interface OutwardPageProps {
  pos?: PurchaseOrder[];
  inwards?: InwardEntry[];
  outwards?: OutwardEntry[];
  vendors?: Vendor[];
  onAddOutward?: (entry: OutwardEntry) => void;
}

export const OutwardPage: React.FC<OutwardPageProps> = ({
  pos,
  inwards,
  outwards,
  vendors,
  onAddOutward
}) => {
  return (
    <OutwardContainer
      initialPOs={pos}
      initialInwards={inwards}
      initialOutwards={outwards}
      initialVendors={vendors}
      onAddOutward={onAddOutward}
    />
  );
};
