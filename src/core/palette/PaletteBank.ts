import type { ActPalette } from './ActPalette';

export type PaletteSlot = {
  slot: number;
  name: string;
  palette: ActPalette;
};

export type PaletteBank = {
  selectedSlot: number;
  slots: PaletteSlot[];
};

export function createPaletteBank(slots: readonly PaletteSlot[] = [], selectedSlot = 1): PaletteBank {
  return {
    selectedSlot,
    slots: [...slots].sort((a, b) => a.slot - b.slot),
  };
}

export function setPaletteSlot(bank: PaletteBank, slot: PaletteSlot): PaletteBank {
  return createPaletteBank([
    ...bank.slots.filter((item) => item.slot !== slot.slot),
    slot,
  ], bank.selectedSlot);
}

export function selectPaletteSlot(bank: PaletteBank, selectedSlot: number): PaletteBank {
  return { ...bank, selectedSlot };
}

export function getSelectedPalette(bank: PaletteBank): ActPalette | null {
  return bank.slots.find((slot) => slot.slot === bank.selectedSlot)?.palette ?? bank.slots[0]?.palette ?? null;
}

export function getPaletteBySlot(bank: PaletteBank, slot: number): ActPalette | null {
  return bank.slots.find((item) => item.slot === slot)?.palette ?? null;
}
