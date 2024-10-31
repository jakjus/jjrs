import { AsyncDatabase as Database } from "promised-sqlite3";

export let db: any;

export const createTables = async (db: any) => {
    const createStatements = [`CREATE TABLE "players" (
            "id"	INTEGER,
            "auth"	TEXT NOT NULL,
            "name"	TEXT,
            "elo"	INTEGER,
            PRIMARY KEY("id" AUTOINCREMENT)
    );`,
    `CREATE UNIQUE INDEX auth ON players(auth)`]

    for (const t of createStatements) {
      await db.run(t)
    }
}

(async () => {
  db = Database.open('db.sqlite')
  // Uncomment for DB SQL Debug:
  // db.inner.on("trace", (sql: any) => console.log("[TRACE]", sql));
  try {
    console.log('Creating DB...')
    await createTables(db)
  } catch (e) {
    console.log('\nDB tables already created.')
  }
})()

