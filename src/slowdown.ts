import { PlayerAugmented, room, toAug } from "../index";

export const applySlowdown = () => {
  room
    .getPlayerList()
    .filter((p) => p.team != 0)
    .forEach((p) => {
      const pAug = toAug(p);
      if (new Date().getTime() > pAug.slowdownUntil) {
        if (pAug.slowdown) {
          pAug.slowdown = 0;
          room.setPlayerAvatar(p.id, "");
          room.setPlayerDiscProperties(p.id, { xgravity: 0, ygravity: 0 });
        }
        return;
      }
      const props = room.getPlayerDiscProperties(p.id);
      if (!props || !props.xspeed || !props.yspeed) {
        return;
      }
      room.setPlayerDiscProperties(p.id, {
        xgravity: -props.xspeed * pAug.slowdown,
        ygravity: -props.yspeed * pAug.slowdown,
      });
    });
};
