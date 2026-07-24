"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addStreamerToAgency = exports.createAgency = exports.getMyAgency = void 0;
const agency_model_1 = require("./agency.model");
const user_model_1 = require("../auth/user.model");
const getMyAgency = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const agency = await agency_model_1.Agency.findOne({ ownerId: req.user.id });
        res.status(200).json({ success: true, agency });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getMyAgency = getMyAgency;
const createAgency = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const { name } = req.body;
        const existing = await agency_model_1.Agency.findOne({ ownerId: req.user.id });
        if (existing) {
            res.status(400).json({ success: false, message: 'You already have an agency.' });
            return;
        }
        const user = await user_model_1.User.findById(req.user.id);
        const agency = await agency_model_1.Agency.create({
            name,
            ownerId: req.user.id,
            ownerUsername: user?.username,
        });
        await user_model_1.User.findByIdAndUpdate(req.user.id, { role: 'agency', agencyId: agency.id });
        res.status(201).json({ success: true, agency });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.createAgency = createAgency;
const addStreamerToAgency = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized.' });
            return;
        }
        const { streamerUsername } = req.body;
        const agency = await agency_model_1.Agency.findOne({ ownerId: req.user.id });
        if (!agency) {
            res.status(404).json({ success: false, message: 'Agency not found.' });
            return;
        }
        const streamer = await user_model_1.User.findOne({ username: streamerUsername });
        if (!streamer) {
            res.status(404).json({ success: false, message: 'Streamer not found.' });
            return;
        }
        if (!agency.streamerIds.includes(streamer.id)) {
            agency.streamerIds.push(streamer.id);
            await agency.save();
        }
        res.status(200).json({ success: true, agency });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.addStreamerToAgency = addStreamerToAgency;
