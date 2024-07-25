import { PlayerAugmented, PlayerMapStats, players } from "../index"
import { currentMap } from "./mapchooser"
import { room } from "../index"

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
export const isInGame = (p: PlayerObject) => p.team == 1 || p.team == 2
export const toAug = (p: PlayerObject): PlayerAugmented => players[p.id]
export const getStats = (p: PlayerAugmented): PlayerMapStats => p.mapStats[currentMap.slug]

export const updateTime = (pAug: PlayerAugmented): void => {
    let stopped = getStats(pAug).stopped
    let started = getStats(pAug).started
    if (started && stopped) {
        let dateNow = new Date().getTime()
        let timeSpent = new Date(stopped).getTime() - new Date(started).getTime()
        setStats(pAug, "started", dateNow - timeSpent) 
        setStats(pAug, "stopped", undefined)
    }
}

export const setStats = (p: PlayerAugmented, key: keyof PlayerMapStats, value: PlayerMapStats[typeof key]): void => {
    p.mapStats[currentMap.slug] = { ...p.mapStats[currentMap.slug], [key]: value }
}
export const msToHhmmss = (ms: number | undefined): string => {
    if (!ms) { return '-' }
    let hours = Math.floor(ms/(1000*60*60))
    let minutes = Math.floor(ms/(1000*60)) - hours*60
    let seconds = Math.floor(ms/(1000)) - minutes*60 - hours*60*60
    let miliseconds = ms - seconds*1000 - minutes*60*1000 - hours*60*60*1000
    let hoursStr = hours.toString()
    if (hoursStr.length < 2) {
        hoursStr = "0"+hoursStr
    }
    let minutesStr = minutes.toString()
    if (minutesStr.length < 2) {
        minutesStr = "0"+minutesStr
    }
    let secondsStr = seconds.toString()
    if (secondsStr.length < 2) {
        secondsStr = "0"+secondsStr
    }
    let milisecondsStr = miliseconds.toString().slice(0,2)
    let timeString = `${hoursStr}h ${minutesStr}m ${secondsStr}.${milisecondsStr}s`
    return timeString
}

export const addTransparency = (p: PlayerObject) => {
    let cf = room.CollisionFlags
    // @ts-ignore
    room.setPlayerDiscProperties(p.id, {cGroup: cf.c1})
}
