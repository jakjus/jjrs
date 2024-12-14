import { Headless } from "haxball.js";
import { duringDraft } from "./src/chooser";
import { isCommand, handleCommand } from "./src/command";
import { playerMessage } from "./src/message";
import {
  handleBallOutOfBounds,
  handleBallInPlay,
  clearThrowInBlocks,
} from "./src/out";
import { checkAllX, rotateBall } from "./src/superpower";
import { handleLastTouch } from "./src/offside";
import { checkFoul } from "./src/foul";
import * as fs from "fs";
import { applySlowdown } from "./src/slowdown";
import initChooser from "./src/chooser";
import { welcomePlayer } from "./src/welcome";
import { initDb } from "./src/db";
import { teamplayBoost } from "./src/teamplayBoost";
import { applyRotation } from "./src/rotateBall";
import { afk } from "./src/afk";
import { initPlayer } from "./src/welcome";
import * as crypto from "node:crypto";

export const version = '1.1.0 (16/12/2024)'

export interface lastTouch {
  byPlayer: PlayerAugmented;
  x: number;
  y: number;
}

export class PlayerAugmented {
  id: number;
  name: string;
  auth: string; // so that it doesn't disappear
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
  fouledAt: { x: number; y: number };
  canCallFoulUntil: number;
  afk: boolean;
  afkCounter: number;
  elo: number;
  constructor(p: PlayerObject & Partial<PlayerAugmented>) {
    this.id = p.id;
    this.gameId = gameId;
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
    this.elo = 1200;
  }
  get position() {
    return room.getPlayer(this.id).position;
  }
}

let gameId = 0;
export class Game {
  id: number;
  inPlay: boolean;
  animation: boolean;
  eventCounter: number;
  lastTouch: lastTouch | null;
  lastKick: PlayerObject | null;
  ballRotation: { x: number; y: number; power: number };
  positionsDuringPass: PlayerObject[];
  skipOffsideCheck: boolean;
  currentPlayers: PlayerAugmented[];
  rotateNextKick: boolean;
  boostCount: number;

  constructor() {
    gameId += 1;
    this.id = gameId;
    this.eventCounter = 0; // to debounce some events
    this.inPlay = true;
    this.lastTouch = null;
    this.lastKick = null;
    this.animation = false;
    this.ballRotation = { x: 0, y: 0, power: 0 };
    this.positionsDuringPass = [];
    this.skipOffsideCheck = false;
    this.currentPlayers = JSON.parse(JSON.stringify(players)); // used to keep track on leavers in case they reconnect with red card or injury
    this.rotateNextKick = false;
    this.boostCount = 0;
  }
  rotateBall() {
    rotateBall(this);
  }
  handleBallTouch() {
    const ball = room.getDiscProperties(0);
    if (!ball) {
      return;
    }
    for (const p of room.getPlayerList()) {
      const prop = room.getPlayerDiscProperties(p.id);
      if (!prop) {
        continue;
      }
      const dist = Math.sqrt((prop.x - ball.x) ** 2 + (prop.y - ball.y) ** 2);
      const isTouching = dist < prop.radius + ball.radius + 0.1;
      if (isTouching) {
        const pAug = toAug(p);
        pAug.sliding = false;
        handleLastTouch(this, pAug);
        return;
      }
    }
  }
  handleBallOutOfBounds() {
    handleBallOutOfBounds(this);
  }
  handleBallInPlay() {
    handleBallInPlay(this);
  }
  checkAllX() {
    checkAllX(this);
  }
  checkFoul() {
    checkFoul();
  }
  applySlowdown() {
    applySlowdown();
  }
}

export let players: PlayerAugmented[] = [];
export let toAug = (p: PlayerObject) => {
  const found = players.find((pp) => pp.id == p.id);
  if (!found) {
    throw `Lookup for player with id ${p.id} failed. Player is not in the players array: ${JSON.stringify(players)}`;
  }
  return found;
};
export let room: RoomObject;
export let game: Game | null;
export let db: any;
export let adminPass: string = crypto.randomBytes(6).toString("hex");

