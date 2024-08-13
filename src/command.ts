import { sendMessage } from "./message"
import { room, PlayerAugmented } from "../index"
import config from "../config"

export const isCommand = (msg: string) => msg.trim().startsWith("!")
export const handleCommand = (p: PlayerAugmented, msg: string) => {
    let commandText = msg.trim().slice(1)
    let commandName = commandText.split(" ")[0]
    let commandArgs = commandText.split(" ").slice(1)
    if (commands[commandName]) {
        commands[commandName](p, commandArgs)
    } else {
        sendMessage(p, "Command not found.")
    }
}

type commandFunc = (p: PlayerAugmented, args: Array<string>) => void
const commands: { [key: string]: commandFunc } = {
    discord: (p) => showDiscord(p),
    dc: (p) => showDiscord(p),
    bb: (p) => bb(p),
    help: (p) => showHelp(p),
}

const showHelp = (p: PlayerAugmented) => {
    sendMessage(p, `${config.roomName}. Commands: ${Object.keys(commands)
                    .map(k => "!"+k)
                    .join(", ")}`)
}

const showDiscord = (p: PlayerAugmented) => {
    sendMessage(null, `HaxClimb Global Discord: discord.gg/ZaarExwMjf`)
}

const bb = (p: PlayerAugmented) => {
    room.kickPlayer(p.id, "Bye!", false)
}
