import { room } from "../index"
import { msToHhmmss, getStats } from "./utils"
import { voteOptions, onlyVoteMessage, handleVote } from "./mapchooser"

export const sendMessage = (p: PlayerObject | null, msg: string) => {
    if (p) {
        room.sendAnnouncement(`[DM] ${msg}`, p.id, 0xe6e9f2, "small", 0)
    } else {
        room.sendAnnouncement(`[Server] ${msg}`, undefined, 0xe6e9f2, "small", 0)
    }
}

export const playerMessage = (p: PlayerAugmented, msg: string) => {
    let bestTime = `[Not finished]`
    let color = 0xd6d6d6
    if (getStats(p) && getStats(p).bestTime){
        bestTime = `[${msToHhmmss(getStats(p).bestTime)}]`
        color = 0xf2e5d0
    } 

    if (onlyVoteMessage) {
        let choice = parseInt(msg.trim())
        if (!voteOptions.map(o => o.id).includes(choice)) {
            sendMessage(p, `Wring Vote by typing one of: ${voteOptions.map(o => o.id).join(", ")}`)
        } else {
            let choiceOpt = voteOptions.filter(v => v.id == choice)[0]
            handleVote(p, choiceOpt)
        }
        return false
    }

    room.sendAnnouncement(`${p.name} ${bestTime} [${Math.floor(p.points)}⛰️]: ${msg}`, undefined, color, "normal", 1)
}
