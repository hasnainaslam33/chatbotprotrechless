import express from 'express';
import { moduleConfigs } from '../services/module-config.js';
import { getSettings } from '../services/settings.js';

const router = express.Router();

function withSettings(moduleKey, module, settings) {
  const saved = settings.modules?.[moduleKey] || {};
  return {
    ...module,
    enabled: saved.enabled !== false,
    title: saved.title || module.title,
    primaryCta: saved.primaryCta || module.primaryCta
  };
}

router.get('/', async (_req, res, next) => {
  try {
    const settings = await getSettings();
    res.json({
      settings: {
        aiEnabled: settings.aiEnabled,
        uploadsEnabled: settings.uploadsEnabled,
        leadsEnabled: settings.leadsEnabled,
        showChatWidget: settings.showChatWidget,
        businessPhone: settings.businessPhone,
        emergencyPhone: settings.emergencyPhone
      },
      modules: Object.fromEntries(Object.entries(moduleConfigs).map(([key, module]) => [key, withSettings(key, module, settings)]))
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:module', async (req, res, next) => {
  try {
    const module = moduleConfigs[req.params.module];
    if (!module) return res.status(404).json({ error: 'Module not found' });
    const settings = await getSettings();
    return res.json({
      settings: {
        aiEnabled: settings.aiEnabled,
        uploadsEnabled: settings.uploadsEnabled,
        leadsEnabled: settings.leadsEnabled,
        showChatWidget: settings.showChatWidget,
        businessPhone: settings.businessPhone,
        emergencyPhone: settings.emergencyPhone
      },
      module: withSettings(req.params.module, module, settings)
    });
  } catch (error) {
    next(error);
  }
});

export default router;
