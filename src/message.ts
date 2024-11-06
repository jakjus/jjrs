import { room, PlayerAugmented } from "../index";

const blendColorsInt = (color1: number, color2: number, percentage: number) => {
  // Ensure the percentage is between 0 and 100
  percentage = Math.min(100, Math.max(0, percentage));

  // Extract RGB components from integer color values
  const extractRGB = (color: number) => {
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;
    return { r, g, b };
  };

  // Combine RGB components back into an integer color
  const combineRGB = (r: number, g: number, b: number) => {
    return (r << 16) | (g << 8) | b;
  };

  // Blend the RGB values
  const blend = (c1: number, c2: number, p: number) => {
    return Math.round(c1 + (c2 - c1) * (p / 100));
  };

  // Extract RGB values from the two input colors
  const rgb1 = extractRGB(color1);
  const rgb2 = extractRGB(color2);

  // Blend each RGB component individually
  const r = blend(rgb1.r, rgb2.r, percentage);
  const g = blend(rgb1.g, rgb2.g, percentage);
  const b = blend(rgb1.b, rgb2.b, percentage);

  // Combine the blended RGB components back into an integer
  return combineRGB(r, g, b);
};

const percentage = (elo: number) => 1 / (1 + Math.E ** -((elo - 1200) / 100));

export const sendMessage = (
  msg: string,
  p?: PlayerAugmented | PlayerObject | null,
) => {
  if (p) {
    room.sendAnnouncement(`[DM] ${msg}`, p.id, 0xd6cedb, "small", 2);
  } else {
    room.sendAnnouncement(`[Server] ${msg}`, undefined, 0xd6cedb, "small", 0);
  }
};

export const playerMessage = async (p: PlayerAugmented, msg: string) => {
  if (p.afk) {
    sendMessage(`You are AFK. Write "!back" to come back.`, p);
  }
  const card = p.cardsAnnounced < 1 ? `` : p.cardsAnnounced < 2 ? `🟨 ` : `🟥 `;
  room.sendAnnouncement(
    `[${p.elo}] ${card}${p.name}: ${msg}`,
    undefined,
    blendColorsInt(0x636363, 0xfff7f2, percentage(p.elo) * 100),
    "normal",
    1,
  );
};
