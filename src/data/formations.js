/**
 * Standaard voetbalopstellingen voor 11v11 (JO13+).
 * Coördinatensysteem: x: 0-100 (links→rechts), y: 0-100 (eigen doel→tegenstander).
 * Genormaliseerd — onafhankelijk van schermgrootte.
 */

export const FORMATIONS = {
  "4-3-3": {
    label: "4-3-3",
    positions: [
      { role: "GK", x: 50, y: 5 },
      { role: "RB", x: 80, y: 22 },
      { role: "CB", x: 60, y: 18 },
      { role: "CB", x: 40, y: 18 },
      { role: "LB", x: 20, y: 22 },
      { role: "CDM", x: 50, y: 38 },
      { role: "CM", x: 70, y: 42 },
      { role: "CM", x: 30, y: 42 },
      { role: "RW", x: 80, y: 65 },
      { role: "ST", x: 50, y: 72 },
      { role: "LW", x: 20, y: 65 },
    ],
  },
  "4-4-2": {
    label: "4-4-2",
    positions: [
      { role: "GK", x: 50, y: 5 },
      { role: "RB", x: 80, y: 22 },
      { role: "CB", x: 60, y: 18 },
      { role: "CB", x: 40, y: 18 },
      { role: "LB", x: 20, y: 22 },
      { role: "RM", x: 80, y: 45 },
      { role: "CM", x: 60, y: 42 },
      { role: "CM", x: 40, y: 42 },
      { role: "LM", x: 20, y: 45 },
      { role: "ST", x: 60, y: 70 },
      { role: "ST", x: 40, y: 70 },
    ],
  },
  "4-2-3-1": {
    label: "4-2-3-1",
    positions: [
      { role: "GK", x: 50, y: 5 },
      { role: "RB", x: 80, y: 22 },
      { role: "CB", x: 60, y: 18 },
      { role: "CB", x: 40, y: 18 },
      { role: "LB", x: 20, y: 22 },
      { role: "CDM", x: 60, y: 35 },
      { role: "CDM", x: 40, y: 35 },
      { role: "RAM", x: 75, y: 55 },
      { role: "CAM", x: 50, y: 52 },
      { role: "LAM", x: 25, y: 55 },
      { role: "ST", x: 50, y: 72 },
    ],
  },
  "3-5-2": {
    label: "3-5-2",
    positions: [
      { role: "GK", x: 50, y: 5 },
      { role: "CB", x: 65, y: 18 },
      { role: "CB", x: 50, y: 15 },
      { role: "CB", x: 35, y: 18 },
      { role: "RWB", x: 85, y: 40 },
      { role: "CM", x: 65, y: 38 },
      { role: "CDM", x: 50, y: 32 },
      { role: "CM", x: 35, y: 38 },
      { role: "LWB", x: 15, y: 40 },
      { role: "ST", x: 60, y: 68 },
      { role: "ST", x: 40, y: 68 },
    ],
  },
  "3-4-3": {
    label: "3-4-3",
    positions: [
      { role: "GK", x: 50, y: 5 },
      { role: "CB", x: 65, y: 18 },
      { role: "CB", x: 50, y: 15 },
      { role: "CB", x: 35, y: 18 },
      { role: "RM", x: 80, y: 42 },
      { role: "CM", x: 60, y: 38 },
      { role: "CM", x: 40, y: 38 },
      { role: "LM", x: 20, y: 42 },
      { role: "RW", x: 75, y: 65 },
      { role: "ST", x: 50, y: 70 },
      { role: "LW", x: 25, y: 65 },
    ],
  },
  "5-3-2": {
    label: "5-3-2",
    positions: [
      { role: "GK", x: 50, y: 5 },
      { role: "RWB", x: 85, y: 25 },
      { role: "CB", x: 65, y: 18 },
      { role: "CB", x: 50, y: 15 },
      { role: "CB", x: 35, y: 18 },
      { role: "LWB", x: 15, y: 25 },
      { role: "CM", x: 65, y: 42 },
      { role: "CDM", x: 50, y: 38 },
      { role: "CM", x: 35, y: 42 },
      { role: "ST", x: 60, y: 68 },
      { role: "ST", x: 40, y: 68 },
    ],
  },
  "4-1-4-1": {
    label: "4-1-4-1",
    positions: [
      { role: "GK", x: 50, y: 5 },
      { role: "RB", x: 80, y: 22 },
      { role: "CB", x: 60, y: 18 },
      { role: "CB", x: 40, y: 18 },
      { role: "LB", x: 20, y: 22 },
      { role: "CDM", x: 50, y: 32 },
      { role: "RM", x: 80, y: 50 },
      { role: "CM", x: 60, y: 48 },
      { role: "CM", x: 40, y: 48 },
      { role: "LM", x: 20, y: 50 },
      { role: "ST", x: 50, y: 72 },
    ],
  },
  "4-5-1": {
    label: "4-5-1",
    positions: [
      { role: "GK", x: 50, y: 5 },
      { role: "RB", x: 80, y: 22 },
      { role: "CB", x: 60, y: 18 },
      { role: "CB", x: 40, y: 18 },
      { role: "LB", x: 20, y: 22 },
      { role: "RM", x: 80, y: 45 },
      { role: "CM", x: 65, y: 40 },
      { role: "CDM", x: 50, y: 35 },
      { role: "CM", x: 35, y: 40 },
      { role: "LM", x: 20, y: 45 },
      { role: "ST", x: 50, y: 72 },
    ],
  },
};

export const FORMATION_KEYS = Object.keys(FORMATIONS);

/**
 * Wijs spelers toe aan opstellingsposities.
 * Keeper → GK slot, overige spelers vullen posities van aanval naar verdediging.
 * @returns {{ [playerName]: { x: number, y: number } }}
 */
export function assignPlayersToFormation(formationKey, fieldPlayers, keeper) {
  const template = FORMATIONS[formationKey];
  if (!template) return {};
  const positions = {};
  const slots = [...template.positions];

  // Keeper krijgt GK slot
  if (keeper) {
    const gkSlot = slots.find(s => s.role === "GK");
    if (gkSlot) positions[keeper] = { x: gkSlot.x, y: gkSlot.y };
  }

  // Velspelers vullen overige slots (gesorteerd: aanvallers eerst, verdedigers laatst)
  const outfieldSlots = slots.filter(s => s.role !== "GK").sort((a, b) => b.y - a.y);
  const outfieldPlayers = fieldPlayers.filter(p => p !== keeper);
  outfieldPlayers.forEach((p, i) => {
    if (i < outfieldSlots.length) {
      positions[p] = { x: outfieldSlots[i].x, y: outfieldSlots[i].y };
    }
  });

  return positions;
}
