import { Game, room, PlayerAugmented, toAug, players } from "../index"
import { defaults } from "./settings"
import { sleep } from "./utils"

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
	let cardsFactor = 1
	if (ballDist > 300) {
		cardsFactor += 1  // flagrant foul
		room.sendAnnouncement('flagrant foul by '+slider.name)
	}
	const power = Math.sqrt((sliderProps.xspeed-victimProps.xspeed)**2+(sliderProps.yspeed-victimProps.yspeed)**2)
	console.log('power', power)
	const slowdown = power > 2.3 ? 0.08*power : 0.06*power
	const av = power > 2.3 ? '❌' : '🩹'
	room.setPlayerAvatar(victim.id, av)
	victim.slowdown = slowdown
	victim.slowdownUntil = new Date().getTime()+1000*(power*10+power**4*8*Math.random()*Math.random())
	victim.canCallFoulUntil = new Date().getTime()+3000
	victim.fouledAt = { x: victimProps.x, y: victimProps.y }
	room.sendAnnouncement(victim.name+' can call foul by holding X')
	slider.foulsMeter += power*cardsFactor
	console.log(slider)
	console.log(victim)
}

export const announceCards = (game: Game) => {
	players.filter(p => p.team != 0).forEach(p => {
		if (p.foulsMeter > p.cardsAnnounced) {
			if (p.foulsMeter > 1 && p.foulsMeter < 2) {
				room.setPlayerAvatar(p.id, "🟨")
				room.sendAnnouncement('yellow card for '+p.name)
			} else if (p.foulsMeter >= 2) {
				room.setPlayerAvatar(p.id, "🟥")
				game.sentoffOrEscaped.push(p)
				room.setPlayerTeam(p.id, 0)
				console.log('sentoff is', game.sentoffOrEscaped)
				room.sendAnnouncement('red card for '+p.name)
			}
			p.cardsAnnounced = Math.floor(p.foulsMeter)
		}
	})

}