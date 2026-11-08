import {
	createContext,
	useContext,
	useEffect,
	useState,
	type ReactNode,
} from "react";
import { api } from "../api/client";
import { appAssetPath } from "../utils/assetPaths";

type ThemeMode = "light" | "dark" | "system";
type ThemeStyle = "classic" | "glow" | "vibrant";
type DarkBackground = "neutral" | "warm" | "cool" | "oled" | "slate" | "forest";
type LightBackground = "neutral" | "warm" | "cool";
type ThemeAccent = "green" | "teal" | "blue" | "orange" | "purple" | "red";

interface ThemeContextType {
	mode: ThemeMode;
	resolvedMode: "light" | "dark";
	// Dark mode settings
	darkStyle: ThemeStyle;
	darkBackground: DarkBackground;
	darkAccent: ThemeAccent;
	// Light mode settings
	lightStyle: ThemeStyle;
	lightBackground: LightBackground;
	lightAccent: ThemeAccent;
	// Show live print progress (% + accent-coloured ring favicon) in the browser tab
	progressInTitle: boolean;
	setProgressInTitle: (v: boolean) => void;
	tabDisplay: 'percentage' | 'time';
	setTabDisplay: (v: 'percentage' | 'time') => void;
	// Actions
	toggleMode: () => void;
	setMode: (mode: ThemeMode) => void;
	setDarkStyle: (style: ThemeStyle) => void;
	setDarkBackground: (background: DarkBackground) => void;
	setDarkAccent: (accent: ThemeAccent) => void;
	setLightStyle: (style: ThemeStyle) => void;
	setLightBackground: (background: LightBackground) => void;
	setLightAccent: (accent: ThemeAccent) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const BRAND_ICONS = {
	light: {
		favicon16: "/img/favicon-16x16.png",
		favicon32: "/img/favicon-32x32.png",
		appleTouchIcon: "/img/apple-touch-icon.png",
		startupImage: "/img/android-chrome-512x512.png",
	},
	dark: {
		favicon16: "/img/favicon-16x16-dark.png",
		favicon32: "/img/favicon-32x32-dark.png",
		appleTouchIcon: "/img/apple-touch-icon-dark.png",
		startupImage: "/img/android-chrome-512x512-dark.png",
	},
} satisfies Record<"light" | "dark", Record<string, string>>;

function updateOrCreateLink(
	selector: string,
	attributes: Record<string, string>,
) {
	const existing = document.head.querySelector<HTMLLinkElement>(selector);
	const link = existing ?? document.createElement("link");

	Object.entries(attributes).forEach(([key, value]) =>
		link.setAttribute(key, value),
	);

	if (!existing) {
		document.head.appendChild(link);
	}
}

function applyBrandIcons(mode: ThemeMode) {
	if (
		typeof document !== "undefined" &&
		document.head.querySelector('link[data-farm-avatar="true"]')
	) {
		return;
	}
	const resolved =
		mode === "system"
			? typeof window !== "undefined" &&
				window.matchMedia("(prefers-color-scheme: dark)").matches
				? "dark"
				: "light"
			: mode;
	const icons = BRAND_ICONS[resolved] || BRAND_ICONS.dark;
	if (!icons) return;

	updateOrCreateLink('link[rel="icon"][sizes="16x16"]', {
		rel: "icon",
		type: "image/png",
		sizes: "16x16",
		href: appAssetPath(icons.favicon16),
	});
	updateOrCreateLink('link[rel="icon"][sizes="32x32"]', {
		rel: "icon",
		type: "image/png",
		sizes: "32x32",
		href: appAssetPath(icons.favicon32),
	});
	updateOrCreateLink('link[rel="apple-touch-icon"]', {
		rel: "apple-touch-icon",
		sizes: "180x180",
		href: appAssetPath(icons.appleTouchIcon),
	});
	updateOrCreateLink('link[rel="apple-touch-startup-image"]', {
		rel: "apple-touch-startup-image",
		href: appAssetPath(icons.startupImage),
	});
}

export function ThemeProvider({ children }: { children: ReactNode }) {
	// Mode
	const [mode, setModeState] = useState<ThemeMode>(() => {
		const stored = localStorage.getItem("theme-mode") as ThemeMode | null;
		const legacy = localStorage.getItem("theme") as ThemeMode | null;
		return stored || legacy || "dark";
	});

	// System preference detection
	const [systemPreference, setSystemPreference] = useState<"light" | "dark">(
		() => {
			return typeof window !== "undefined" &&
				window.matchMedia &&
				window.matchMedia("(prefers-color-scheme: dark)")?.matches
				? "dark"
				: "light";
		},
	);

	useEffect(() => {
		if (typeof window === "undefined" || !window.matchMedia) return;
		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
		if (!mediaQuery?.addEventListener) return;
		const handler = (e: MediaQueryListEvent) => {
			setSystemPreference(e.matches ? "dark" : "light");
		};
		mediaQuery.addEventListener("change", handler);
		return () => mediaQuery.removeEventListener("change", handler);
	}, []);

	// Resolved mode: what's actually applied (always 'light' or 'dark')
	const resolvedMode: "light" | "dark" =
		mode === "system" ? systemPreference : mode;

	// Dark mode settings
	const [darkStyle, setDarkStyleState] = useState<ThemeStyle>(() => {
		return (localStorage.getItem("dark-style") as ThemeStyle) || "vibrant";
	});
	const [darkBackground, setDarkBackgroundState] = useState<DarkBackground>(
		() => {
			return (
				(localStorage.getItem("dark-background") as DarkBackground) ||
				"cool"
			);
		},
	);
	const [darkAccent, setDarkAccentState] = useState<ThemeAccent>(() => {
		return (localStorage.getItem("dark-accent") as ThemeAccent) || "teal";
	});

	// Light mode settings
	const [lightStyle, setLightStyleState] = useState<ThemeStyle>(() => {
		return (localStorage.getItem("light-style") as ThemeStyle) || "classic";
	});
	const [lightBackground, setLightBackgroundState] =
		useState<LightBackground>(() => {
			return (
				(localStorage.getItem("light-background") as LightBackground) ||
				"neutral"
			);
		});
	const [lightAccent, setLightAccentState] = useState<ThemeAccent>(() => {
		return (localStorage.getItem("light-accent") as ThemeAccent) || "teal";
	});

	// Client-only pref (localStorage), no api.updateSettings sync
	const [progressInTitle, setProgressInTitleState] = useState<boolean>(() => {
		return localStorage.getItem("progress-in-title") === "true";
	});
	const setProgressInTitle = (v: boolean) => {
		setProgressInTitleState(v);
		localStorage.setItem("progress-in-title", String(v));
	};

	const [tabDisplay, setTabDisplayState] = useState<'percentage' | 'time'>(() => {
		return localStorage.getItem("tab-display") === "time" ? "time" : "percentage";
	});
	const setTabDisplay = (v: 'percentage' | 'time') => {
		setTabDisplayState(v);
		localStorage.setItem("tab-display", v);
	};

	// Sync from API on mount
	useEffect(() => {
		api.getSettings()
			.then((settings) => {
				// Dark settings
				if (settings.dark_style) {
					setDarkStyleState(settings.dark_style as ThemeStyle);
					localStorage.setItem("dark-style", settings.dark_style);
				}
				if (settings.dark_background) {
					setDarkBackgroundState(
						settings.dark_background as DarkBackground,
					);
					localStorage.setItem(
						"dark-background",
						settings.dark_background,
					);
				}
				if (settings.dark_accent) {
					setDarkAccentState(settings.dark_accent as ThemeAccent);
					localStorage.setItem("dark-accent", settings.dark_accent);
				}
				// Light settings
				if (settings.light_style) {
					setLightStyleState(settings.light_style as ThemeStyle);
					localStorage.setItem("light-style", settings.light_style);
				}
				if (settings.light_background) {
					setLightBackgroundState(
						settings.light_background as LightBackground,
					);
					localStorage.setItem(
						"light-background",
						settings.light_background,
					);
				}
				if (settings.light_accent) {
					setLightAccentState(settings.light_accent as ThemeAccent);
					localStorage.setItem("light-accent", settings.light_accent);
				}
			})
			.catch(() => {});
	}, []);

	// Apply theme classes based on current mode
	useEffect(() => {
		const root = document.documentElement;

		// Remove all theme classes
		root.classList.remove(
			"dark",
			"style-classic",
			"style-glow",
			"style-vibrant",
			"bg-neutral",
			"bg-warm",
			"bg-cool",
			"bg-oled",
			"bg-slate",
			"bg-forest",
			"accent-green",
			"accent-teal",
			"accent-blue",
			"accent-orange",
			"accent-purple",
			"accent-red",
		);

		// Apply based on resolved mode
		if (resolvedMode === "dark") {
			root.classList.add("dark");
			root.classList.add(`style-${darkStyle}`);
			root.classList.add(`bg-${darkBackground}`);
			root.classList.add(`accent-${darkAccent}`);
		} else {
			root.classList.add(`style-${lightStyle}`);
			root.classList.add(`bg-${lightBackground}`);
			root.classList.add(`accent-${lightAccent}`);
		}

		applyBrandIcons(resolvedMode);
		localStorage.setItem("theme-mode", mode);
		localStorage.removeItem("theme");
	}, [
		mode,
		resolvedMode,
		darkStyle,
		darkBackground,
		darkAccent,
		lightStyle,
		lightBackground,
		lightAccent,
	]);

	const toggleMode = () =>
		setModeState((prev) => {
			if (prev === "dark") return "light";
			if (prev === "light") return "system";
			return "dark";
		});
	const setMode = (m: ThemeMode) => setModeState(m);

	// Dark setters
	const setDarkStyle = (v: ThemeStyle) => {
		setDarkStyleState(v);
		localStorage.setItem("dark-style", v);
		api.updateSettings({ dark_style: v }).catch(() => {});
	};
	const setDarkBackground = (v: DarkBackground) => {
		setDarkBackgroundState(v);
		localStorage.setItem("dark-background", v);
		api.updateSettings({ dark_background: v }).catch(() => {});
	};
	const setDarkAccent = (v: ThemeAccent) => {
		setDarkAccentState(v);
		localStorage.setItem("dark-accent", v);
		api.updateSettings({ dark_accent: v }).catch(() => {});
	};

	// Light setters
	const setLightStyle = (v: ThemeStyle) => {
		setLightStyleState(v);
		localStorage.setItem("light-style", v);
		api.updateSettings({ light_style: v }).catch(() => {});
	};
	const setLightBackground = (v: LightBackground) => {
		setLightBackgroundState(v);
		localStorage.setItem("light-background", v);
		api.updateSettings({ light_background: v }).catch(() => {});
	};
	const setLightAccent = (v: ThemeAccent) => {
		setLightAccentState(v);
		localStorage.setItem("light-accent", v);
		api.updateSettings({ light_accent: v }).catch(() => {});
	};

	return (
		<ThemeContext.Provider
			value={{
				mode,
				resolvedMode,
				darkStyle,
				darkBackground,
				darkAccent,
				lightStyle,
				lightBackground,
				lightAccent,
				progressInTitle,
				setProgressInTitle,
				tabDisplay,
				setTabDisplay,
				toggleMode,
				setMode,
				setDarkStyle,
				setDarkBackground,
				setDarkAccent,
				setLightStyle,
				setLightBackground,
				setLightAccent,
			}}
		>
			{children}
		</ThemeContext.Provider>
	);
}

export function useTheme() {
	const context = useContext(ThemeContext);
	if (!context) throw new Error("useTheme must be used within ThemeProvider");
	return context;
}

export type {
	ThemeMode,
	ThemeStyle,
	DarkBackground,
	LightBackground,
	ThemeAccent,
};
