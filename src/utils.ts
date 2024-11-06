import { room, PlayerAugmented } from "../index";
import { db } from "./db";

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const setStats = async (
  p: PlayerAugmented,
  key: string,
  value: any,
): Promise<void> => {
  const auth = p.auth;
  const playerInDb = await db.get("SELECT id FROM players WHERE auth=?", [
    auth,
  ]);
  const query = "UPDATE stats SET " + key + "=? WHERE playerId=?";
  await db.run(query, [value, playerInDb.id]);
};

export const msToHhmmss = (ms: number | undefined): string => {
  if (!ms) {
    return "-";
  }
  const hours = Math.floor(ms / (1000 * 60 * 60));
  ms %= 1000 * 60 * 60;

  const minutes = Math.floor(ms / (1000 * 60));
  ms %= 1000 * 60;

  const seconds = Math.floor(ms / 1000);
  const milliseconds = ms % 1000;

  // Ensure two digits for hours, minutes, and seconds, and three digits for milliseconds
  const formattedHours = String(hours).padStart(2, "0");
  const formattedMinutes = String(minutes).padStart(2, "0");
  const formattedSeconds = String(seconds).padStart(2, "0");
  const formattedMilliseconds = String(milliseconds).padStart(3, "0");

  // Return the formatted string
  return `${formattedHours}:${formattedMinutes}:${formattedSeconds}.${formattedMilliseconds}`;
};

export const addTransparency = (p: PlayerObject) => {
  let cf = room.CollisionFlags;
  // @ts-ignore
  room.setPlayerDiscProperties(p.id, { cGroup: cf.c1 });
};
