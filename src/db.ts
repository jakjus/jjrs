import { AsyncDatabase as Database } from "promised-sqlite3";
import { game, PlayerAugmented } from "..";

export let db: any;

const createTables = async (db: any) => {
  const createStatements = [
    `CREATE TABLE "players" (
            "id"	INTEGER,
            "auth"	TEXT NOT NULL,
            "name"	TEXT,
            "admin" BOOLEAN NOT NULL DEFAULT 0,
            "elo"	INTEGER,
            PRIMARY KEY("id" AUTOINCREMENT)
    );`,
    `CREATE UNIQUE INDEX auth ON players(auth)`,
  ];

  for (const t of createStatements) {
    await db.run(t);
  }
};

export const changeEloOfPlayer = async (playerId: number, change: number) => {
  const p = game?.currentPlayers.find((p) => p.id == playerId);
  if (!p) {
    console.log("Error finding players for ELO calculation with ID ", playerId);
    return 1200;
  }
  await db.run(`UPDATE players SET elo=elo+? WHERE auth=?`, [change, p.auth]);
};

export const setPlayerAsAdmin = async (playerId: number) => {
  const p = game?.currentPlayers.find((p) => p.id == playerId);
  if (!p) {
    console.log("Error: Player with ID", playerId, "not found.");
    return;
  }
  try {
    await db.run(`UPDATE players SET admin = 1 WHERE auth = ?`, [p.auth]);
    console.log(`Player ${p.name} (ID: ${playerId}) is now an admin.`);
  } catch (error) {
    console.error("Error updating admin status for player:", error);
  }
};


export const initDb = async () => {
  db = await Database.open("db.sqlite");
  // Uncomment for DB SQL Debug:
  //db.inner.on("trace", (sql: any) => console.log("[TRACE]", sql));
  try {
    console.log("Creating DB...");
    await createTables(db);
  } catch (e) {
    console.log("\nDB tables already created.");
  }
  return db;
};

interface ReadPlayer {
  elo: number;
  admin: boolean;
}

export const getOrCreatePlayer = async (
p: PlayerObject | PlayerAugmented,
): Promise<ReadPlayer> => {
  const auth = p.auth;
  const playerInDb = await db.get("SELECT elo, admin FROM players WHERE auth=?", [
    auth,
  ]);

  if (!playerInDb) {
    await db.run("INSERT INTO players(auth, name, elo, admin) VALUES (?, ?, ?, ?)", [
      p.auth,
      p.name,
      1200,
      0,
    ]);
    return { 
      elo: 1200, 
      admin: false
    };
  }

  return { 
    elo: playerInDb.elo, 
    admin: Boolean(playerInDb.admin)
  };
};

