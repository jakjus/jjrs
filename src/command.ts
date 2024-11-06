import { sendMessage } from "./message";
import { room, PlayerAugmented } from "../index";
import { addToGame, handlePlayerLeaveOrAFK } from "./chooser";
import config from "../config";

export const isCommand = (msg: string) => msg.trim().startsWith("!");
export const handleCommand = (p: PlayerAugmented, msg: string) => {
  let commandText = msg.trim().slice(1);
  let commandName = commandText.split(" ")[0];
  let commandArgs = commandText.split(" ").slice(1);
  if (commands[commandName]) {
    commands[commandName](p, commandArgs);
  } else {
    sendMessage("Command not found.", p);
  }
};

type commandFunc = (p: PlayerAugmented, args: Array<string>) => void;
const commands: { [key: string]: commandFunc } = {
  afk: (p) => setAfk(p),
  back: (p) => setBack(p),
  discord: (p) => showDiscord(p),
  dc: (p) => showDiscord(p),
  bb: (p) => bb(p),
  help: (p) => showHelp(p),
};

const setAfk = (p: PlayerAugmented) => {
  p.afk = true;
  room.setPlayerTeam(p.id, 0);
  sendMessage("You are now AFK.", p);
  handlePlayerLeaveOrAFK(p);
};

const setBack = (p: PlayerAugmented) => {
  if (!p.afk) {
    sendMessage("You are ALREADY back.", p);
    return;
  }
  p.afk = false;
  addToGame(room, room.getPlayer(p.id));
  sendMessage("You are BACK.", p);
};

const showHelp = (p: PlayerAugmented) => {
  sendMessage(
    `${config.roomName}. Commands: ${Object.keys(commands)
      .map((k) => "!" + k)
      .join(", ")}`,
    p,
  );
};

const showDiscord = (p: PlayerAugmented) => {
  sendMessage(`Discord: discord.gg/zupRtBMUjb`);
};

const bb = (p: PlayerAugmented) => {
  room.kickPlayer(p.id, "Bye!", false);
};
