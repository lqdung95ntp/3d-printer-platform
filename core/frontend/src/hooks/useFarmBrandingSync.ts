import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { appAssetPath } from '../utils/assetPaths';

export function useFarmBrandingSync() {
  const { data: uiPreferences, isSuccess } = useQuery({
    queryKey: ['ui-preferences'],
    queryFn: api.getUiPreferences,
    staleTime: 5 * 60 * 1000,
  });

  const farmName = uiPreferences?.farm_name?.trim() || '';
  const farmAvatar = uiPreferences?.farm_avatar?.trim() || '';

  useEffect(() => {
    if (typeof document === 'undefined') return;

    // 1. Sync title if not actively showing print progress
    if (farmName) {
      if (!document.title || !/^\d+% · /.test(document.title)) {
        document.title = farmName;
      }
    }

    // 2. Sync mobile web app titles
    const title = farmName || 'Printbuddy';

    let appleMeta = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
    if (!appleMeta) {
      appleMeta = document.createElement('meta');
      appleMeta.name = 'apple-mobile-web-app-title';
      document.head.appendChild(appleMeta);
    }
    appleMeta.content = title;

    let appNameMeta = document.querySelector<HTMLMetaElement>('meta[name="application-name"]');
    if (!appNameMeta) {
      appNameMeta = document.createElement('meta');
      appNameMeta.name = 'application-name';
      document.head.appendChild(appNameMeta);
    }
    appNameMeta.content = title;

    // 3. Sync touch icons and favicons
    if (farmAvatar) {
      const avatarUrl = appAssetPath(farmAvatar);

      // Apple touch icon (sizes="180x180" or generic)
      const touchIcons = document.querySelectorAll<HTMLLinkElement>('link[rel="apple-touch-icon"]');
      if (touchIcons.length > 0) {
        touchIcons.forEach((link) => {
          link.href = avatarUrl;
          link.dataset.farmAvatar = 'true';
        });
      } else {
        const link = document.createElement('link');
        link.rel = 'apple-touch-icon';
        link.sizes = '180x180';
        link.href = avatarUrl;
        link.dataset.farmAvatar = 'true';
        document.head.appendChild(link);
      }

      // Apple startup image
      let startup = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-startup-image"]');
      if (!startup) {
        startup = document.createElement('link');
        startup.rel = 'apple-touch-startup-image';
        document.head.appendChild(startup);
      }
      startup.href = avatarUrl;
      startup.dataset.farmAvatar = 'true';

      // Standard and shortcut favicons
      const favicons = document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"]');
      if (favicons.length > 0) {
        favicons.forEach((link) => {
          if (!link.href.startsWith('data:image/svg+xml')) {
            link.href = avatarUrl;
          }
          link.dataset.farmAvatar = 'true';
        });
      } else {
        const link = document.createElement('link');
        link.rel = 'icon';
        link.type = 'image/png';
        link.href = avatarUrl;
        link.dataset.farmAvatar = 'true';
        document.head.appendChild(link);
      }
    } else if (isSuccess) {
      // Clear farm avatar marker so ThemeContext can restore defaults if needed
      const farmLinks = document.querySelectorAll<HTMLLinkElement>('link[data-farm-avatar="true"]');
      farmLinks.forEach((link) => {
        delete link.dataset.farmAvatar;
      });
    }
  }, [farmName, farmAvatar, isSuccess]);
}
