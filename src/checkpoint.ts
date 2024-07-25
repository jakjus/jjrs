import { isInGame, msToHhmmss, toAug, getStats, setStats, sleep } from "./utils"
import { defaultTeam } from "./settings"
import { sendMessage } from "./message"
import { PlayerAugmented, room } from "../index"
import { currentMap } from "./mapchooser"
import { keyv } from "./db"

export const saveCheckpoint = async (p: PlayerAugmented) => {
    if (!isInGame(p)) {
        sendMessage(p, "❌ You have to be in game to save a checkpoint.")
        return
    }

    let props = room.getPlayerDiscProperties(p.id)
    if ((Math.abs(props.xspeed) + Math.abs(props.yspeed)) > 0.25) {
        sendMessage(p, "❌ You cannot move while saving a checkpoint.")
        return
    }
    let oldprops = props
    sendMessage(p, "⏳ Saving checkpoint...")

    for (let i = 0; i < 5; i++) {
        await sleep(1000)
        props = room.getPlayerDiscProperties(p.id)
        if (!props) { return }
        if ((Math.abs(props.xspeed) + Math.abs(props.yspeed)) > 0.25) {
            sendMessage(p, "❌ You cannot move while saving a checkpoint.")
            return
        }
    }

    if ((Math.abs(oldprops.x - props.x) + Math.abs(oldprops.y - props.y)) > 1) {
        sendMessage(p, "❌ You cannot move while saving a checkpoint.")
        return
    }

    setStats(p, "checkpoint", props)
    keyv.set(p.auth, p)
    sendMessage(p, "✅ Checkpoint saved.")
}

export const loadCheckpoint = async (p: PlayerAugmented) => {
    await room.setPlayerTeam(p.id, defaultTeam)
    let pCheckpoint = getStats(p).checkpoint
    if (pCheckpoint) {
        room.setPlayerDiscProperties(p.id, pCheckpoint)
        sendMessage(p, "Checkpoint loaded.")
    } else {
        sendMessage(p, `No checkpoint found. Make a checkpoint with "!save"`)
    }
}

export const handleAllFinish = () => {
    room.getPlayerList().filter(p => p.team != 0).forEach(po => {
        let p = toAug(po)
        if (!hasFinished(p)){
            return
        }
        let now = new Date().getTime()
        let started = new Date(getStats(p).started).getTime()
        let totalMiliseconds = now-started
        let timeDiff = (currentMap.estimatedTimeMins*60*1000-totalMiliseconds)/(currentMap.estimatedTimeMins*60*1000)
        // will be positive if good time, negative if bad time
        let getPoints = Math.ceil(10*(5**(timeDiff)))
        sendMessage(null, `🏁 ${p.name} has finished the climb. Final Time: ${msToHhmmss(totalMiliseconds)} [+⛰️ ${getPoints}] `)
        p.points += getPoints
        let pBestTime = getStats(p).bestTime
        if (!pBestTime || (totalMiliseconds < pBestTime)) {
            setStats(p, "bestTime", totalMiliseconds)
            sendMessage(null, `🏁 ${p.name} has a New Personal Best!`)
        }
        setStats(p, "finished", true)
        keyv.set(p.auth, p)
    })
}

export const hasFinished = (p: PlayerAugmented) => {
    let pos = room.getPlayerDiscProperties(p.id)
    if ((pos.x > currentMap.bounds.x[0]) && (pos.x < currentMap.bounds.x[1])
        && (pos.y > currentMap.bounds.y[0]) && (pos.y < currentMap.bounds.y[1])
        && (!getStats(p).finished)){
            return true
        }
        else {
            return false
        }
}
