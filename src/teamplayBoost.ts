import { room, Game } from "..";
import { sendMessage } from "./message";
import { defaults } from "./settings";
import { blendColorsInt } from "./utils";

const boostToCoef = (game: Game) =>
  (1 / (1 + Math.E ** -(game.boostCount * 0.4)) - 0.5) * 2;

export const boostToColor = (game: Game, team?: TeamID) =>
  blendColorsInt(
    0xffffff,
    team === 1 ? 0xd10000 : 0x0700d1,
    boostToCoef(game) * 100,
  );

export const setBallInvMassAndColor = (game: Game, team?: TeamID) => {
  room.setDiscProperties(0, {
    color: boostToColor(game, team),
    invMass: defaults.ballInvMass + boostToCoef(game) * 1.45,
  });
};

export const teamplayBoost = (game: Game, p: PlayerObject) => {
  // Teamplay boost. Ball is lighter (kicks are stronger)
  // depending on within team pass streak.
  if (!game.lastKick || game.lastKick?.team === p.team) {
    game.boostCount += 1;
    const team = p.team == 1 ? "Red" : "Blue";
    const teamEmoji = p.team == 1 ? "🔴" : "🔵";
    if (game.boostCount >= 3) {
      sendMessage(`👏  ${teamEmoji}: ${game.boostCount} passes. (${p.name})`);
    }
    if (game.boostCount == 5) {
      sendMessage(`🔥   ${team} team has set the ball on FIRE.`);
    } else if (game.boostCount == 8) {
      sendMessage(`🔥🔥🔥    ${team} team is INSANE!`);
    } else if (game.boostCount > 10) {
      sendMessage(`🚀🚀🚀    ${team} team is GODLIKE!`);
    }
  } else {
    game.boostCount = 0;
  }
  game.lastKick = p;
  setBallInvMassAndColor(game, p.team);
};

export const resetTeamplayBoost = (game: Game) => {
  game.ballRotation = { x: 0, y: 0, power: 0 };
  game.boostCount = 0;
  setBallInvMassAndColor(game);
};
