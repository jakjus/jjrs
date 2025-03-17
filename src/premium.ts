import { PlayerAugmented } from "..";
import { sendMessage } from "./message";
import { loginEnabled } from "./settings";

export const handleLoginAndPremium = async (player: PlayerAugmented) => {
	if (!process.env.API_URL) { return }
	if (!loginEnabled) { return }
	const res = await fetch(`${process.env.API_URL}/player?auth=${player.auth}`)
	const json = await res.json()
	player.loggedIn = json.loggedIn ? true : false
	player.premium = json.premium ? true : false
}
