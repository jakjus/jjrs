import HaxballJS from "haxball.js";
import roomBuilder from "./index";
import config from "./config";

HaxballJS.then(HBInit => roomBuilder(HBInit, {...config, noPlayer: true })) // noPlayer is required for team chooser to work correctly
