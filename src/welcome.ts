import { sendMessage } from "./message";
import config from "../config";

export const welcomePlayer = (room: RoomObject, p: PlayerObject) => {
  sendMessage(`${config.roomName}\nUse "!help" to see all commands.`, p);
  sendMessage(
    `This project is in TEST phase. It may have bugs or be restarted without warning.`,
    p,
  );
  sendMessage(
    `Hold "X" shorter to activate slide. Hold "X" longer to sprint. Passes within team make ball kicks stronger.`,
    p,
  );
  sendMessage(`Discord: https://discord.gg/Frg8Cr8UQb`, p);
};
