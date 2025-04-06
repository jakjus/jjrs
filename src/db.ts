import { AsyncDatabase as Database } from "promised-sqlite3";
import { game, PlayerAugmented } from "..";

export let db: any;

const createTables = async (db: any) => {
  const createStatements = [
    `CREATE TABLE "players" (
            "id"	INTEGER,
            "auth"	TEXT NOT NULL,
            "name"	TEXT,
            "elo"	INTEGER,
            PRIMARY KEY("id" AUTOINCREMENT)
    );`,
    `CREATE UNIQUE INDEX auth ON players(auth)`,
  ];

  for (const t of createStatements) {
    await db.run(t);
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
}

export const getOrCreatePlayer = async (
  p: { auth: string, name: string },
): Promise<ReadPlayer> => {
  const auth = p.auth;
  const playerInDb = await db.get("SELECT elo FROM players WHERE auth=?", [
    auth,
  ]);
  if (!playerInDb) {
    await db.run("INSERT INTO players(auth, name, elo) VALUES (?, ?, ?)", [
      p.auth,
      p.name,
      1200,
    ]);
    const newPlayer = { elo: 1200 };
    return newPlayer;
  }
  return playerInDb;
};
