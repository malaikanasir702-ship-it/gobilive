"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useTemplate = exports.createTemplate = exports.getTemplateById = exports.getTemplates = void 0;
const template_model_1 = require("./template.model");
// GET /api/templates
const getTemplates = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const category = req.query.category;
        const filter = { isActive: true };
        if (category && category !== 'for_you')
            filter.category = category;
        const skip = (page - 1) * limit;
        const [templates, total] = await Promise.all([
            template_model_1.Template.find(filter)
                .populate('soundId', 'title artist url coverUrl duration')
                .sort({ usageCount: -1, createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            template_model_1.Template.countDocuments(filter),
        ]);
        res.json({ success: true, templates, total, page, pages: Math.ceil(total / limit) });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.getTemplates = getTemplates;
// GET /api/templates/:id
const getTemplateById = async (req, res) => {
    try {
        const template = await template_model_1.Template.findById(req.params.id)
            .populate('soundId', 'title artist url coverUrl duration')
            .lean();
        if (!template)
            return res.status(404).json({ success: false, message: 'Template not found' });
        res.json({ success: true, template });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.getTemplateById = getTemplateById;
// POST /api/templates — admin only
const createTemplate = async (req, res) => {
    try {
        const template = await template_model_1.Template.create(req.body);
        res.status(201).json({ success: true, template });
    }
    catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};
exports.createTemplate = createTemplate;
// POST /api/templates/:id/use
const useTemplate = async (req, res) => {
    try {
        await template_model_1.Template.findByIdAndUpdate(req.params.id, { $inc: { usageCount: 1 } });
        res.json({ success: true });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.useTemplate = useTemplate;
