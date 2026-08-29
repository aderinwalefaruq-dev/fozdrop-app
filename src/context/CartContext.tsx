import React, { createContext, useContext, useState, useCallback } from 'react';
import type { CartItem, MenuItem, Vendor } from '@/types/types';

export interface CartItemWithSection extends CartItem {
  sectionName?: string;
}

interface CartContextType {
  items: CartItemWithSection[];
  vendors: Vendor[];
  addItem: (item: MenuItem, vendor: Vendor, sectionName?: string) => void;
  removeItem: (menuItemId: string) => void;
  updateQuantity: (menuItemId: string, quantity: number) => void;
  updatePlateNote: (menuItemId: string, plateIndex: number, note: string) => void;
  clearCart: () => void;
  subtotal: number;
  totalItems: number;
}

const CartContext = createContext<CartContextType>({
  items: [],
  vendors: [],
  addItem: () => {},
  removeItem: () => {},
  updateQuantity: () => {},
  updatePlateNote: () => {},
  clearCart: () => {},
  subtotal: 0,
  totalItems: 0,
});

// Keeps plateNotes length in sync with quantity: growing pads with empty
// notes (new plates start with no special instructions), shrinking trims
// from the end.
function resizePlateNotes(notes: string[], quantity: number): string[] {
  if (notes.length === quantity) return notes;
  if (notes.length < quantity) return [...notes, ...Array(quantity - notes.length).fill('')];
  return notes.slice(0, quantity);
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItemWithSection[]>([]);

  const removeItem = useCallback((menuItemId: string) => {
    setItems((prev) => prev.filter((c) => c.menu_item.id !== menuItemId));
  }, []);

  const addItem = useCallback((item: MenuItem, v: Vendor, sectionName?: string) => {
    setItems((prev) => {
      const existing = prev.find((c) => c.menu_item.id === item.id);
      if (existing) {
        const quantity = existing.quantity + 1;
        return prev.map((c) =>
          c.menu_item.id === item.id
            ? { ...c, quantity, plateNotes: resizePlateNotes(c.plateNotes, quantity) }
            : c
        );
      }
      return [...prev, { menu_item: item, quantity: 1, vendor: v, sectionName, plateNotes: [''] }];
    });
  }, []);

  const updateQuantity = useCallback((menuItemId: string, quantity: number) => {
    if (quantity <= 0) { removeItem(menuItemId); return; }
    setItems((prev) =>
      prev.map((c) =>
        c.menu_item.id === menuItemId
          ? { ...c, quantity, plateNotes: resizePlateNotes(c.plateNotes, quantity) }
          : c
      )
    );
  }, [removeItem]);

  // Sets the customization note for one specific plate of a multi-plate item
  // — e.g. plate 1 of 3 "no pepper", plate 2 "extra meat", plate 3 blank.
  const updatePlateNote = useCallback((menuItemId: string, plateIndex: number, note: string) => {
    setItems((prev) =>
      prev.map((c) =>
        c.menu_item.id === menuItemId
          ? { ...c, plateNotes: c.plateNotes.map((n, i) => (i === plateIndex ? note : n)) }
          : c
      )
    );
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const subtotal = items.reduce((sum, c) => sum + c.menu_item.price * c.quantity, 0);
  const totalItems = items.reduce((sum, c) => sum + c.quantity, 0);

  const vendors = items.reduce<Vendor[]>((acc, c) => {
    if (!acc.find((v) => v.id === c.vendor.id)) acc.push(c.vendor);
    return acc;
  }, []);

  return (
    <CartContext.Provider
      value={{ items, vendors, addItem, removeItem, updateQuantity, updatePlateNote, clearCart, subtotal, totalItems }}
    >
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
