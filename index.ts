import { Headless } from "haxball.js"
import { isCommand, handleCommand } from "./src/command"
import { playerMessage } from "./src/message"
import { handleBallOutOfBounds, handleBallInPlay, clearThrowInBlocks } from "./src/out";
import * as fs from 'fs';

export interface lastTouch {
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
  team: 0 | 1 | 2;
  constructor(p: PlayerObject) {
    this.id = p.id;
    this.name = p.name;
    this.auth = p.auth;
    this.foulsMeter = 0;
    this.conn = p.conn;
    this.team = p.team;
  }
  get position() { return room.getPlayer(this.id).position }
}

export class Game {
  ticks: number;
  inPlay: boolean;
  //state: "play" | "ti" | "os" | "gk" | "ck" | "fk" | "pen";
  lastTouch: lastTouch | null;
  constructor() {
    this.ticks = 0;
    this.inPlay = true;
    this.lastTouch = null;
    //this.state = "play";
  }
  addTicks() {
    if (this.inPlay) {
      this.ticks++
    }
  }
  handleEnd() {
    // 60 ticks per second
    if (this.ticks >= 5 * 60 * 60) {
      console.log('stopping bcs time')
      room.stopGame()
    }
  }
  handleBallTouch() {
    const ball = room.getDiscProperties(0)
    if (!ball) { return }
    for (const p of room.getPlayerList()) {
      const prop = room.getPlayerDiscProperties(p.id)
      if (!prop) { continue }
      if (Math.sqrt((prop.x - ball.x)**2+(prop.y - ball.y)**2) < (prop.radius + ball.radius + 0.05)) {
        console.log('touched by ', p)
        this.lastTouch = { byPlayer: toAug(p), x: prop.x, y: prop.y }
        return
      }
    }
  }
  handleBallOutOfBounds() {
    handleBallOutOfBounds(this)
  }
  handleBallInPlay() {
    handleBallInPlay(this)
  }
}


export let players: PlayerAugmented[] = []
export let toAug = (p: PlayerObject) => {
  const found = players.find(pp => pp.id == p.id)
  if (!found) {
    throw(`Lookup for player with id ${p.id} failed. Player is not in the players array: ${players}`)
  }
  return found
}
export let db: any;
export let room: RoomObject;
export let game: Game | null;

process.stdin.on("data", d => {
  const r = room
  console.log(eval(d.toString()))
})

const roomBuilder = async (HBInit: Headless, args: RoomConfigObject) => {
  room = HBInit(args)
  const rsStadium = fs.readFileSync('./rs5.hbs', { encoding: 'utf8', flag: 'r' })
  room.setCustomStadium(rsStadium)
  room.setTimeLimit(0)
  room.setScoreLimit(0)

  room.startGame()

  room.onGameTick = () => {
    if (!game) { return }
    game.addTicks()
    game.handleBallTouch()
    if (game.inPlay) {
      game.handleEnd()
      game.handleBallOutOfBounds()
    } else {
      game.handleBallInPlay()
    }
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
    const pp = toAug(p)
    if (process.env.DEBUG) {
      console.log('paug', pp)
      console.log('props', room.getPlayerDiscProperties(p.id))
    }
    if (isCommand(msg)){
      handleCommand(pp, msg)
      return false
    }
    playerMessage(pp, msg)
    return false
  }

  room.onGameStart = _ => {
    game = new Game()
    clearThrowInBlocks()
  }

  room.onPositionsReset = () => {
    clearThrowInBlocks()
  }

  room.onGameStop = _ => {
    if (game) { game = null }
  }

  room.onPlayerTeamChange = p => {
    toAug(p).team = p.team
  }

  room.onPlayerBallKick = p => {
    if (game) {
      game.lastTouch = { byPlayer: toAug(p), x: p.position.x, y: p.position.y }
    }
  }

  room.onRoomLink = url => {
    console.log(`Room link: ${url}`)
  }
}

export default roomBuilder;
