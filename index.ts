import { Headless } from "haxball.js"
import { sendMessage } from "./src/message"
import { duringDraft } from "./src/chooser"
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
import { AsyncDatabase as Database } from "promised-sqlite3";
import { createTables } from "./src/db";

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
  gameId: number;
  slowdownUntil: number;
  cooldownUntil: number;
  fouledAt: { x: number, y: number };
  canCallFoulUntil: number;
  afk: boolean;
  afkCounter: number;
  constructor(p: PlayerObject & Partial<PlayerAugmented>) {
    this.id = p.id;
    this.gameId = gameId
    this.name = p.name;
    this.auth = p.auth;
    this.conn = p.conn;
    this.team = p.team;
    this.foulsMeter = p.foulsMeter || 0;
    this.cardsAnnounced = p.cardsAnnounced || 0;
    this.activation = 0;
    this.sliding = false;
    this.slowdown = p.slowdown || 0;
    this.slowdownUntil = p.slowdownUntil || 0;
    this.cooldownUntil = p.cooldownUntil || 0;
    this.canCallFoulUntil = 0;
    this.fouledAt = { x: 0, y: 0 };
    this.afk = false;
    this.afkCounter = 0;
  }
  get position() { return room.getPlayer(this.id).position }
}

let gameId = 0;
export class Game {
  id: number;
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
    gameId += 1
    this.id = gameId
    this.eventCounter = 0; // to debounce some events
    this.inPlay = true;
    this.lastTouch = null;
    this.animation = false;
    this.ballRotation = {x: 0, y: 0, power: 0};
    this.positionsDuringPass = [];
    this.skipOffsideCheck = false;
    this.currentPlayers = [...players];  // used to keep track on leavers in case they reconnect with red card or injury
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
  //db = await Database.open('db.sqlite')
  //try {
  //  console.log('Creating DB...')
  //  await createTables(db)
  //} catch (e) {
  //  console.log('\nDB tables already created.')
  //}
  room = HBInit(args)
  const rsStadium = fs.readFileSync('./rs5.hbs', { encoding: 'utf8', flag: 'r' })
  room.setCustomStadium(rsStadium)
  room.setTimeLimit(5)
  room.setScoreLimit(0)
  if (process.env.DEBUG) {
    room.setScoreLimit(1)
    room.setTimeLimit(1)
  }
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
  let j = 0;
  room.onTeamGoal = team => {
  }

  room.onGameTick = () => {
    if (!game) { return }
    try {
      if (game.inPlay) {
        game.handleBallOutOfBounds()
        game.rotateBall()
      } else {
        game.handleBallInPlay()
      }
      game.handleBallTouch()
      game.checkAllX()
      game.checkFoul()
      i++;
      if (i > 6) {
        i = 0
        game.applySlowdown()
      }

      if (!duringDraft) {
        j++;
      }

      if (j > 60) {
        j = 0
        players.filter(p => p.team == 1 || p.team == 2).forEach(p => {
          p.afkCounter += 1;
          if (p.afkCounter == 18) {
            sendMessage('Move! You will be AFK in 5 seconds...', p)
          } else if (p.afkCounter > 23) {
            p.afkCounter = 0
            room.setPlayerTeam(p.id, 0)
            p.afk = true
          }
        })
      }
    } catch(e) {console.log('Error:', e)}
  }

  room.onPlayerActivity = p => {
    toAug(p).afkCounter = 0
  }

  room.onPlayerJoin = async p => {
    if (process.env.DEBUG) {
      room.setPlayerAdmin(p.id, true)
      //room.setPlayerTeam(p.id, 1)
    }
    if (!process.env.DEBUG) {
      if (players.map(p => p.auth).includes(p.auth)) {
        room.kickPlayer(p.id, "You are already on the server.", false)
      }
    }
    //await db.run('UPDATE players SET name=? WHERE auth=?', [p.name, p.auth])
    welcomePlayer(room, p)
    room.setPlayerAvatar(p.id, "")
    let newPlayer = new PlayerAugmented(p)
    if (game) {
      const found = game.currentPlayers.find(pp => pp.auth == p.auth)
      if (found && found.gameId == gameId) {
        game.currentPlayers = game.currentPlayers.filter(ppp => ppp.auth != p.auth)
        newPlayer = new PlayerAugmented({ ...p, foulsMeter: found.foulsMeter, cardsAnnounced: found.foulsMeter, slowdown: found.slowdown, slowdownUntil: found.slowdownUntil })
      }
      game.currentPlayers.push(newPlayer)
    }
    players.push(newPlayer)
  }

  room.onPlayerLeave = async p => {
    players = players.filter(pp => p.id != pp.id)
    if (players.filter(p => !p.afk).length < 2) {
      room.stopGame()
      room.startGame()
    }
  }

  room.onPlayerChat = (p, msg) => {
    const pp = toAug(p)
    if (process.env.DEBUG) {
      if (msg == 'a') {
        room.setPlayerDiscProperties(p.id, {x: -10})
      }
      if (msg == 'b') {
        console.log(game?.currentPlayers)
      }
      //console.log('paug', pp)
      //console.log('props', room.getPlayerDiscProperties(p.id))
      //console.log('ball', room.getDiscProperties(0))
      //console.log('game', game)
    }

    if (isCommand(msg)){
      handleCommand(pp, msg)
      return false
    }

    playerMessage(pp, msg)
    return false
  }

  room.onGameStart = _ => {
    if (!duringDraft) {
      game = new Game()
    }
    players.forEach(p => {
      if (game) {
        p.gameId = game.id
      }
      p.slowdownUntil = 0
      p.foulsMeter = 0;
      p.cardsAnnounced = 0;
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
