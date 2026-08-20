import next from 'eslint-config-next/core-web-vitals';
import base from '@nebula/config/eslint/next';

// eslint-config-next 16 ya exporta flat config, sin necesidad de FlatCompat.
const config = [...base, ...next];

export default config;
