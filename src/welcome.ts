import { sendMessage } from "./message"
import config from "../config"
import { defaultTeam } from "./settings"

export const welcomePlayer = (room: RoomObject, p: PlayerObject) => {
    room.setPlayerTeam(p.id, defaultTeam)
    sendMessage(p, `${config.roomName}\nUse "!help" to see all commands.`)
    sendMessage(p, `This project is Open Source. Visit: https://github.com/jakjus/hax-climb`)
    sendMessage(p, `HaxClimb Global Discord: discord.gg/ZaarExwMjf`)
}
