"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlatformSettings = void 0;
exports.getPlatformSettings = getPlatformSettings;
const mongoose_1 = require("mongoose");
const PlatformSettingsSchema = new mongoose_1.Schema({
    diamondToRcoinRate: { type: Number, default: 10 },
    minWithdrawRcoins: { type: Number, default: 100 },
    minConvertDiamonds: { type: Number, default: 10 },
    minLevelToGoLive: { type: Number, default: 1 },
    dailyLoginDiamonds: { type: Number, default: 25 },
    referralBonusDiamonds: { type: Number, default: 100 },
    videoCallRcoinCost: { type: Number, default: 5 },
    // Bean economy defaults
    beanDollarRateUsd: { type: Number, default: 10 },
    beanDollarRateBeans: { type: Number, default: 100000 },
    diamondToBeanCommission: { type: Number, default: 80 },
    diamondToBeanRate: { type: Number, default: 10 },
}, { timestamps: true });
exports.PlatformSettings = (0, mongoose_1.model)('PlatformSettings', PlatformSettingsSchema);
async function getPlatformSettings() {
    let settings = await exports.PlatformSettings.findOne();
    if (!settings) {
        settings = await exports.PlatformSettings.create({});
    }
    return settings;
}
