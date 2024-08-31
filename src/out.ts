import { room, Game } from '../index';
import { mapBounds, goals, defaults, colors } from './settings';
import { sleep } from './utils'


export const handleBallOutOfBounds = async (game: Game) => {
	if (!game.inPlay) { return }
	const ballPos = room.getBallPosition()
	// LEFT BORDER, but not in GOAL
	if (ballPos.x < mapBounds.x[0] && ballPos.y < goals.y[0] && ballPos.y > goals.y[1]) {
		if (game.lastTouch?.byPlayer.team == 1) {
			if (ballPos.y > 0) {
				cornerKick(game, 2, { x: mapBounds.x[0], y: mapBounds.y[0] })
			} else {
				cornerKick(game, 2, { x: mapBounds.x[0], y: mapBounds.y[1] })
			}
	// LEFT BORDER, in GOAL
		} else if (game.lastTouch?.byPlayer.team == 2) {
			goalKick(game, 1, { x: mapBounds.x[0] + 100, y: 0 })
		}
	}
	// RIGHT BORDER, but not in GOAL
	else if (ballPos.x > mapBounds.x[1] && ballPos.y < goals.y[0] && ballPos.y > goals.y[1]) {
		if (game.lastTouch?.byPlayer.team == 1) {
			if (ballPos.y > 0) {
				cornerKick(game, 1, { x: mapBounds.x[1], y: mapBounds.y[0] })
			} else {
				cornerKick(game, 1, { x: mapBounds.x[0], y: mapBounds.y[1] })
			}
	// RIGHT BORDER, in GOAL
		} else if (game.lastTouch?.byPlayer.team == 2) {
			goalKick(game, 2, { x: mapBounds.x[1] - 100, y: 0 })
		}
	}
	// UPPER BORDER
	else if (ballPos.y > mapBounds.y[1]) {
		if (game.lastTouch?.byPlayer.team == 1) {
			throwIn(game, 2, {x: ballPos.x, y: mapBounds.y[1]})
		} else if (game.lastTouch?.byPlayer.team == 2) {
			throwIn(game, 1, {x: ballPos.x, y: mapBounds.y[1]})
		}
	}
	// LOWER BORDER
	else if (ballPos.y < mapBounds.y[0]) {
		if (game.lastTouch?.byPlayer.team == 1) {
			throwIn(game, 2, {x: ballPos.x, y: mapBounds.y[0]})
		} else if (game.lastTouch?.byPlayer.team == 2) {
			throwIn(game, 1, {x: ballPos.x, y: mapBounds.y[0]})
		}
	}
}

const cornerKick = (game: Game, forTeam: TeamID, pos: {x: number, y: number}) => {
	console.log(`corner for ${forTeam}`)
	// colorBall(forTeam, )
	game.inPlay = false
	room.setDiscProperties(0, {...pos, xspeed: 0, yspeed: 0, invMass: 0.0001})
}

const goalKick = (game: Game, forTeam: TeamID, pos: {x: number, y: number}) => {
	console.log(`goalkick for ${forTeam}`)
	room.setDiscProperties(0, {...pos, xspeed: 0, yspeed: 0, invMass: 0.0001})
	game.inPlay = false
}

const throwIn = async (game: Game, forTeam: TeamID, pos: {x: number, y: number}) => {
	console.log(`throwin for ${forTeam}`)
	game.inPlay = false
	if (forTeam == 1) {
		if (pos.y < 0) {
			// show top red line
			room.setDiscProperties(17, {x: 1149});
			// hide top blue line
			room.setDiscProperties(19, {x: -1149});
		} else {
			// show bottom red line
			room.setDiscProperties(21, {x: 1149});
			// hide bottom blue line
			room.setDiscProperties(23, {x: -1149});
		}
	} else {
		if (pos.y < 0) {
			// show top blue line
			room.setDiscProperties(19, {x: 1149});
			// hide top red line
			room.setDiscProperties(17, {x: -1149});
		} else {
			// show bottom blue line
			room.setDiscProperties(23, {x: 1149});
			// hide bottom red line
			room.setDiscProperties(21, {x: -1149});
		}

	}
	room.getPlayerList().filter(p => p.team != 0).forEach(p => {
		if (p.team == forTeam) {
			room.setPlayerDiscProperties(p.id, {cGroup: 2})
		} else {
			// Collide with Plane
			room.setPlayerDiscProperties(p.id, {cGroup: 536870918})
			// Move back from the line
			if (p.position.y < -460 && pos.y < 0) {
				room.setPlayerDiscProperties(p.id, {y: -440});
			} else if (p.position.y > 460 && pos.y > 0) {
				room.setPlayerDiscProperties(p.id, {y: 440});
			}
		}
})
	room.setDiscProperties(0, {...pos, xspeed: 0, yspeed: 0})

	// Blink if not played
	for (let i=0; i<110; i++) {
		if (game.inPlay) { return }
		const blinkColor = forTeam == 1 ? colors.red : colors.blue
		if (i > 100) {
			const newForTeam = forTeam == 1 ? 2 : 1
			throwIn(game, newForTeam, pos)
			return
		}
		if (i > 70) {
			if (Math.floor(i/4)%2 == 0) {
				room.setDiscProperties(0, {color: blinkColor})
			} else {
				room.setDiscProperties(0, {color: colors.white })
			}
		}
		await sleep(100)
	}
}

export const handleBallInPlay = (game: Game) => {
	const props = room.getDiscProperties(0)
	if (Math.abs(props.xspeed) > 0.1 || Math.abs(props.yspeed) > 0.1) {
		room.sendAnnouncement('game inPlay')
		room.getPlayerList().forEach(p => room.setPlayerDiscProperties(p.id, { invMass: defaults.invMass }))
		game.inPlay = true
		room.setDiscProperties(0, { color: colors.white })
		clearThrowInBlocks()
	}
}

export const clearThrowInBlocks = () => {
	room.getPlayerList().filter(p => p.team != 0).forEach(p => {
		if (p.team == 1) {
			room.setPlayerDiscProperties(p.id, {cGroup: 2})
		} else if (p.team == 2) {
			room.setPlayerDiscProperties(p.id, {cGroup: 4})
		}
	})
	room.setDiscProperties(17, {x: -1149});
	room.setDiscProperties(19, {x: -1149});
	room.setDiscProperties(21, {x: -1149});
	room.setDiscProperties(23, {x: -1149});
}
