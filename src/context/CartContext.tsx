import React, { createContext, useContext, useState, useCallback } from 'react';
import type { MenuItem, Vendor, Plate, PlateLineItem } from '@/types/types';

interface CartContextType {
  plates: Plate[];
  vendors: Vendor[];
  activePlateId: string | null;
  setActivePlate: (plateId: string) => void;
  // Returns the plate that new "+" taps for this vendor should land in —
  // the currently active plate if it belongs to this vendor, otherwise the
  // vendor's most recent plate, otherwise a brand new "Plate A" is created.
  // This keeps single-plate ordering frictionless while still letting a
  // customer explicitly start a second, third, etc. plate.
  getOrCreateActivePlateForVendor: (vendor: Vendor) => string;
  addPlate: (vendor: Vendor) => string;
  removePlate: (plateId: string) => void;
  renamePlate: (plateId: string, label: string) => void;
  addItemToPlate: (plateId: string, item: MenuItem) => void;
  updateItemQuantity: (plateId: string, menuItemId: string, quantity: number) => void;
  removeItemFromPlate: (plateId: string, menuItemId: string) => void;
  clearCart: () => void;
  subtotal: number;
  totalItems: number;
}

const CartContext = createContext<CartContextType>({
  plates: [],
  vendors: [],
  activePlateId: null,
  setActivePlate: () => {},
  getOrCreateActivePlateForVendor: () => '',
  addPlate: () => '',
  removePlate: () => {},
  renamePlate: () => {},
  addItemToPlate: () => {},
  updateItemQuantity: () => {},
  removeItemFromPlate: () => {},
  clearCart: () => {},
  subtotal: 0,
  totalItems: 0,
});

function nextLabel(existingCountForVendor: number): string {
  // Plate A, Plate B, Plate C, ... per vendor
  return `Plate ${String.fromCharCode(65 + existingCountForVendor)}`;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [plates, setPlates] = useState<Plate[]>([]);
  const [activePlateId, setActivePlateId] = useState<string | null>(null);

  const setActivePlate = useCallback((plateId: string) => setActivePlateId(plateId), []);

  const addPlate = useCallback((vendor: Vendor) => {
    const newId = `plate-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setPlates((prev) => {
      const vendorPlateCount = prev.filter((p) => p.vendor.id === vendor.id).length;
      return [...prev, { id: newId, vendor, label: nextLabel(vendorPlateCount), items: [] }];
    });
    setActivePlateId(newId);
    return newId;
  }, []);

  const removePlate = useCallback((plateId: string) => {
    setPlates((prev) => {
      const remaining = prev.filter((p) => p.id !== plateId);
      setActivePlateId((current) => {
        if (current !== plateId) return current;
        const removed = prev.find((p) => p.id === plateId);
        const sameVendorPlate = removed
          ? remaining.find((p) => p.vendor.id === removed.vendor.id)
          : undefined;
        return sameVendorPlate?.id ?? null;
      });
      return remaining;
    });
  }, []);

  const renamePlate = useCallback((plateId: string, label: string) => {
    setPlates((prev) => prev.map((p) => (p.id === plateId ? { ...p, label } : p)));
  }, []);

  // Resolve (or lazily create) the plate that a menu-item tap should go
  // into. Kept as a callback rather than derived state because it may need
  // to create a new plate as a side effect the first time a vendor's menu
  // is used in a session.
  const getOrCreateActivePlateForVendor = useCallback((vendor: Vendor): string => {
    let resolvedId = '';
    setPlates((prev) => {
      const activeBelongsToVendor = prev.find((p) => p.id === activePlateId && p.vendor.id === vendor.id);
      if (activeBelongsToVendor) { resolvedId = activeBelongsToVendor.id; return prev; }

      const mostRecentForVendor = [...prev].reverse().find((p) => p.vendor.id === vendor.id);
      if (mostRecentForVendor) { resolvedId = mostRecentForVendor.id; return prev; }

      const newId = `plate-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      resolvedId = newId;
      return [...prev, { id: newId, vendor, label: nextLabel(0), items: [] }];
    });
    if (resolvedId !== activePlateId) setActivePlateId(resolvedId);
    return resolvedId;
  }, [activePlateId]);

  const addItemToPlate = useCallback((plateId: string, item: MenuItem) => {
    setPlates((prev) => prev.map((p) => {
      if (p.id !== plateId) return p;
      const existing = p.items.find((i) => i.menuItemId === item.id);
      const items: PlateLineItem[] = existing
        ? p.items.map((i) => (i.menuItemId === item.id ? { ...i, quantity: i.quantity + 1 } : i))
        : [...p.items, { menuItemId: item.id, itemName: item.item_name, price: item.price, quantity: 1 }];
      return { ...p, items };
    }));
  }, []);

  const updateItemQuantity = useCallback((plateId: string, menuItemId: string, quantity: number) => {
    setPlates((prev) => prev.map((p) => {
      if (p.id !== plateId) return p;
      if (quantity <= 0) return { ...p, items: p.items.filter((i) => i.menuItemId !== menuItemId) };
      return { ...p, items: p.items.map((i) => (i.menuItemId === menuItemId ? { ...i, quantity } : i)) };
    }));
  }, []);

  const removeItemFromPlate = useCallback((plateId: string, menuItemId: string) => {
    setPlates((prev) => prev.map((p) =>
      p.id === plateId ? { ...p, items: p.items.filter((i) => i.menuItemId !== menuItemId) } : p
    ));
  }, []);

  const clearCart = useCallback(() => { setPlates([]); setActivePlateId(null); }, []);

  const plateTotal = (p: Plate) => p.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const subtotal = plates.reduce((sum, p) => sum + plateTotal(p), 0);
  const totalItems = plates.reduce((sum, p) => sum + p.items.reduce((s, i) => s + i.quantity, 0), 0);

  const vendors = plates.reduce<Vendor[]>((acc, p) => {
    if (!acc.find((v) => v.id === p.vendor.id)) acc.push(p.vendor);
    return acc;
  }, []);

  return (
    <CartContext.Provider
      value={{
        plates, vendors, activePlateId, setActivePlate, getOrCreateActivePlateForVendor,
        addPlate, removePlate, renamePlate, addItemToPlate, updateItemQuantity, removeItemFromPlate,
        clearCart, subtotal, totalItems,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
