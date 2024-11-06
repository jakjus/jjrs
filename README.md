<h1 align="center">JJRS - Jakjus Real Soccer</h1>
<p>
  <a href="https://github.com/jakjus/hax-climb/blob/master/LICENSE" target="_blank">
    <img alt="License: MIT" src="https://img.shields.io/github/license/jakjus/hax-climb" />
  </a>
</p>

> Haxball Room Script for JJRS (Jakjus Real Soccer)

![Preview](./preview.png)

### 🚀 [Discord](https://discord.gg/dYk5UXs)

## Features
- [x] Real Soccer Map and Draft Map
- [x] Outs, Goal Kicks, Corners
- [x] Fouls, Yellow and Red cards
- [x] Free Kicks, Penalties
- [x] Natural outs and ball passes
- [x] Slide, Sprint, Superkick
- [x] ELO System (SQLite database)
- [x] Draft System - top ranked players choose their team
- [x] Fully automatic


## Prerequisites

- NPM
- NodeJS

## Install

```sh
git clone git@github.com:jakjus/jjrs.git
cd jjrs/
npm install
```

## Usage

Rename `config.example.ts` with `config.ts`. Insert **token** from https://haxball.com/headlesstoken into `config.ts`.

```ts
// config.ts

export default {
    roomName: `🌕   JJRS v1.0 by jakjus`,
    public: true,
    maxPlayers: 30,
    token: `YOUR_TOKEN_HERE`,
}
```

Run Server:
```sh
npm start
```

### How to play
Hold and release KICK to activate superpower. Release on correct emoji to activate chosen power.

- 👟 Slide/Superkick
  - [When not next to the ball] Slide: Slide in chosen direction.
  If you touch an enemy player, he will be fouled.
  - [When very close to the ball, but not touching the ball] Superkick:
    Kick the ball strongly and with rotation. The closer to the ball
  (but not touching it), the stronger the shot. Rotation and strength
  also depends on
  player movement.
- 💨 Sprint: Sprint in chosen direction
- 🩹 Call Foul: If you are fouled, you have short time to call foul by
holding KICK. If you do not use it, the game goes on (privilege of
benefit).


### Settings
Some script settings can be changed in `src/settings.ts`. Also, if you
change RS map physics, you should update settings values in
`src/settings.ts`.


## Author

👤 **Jakub Juszko**

* Website: https://jakjus.com
* Github: [@jakjus](https://github.com/jakjus)
* LinkedIn: [@jakubjuszko](https://linkedin.com/in/jakubjuszko)

## 🤝 Contributing

Contributions, issues and feature requests are welcome!<br />Feel free to check [issues page](https://github.com/jakjus/hax-climb/issues). 

## Show your support

Give a ⭐️ if this project helped you!

## 📝 License

Copyright © 2024 [Jakub Juszko](https://github.com/jakjus).<br />
This project is [MIT](https://github.com/jakjus/hax-climb/blob/master/LICENSE) licensed.

***