const roomBuilder = async (HBInit: Headless, args: RoomConfigObject) => {
  room = HBInit(args);
  db = await initDb();
  const rsStadium = fs.readFileSync("./maps/rs5.hbs", {
    encoding: "utf8",
    flag: "r",
  });
  room.setCustomStadium(rsStadium);
  room.setTimeLimit(5);
  room.setScoreLimit(3);
  room.setTeamsLock(true);
  if (process.env.DEBUG) {
    room.setScoreLimit(1);
    room.setTimeLimit(1);
  }
  room.startGame();

  let i = 0;
  room.onTeamGoal = (team) => {};

  room.onGameTick = () => {
    if (!game) {
      return;
    }
    try {
      i++;
      game.handleBallTouch();
      if (i > 6) {
        if (game.inPlay) {
          game.handleBallOutOfBounds();
          game.rotateBall();
        } else {
          game.handleBallInPlay();
        }
        game.applySlowdown();
        afk.onTick();
        game.checkAllX();
        game.checkFoul();
        i = 0;
      }
    } catch (e) {
      console.log("Error:", e);
    }
  };

  room.onPlayerActivity = (p) => {
    afk.onActivity(p);
  };

  room.onPlayerJoin = async (p) => {
    if (process.env.DEBUG) {
      room.setPlayerAdmin(p.id, true);
    } else {
      if (players.map((p) => p.auth).includes(p.auth)) {
        room.kickPlayer(p.id, "You are already on the server.", false);
      }
    }
    welcomePlayer(room, p);
    room.setPlayerAvatar(p.id, "");
    await initPlayer(p);
  };

  // handled in src/chooser.ts
  room.onPlayerLeave = async (p) => {
    players = players.filter((pp) => p.id != pp.id);
  };

  room.onPlayerChat = (p, msg) => {
    const pp = toAug(p);
    if (process.env.DEBUG) {
      if (msg == "a") {
        room.setPlayerDiscProperties(p.id, { x: -10 });
      }
    }
    if (msg == "!debug") {
      console.log(game);
      return false;
    }

    if (isCommand(msg)) {
      handleCommand(pp, msg);
      return false;
    }

    playerMessage(pp, msg);
    return false;
  };

  room.onGameStart = (_) => {
    if (!duringDraft) {
      game = new Game();
    }
    players.forEach((p) => {
      if (game) {
        p.gameId = game.id;
      }
      p.slowdownUntil = 0;
      p.foulsMeter = 0;
      p.cardsAnnounced = 0;
      p.activation = 0;
      p.sliding = false;
      p.slowdown = 0;
      p.slowdownUntil = 0;
      p.cooldownUntil = 0;
      p.canCallFoulUntil = 0;
    });
    clearThrowInBlocks();
    room.getPlayerList().forEach((p) => room.setPlayerAvatar(p.id, ""));
  };

  room.onPositionsReset = () => {
    clearThrowInBlocks();
    if (game) {
      game.animation = false;
      room.setDiscProperties(0, {
        xspeed: 0,
        yspeed: 0,
        xgravity: 0,
        ygravity: 0,
      }); // without this, there was one tick where the ball's gravity was applied, and the ball has moved after positions reset.
      game.ballRotation = { x: 0, y: 0, power: 0 };
    }
  };

  room.onGameStop = (_) => {
    if (game) {
      game = null;
    }
  };

  room.onPlayerTeamChange = (p) => {
    if (process.env.DEBUG) {
      //room.setPlayerDiscProperties(p.id, {x: -10, y: 0})
    }
    toAug(p).team = p.team;
  };

  room.onPlayerBallKick = (p) => {
    if (game) {
      const pp = toAug(p);
      teamplayBoost(game, p);
      applyRotation(game, p);
      handleLastTouch(game, pp);
      if (pp.activation > 20) {
        pp.activation = 0;
        room.setPlayerAvatar(p.id, "");
      }
    }
  };

  room.onRoomLink = (url) => {
    console.log(`Room link: ${url}`);
    console.log(`Admin Password: ${adminPass}`);
  };

  initChooser(room); // must be called at the end
};

export default roomBuilder;
