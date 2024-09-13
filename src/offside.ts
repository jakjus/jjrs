import { Game, room } from "../index"
import { PlayerAugmented } from "../index"
import { sleep } from "./utils"
import { offsideDiscs, mapBounds, defaults } from "./settings"
import { freeKick } from "./out"

export const handleLastTouch = async (game: Game, p: PlayerAugmented) => {
	if (game.inPlay) {
		if (game.skipOffsideCheck) {
			game.skipOffsideCheck = false
		} else {
			checkOffside(game, p)
		}
	}
	savePositionsOnTouch(game)
	const ballPos = room.getBallPosition()
	game.lastTouch = { byPlayer: p, x: ballPos.x, y: ballPos.y }
}

const savePositionsOnTouch = (game: Game) => {
	const positions = room.getPlayerList().filter(p => p.team != 0)
	game.positionsDuringPass = positions
}

const checkOffside = async (game: Game, p: PlayerAugmented) => {
	const lt = game.lastTouch
	if (!lt) { return }
	const kickTeam = lt?.byPlayer.team
	if (kickTeam != p.team) { return }
	if (p.id == lt?.byPlayer.id) { return }
	const receiverDuringPass = game.positionsDuringPass.find(pp => pp.id == p.id)
	if (!receiverDuringPass) { return }
	const atkDirection = p.team == 1 ? 1 : -1
	if (atkDirection*receiverDuringPass.position.x < 0) {
		room.sendAnnouncement('own half')
		return  // receiver in his starting half during pass
	}
	const receiverPosNow = room.getPlayerDiscProperties(p.id)
	const enemies = game.positionsDuringPass
		.filter(pp => pp.team != kickTeam)
	const defenders = enemies
		.filter(pp => atkDirection*pp.position.x > atkDirection*receiverDuringPass.position.x)
	if (enemies.length < 1) {
		room.sendAnnouncement('not enough players in enemy team')
		return
	}
	if (defenders.length > 1) {
		room.sendAnnouncement('didnt cross last defenders offside line')
		return  // there was a defender
	}
	if (!game.inPlay) { return }
	if (atkDirection*receiverDuringPass.position.x < atkDirection*lt.x) {
		room.sendAnnouncement('ball was in front of receiver during pass')
		return
	}

	// its offside
	game.inPlay = false
	game.eventCounter += 1
	room.sendAnnouncement('offside')
	const osPlace = receiverDuringPass.position
	const allPosNow = room.getPlayerList().filter(p => p.team != 0)
	const ballNow = room.getBallPosition()

	// Rewind and show lines
	game.positionsDuringPass.forEach(p => room.setPlayerDiscProperties(p.id, {...p.position, xspeed: 0, yspeed: 0}))
	room.setDiscProperties(0, {x: lt.x, y: lt.y, xspeed: 0, yspeed: 0, ygravity: 0, xgravity: 0})
	let colorOffsideDiscs = offsideDiscs.red
	let colorLastDefDiscs = offsideDiscs.blue;
	if (lt.byPlayer.team == 2) {
		colorOffsideDiscs = offsideDiscs.blue
		colorLastDefDiscs = offsideDiscs.red;
	}

	const enemiesWithBall = [...enemies, { id: "ball", position: { x: lt.x, y: lt.y }}]

	const secondOsLine = enemiesWithBall.sort((a, b) => atkDirection*b.position.x-atkDirection*a.position.x)[1]

	const secondOsRadius = secondOsLine.id == "ball" ? defaults.ballRadius : defaults.playerRadius

	room.setDiscProperties(colorOffsideDiscs[0], { x: osPlace.x+atkDirection*(defaults.playerRadius+1), y: mapBounds.y+100 })
	room.setDiscProperties(colorOffsideDiscs[1], { x: osPlace.x+atkDirection*(defaults.playerRadius+1), y: -mapBounds.y-100 })

	room.setDiscProperties(colorLastDefDiscs[0], { x: secondOsLine.position.x+atkDirection*(secondOsRadius+1), y: mapBounds.y+100 })
	room.setDiscProperties(colorLastDefDiscs[1], { x: secondOsLine.position.x+atkDirection*(secondOsRadius+1), y: -mapBounds.y-100 })
	//await sleep(100)
	room.pauseGame(true)
	await sleep(10000)
	room.pauseGame(false)
	game.lastTouch = null
	await sleep(100)
	const toHide = [...colorOffsideDiscs, ...colorLastDefDiscs]
	toHide.forEach(dId => {
		room.setDiscProperties(dId, { x: mapBounds.x+300, y: mapBounds.y+300 })
	})
	allPosNow.forEach(p => room.setPlayerDiscProperties(p.id, p.position))
	room.setDiscProperties(0, ballNow)
	const freeKickForTeam = kickTeam == 1 ? 2 : 1
	freeKick(game, freeKickForTeam, osPlace)
}