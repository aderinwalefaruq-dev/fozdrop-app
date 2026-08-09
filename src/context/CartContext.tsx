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
  clearCart: () => {},
  subtotal: 0,
  totalItems: 0,
});

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItemWithSection[]>([]);

  const addItem = useCallback((item: MenuItem, v: Vendor, sectionName?: string) => {
    setItems((prev) => {
      const existing = prev.find((c) => c.menu_item.id === item.id);
      if (existing) {
        return prev.map((c) =>
          c.menu_item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { menu_item: item, quantity: 1, vendor: v, sectionName }];
    });
  }, []);

  const removeItem = useCallback((menuItemId: string) => {
    setItems((prev) => prev.filter((c) => c.menu_item.id !== menuItemId));
  }, []);

  const updateQuantity = useCallback((menuItemId: string, quantity: number) => {
    if (quantity <= 0) { removeItem(menuItemId); return; }
    setItems((prev) =>
      prev.map((c) => (c.menu_item.id === menuItemId ? { ...c, quantity } : c))
    );
  }, [removeItem]);

  const clearCart = useCallback(() => setItems([]), []);

  const subtotal = items.reduce((sum, c) => sum + c.menu_item.price * c.quantity, 0);
  const totalItems = items.reduce((sum, c) => sum + c.quantity, 0);

  const vendors = items.reduce<Vendor[]>((acc, c) => {
    if (!acc.find((v) => v.id === c.vendor.id)) acc.push(c.vendor);
    return acc;
  }, []);

  return (
    <CartContext.Provider
      value={{ items, vendors, addItem, removeItem, updateQuantity, clearCart, subtotal, totalItems }}
    >
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
