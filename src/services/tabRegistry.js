import generalSchema from "./schemas/general.schema";
import elementsSchema from "./schemas/elements.schema";
import regionsSchema from "./schemas/regions.schema";
import ampsSchema from "./schemas/amps.schema";
import movesSchema from "./schemas/moves.schema";
import mhjSchema from "./schemas/mhj.schema";
import conrabSchema from "./schemas/conrab.schema";
import { validateSchemaRegistry } from "./schemaFactory";

export const tabRegistry = [
    generalSchema,
    elementsSchema,
    regionsSchema,
    ampsSchema,
    movesSchema,
    mhjSchema,
    conrabSchema,
];

validateSchemaRegistry(tabRegistry);
