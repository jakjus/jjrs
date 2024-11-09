import { room, Game } from "..";

export const applyRotation = (game: Game, p: PlayerObject) => {
      const props = room.getPlayerDiscProperties(p.id);
      const spMagnitude = Math.sqrt(props.xspeed ** 2 + props.yspeed ** 2);
      const vecXsp = props.xspeed / spMagnitude;
      const vecYsp = props.yspeed / spMagnitude;

      game.ballRotation = {
        x: -vecXsp,
        y: -vecYsp,
        power: spMagnitude ** 0.5 * 5,
      };
      if (game.rotateNextKick) {
        game.ballRotation = {
          x: -vecXsp,
          y: -vecYsp,
          power: spMagnitude ** 0.5 * 12,
        };
      }
      game.rotateNextKick = false;
}
