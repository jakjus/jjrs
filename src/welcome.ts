import { sendMessage } from "./message";
import { getOrCreatePlayer } from "./db";
import { db, game, players, PlayerAugmented } from "..";
import config from "../config";

export const welcomePlayer = (room: RoomObject, p: PlayerObject) => {
  sendMessage(`${config.roomName}\nUse "!help" to see all commands.`, p);
  sendMessage("JJRS is Open Source. Full Script: github.com/jakjus/jjrs", p);
  sendMessage(
    `Hold "X" shorter to activate slide. Hold "X" longer to sprint. Passes within team make ball kicks stronger.`,
    p,
  );
  sendMessage(`Discord: https://discord.gg/Frg8Cr8UQb`, p);
};

export const initPlayer = async (p: PlayerObject) => {
  let newPlayer = new PlayerAugmented(p);
  if (game) {
    const found = game.currentPlayers.find((pp) => pp.auth == p.auth);
    // If player reconnected into the same game, apply cooldowns, cards and
    // injuries.
    if (found && found.gameId == game.id) {
      game.currentPlayers = game.currentPlayers.filter(
        (ppp) => ppp.auth != p.auth,
      );
      newPlayer = new PlayerAugmented({
        ...p,
        foulsMeter: found.foulsMeter,
        cardsAnnounced: found.foulsMeter, // if cards were not announced, make it announced immediately after reconnect
        slowdown: found.slowdown,
        slowdownUntil: found.slowdownUntil,
      });
    }
    game.currentPlayers.push(newPlayer);
  }
  players.push(newPlayer);
  const readPlayer = await getOrCreatePlayer(p);
  newPlayer.elo = readPlayer.elo;
  await db.run("UPDATE players SET name=? WHERE auth=?", [p.name, p.auth]);
};
