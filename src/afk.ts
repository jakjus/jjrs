import { duringDraft } from "./chooser";
import { room, players } from "..";
import { sendMessage } from "./message";
import { toAug } from "..";

let j = 0;
export const afk = {
  onTick: () => {
    if (!duringDraft && !process.env.DEBUG) {
      j+=6;
    }

    if (j > 60) {
      j = 0;
      players
        .filter((p) => p.team == 1 || p.team == 2)
        .forEach((p) => {
          p.afkCounter += 1;
          if (p.afkCounter == 14) {
            sendMessage("Move! You will be AFK in 5 seconds...", p);
          } else if (p.afkCounter > 19) {
            p.afkCounter = 0;
            room.setPlayerTeam(p.id, 0);
            p.afk = true;
          }
        });
    }
  },
  onActivity: (p: PlayerObject) => {
    toAug(p).afkCounter = 0;
  },
};
