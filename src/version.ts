import packageInfo from '../package.json' with { type: 'json' };

export const GAME_VERSION = packageInfo.version;
