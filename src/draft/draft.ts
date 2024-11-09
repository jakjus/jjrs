import * as fs from "fs";
import { sendMessage } from "./message";
import { sleep } from "./utils";

export const performDraft = async (
  room: RoomObject,
  players: PlayerObject[],
  maxTeamSize: number,
  afkHandler?: Function,
) => {
  room.stopGame();
  players.forEach((p) => room.setPlayerTeam(p.id, 0));
  const draftMap = fs.readFileSync("./draft.hbs", {
    encoding: "utf8",
    flag: "r",
  });
  room.setCustomStadium(draftMap);
  // set blue players kickable (kicking them by red players results in
  // choose)
  players.slice(0, 2).forEach(async (p) => {
    room.setPlayerTeam(p.id, 1);
  });
  await sleep(100);
  room.startGame();
  await sleep(100);
  players.slice(0, 2).forEach(async (p) => {
    if (room.getPlayer(p.id)) {
      room.setPlayerDiscProperties(p.id, {
        cGroup:
          room.CollisionFlags.red |
          room.CollisionFlags.c3 |
          room.CollisionFlags.c1,
      });
    }
  });
  sendMessage("Draft has started. Captains choose players by KICKING (X).");
  let redPicker = players[0];
  let bluePicker = players[1];
  players.slice(2).forEach(async (p) => {
    room.setPlayerTeam(p.id, 2);
    await sleep(100);
    if (room.getPlayer(p.id)) {
      room.setPlayerDiscProperties(p.id, {
        cGroup:
          room.CollisionFlags.blue |
          room.CollisionFlags.c3 |
          room.CollisionFlags.c1,
      });
    }
  });
  sendMessage("BLUE enter the draft area (20s).");
  await sleep(20000);
  room
    .getPlayerList()
    .filter((p) => p.team == 2)
    .forEach((p) =>
      room.setPlayerDiscProperties(p.id, {
        cGroup:
          room.CollisionFlags.blue |
          room.CollisionFlags.kick |
          room.CollisionFlags.c1,
      }),
    ); // dont collide with middle line blocks and set kickable

  const setLock = (p: PlayerObject) => {
    const props = room.getPlayerDiscProperties(p.id);
    room.setPlayerDiscProperties(p.id, {
      cGroup:
        room.CollisionFlags.red |
        room.CollisionFlags.c3 |
        room.CollisionFlags.c1,
    });
    if (Math.abs(props.x) <= 55) {
      room.setPlayerDiscProperties(p.id, { x: Math.sign(props.x) * 70 });
    }
  };

  const setUnlock = (p: PlayerObject) => {
    room.setPlayerDiscProperties(p.id, {
      cGroup: room.CollisionFlags.red | room.CollisionFlags.c1,
    });
  };

  const redZone = { x: [-360, -210], y: [0, 300] };
  const blueZone = { x: [210, 360], y: [0, 300] };
  const midZone = { x: [-15, 15], y: [-300, 600] };

  const playersInZone = (zone: { x: number[]; y: number[] }) =>
    room
      .getPlayerList()
      .filter((p) => p.team == 2)
      .filter((p) => {
        if (!room.getScores()) {
          return [];
        }
        const props = room.getPlayerDiscProperties(p.id);
        return (
          props.x > zone.x[0] &&
          props.x < zone.x[1] &&
          props.y > zone.y[0] &&
          props.y < zone.y[1]
        );
      });

  // segment [62] and [63] is middle draft block
  // segment [64] is left chooser block
  // segment [65] is right chooser block
  // f0c0f0 set cmask: c3
  // spawn: x: -150, y: 150
  // x: 25

  sendMessage(redPicker.name + " picks teammate...");
  sendMessage("PICK YOUR TEAMMATE by KICKING him!", redPicker);
  let pickingNow = "red";
  let totalWait = 0;
  const pickTimeLimit = 20000; // ms
  const sleepTime = 100; // ms
  setUnlock(redPicker);

  let previousMidZoneLength = 0;
  while (playersInZone(midZone).length != 0) {
    const setNewPickerRed = async () => {
      if (
        room
          .getPlayerList()
          .map((p) => p.id)
          .includes(redPicker.id)
      ) {
        room.setPlayerTeam(redPicker.id, 0);
        afkHandler(redPicker);
      }
      const midPlayers = playersInZone(midZone);
      redPicker = midPlayers[0];
      room.setPlayerTeam(redPicker.id, 1);
      await sleep(100);
      room.setPlayerDiscProperties(redPicker.id, { x: -120, y: 0 });
      if (pickingNow == "red") {
        setUnlock(redPicker);
      } else {
        setLock(redPicker);
      }
      totalWait = 0;
    };

    const setNewPickerBlue = async () => {
      if (
        room
          .getPlayerList()
          .map((p) => p.id)
          .includes(bluePicker.id)
      ) {
        room.setPlayerTeam(bluePicker.id, 0);
        afkHandler(bluePicker);
      }
      const midPlayers = playersInZone(midZone);
      bluePicker = midPlayers[0];
      room.setPlayerTeam(bluePicker.id, 1);
      await sleep(100);
      room.setPlayerDiscProperties(bluePicker.id, { x: 120, y: 0 });
      if (pickingNow == "blue") {
        setUnlock(bluePicker);
      } else {
        setLock(bluePicker);
      }
      totalWait = 0;
    };

    // if teams full
    if (
      playersInZone(redZone).length == maxTeamSize - 1 &&
      playersInZone(blueZone).length == maxTeamSize - 1
    ) {
      break;
    }
    // if picker left
    if (
      !room
        .getPlayerList()
        .map((p) => p.id)
        .includes(redPicker.id) ||
      redPicker.team !== 1
    ) {
      sendMessage("Red picker left. Changing red picker...");
      await setNewPickerRed();
    }
    if (
      !room
        .getPlayerList()
        .map((p) => p.id)
        .includes(bluePicker.id) ||
      bluePicker.team !== 2
    ) {
      sendMessage("Blue picker left. Changing blue picker...");
      await setNewPickerBlue();
    }

    totalWait += sleepTime;

    // reset wait if player was picked
    if (playersInZone(midZone).length != previousMidZoneLength) {
      previousMidZoneLength = playersInZone(midZone).length;
      totalWait = 0;
    }
    if (pickingNow == "red") {
      if (
        playersInZone(redZone).length >= playersInZone(blueZone).length + 1 ||
        totalWait > pickTimeLimit
      ) {
        if (totalWait > pickTimeLimit) {
          sendMessage("Timeout. Changing red picker...");
          await setNewPickerRed();
          continue;
        }
        pickingNow = "blue";
        sendMessage(bluePicker.name + " picks teammate...");
        sendMessage("Pick 2 players by KICKING them.", bluePicker);
        setUnlock(bluePicker);
        setLock(redPicker);
        totalWait = 0;
        continue;
      }
    } else {
      if (
        playersInZone(blueZone).length >= playersInZone(redZone).length + 1 ||
        totalWait > pickTimeLimit
      ) {
        if (totalWait > pickTimeLimit) {
          sendMessage("Timeout. Changing blue picker...");
          await setNewPickerBlue();
          continue;
        }
        pickingNow = "red";
        sendMessage(`${redPicker.name} picks teammate...`);
        sendMessage("Pick 2 players by KICKING them!", redPicker);
        setUnlock(redPicker);
        setLock(bluePicker);
        totalWait = 0;
        continue;
      }
    }
    await sleep(sleepTime);
    if (!room.getScores()) {
      sendMessage("Draft cancelled.");
      break;
    }
  }
  await sleep(100); // wait for last pick to arrive in box
  // fill empty spots with other
  const red = [...playersInZone(redZone), redPicker];
  const blue = [...playersInZone(blueZone), bluePicker];
  room
    .getPlayerList()
    .filter(
      (p) =>
        ![...red, ...blue, ...playersInZone(midZone)]
          .map((pp) => pp.id)
          .includes(p.id),
    )
    .forEach((p) => { if (afkHandler) { afkHandler(p) }});
  room.stopGame();
  sendMessage("Draft finished.");
  return { red, blue };
};

