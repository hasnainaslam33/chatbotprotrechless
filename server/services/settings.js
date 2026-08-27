import fs from 'fs/promises';
import path from 'path';
import { config } from '../config.js';
import { moduleConfigs } from './module-config.js';

const settingsFile = path.join(config.dataDir, 'settings.json');

function moduleDefaults() {
  return Object.fromEntries(
    Object.entries(moduleConfigs).map(([key, value]) => [
      key,
      {
        enabled: true,
        title: value.title,
        primaryCta: value.primaryCta || ''
      }
    ])
  );
}

export function defaultSettings() {
  return {
    updatedAt: new Date().toISOString(),
    aiEnabled: true,
    uploadsEnabled: true,
    leadsEnabled: true,
    eventTrackingEnabled: true,
    requireLeadConsent: true,
    showChatWidget: true,
    businessName: config.businessName,
    businessPhone: config.businessPhone,
    mainSiteUrl: config.mainSiteUrl,
    aiSiteUrl: config.aiSiteUrl,
    emergencyPhone: config.businessPhone,
    dashboardNote: 'Review leads quickly, check uploaded files, and keep only active modules enabled.',
    modules: moduleDefaults()
  };
}

function booleanValue(value, fallback = true) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
  return fallback;
}

function cleanString(value, fallback = '', max = 500) {
  if (typeof value !== 'string') return fallback;
  return value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
}

function mergeSettings(saved = {}) {
  const defaults = defaultSettings();
  const modules = moduleDefaults();
  for (const [key, value] of Object.entries(saved.modules || {})) {
    if (!modules[key]) continue;
    modules[key] = {
      ...modules[key],
      enabled: booleanValue(value.enabled, true),
      title: cleanString(value.title, modules[key].title, 160) || modules[key].title,
      primaryCta: cleanString(value.primaryCta, modules[key].primaryCta, 220) || modules[key].primaryCta
    };
  }

  return {
    ...defaults,
    ...saved,
    aiEnabled: booleanValue(saved.aiEnabled, defaults.aiEnabled),
    uploadsEnabled: booleanValue(saved.uploadsEnabled, defaults.uploadsEnabled),
    leadsEnabled: booleanValue(saved.leadsEnabled, defaults.leadsEnabled),
    eventTrackingEnabled: booleanValue(saved.eventTrackingEnabled, defaults.eventTrackingEnabled),
    requireLeadConsent: booleanValue(saved.requireLeadConsent, defaults.requireLeadConsent),
    showChatWidget: booleanValue(saved.showChatWidget, defaults.showChatWidget),
    businessName: cleanString(saved.businessName, defaults.businessName, 180),
    businessPhone: cleanString(saved.businessPhone, defaults.businessPhone, 80),
    mainSiteUrl: cleanString(saved.mainSiteUrl, defaults.mainSiteUrl, 300),
    aiSiteUrl: cleanString(saved.aiSiteUrl, defaults.aiSiteUrl, 300),
    emergencyPhone: cleanString(saved.emergencyPhone, defaults.emergencyPhone, 80),
    dashboardNote: cleanString(saved.dashboardNote, defaults.dashboardNote, 800),
    modules
  };
}

export async function getSettings() {
  await fs.mkdir(config.dataDir, { recursive: true });
  try {
    const raw = await fs.readFile(settingsFile, 'utf8');
    return mergeSettings(JSON.parse(raw));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const initial = defaultSettings();
    await saveSettings(initial);
    return initial;
  }
}

export async function saveSettings(nextSettings) {
  await fs.mkdir(config.dataDir, { recursive: true });
  const settings = mergeSettings({ ...nextSettings, updatedAt: new Date().toISOString() });
  await fs.writeFile(settingsFile, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
  return settings;
}

export async function updateSettings(patch = {}) {
  const current = await getSettings();
  const merged = mergeSettings({ ...current, ...patch, modules: { ...current.modules, ...(patch.modules || {}) } });
  return saveSettings(merged);
}

export async function isModuleEnabled(moduleKey = '') {
  const settings = await getSettings();
  if (!moduleKey || moduleKey === 'home' || moduleKey === 'general') return true;
  return settings.modules[moduleKey]?.enabled !== false;
}

export function publicSettings(settings) {
  const safe = mergeSettings(settings);
  return {
    aiEnabled: safe.aiEnabled,
    uploadsEnabled: safe.uploadsEnabled,
    leadsEnabled: safe.leadsEnabled,
    eventTrackingEnabled: safe.eventTrackingEnabled,
    showChatWidget: safe.showChatWidget,
    businessName: safe.businessName,
    businessPhone: safe.businessPhone,
    mainSiteUrl: safe.mainSiteUrl,
    aiSiteUrl: safe.aiSiteUrl,
    emergencyPhone: safe.emergencyPhone,
    modules: Object.fromEntries(
      Object.entries(safe.modules).map(([key, value]) => [key, { enabled: value.enabled, title: value.title, primaryCta: value.primaryCta }])
    )
  };
}
