import { room, PlayerAugmented } from "../index";
import { blendColorsInt } from "./utils";

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

  if (p.admin){
    room.sendAnnouncement(
      `🛡️ [${p.elo}] ${card}${p.name}: ${msg}`,
      undefined,
      0xFFD700,
      "normal",
      1,
    );
  }else{
    room.sendAnnouncement(
      `[${p.elo}] ${card}${p.name}: ${msg}`,
      undefined,
      blendColorsInt(0x636363, 0xfff7f2, percentage(p.elo) * 100),
      "normal",
      1,
    );
  }

};
