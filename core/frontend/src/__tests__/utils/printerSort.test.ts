import { describe, it, expect } from "vitest";
import {
	isBambuPrinter,
	naturalCompare,
	defaultPrinterComparator,
	sortPrintersDefault,
	type PrinterLike,
} from "../../utils/printerSort";

describe("printerSort utility", () => {
	describe("isBambuPrinter", () => {
		it("returns true for bambu provider", () => {
			expect(isBambuPrinter({ provider: "bambu" })).toBe(true);
			expect(isBambuPrinter({ provider: "BAMBU" })).toBe(true);
		});

		it("returns true when provider is undefined or null", () => {
			expect(isBambuPrinter({})).toBe(true);
			expect(isBambuPrinter({ provider: null })).toBe(true);
			expect(isBambuPrinter({ provider: undefined })).toBe(true);
		});

		it("returns false for other providers", () => {
			expect(isBambuPrinter({ provider: "klipper" })).toBe(false);
			expect(isBambuPrinter({ provider: "elegoo_sdcp" })).toBe(false);
			expect(isBambuPrinter({ provider: "prusalink" })).toBe(false);
			expect(isBambuPrinter({ provider: "fluidd" })).toBe(false);
		});
	});

	describe("naturalCompare", () => {
		it("sorts numbers naturally", () => {
			const items = ["A1-10", "A1-2", "A1-1", "A1-20", "A1-3"];
			items.sort(naturalCompare);
			expect(items).toEqual(["A1-1", "A1-2", "A1-3", "A1-10", "A1-20"]);
		});
	});

	describe("defaultPrinterComparator and sortPrintersDefault", () => {
		it("sorts Bambu Lab printers before non-Bambu Lab printers", () => {
			const printers: PrinterLike[] = [
				{ id: 1, name: "Ender 3", provider: "klipper", model: "Ender" },
				{ id: 2, name: "A1-1", provider: "bambu", model: "A1" },
			];
			const sorted = sortPrintersDefault(printers);
			expect(sorted.map((p) => p.name)).toEqual(["A1-1", "Ender 3"]);
		});

		it("sorts by natural name with Bambu Lab first, non-Bambu Lab after", () => {
			// Exactly reproduces the user scenario: A1-4, A1-3, A1-2, A1-1, A1-5, X2D (Bambu) and U1 (Klipper)
			const printers: PrinterLike[] = [
				{ id: 1, name: "X2D", provider: "bambu", model: "X2D" },
				{ id: 2, name: "A1-4", provider: "bambu", model: "A1" },
				{ id: 3, name: "A1-3", provider: "bambu", model: "A1" },
				{
					id: 4,
					name: "U1",
					provider: "klipper",
					model: "Snapmaker U1",
				},
				{ id: 5, name: "A1-2", provider: "bambu", model: "A1" },
				{ id: 6, name: "A1-1", provider: "bambu", model: "A1" },
				{ id: 7, name: "A1-5", provider: "bambu", model: "A1" },
			];

			const sorted = sortPrintersDefault(printers);
			expect(sorted.map((p) => p.name)).toEqual([
				"A1-1",
				"A1-2",
				"A1-3",
				"A1-4",
				"A1-5",
				"X2D",
				"U1",
			]);
		});

		it("sorts by name naturally and breaks ties using model/ID", () => {
			const printers: PrinterLike[] = [
				{
					id: 1,
					name: "Printer A",
					provider: "bambu",
					model: "Model 2",
				},
				{
					id: 2,
					name: "Printer A",
					provider: "bambu",
					model: "Model 1",
				},
			];
			const sorted = sortPrintersDefault(printers);
			expect(sorted[0].model).toBe("Model 1");
			expect(sorted[1].model).toBe("Model 2");
		});

		it("breaks ties using ID", () => {
			const p1: PrinterLike = {
				id: 2,
				name: "Same",
				model: "A1",
				provider: "bambu",
			};
			const p2: PrinterLike = {
				id: 1,
				name: "Same",
				model: "A1",
				provider: "bambu",
			};
			expect(defaultPrinterComparator(p1, p2)).toBeGreaterThan(0);
			expect(defaultPrinterComparator(p2, p1)).toBeLessThan(0);
		});
	});
});
