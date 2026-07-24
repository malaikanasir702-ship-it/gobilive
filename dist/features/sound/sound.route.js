"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../core/middlewares/auth.middleware");
const sound_controller_1 = require("./sound.controller");
const router = (0, express_1.Router)();
router.get('/', auth_middleware_1.authenticateJWT, sound_controller_1.getSounds);
router.get('/:id', auth_middleware_1.authenticateJWT, sound_controller_1.getSoundById);
router.post('/', auth_middleware_1.authenticateJWT, sound_controller_1.createSound); // admin can seed sounds
router.post('/:id/use', auth_middleware_1.authenticateJWT, sound_controller_1.useSound);
exports.default = router;
