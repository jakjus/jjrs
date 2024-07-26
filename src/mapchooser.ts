import * as maps from "./maps/maplist";
import { room } from "../index";
import { getStats, setStats, updateTime, addTransparency } from "./utils";
import { loadCheckpoint } from "./checkpoint";
import { sendMessage } from "./message";
import { mapDurationMins } from "./settings";

export interface ClimbMap {
    slug: string,
    estimatedTimeMins: number,
    bounds: { x: number[], y: number[] },
    map: any,
}

let loadedMaps: Array<ClimbMap> = []

export let currentMap: ClimbMap; 
let mapStarted: Date;

export const showTimeleft = (p: PlayerObject) => {
    const diffSecs = mapDurationMins*60 - ((new Date().getTime() - mapStarted.getTime())/1000)
    let diffMins = Math.ceil(diffSecs/60)
    sendMessage(p, `${diffMins} minutes left. Next map: ${getNextMapName()}`)
}


let getNextMapName = () => nextMap?.map?.name || `[Not yet decided]`

export const initMapCycle = () => {
    if (loadedMaps.length == 1){
        sendMessage(null, `Only one map loaded. Map chooser disabled.`)
    } else {
        setInterval(checkTimer, 5000)
    }
    Object.values(maps).forEach((m: ClimbMap) => loadedMaps.push(m))
    nextMap = loadedMaps[0]
    changeMap()
}

let diffSecs: number;
export const changeMap = async () => {
    for await (const po of room.getPlayerList()) {
        const stats = await getStats(po)
        if (stats.started && !stats.stopped) {
          await setStats(po, "stopped", new Date().getTime())
        }
    }

    if (nextMap) {
        currentMap = nextMap
    }
    mapStarted = new Date()
    room.stopGame()
    room.setCustomStadium(JSON.stringify(currentMap.map))
    room.startGame()
    room.getPlayerList().forEach(async po => {
        await updateTime(po)
        await loadCheckpoint(po)
        addTransparency(po)
    })
    announced = 0
    nextMap = undefined;
}

let announced = 0
let hasVoted: number[] = []
export let wantVotemapIds = new Set()

export const addVotemap = (p: PlayerObject) => {
  if (announced > 0) {
    sendMessage(p, `Voting in progress or finished. You cannot !votemap now.`)
    return
  }
  const have = wantVotemapIds.size
  const needed = Math.ceil(room.getPlayerList().length/2)
  if (!wantVotemapIds.has(p.id)) {
    wantVotemapIds.add(p.id)
    if (have+1 >= needed) {
      sendMessage(null, `${p.name} wants to change map. (${have+1}/${needed})`)
      sendMessage(null, `Votemap successful. (${have+1}/${needed})`)
      announced = 1
      mapStarted = new Date(new Date().getTime() - (mapDurationMins*60-2*60)*1000)  // when mapDurationMins is 15: set mapStarted as 13 mins ago (leaves 2 mins left and starts voting)
    } else {
      sendMessage(null, `${p.name} wants to change map. Use !votemap to join and start voting. (${have+1}/${needed})`)
    }
  } else {
    sendMessage(p, `You already used !votemap`)
    return
  }
}

type voteOption = { id: number, option: ClimbMap, votes: number }
export let voteOptions: voteOption[]
export const handleVote = (p: PlayerObject, opt: voteOption) => {
    if (!hasVoted.includes(p.id)) {
        hasVoted.push(p.id)
        opt.votes += 1
        sendMessage(null, `${p.name} has voted for: ${printOption(opt)}`)
    } else {
        sendMessage(p, `You have already voted.`)
    }
}

export let onlyVoteMessage = false

export const printOption = (vo: voteOption) => {
    if (vo.option.map.name == currentMap.map.name) {
        return `${vo.id}. Current map +10 minutes`
    }
    return `${vo.id}. ${vo.option.map.name}`
}

const startVoting = () => {
    wantVotemapIds = new Set()
    onlyVoteMessage = true
    sendMessage(null, `🗳️ Vote for next map:`)
    let prolongOption = {id: 1, option: currentMap, votes: 0}
    voteOptions = [prolongOption]
    sendMessage(null, printOption(prolongOption))
    for (const [i, haxMap] of loadedMaps.filter(m => m.map.name != currentMap.map.name).entries()) {
        let opt = {id: i+2, option: haxMap, votes: 0}
        voteOptions.push(opt)
        sendMessage(null, printOption(opt))
    }
}

const endVoting = () => {
    hasVoted = []
    let sorted = voteOptions.sort((a, b) => b.votes - a.votes)
    sendMessage(null, `🗳️ Voting ended. Results:`)
    for (let result of sorted) {
        sendMessage(null, `[${result.votes} votes] ${printOption(result)}`)
    }
    if (sorted[0].id == 1) {
        sendMessage(null, `Current map will be prolonged by 10 minutes.`)
        prolong()
    } else {
        sendMessage(null, `Next map has been set to: ${sorted[0].option.map.name}`)
        nextMap = sorted[0].option
    }
    onlyVoteMessage = false
}

let nextMap: ClimbMap | undefined;
const prolong = () => {
    mapStarted = new Date(mapStarted.getTime()+10*60*1000)
    announced = 0
    nextMap = undefined;
}

const checkTimer = () => {
    diffSecs = mapDurationMins*60 - ((new Date().getTime() - mapStarted.getTime())/1000)
    if (process.env.DEBUG) {
        diffSecs = mapDurationMins*60/44 - ((new Date().getTime() - mapStarted.getTime())/1000)
    }
    let diffMins = Math.ceil(diffSecs/60)
    if (announced == 0 && diffSecs < 5*60) {
        sendMessage(null, `${diffMins} minutes left. Next map: ${getNextMapName()}`)
        announced += 1
    }
    if (announced == 1 && diffSecs < 2*60) {
        sendMessage(null, `${diffMins} minutes left. Next map: ${getNextMapName()}`)
        startVoting()
        setTimeout(() => endVoting(), 20*1000)
        announced += 1
    }
    if (announced == 2 && diffSecs < 1*60) {
        sendMessage(null, `${diffMins} minutes left. Next map: ${getNextMapName()}`)
        announced += 1
    }
    if (announced == 3 && diffSecs < 15) {
        sendMessage(null, `${Math.ceil(diffSecs)} seconds left. Next map: ${getNextMapName()}. "!save" your progress now.`)
        announced += 1
    }
    if (diffSecs < 0) {
        sendMessage(null, `Changing map: ${getNextMapName()}`)
        changeMap()
    }
}

