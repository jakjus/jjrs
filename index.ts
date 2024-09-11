import { Headless } from "haxball.js"
import { isCommand, handleCommand } from "./src/command"
import { playerMessage } from "./src/message"
import { handleBallOutOfBounds, handleBallInPlay, clearThrowInBlocks } from "./src/out";
import { checkAllX, rotateBall } from "./src/superpower"
import { handleLastTouch } from "./src/offside"
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
  activation: number;
  team: 0 | 1 | 2;
  constructor(p: PlayerObject) {
    this.id = p.id;
    this.name = p.name;
    this.auth = p.auth;
    this.foulsMeter = 0;
    this.conn = p.conn;
    this.team = p.team;
    this.activation = 0;
  }
  get position() { return room.getPlayer(this.id).position }
}

export class Game {
  inPlay: boolean;
  animation: boolean;
  eventCounter: number;
  //state: "play" | "ti" | "os" | "gk" | "ck" | "fk" | "pen";
  lastTouch: lastTouch | null;
  ballRotation: { x: number, y: number, power: number };
  positionsDuringPass: PlayerObject[];
  skipOffsideCheck: boolean;
  constructor() {
    this.eventCounter = 0; // to debounce some events
    this.inPlay = true;
    this.lastTouch = null;
    this.animation = false;
    this.ballRotation = {x: 0, y: 0, power: 0}
    this.positionsDuringPass = []
    this.skipOffsideCheck = false
    //this.state = "play";
  }
  rotateBall() {
    rotateBall(this)
  }
  handleBallTouch() {
    const ball = room.getDiscProperties(0)
    if (!ball) { return }
    for (const p of room.getPlayerList()) {
      const prop = room.getPlayerDiscProperties(p.id)
      if (!prop) { continue }
      const dist = Math.sqrt((prop.x - ball.x)**2+(prop.y - ball.y)**2)
      const isTouching = dist < (prop.radius + ball.radius + 0.1)
      if (isTouching) {
        handleLastTouch(this, toAug(p))
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
  checkAllX() {
    checkAllX(this)
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

  //room.startGame()
  const loop = async () => {
    if (!game || !room.getScores()) {
      setTimeout(loop, 1000/60)
      return
    }
    try {
      if (game.inPlay) {
        game.handleBallOutOfBounds()
      } else {
        game.handleBallInPlay()
      }
    } catch(e) {
      console.log(e)
    }
    finally {
      setTimeout(loop, 1000/60)
    }
  }

  loop()

  room.onGameTick = () => {
    if (!game) { return }
    game.handleBallTouch()
    game.checkAllX()
    game.rotateBall()
  }

  room.onPlayerJoin = async p => {
    if (process.env.DEBUG) {
      room.setPlayerAdmin(p.id, true)
      room.setPlayerTeam(p.id, 1)
      room.startGame()
      room.setPlayerDiscProperties(p.id, {x: -10, y: 0})
      room.setPlayerAvatar(p.id, "")
    }
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
    room.getPlayerList().forEach(p => room.setPlayerAvatar(p.id, ""))
  }

  room.onPositionsReset = () => {
    clearThrowInBlocks()
    if (game) {
      game.ballRotation = { x:0, y:0, power:0 }
    }
  }

  room.onGameStop = _ => {
    if (game) { game = null }
  }

  room.onPlayerTeamChange = p => {
    toAug(p).team = p.team
  }

  room.onPlayerBallKick = p => {
    room.sendAnnouncement('ballkick')
    if (game) {
      const pp = toAug(p)
      handleLastTouch(game, pp)
      pp.activation = 0
      room.setPlayerAvatar(p.id, "")
    }
  }

  room.onRoomLink = url => {
    console.log(`Room link: ${url}`)
  }
}

export default roomBuilder;
