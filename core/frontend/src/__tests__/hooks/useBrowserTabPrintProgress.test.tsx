import { afterEach, describe, expect, it } from "vitest";
import { render, act } from "@testing-library/react";
import { useBrowserTabPrintProgress } from "../../hooks/useBrowserTabPrintProgress";

function Harness() {
	useBrowserTabPrintProgress();
	return null;
}

describe("useBrowserTabPrintProgress", () => {
	afterEach(() => {
		document.title = "3D Printer Platform";
	});

	it("shows the live print progress in the browser tab title", () => {
		render(<Harness />);

		act(() => {
			window.dispatchEvent(
				new CustomEvent("printbuddy-printer-status", {
					detail: {
						printer_id: 1,
						data: {
							progress: 42,
							remaining_time: 3600,
							state: "printing",
						},
					},
				}),
			);
		});

		expect(document.title).toBe("42% · 3D Printer Platform");
	});

	it("selects the active print finishing soonest when multiple printers are running", () => {
		render(<Harness />);

		act(() => {
			window.dispatchEvent(
				new CustomEvent("printbuddy-printer-status", {
					detail: {
						printer_id: 1,
						data: {
							progress: 80,
							remaining_time: 7200,
							state: "printing",
						},
					},
				}),
			);
			window.dispatchEvent(
				new CustomEvent("printbuddy-printer-status", {
					detail: {
						printer_id: 2,
						data: {
							progress: 35,
							remaining_time: 900,
							state: "printing",
						},
					},
				}),
			);
		});

		expect(document.title).toBe("35% · 3D Printer Platform");
	});

	it("resets the title when no printer is actively printing", () => {
		document.title = "42% · 3D Printer Platform";
		render(<Harness />);

		act(() => {
			window.dispatchEvent(
				new CustomEvent("printbuddy-printer-status", {
					detail: {
						printer_id: 1,
						data: {
							progress: 100,
							remaining_time: 0,
							state: "idle",
						},
					},
				}),
			);
		});

		expect(document.title).toBe("3D Printer Platform");
	});

	it("uses custom base title when provided", () => {
		function CustomHarness() {
			useBrowserTabPrintProgress({ baseTitle: "Bee 3D Farm" });
			return null;
		}
		render(<CustomHarness />);

		act(() => {
			window.dispatchEvent(
				new CustomEvent("printbuddy-printer-status", {
					detail: {
						printer_id: 1,
						data: {
							progress: 75,
							remaining_time: 1800,
							state: "printing",
						},
					},
				}),
			);
		});

		expect(document.title).toBe("75% · Bee 3D Farm");
	});
});
