import { Headless } from "haxball.js"
import { isCommand, handleCommand } from "./src/command"
import { playerMessage } from "./src/message"
import { handleBallOutOfBounds } from "./src/out";
import * as fs from 'fs';

export interface lastKick {
  byPlayer: PlayerAugmented,
  x: number,
  y: number,
}

export class PlayerAugmented {
  id: number;
  name: string;
  auth: string;  // so that it doesn't disappear
  foulsMeter: number; // can be a decimal. over 1.0 => yellow card, over 2.0 => red card
  conn: string;
  constructor(p: PlayerObject) {
    this.id = p.id;
    this.name = p.name;
    this.auth = p.auth;
    this.foulsMeter = 0;
    this.conn = p.conn;
  }
  get position() { return room.getPlayer(this.id).position }
  get team() { return room.getPlayer(this.id).team }
}

export class Game {
  ticks: number;
  active: boolean;
  state: "play" | "out" | "os" | "ck" | "fk" | "pen";
  constructor() {
    this.ticks = 0;
    this.active = true;
    this.state = "play";
  }
  addTime() {
    if (this.active) {
      this.ticks++
    }
  }
  handleEnd() {
    if (this.ticks > 300*60) {
      console.log('stopping bcs time')
      room.stopGame()
    }
  }
  handleBallOutOfBounds() {
    handleBallOutOfBounds(this, room)
  }
}


export let players: PlayerAugmented[] = []
export let getP = (p: PlayerObject) => {
  const found = players.find(pp => pp.id == p.id)
  if (!found) {
    throw(`Lookup for player with id ${p.id} failed. Player is not in the players array. Players array: ${players}`)
  }
  return found
}
export let db: any;
export let room: RoomObject;

const roomBuilder = async (HBInit: Headless, args: RoomConfigObject) => {
  room = HBInit(args)

  const rsStadium = fs.readFileSync('./rs5.hbs', { encoding: 'utf8', flag: 'r' })
  room.setCustomStadium(rsStadium)
  room.setTimeLimit(0)
  room.setScoreLimit(0)

  let game = new Game()
  room.startGame()

  room.onGameTick = () => {
    game.addTime()
    game.handleEnd()
    game.handleBallOutOfBounds()
  }

  room.onPlayerJoin = async p => {
    process.env.DEBUG && room.setPlayerAdmin(p.id, true)
    const newPlayer = new PlayerAugmented(p)
    players.push(newPlayer)
  }

  room.onPlayerLeave = async p => {
    players = players.filter(pp => p.id != pp.id)
  }

  room.onPlayerChat = (p, msg) => {
    const pp = getP(p)
    if (process.env.DEBUG) {
      console.log('player', p)
      console.log('paug', pp)
      console.log('paugpos', pp.position)
      console.log('paugteam', pp.team)
    }
    if (isCommand(msg)){
      handleCommand(pp, msg)
      return false
    }
    playerMessage(pp, msg)
    return false
  }

  room.onPlayerTeamChange = p => {
    // getP(p).team = p.team
  }

  room.onRoomLink = url => {
    console.log(`Room link: ${url}`)
  }
}

export default roomBuilder;
