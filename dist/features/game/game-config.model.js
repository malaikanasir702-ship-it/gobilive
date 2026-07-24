"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameConfig = void 0;
const mongoose_1 = require("mongoose");
const GameConfigSchema = new mongoose_1.Schema({
    gameId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    meta: { type: mongoose_1.Schema.Types.Mixed },
}, { timestamps: true });
exports.GameConfig = (0, mongoose_1.model)('GameConfig', GameConfigSchema);
