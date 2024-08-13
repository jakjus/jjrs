import { room, PlayerAugmented } from "../index"
import { msToHhmmss, getStats, getOrCreatePlayer } from "./utils"

export const sendMessage = (p: PlayerAugmented | null, msg: string) => {
    if (p) {
        room.sendAnnouncement(`[DM] ${msg}`, p.id, 0xe6e9f2, "small", 0)
    } else {
        room.sendAnnouncement(`[Server] ${msg}`, undefined, 0xe6e9f2, "small", 0)
    }
}

export const playerMessage = async (p: PlayerAugmented, msg: string) => {
    room.sendAnnouncement(`${p.name}: ${msg}`, undefined, 0xe6e9f2, "normal", 1)
}
