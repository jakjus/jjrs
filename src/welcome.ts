import { sendMessage } from "./message"
import config from "../config"

export const welcomePlayer = (room: RoomObject, p: PlayerObject) => {
    sendMessage(`${config.roomName}\nUse "!help" to see all commands.`)
    sendMessage(`This project is in TEST phase. It may have bugs or be restarted without warning.`)
    sendMessage(`Hold "X" shorter to activate slide/finesse kick. Hold "X" longer to sprint.`)
}
