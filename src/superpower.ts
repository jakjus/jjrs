import { toAug, room, players, PlayerAugmented, Game } from "../index"
import { handleLastTouch } from "./offside"
import { defaults } from "./settings"

export const checkAllX = (game: Game) => {
	players.filter(p => p.team != 0)
	.forEach(pp => {
		const props = room.getPlayerDiscProperties(pp.id)
		// When X is PRESSED
		if (props.damping == 0.959) {
			pp.activation++
			if (pp.activation > 30 && pp.activation < 60) {
				room.setPlayerAvatar(pp.id, 'sk')
			} else if (pp.activation >= 60 && pp.activation < 120) {
				room.setPlayerAvatar(pp.id, 'sp')
			} else if (pp.activation >= 120) {
				room.setPlayerAvatar(pp.id, "")
			}
		// When X is RELEASED
		} else if (pp.activation > 10 && pp.activation < 60) {
			pp.activation = 0
			room.sendAnnouncement('slide/kick')
			finKick(game, pp)
			room.setPlayerAvatar(pp.id, "")
		} else if (pp.activation >= 60 && pp.activation < 120) {
			pp.activation = 0
			room.sendAnnouncement('sprint')
			sprint(game, pp)
			room.setPlayerAvatar(pp.id, '')
		} else {
			pp.activation = 0
		}
	})
}

export const sprint = (game: Game, p: PlayerAugmented) => {
	const props = room.getPlayerDiscProperties(p.id)
	const magnitude = Math.sqrt(props.xspeed**2+props.yspeed**2)
	const vecX = props.xspeed/magnitude
	const vecY = props.yspeed/magnitude
	room.setPlayerDiscProperties(p.id, { xgravity: vecX*0.08, ygravity: vecY*0.08 })
	setTimeout(() => room.setPlayerDiscProperties(p.id, { xgravity: 0, ygravity: 0 }), 800)
}

const finKick = (game: Game, p: PlayerAugmented) => {
	if (game.animation) { return }
	const props = room.getPlayerDiscProperties(p.id)
	const ball = room.getDiscProperties(0)
	const dist = Math.sqrt((props.x-ball.x)**2+(props.y-ball.y)**2)
	const activationRange = 42
	if (dist > activationRange) {
		room.sendAnnouncement('too far from the ball')
		return
	}
	if (dist < defaults.ballRadius+defaults.playerRadius+1) {
		room.sendAnnouncement('too close to the ball')
		return
	}

	const xx = ball.x-props.x
	const yy = ball.y-props.y
	const magnitude = Math.sqrt(xx**2+yy**2)
	const vecX = xx/magnitude
	const vecY = yy/magnitude
	const dir = {x: vecX, y: vecY}
	const totalXspeed = ((dir.x+props.xspeed*0.4)*(activationRange-dist)**0.2)*4
	const totalYspeed = ((dir.y+props.yspeed*0.4)*(activationRange-dist)**0.2)*4
	room.setDiscProperties(0, {
		xspeed: totalXspeed,
		yspeed: totalYspeed
	})

	const spMagnitude = Math.sqrt(props.xspeed**2+props.yspeed**2)
	const vecXsp = props.xspeed/spMagnitude
	const vecYsp = props.yspeed/spMagnitude

	game.ballRotation = { x: -vecXsp, y: -vecYsp, power: spMagnitude*(activationRange-dist)**0.2*6}
	handleLastTouch(game, p)
}

export const rotateBall = (game: Game) => {
	if (game.ballRotation.power < 0.1) {
		game.ballRotation.power = 0
		room.setDiscProperties(0, {
			xgravity: 0,
			ygravity: 0,
		})

		return
	}
	room.setDiscProperties(0, {
		xgravity: 0.01*game.ballRotation.x*game.ballRotation.power,
		ygravity: 0.01*game.ballRotation.y*game.ballRotation.power,
	})
	game.ballRotation.power *= 0.96
	console.log(game.ballRotation)
}



