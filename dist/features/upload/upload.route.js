"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../core/middlewares/auth.middleware");
const upload_middleware_1 = require("./upload.middleware");
const upload_controller_1 = require("./upload.controller");
const router = (0, express_1.Router)();
router.post('/media', auth_middleware_1.authenticateJWT, upload_middleware_1.uploadMedia.single('file'), upload_controller_1.uploadFile);
exports.default = router;
