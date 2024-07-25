import { Headless } from "haxball.js"
import { AsyncDatabase as Database } from "promised-sqlite3";
import { isCommand, handleCommand } from "./src/command"
import { playerMessage } from "./src/message"
import { addTransparency, updateTime, getStats, setStats } from "./src/utils"
import { welcomePlayer } from "./src/welcome"
import { createTables } from "./src/db";
import { handleBallOutOfBounds } from "./src/out";
import * as fs from 'fs';

export interface lastKick {
  byPlayer: Player,
  x: number,
  y: number,
}

class Player extends PlayerObject {
  foulsMeter: number; // can be a decimal. over 1.0 => yellow card, over 2.0 => red card
  constructor(p: PlayerObject) {
    super();
    this.auth = p.auth;
    this.foulsMeter = 0;
  }
}

const roomF = {
  players: [],
  getPlayerList: () => players,
  onPlayerJoin: (p: PlayerObject) => {
    const newPlayer = new Player(p)
    players.push(newPlayer)
  },
  onPlayerLeave: (p: PlayerObject) => 
  { 
    players = players.filter(pp => p.id != pp.id)
  },
}

export class Game {
  time: number;
  active: boolean;
  state: "play" | "out" | "os" | "ck" | "fk" | "pen";
  constructor() {
    this.time = 0;
    this.active = true;
    this.state = "play";
  }
  addTime() {
    if (this.active) {
      this.time++
    }
  }
  handleEnd() {
    if (this.time > 300) {
      room.stopGame()
    }
  }
  handleBallOutOfBounds() {
    handleBallOutOfBounds(this, room)
  }
}


export let players: Player[] = []
export let db: any;
export let room: RoomObject;

const roomBuilder = async (HBInit: Headless, args: RoomConfigObject) => {
  db = await Database.open('db.sqlite')
  // Uncomment for DB SQL Debug:
  // db.inner.on("trace", (sql: any) => console.log("[TRACE]", sql));
  try { 
    console.log('Creating DB...')
    await createTables(db)
  } catch (e) {
    console.log('\nDB tables already created.')
  }

  room = HBInit(args)

  const rsStadium = fs.readFileSync('./rs5.hbs', { encoding: 'utf8', flag: 'r' })

  room.setCustomStadium(rsStadium)

  let game = new Game()

  room.startGame()

  room.onGameTick = () => {
    game.addTime()
    game.handleEnd()
    game.handleBallOutOfBounds()
  }

  room.setTimeLimit(0)
  room.setScoreLimit(0)

  room.onPlayerJoin = async p => {
    roomF.onPlayerJoin(p)
  }

  room.onPlayerLeave = async p => {
    roomF.onPlayerLeave(p)
  }

  room.onPlayerChat = (p, msg) => {
    if (isCommand(msg)){
      handleCommand(toAug(p), msg)
      return false
    }
    playerMessage(toAug(p), msg)
    return false
  }

  room.onPlayerTeamChange = p => {
    toAug(p).team = p.team
  }

  room.onRoomLink = url => {
    console.log(`Room link: ${url}`)
  }
}

export default roomBuilder;
