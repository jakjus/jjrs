import { toAug, room, players, PlayerAugmented, Game } from "../index"
import { freeKick } from "./out"
import { handleLastTouch } from "./offside"
import { defaults } from "./settings"
import { sleep } from "./utils"

export const checkAllX = (game: Game) => {
	players.filter(p => p.team != 0)
	.forEach(pp => {
		const props = room.getPlayerDiscProperties(pp.id)
		// When X is PRESSED
		if (props.damping == 0.959) {
			pp.activation++
			if (new Date().getTime() < pp.canCallFoulUntil && pp.activation > 20) {
				room.sendAnnouncement('calling foul')
				freeKick(game, pp.team, pp.fouledAt)
				pp.activation = 0
				return
			}
			if (pp.slowdown) {
				return
			}
			if (pp.activation > 20 && pp.activation < 60) {
				room.setPlayerAvatar(pp.id, '👟')
			} else if (pp.activation >= 60 && pp.activation < 100) {
				room.setPlayerAvatar(pp.id, '💨')
			} else if (pp.activation >= 100) {
				room.setPlayerAvatar(pp.id, "")
			}
		// When X is RELEASED
		} else if (pp.activation > 20 && pp.activation < 60) {
			pp.activation = 0
			room.sendAnnouncement('slide/kick')
			finKickOrSlide(game, pp)
		} else if (pp.activation >= 60 && pp.activation < 100) {
			pp.activation = 0
			room.sendAnnouncement('sprint')
			sprint(game, pp)
			room.setPlayerAvatar(pp.id, '🏃')
			setTimeout(() => room.setPlayerAvatar(pp.id, ""), 700)
		} else {
			pp.activation = 0
		}
	})
}

export const sprint = (game: Game, p: PlayerAugmented) => {
	if (p.slowdown) { return }
	const props = room.getPlayerDiscProperties(p.id)
	const magnitude = Math.sqrt(props.xspeed**2+props.yspeed**2)
	const vecX = props.xspeed/magnitude
	const vecY = props.yspeed/magnitude
	room.setPlayerDiscProperties(p.id, { xgravity: vecX*0.08, ygravity: vecY*0.08 })
	setTimeout(() => room.setPlayerDiscProperties(p.id, { xgravity: 0, ygravity: 0 }), 900)
}

const slide = async (game: Game, p: PlayerAugmented, props: DiscPropertiesObject) => {
	room.setPlayerDiscProperties(p.id, {
			xspeed: props.xspeed * 3.1, yspeed: props.yspeed * 3.1, xgravity: -props.xspeed * 0.026, ygravity: -props.yspeed * 0.026,
	});
	room.setPlayerAvatar(p.id, '👟');
	p.sliding = true;
	await sleep(700);
	p.sliding = false;
	p.slowdown = 0.13
	p.slowdownUntil = new Date().getTime()+1000*3.4
	room.setPlayerAvatar(p.id, "");
}

const finKickOrSlide = (game: Game, p: PlayerAugmented) => {
	if (game.animation) { return }
	if (p.slowdown) { return }
	const props = room.getPlayerDiscProperties(p.id)
	const ball = room.getDiscProperties(0)
	const dist = Math.sqrt((props.x-ball.x)**2+(props.y-ball.y)**2)
	const activationRange = 42
	const slideFromRange = 56
	setTimeout(() => room.setPlayerAvatar(p.id, ""), 700)
	if (dist > activationRange && dist < slideFromRange) {
		room.sendAnnouncement('too far from the ball')
		return
	} else if (dist >= slideFromRange) {
		slide(game, p, props)
		return
	}
	if (dist < defaults.ballRadius+defaults.playerRadius+1) {
		room.sendAnnouncement('too close to the ball')
		return
	}
	room.setPlayerAvatar(p.id, "🎯");

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
}

