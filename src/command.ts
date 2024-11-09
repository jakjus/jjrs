import { sendMessage } from "./message";
import * as fs from "fs";
import { room, PlayerAugmented } from "../index";
import { addToGame, handlePlayerLeaveOrAFK } from "./chooser";
import { adminPass } from "../index";
import { performDraft } from "./draft/draft";
import { teamSize } from "./settings";
import { changeDuringDraft } from "./chooser";
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
  admin: (p, args) => adminLogin(p, args),
  draft: (p) => draft(p),
  rs: (p) => rs(p),
};

const adminLogin = (p: PlayerAugmented, args: string[]) => {
  if (args.length < 1) {
    sendMessage('Usage: !admin your_admin_pass', p)
    return
  }
  if (args[0] === adminPass) {
    room.setPlayerAdmin(p.id, true)
    sendMessage('Login successful.', p)
  } else {
    sendMessage('Wrong password.', p)
  }
}

const draft = async (p: PlayerAugmented) => {
  if (!room.getPlayer(p.id).admin) {
    sendMessage("❌ ADMIN only command. If you're an admin, log in with !admin", p)
    return
  }
  sendMessage(`${p.name} has changed map to jakjus Draft`)
  changeDuringDraft(true)
  const result = await performDraft(room, room.getPlayerList(), teamSize)
  room.getPlayerList().forEach((p) => {
    if (p.team != 0) {
      room.setPlayerTeam(p.id, 0);
    }
  });
  result?.red?.forEach((p) => room.setPlayerTeam(p.id, 1));
  result?.blue?.forEach((p) => room.setPlayerTeam(p.id, 2));
  changeDuringDraft(false)
}

const rs = (p: PlayerAugmented) => {
  if (!room.getPlayer(p.id).admin) {
    sendMessage("❌ ADMIN only command. If you're an admin, log in with !admin", p)
    return
  }
  room.stopGame()
  const rsStadium = fs.readFileSync("./maps/rs5.hbs", {
    encoding: "utf8",
    flag: "r",
  });
  room.setCustomStadium(rsStadium);
  sendMessage(`${p.name} has changed map to JJRS`)
}

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
