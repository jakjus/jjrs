import { toAug, room, players, PlayerAugmented, Game } from "../index";
import { sendMessage } from "./message";
import { freeKick, penalty } from "./out";
import { handleLastTouch } from "./offside";
import { defaults, mapBounds } from "./settings";
import { sleep } from "./utils";
import { isPenalty } from "./foul";

export const checkAllX = (game: Game) => {
  if (!game.inPlay) {
    return;
  }
  players
    .filter((p) => p.team != 0)
    .forEach((pp) => {
      const props = room.getPlayerDiscProperties(pp.id);
      if (!props) {
        return;
      }
      // When X is PRESSED
      if (props.damping == defaults.kickingDamping) {
        pp.activation++;
        if (
          new Date().getTime() < pp.canCallFoulUntil &&
          pp.activation > 20 &&
          Math.abs(pp.fouledAt.x) < mapBounds.x
        ) {
          sendMessage(`${pp.name} has called foul.`);
          if (isPenalty(pp)) {
            penalty(game, pp.team, { ...pp.fouledAt });
            pp.activation = 0;
            pp.canCallFoulUntil = 0;
            return;
          }
          freeKick(game, pp.team, pp.fouledAt);
          pp.activation = 0;
          pp.canCallFoulUntil = 0;
          return;
        }
        if (pp.slowdown && new Date().getTime() > pp.canCallFoulUntil) {
          pp.activation = 0;
          return;
        }
        if (pp.activation > 20 && pp.activation < 60) {
          room.setPlayerAvatar(pp.id, "👟");
        } else if (pp.activation >= 60 && pp.activation < 100) {
          room.setPlayerAvatar(pp.id, "💨");
        } else if (pp.activation >= 100) {
          room.setPlayerAvatar(pp.id, "");
        }
        // When X is RELEASED
      } else if (pp.activation > 20 && pp.activation < 60) {
        pp.activation = 0;
        slide(game, pp);
      } else if (pp.activation >= 60 && pp.activation < 100) {
        pp.activation = 0;
        if (pp.cooldownUntil > new Date().getTime()) {
          sendMessage(
            `Cooldown: ${Math.ceil((pp.cooldownUntil - new Date().getTime()) / 1000)}s.`,
            pp,
          );
          pp.activation = 0;
          room.setPlayerAvatar(pp.id, "🚫");
          setTimeout(() => room.setPlayerAvatar(pp.id, ""), 200);
          return;
        }
        sprint(game, pp);
        room.setPlayerAvatar(pp.id, "💨");
        setTimeout(() => room.setPlayerAvatar(pp.id, ""), 700);
        pp.cooldownUntil = new Date().getTime() + 18000;
      } else {
        pp.activation = 0;
      }
    });
};

export const sprint = (game: Game, p: PlayerAugmented) => {
  if (p.slowdown) {
    return;
  }
  const props = room.getPlayerDiscProperties(p.id);
  const magnitude = Math.sqrt(props.xspeed ** 2 + props.yspeed ** 2);
  const vecX = props.xspeed / magnitude;
  const vecY = props.yspeed / magnitude;
  room.setPlayerDiscProperties(p.id, {
    xgravity: vecX * 0.08,
    ygravity: vecY * 0.08,
  });
  setTimeout(
    () => room.setPlayerDiscProperties(p.id, { xgravity: 0, ygravity: 0 }),
    900,
  );
};

const slide = async (game: Game, p: PlayerAugmented) => {
  if (p.slowdown) {
    return;
  }
  if (game.animation) {
    room.setPlayerAvatar(p.id, "");
    return;
  }
  const props = room.getPlayerDiscProperties(p.id);
    if (p.cooldownUntil > new Date().getTime()) {
      sendMessage(
        `Cooldown: ${Math.ceil((p.cooldownUntil - new Date().getTime()) / 1000)}s`,
        p,
      );
      p.activation = 0;
      room.setPlayerAvatar(p.id, "🚫");
      setTimeout(() => room.setPlayerAvatar(p.id, ""), 200);
      return;
    }
  room.setPlayerDiscProperties(p.id, {
    xspeed: props.xspeed * 3.4,
    yspeed: props.yspeed * 3.4,
    xgravity: -props.xspeed * 0.026,
    ygravity: -props.yspeed * 0.026,
  });
  room.setPlayerAvatar(p.id, "👟");
  p.sliding = true;
  await sleep(900);
  p.sliding = false;
  p.slowdown = 0.13;
  p.slowdownUntil = new Date().getTime() + 1000 * 3;
  p.cooldownUntil = new Date().getTime() + 18000;
  room.setPlayerAvatar(p.id, "");
};

export const rotateBall = (game: Game) => {
  if (game.ballRotation.power < 0.1) {
    game.ballRotation.power = 0;
    room.setDiscProperties(0, {
      xgravity: 0,
      ygravity: 0,
    });

    return;
  }
  room.setDiscProperties(0, {
    xgravity: 0.01 * game.ballRotation.x * game.ballRotation.power,
    ygravity: 0.01 * game.ballRotation.y * game.ballRotation.power,
  });
  game.ballRotation.power *= 0.96;
};
