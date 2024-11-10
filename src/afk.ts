import { duringDraft } from "./chooser";
import { room, players } from "..";
import { sendMessage } from "./message";
import { toAug } from "..";

export const afk = {
  onTick: () => {
    let j = 0;
    if (!duringDraft && !process.env.DEBUG) {
      j++;
    }

    if (j > 60) {
      j = 0;
      players
        .filter((p) => p.team == 1 || p.team == 2)
        .forEach((p) => {
          p.afkCounter += 1;
          if (p.afkCounter == 18) {
            sendMessage("Move! You will be AFK in 5 seconds...", p);
          } else if (p.afkCounter > 23) {
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
