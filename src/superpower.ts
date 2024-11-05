import { toAug, room, players, PlayerAugmented, Game } from "../index"
import { sendMessage } from "./message"
import { freeKick, penalty } from "./out"
import { handleLastTouch } from "./offside"
import { defaults } from "./settings"
import { sleep } from "./utils"
import { isPenalty } from "./foul"

export const checkAllX = (game: Game) => {
	players.filter(p => p.team != 0)
	.forEach(pp => {
		const props = room.getPlayerDiscProperties(pp.id)
		if (!props) { return }
		// When X is PRESSED
		if (props.damping == 0.959) {
			pp.activation++
			if (new Date().getTime() < pp.canCallFoulUntil && pp.activation > 20) {
				sendMessage(`${pp.name} has called foul.`)
				if (isPenalty(pp)) {
					penalty(game, pp.team, {...pp.fouledAt})
					pp.activation = 0
					pp.canCallFoulUntil = 0
					return
				}
				freeKick(game, pp.team, pp.fouledAt)
				pp.activation = 0
				pp.canCallFoulUntil = 0
				return
			}
			if (pp.slowdown && (new Date().getTime() > pp.canCallFoulUntil)) {
				pp.activation = 0
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
			finKickOrSlide(game, pp)
		} else if (pp.activation >= 60 && pp.activation < 100) {
			pp.activation = 0
			if (pp.cooldownUntil > new Date().getTime()) {
				sendMessage(`Cooldown: ${Math.ceil((pp.cooldownUntil-new Date().getTime())/1000)}s.`, pp)
				pp.activation = 0
				room.setPlayerAvatar(pp.id, "🚫")
				setTimeout(() => room.setPlayerAvatar(pp.id, ""), 200)
				return
			}
			sprint(game, pp)
			room.setPlayerAvatar(pp.id, '💨')
			setTimeout(() => room.setPlayerAvatar(pp.id, ""), 700)
			pp.cooldownUntil = new Date().getTime()+18000
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
			xspeed: props.xspeed * 3.4, yspeed: props.yspeed * 3.4, xgravity: -props.xspeed * 0.026, ygravity: -props.yspeed * 0.026,
	});
	room.setPlayerAvatar(p.id, '👟');
	p.sliding = true;
	await sleep(700);
	p.sliding = false;
	p.slowdown = 0.13
	p.slowdownUntil = new Date().getTime()+1000*3.2
	room.setPlayerAvatar(p.id, "");
}

const finKickOrSlide = (game: Game, p: PlayerAugmented) => {
	if (p.slowdown) { return }
	if (game.animation) {
		room.setPlayerAvatar(p.id, "")
		return
	}
	const props = room.getPlayerDiscProperties(p.id)
	const ball = room.getDiscProperties(0)
	const dist = Math.sqrt((props.x-ball.x)**2+(props.y-ball.y)**2)
	const activationRange = 42
	const slideFromRange = 56
	setTimeout(() => room.setPlayerAvatar(p.id, ""), 700)
	if (dist > activationRange && dist < slideFromRange) {
		sendMessage('Too close to the ball to slide, too far to finesse kick.', p)
		return
	} else if (dist >= slideFromRange) {
		if (p.cooldownUntil > new Date().getTime()) {
			sendMessage(`Cooldown: ${Math.ceil((p.cooldownUntil-new Date().getTime())/1000)}s`, p)
			p.activation = 0
			room.setPlayerAvatar(p.id, "🚫")
			setTimeout(() => room.setPlayerAvatar(p.id, ""), 200)
			return
		}
		slide(game, p, props)
		p.cooldownUntil = new Date().getTime()+18000
		return
	}
	if (dist < defaults.ballRadius+defaults.playerRadius+1) {
		sendMessage('Too close to the ball.', p)
		return
	}
	room.setPlayerAvatar(p.id, "🎯");
	game.rotateNextKick = false
	room.setDiscProperties(0, { invMass: defaults.ballInvMass })

	const xx = ball.x-props.x
	const yy = ball.y-props.y
	const magnitude = Math.sqrt(xx**2+yy**2)
	const vecX = xx/magnitude
	const vecY = yy/magnitude
	const dir = {x: vecX, y: vecY}
	const totalXspeed = ((dir.x+props.xspeed*0.4)*(activationRange-dist)**0.2)*4.9
	const totalYspeed = ((dir.y+props.yspeed*0.4)*(activationRange-dist)**0.2)*4.9
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

