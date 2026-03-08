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
      { role: "RB", x: 80, y: 27 },
      { role: "CB", x: 60, y: 23 },
      { role: "CB", x: 40, y: 23 },
      { role: "LB", x: 20, y: 27 },
      { role: "CDM", x: 50, y: 43 },
      { role: "CM", x: 70, y: 47 },
      { role: "CM", x: 30, y: 47 },
      { role: "RW", x: 80, y: 70 },
      { role: "ST", x: 50, y: 77 },
      { role: "LW", x: 20, y: 70 },
    ],
  },
  "4-4-2": {
    label: "4-4-2",
    positions: [
      { role: "GK", x: 50, y: 5 },
      { role: "RB", x: 80, y: 27 },
      { role: "CB", x: 60, y: 23 },
      { role: "CB", x: 40, y: 23 },
      { role: "LB", x: 20, y: 27 },
      { role: "RM", x: 80, y: 50 },
      { role: "CM", x: 60, y: 47 },
      { role: "CM", x: 40, y: 47 },
      { role: "LM", x: 20, y: 50 },
      { role: "ST", x: 60, y: 75 },
      { role: "ST", x: 40, y: 75 },
    ],
  },
  "4-2-3-1": {
    label: "4-2-3-1",
    positions: [
      { role: "GK", x: 50, y: 5 },
      { role: "RB", x: 80, y: 27 },
      { role: "CB", x: 60, y: 23 },
      { role: "CB", x: 40, y: 23 },
      { role: "LB", x: 20, y: 27 },
      { role: "CDM", x: 60, y: 40 },
      { role: "CDM", x: 40, y: 40 },
      { role: "RAM", x: 75, y: 60 },
      { role: "CAM", x: 50, y: 57 },
      { role: "LAM", x: 25, y: 60 },
      { role: "ST", x: 50, y: 77 },
    ],
  },
  "3-5-2": {
    label: "3-5-2",
    positions: [
      { role: "GK", x: 50, y: 5 },
      { role: "CB", x: 65, y: 23 },
      { role: "CB", x: 50, y: 20 },
      { role: "CB", x: 35, y: 23 },
      { role: "RWB", x: 85, y: 45 },
      { role: "CM", x: 65, y: 43 },
      { role: "CDM", x: 50, y: 37 },
      { role: "CM", x: 35, y: 43 },
      { role: "LWB", x: 15, y: 45 },
      { role: "ST", x: 60, y: 73 },
      { role: "ST", x: 40, y: 73 },
    ],
  },
  "3-4-3": {
    label: "3-4-3",
    positions: [
      { role: "GK", x: 50, y: 5 },
      { role: "CB", x: 65, y: 23 },
      { role: "CB", x: 50, y: 20 },
      { role: "CB", x: 35, y: 23 },
      { role: "RM", x: 80, y: 47 },
      { role: "CM", x: 60, y: 43 },
      { role: "CM", x: 40, y: 43 },
      { role: "LM", x: 20, y: 47 },
      { role: "RW", x: 75, y: 70 },
      { role: "ST", x: 50, y: 75 },
      { role: "LW", x: 25, y: 70 },
    ],
  },
  "5-3-2": {
    label: "5-3-2",
    positions: [
      { role: "GK", x: 50, y: 5 },
      { role: "RWB", x: 85, y: 30 },
      { role: "CB", x: 65, y: 23 },
      { role: "CB", x: 50, y: 20 },
      { role: "CB", x: 35, y: 23 },
      { role: "LWB", x: 15, y: 30 },
      { role: "CM", x: 65, y: 47 },
      { role: "CDM", x: 50, y: 43 },
      { role: "CM", x: 35, y: 47 },
      { role: "ST", x: 60, y: 73 },
      { role: "ST", x: 40, y: 73 },
    ],
  },
  "4-1-4-1": {
    label: "4-1-4-1",
    positions: [
      { role: "GK", x: 50, y: 5 },
      { role: "RB", x: 80, y: 27 },
      { role: "CB", x: 60, y: 23 },
      { role: "CB", x: 40, y: 23 },
      { role: "LB", x: 20, y: 27 },
      { role: "CDM", x: 50, y: 37 },
      { role: "RM", x: 80, y: 55 },
      { role: "CM", x: 60, y: 53 },
      { role: "CM", x: 40, y: 53 },
      { role: "LM", x: 20, y: 55 },
      { role: "ST", x: 50, y: 77 },
    ],
  },
  "4-5-1": {
    label: "4-5-1",
    positions: [
      { role: "GK", x: 50, y: 5 },
      { role: "RB", x: 80, y: 27 },
      { role: "CB", x: 60, y: 23 },
      { role: "CB", x: 40, y: 23 },
      { role: "LB", x: 20, y: 27 },
      { role: "RM", x: 80, y: 50 },
      { role: "CM", x: 65, y: 45 },
      { role: "CDM", x: 50, y: 40 },
      { role: "CM", x: 35, y: 45 },
      { role: "LM", x: 20, y: 50 },
      { role: "ST", x: 50, y: 77 },
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
