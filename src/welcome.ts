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
    const found = game.holdPlayers.find((pp) => pp.auth == p.auth);
    // If player reconnected into the same game, apply cooldowns, cards and
    // injuries.
    if (found) {
      // player was already in game
      // disallow reconnect on the same game (giving red card)
      newPlayer = new PlayerAugmented({
        ...p,
        foulsMeter: 2,
        cardsAnnounced: 2
      });
      found.id = p.id  // so that the elo decrease is shown to him
    } else {
      // when he connects during the game, push in with team: 0 to not
      // assign any points, but not let him back in on reconnect (in
      // case he abuses red card + reconnect during warmup)
      game.holdPlayers.push({ id: p.id, auth: p.auth, team: 0 })
    }
  }
  players.push(newPlayer);
  const readPlayer = await getOrCreatePlayer(p);
  newPlayer.elo = readPlayer.elo;
  await db.run("UPDATE players SET name=? WHERE auth=?", [p.name, p.auth]);
};
