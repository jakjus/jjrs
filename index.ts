import { Headless } from "haxball.js"
import { isCommand, handleCommand } from "./src/command"
import { playerMessage } from "./src/message"
import { handleBallOutOfBounds, handleBallInPlay, clearThrowInBlocks } from "./src/out";
import { checkAllX, rotateBall } from "./src/superpower"
import { handleLastTouch } from "./src/offside"
import { checkFoul } from "./src/foul"
import * as fs from 'fs';
import { applySlowdown } from "./src/slowdown";
import { defaults } from "./src/settings";
import initChooser from "./src/chooser";
import { welcomePlayer } from "./src/welcome";

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
  cardsAnnounced: number; // same as foulsMeter
  sliding: boolean;
  conn: string;
  activation: number;
  team: 0 | 1 | 2;
  slowdown: number;
  slowdownUntil: number;
  cooldownUntil: number;
  fouledAt: { x: number, y: number };
  canCallFoulUntil: number;
  afk: boolean;
  constructor(p: PlayerObject & Partial<PlayerAugmented>) {
    this.id = p.id;
    this.name = p.name;
    this.auth = p.auth;
    this.conn = p.conn;
    this.team = p.team;
    this.foulsMeter = p.foulsMeter || 0;
    this.cardsAnnounced = p.cardsAnnounced || 0;
    this.activation = 0;
    this.sliding = false;
    this.slowdown = 0;
    this.slowdownUntil = 0;
    this.cooldownUntil = 0;
    this.canCallFoulUntil = 0;
    this.fouledAt = { x: 0, y: 0 };
    this.afk = false;
  }
  get position() { return room.getPlayer(this.id).position }
}

export class Game {
  inPlay: boolean;
  animation: boolean;
  eventCounter: number;
  lastTouch: lastTouch | null;
  ballRotation: { x: number, y: number, power: number };
  positionsDuringPass: PlayerObject[];
  skipOffsideCheck: boolean;
  currentPlayers: PlayerAugmented[];
  rotateNextKick: boolean;

  constructor() {
    this.eventCounter = 0; // to debounce some events
    this.inPlay = true;
    this.lastTouch = null;
    this.animation = false;
    this.ballRotation = {x: 0, y: 0, power: 0};
    this.positionsDuringPass = [];
    this.skipOffsideCheck = false;
    this.currentPlayers = [...players];
    this.rotateNextKick = false;
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
        const pAug = toAug(p)
        pAug.sliding = false
        handleLastTouch(this, pAug)
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
  checkFoul() {
    checkFoul(this)
  }
  applySlowdown() {
    applySlowdown()
  }
}


export let players: PlayerAugmented[] = []
export let toAug = (p: PlayerObject) => {
  const found = players.find(pp => pp.id == p.id)
  if (!found) {
    throw(`Lookup for player with id ${p.id} failed. Player is not in the players array: ${JSON.stringify(players)}`)
  }
  return found
}
export let db: any;
export let room: RoomObject;
export let game: Game | null;

//process.stdin.on("data", d => {
//  const r = room
//  const result = eval(d.toString())
//  console.log(result)
//})

const roomBuilder = async (HBInit: Headless, args: RoomConfigObject) => {
  room = HBInit(args)
  const rsStadium = fs.readFileSync('./rs5.hbs', { encoding: 'utf8', flag: 'r' })
  room.setCustomStadium(rsStadium)
  room.setTimeLimit(5)
  room.setScoreLimit(0)
  room.startGame()

  //room.startGame()
  //const loop = async () => {
  //  if (!game || !room.getScores()) {
  //    setTimeout(loop, 1000/60)
  //    return
  //  }
  //  if (game.inPlay) {
  //    game.handleBallOutOfBounds()
  //  } else {
  //    game.handleBallInPlay()
  //  }
  //  setTimeout(loop, 1000/60)
  //}

  //loop()  // there were issues during throwIn using onGameTick loop. should be changed to onGameTick when bug is solved

  let i = 0;
  room.onGameTick = () => {
    if (!game) { return }
    if (game.inPlay) {
      game.handleBallOutOfBounds()
    } else {
      game.handleBallInPlay()
    }
    game.handleBallTouch()
    game.checkAllX()
    game.rotateBall()
    game.checkFoul()
    i++;
    if (i > 6) {
      i = 0
      game.applySlowdown()
    }
  }

  room.onPlayerJoin = async p => {
    if (process.env.DEBUG) {
      room.setPlayerAdmin(p.id, true)
      //room.setPlayerTeam(p.id, 1)
    }
    if (players.map(p => p.auth).includes(p.auth)) {
      room.kickPlayer(p.id, "You are already on the server.", false)
    }
    welcomePlayer(room, p)
    room.setPlayerAvatar(p.id, "")
    let newPlayer = new PlayerAugmented(p)
    if (game) {
      const found = game.currentPlayers.find(pp => pp.auth == p.auth)
      if (found) {
        newPlayer = new PlayerAugmented({ ...p, foulsMeter: found.foulsMeter, cardsAnnounced: found.foulsMeter, slowdown: found.slowdown, slowdownUntil: found.slowdownUntil })
      }
    }
    players.push(newPlayer)
  }

  room.onPlayerLeave = async p => {
    players = players.filter(pp => p.id != pp.id)
  }

  room.onPlayerChat = (p, msg) => {
    const pp = toAug(p)
    if (process.env.DEBUG) {
      if (msg == 'a') {
        room.setPlayerDiscProperties(p.id, {x: -10})
      }
      console.log('paug', pp)
      console.log('props', room.getPlayerDiscProperties(p.id))
      console.log('ball', room.getDiscProperties(0))
      console.log('game', game)
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
    players.forEach(p => {
      p.slowdownUntil = 0
      p.foulsMeter = p.foulsMeter || 0;
      p.cardsAnnounced = p.cardsAnnounced || 0;
      p.activation = 0;
      p.sliding = false;
      p.slowdown = 0;
      p.slowdownUntil = 0;
      p.cooldownUntil = 0;
      p.canCallFoulUntil = 0;
    })
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
    if (process.env.DEBUG) {
      //room.setPlayerDiscProperties(p.id, {x: -10, y: 0})
    }
    toAug(p).team = p.team
  }

  room.onPlayerBallKick = p => {
    if (game) {
      const pp = toAug(p)
      if (game.rotateNextKick) {
        const props = room.getPlayerDiscProperties(p.id)
        const spMagnitude = Math.sqrt(props.xspeed**2+props.yspeed**2)
        const vecXsp = props.xspeed/spMagnitude
        const vecYsp = props.yspeed/spMagnitude

        game.ballRotation = { x: -vecXsp, y: -vecYsp, power: spMagnitude**0.5*10}
        game.rotateNextKick = false
        room.setDiscProperties(0, { invMass: defaults.ballInvMass })
      }

      handleLastTouch(game, pp)
      if (pp.activation > 20) {
        pp.activation = 0
        room.setPlayerAvatar(p.id, "")
      }
    }
  }

  room.onRoomLink = url => {
    console.log(`Room link: ${url}`)
  }

  initChooser(room) // must be called at the end
}

export default roomBuilder;
