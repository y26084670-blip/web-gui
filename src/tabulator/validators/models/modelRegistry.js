import { TABS } from "../../../services/schemas/common/constants.js";
import { generalValidator } from "./general/generalValidator.js";
import { conrabValidator } from "./conrab/conrabValidator.js";
import { elementsValidator } from "./elements/elementsValidator.js";
import { regionsValidator } from "./regions/regionsValidator.js";
import { ampsValidator } from "./amps/ampsValidator.js";
import { movesValidator } from "./moves/movesValidator.js";
import { mhjValidator } from "./mhj/mhjValidator.js";

export const modelRegistry = {
    [TABS.GENERAL.id]: generalValidator,
    [TABS.CONRAB.id]: conrabValidator,
    [TABS.ELEMENTS.id]: elementsValidator,
    [TABS.REGIONS.id]: regionsValidator,
    [TABS.AMPS.id]: ampsValidator,
    [TABS.MOVES.id]: movesValidator,
    [TABS.MHJ.id]: mhjValidator,
};