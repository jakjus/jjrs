import HaxballJS from "haxball.js";
import roomBuilder from "./index";
import config from "./config";

HaxballJS.then(HBInit => roomBuilder(HBInit, config))
