import { db } from '../index'

export const createTables = async (db: any) => {
    const createStatements = [`CREATE TABLE "players" (
            "id"	INTEGER,
            "auth"	TEXT NOT NULL,
            "name"	TEXT,
            "points"	INTEGER,
            PRIMARY KEY("id" AUTOINCREMENT)
    );`,
    `CREATE TABLE "stats" (
            "id"	INTEGER,
            "playerId"	INTEGER,
            "mapSlug"	TEXT,
            "started"	INTEGER,
            "stopped"	INTEGER,
            "bestTime"	INTEGER,
            "cpX"	REAL,
            "cpY"	REAL,
            FOREIGN KEY("playerId") REFERENCES "players"("id"),
            PRIMARY KEY("id" AUTOINCREMENT)
    );
    `, 
    `CREATE UNIQUE INDEX auth ON players(auth)`,
    `CREATE INDEX points ON stats(points DESC)`,
    `CREATE INDEX bestTime ON stats(bestTime DESC)`,
    `CREATE INDEX mapSlug ON stats(mapSlug)`
    ]

    for (const t of createStatements) {
      await db.run(t)
    }
}
