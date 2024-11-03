import { Game, room, PlayerAugmented, toAug, players } from "../index"
import { defaults, box, mapBounds } from "./settings"
import { sendMessage } from "./message"

export const isPenalty = (victim: PlayerAugmented) =>
	{
		const positiveX = Math.abs(victim.fouledAt.x)
		const isYInRange = Math.abs(victim.fouledAt.y) <= box.y
		const boxSide = victim.team == 1 ? 1 : -1
		const isInBox = positiveX >= box.x && positiveX <= mapBounds.x && Math.sign(victim.fouledAt.x) === boxSide
		const result = isYInRange && isInBox
		return result
	}

export const checkFoul = async (game: Game) => {
	const red = room.getPlayerList().filter(p => p.team == 1)
	const blue = room.getPlayerList().filter(p => p.team == 2)
	red.forEach(r => {
		blue.forEach(b => {
			const dist = Math.sqrt((r.position.x-b.position.x)**2+(r.position.y-b.position.y)**2)
			if (dist < defaults.playerRadius*2+0.1) {
				const ar = toAug(r)
				const ab = toAug(b)

				if (ar.sliding && !ab.sliding) {
					handleSlide(ar, ab)
				}
				if (!ar.sliding && ab.sliding) {
					handleSlide(ab, ar)
				}
			}
		})
	})
}

const handleSlide = (slider: PlayerAugmented, victim: PlayerAugmented) => {
	if (victim.slowdown) {
		return
	}
	const sliderProps = room.getPlayerDiscProperties(slider.id)
	const victimProps = room.getPlayerDiscProperties(victim.id)
	const ballPos = room.getBallPosition()
	const ballDist = Math.sqrt((slider.position.x-ballPos.x)**2+(slider.position.y-ballPos.y)**2)
	let cardsFactor = 0.7
	if (ballDist > 300) {
		cardsFactor += 1  // flagrant foul
		sendMessage(`Flagrant foul by ${slider.name}.`)
	}
	victim.fouledAt = { x: victimProps.x, y: victimProps.y }
	if (isPenalty(victim)) {
		cardsFactor += 0.3
	}
	const power = Math.sqrt((sliderProps.xspeed-victimProps.xspeed)**2+(sliderProps.yspeed-victimProps.yspeed)**2)*0.7
	const slowdown = power > 2.7 ? 0.05*power : 0.04*power
	const av = power > 2.7 ? '❌' : '🩹'
	room.setPlayerAvatar(victim.id, av)
	victim.slowdown = slowdown
	victim.slowdownUntil = new Date().getTime()+1000*(0.08*power**8*(0.5+0.5*Math.random()*Math.random()))
	victim.canCallFoulUntil = new Date().getTime()+4000
	sendMessage('You have been fouled. You can call foul by holding X in the next 4 seconds.', victim)
	slider.foulsMeter += 0.7*power*cardsFactor*(Math.random()*0.2+0.9)
}

export const announceCards = (game: Game) => {
	players.filter(p => p.team != 0).forEach(p => {
		if (p.foulsMeter > p.cardsAnnounced) {
			if (p.foulsMeter > 1 && p.foulsMeter < 2) {
				room.setPlayerAvatar(p.id, "🟨")
				sendMessage('🟨 Yellow card for '+p.name)
			} else if (p.foulsMeter >= 2) {
				room.setPlayerAvatar(p.id, "🟥")
				room.setPlayerTeam(p.id, 0)
				sendMessage('🟥 Red card for '+p.name)
			}
			p.cardsAnnounced = p.foulsMeter
		}
	})
}
