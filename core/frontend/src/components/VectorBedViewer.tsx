import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Maximize2 } from "lucide-react";
import type { PrintableObject } from "../api/client";

export interface VectorBedViewerProps {
	objects: PrintableObject[];
	selectedObjectIds: number[] | Set<number>;
	onToggleObject: (objectId: number) => void;
	bboxAll?: [number, number, number, number] | null;
	bedSize?: [number, number] | null;
	className?: string;
	onEnlarge?: () => void;
}

/**
 * Standard Ray-Casting algorithm to check if point (x, y) is inside a 2D polygon.
 */
function isPointInPolygon(
	point: [number, number],
	polygon: [number, number][],
): boolean {
	const [x, y] = point;
	let inside = false;
	for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
		const [xi, yi] = polygon[i];
		const [xj, yj] = polygon[j];
		const intersect =
			yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
		if (intersect) inside = !inside;
	}
	return inside;
}

export function VectorBedViewer({
	objects,
	selectedObjectIds,
	onToggleObject,
	bboxAll,
	bedSize,
	className = "",
	onEnlarge,
}: VectorBedViewerProps) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const [hoveredObject, setHoveredObject] = useState<PrintableObject | null>(
		null,
	);

	const selectedSet = useMemo(() => {
		if (selectedObjectIds instanceof Set) return selectedObjectIds;
		return new Set(selectedObjectIds);
	}, [selectedObjectIds]);

	// Calculate bed bounds in mm coordinates (origin (0,0) at bottom-left in 3D printers)
	const bounds = useMemo(() => {
		if (bedSize && bedSize[0] > 0 && bedSize[1] > 0) {
			return {
				minX: 0,
				maxX: bedSize[0],
				minY: 0,
				maxY: bedSize[1],
			};
		}

		// Calculate from polygons or bboxAll
		let minX = bboxAll ? bboxAll[0] : Infinity;
		let minY = bboxAll ? bboxAll[1] : Infinity;
		let maxX = bboxAll ? bboxAll[2] : -Infinity;
		let maxY = bboxAll ? bboxAll[3] : -Infinity;

		for (const obj of objects) {
			if (obj.polygon && obj.polygon.length > 0) {
				for (const [x, y] of obj.polygon) {
					if (x < minX) minX = x;
					if (x > maxX) maxX = x;
					if (y < minY) minY = y;
					if (y > maxY) maxY = y;
				}
			}
		}

		if (minX !== Infinity && maxX !== -Infinity) {
			// Add a comfortable margin around objects (at least 20mm)
			const spanX = Math.max(maxX - minX, 50);
			const spanY = Math.max(maxY - minY, 50);
			const marginX = Math.max(spanX * 0.15, 20);
			const marginY = Math.max(spanY * 0.15, 20);

			// If minX/minY are close to 0, start from 0
			const finalMinX = minX < 30 ? 0 : Math.max(0, minX - marginX);
			const finalMinY = minY < 30 ? 0 : Math.max(0, minY - marginY);
			const finalMaxX = Math.max(maxX + marginX, 220);
			const finalMaxY = Math.max(maxY + marginY, 220);

			// Make it square or proportional
			const maxDim = Math.max(finalMaxX, finalMaxY);
			return {
				minX: finalMinX,
				maxX: maxDim,
				minY: finalMinY,
				maxY: maxDim,
			};
		}

		// Default fallback build plate: 250 x 250 mm (typical for Snapmaker U1 / Klipper beds)
		return { minX: 0, maxX: 250, minY: 0, maxY: 250 };
	}, [bedSize, objects, bboxAll]);

	// Convert 3D printer mm coordinates -> Canvas pixel coordinates
	const mmToCanvas = useCallback(
		(
			mmX: number,
			mmY: number,
			width: number,
			height: number,
			padding: number,
		) => {
			const usableW = width - padding * 2;
			const usableH = height - padding * 2;
			const rangeX = bounds.maxX - bounds.minX || 1;
			const rangeY = bounds.maxY - bounds.minY || 1;

			const px = padding + ((mmX - bounds.minX) / rangeX) * usableW;
			// Invert Y because canvas origin is top-left, printer origin is bottom-left
			const py =
				height -
				padding -
				((mmY - bounds.minY) / rangeY) * usableH;
			return [px, py];
		},
		[bounds],
	);

	// Convert Canvas pixel coordinates -> 3D printer mm coordinates
	const canvasToMm = useCallback(
		(
			px: number,
			py: number,
			width: number,
			height: number,
			padding: number,
		): [number, number] => {
			const usableW = width - padding * 2;
			const usableH = height - padding * 2;
			const rangeX = bounds.maxX - bounds.minX || 1;
			const rangeY = bounds.maxY - bounds.minY || 1;

			const mmX = bounds.minX + ((px - padding) / usableW) * rangeX;
			const mmY =
				bounds.minY +
				((height - padding - py) / usableH) * rangeY;
			return [mmX, mmY];
		},
		[bounds],
	);

	// Render vector canvas
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const rect = canvas.getBoundingClientRect();
		const dpr = window.devicePixelRatio || 1;
		const width = rect.width || 300;
		const height = rect.height || 300;

		canvas.width = width * dpr;
		canvas.height = height * dpr;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		ctx.save();
		ctx.scale(dpr, dpr);

		// 1. Draw Bed Background (dark textured plate style)
		ctx.fillStyle = "#16181d";
		ctx.fillRect(0, 0, width, height);

		const padding = 16;
		const usableW = width - padding * 2;
		const usableH = height - padding * 2;

		// 2. Draw Bed Outline and Grid lines
		ctx.strokeStyle = "#272a33";
		ctx.lineWidth = 1;
		ctx.strokeRect(padding, padding, usableW, usableH);

		// Grid step (every 50mm)
		const gridStepMm = 50;

		ctx.beginPath();
		ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
		ctx.lineWidth = 1;

		for (
			let gx = Math.ceil(bounds.minX / gridStepMm) * gridStepMm;
			gx < bounds.maxX;
			gx += gridStepMm
		) {
			const [x] = mmToCanvas(gx, bounds.minY, width, height, padding);
			ctx.moveTo(x, padding);
			ctx.lineTo(x, height - padding);
		}
		for (
			let gy = Math.ceil(bounds.minY / gridStepMm) * gridStepMm;
			gy < bounds.maxY;
			gy += gridStepMm
		) {
			const [, y] = mmToCanvas(bounds.minX, gy, width, height, padding);
			ctx.moveTo(padding, y);
			ctx.lineTo(width - padding, y);
		}
		ctx.stroke();

		// Origin label at bottom-left
		ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
		ctx.font = "9px system-ui, sans-serif";
		ctx.fillText(
			`${Math.round(bounds.maxX)}×${Math.round(bounds.maxY)}mm`,
			width - padding - 50,
			height - padding - 4,
		);
		ctx.fillText("0,0", padding + 4, height - padding - 4);

		// 3. Draw Objects (Polygons)
		for (const obj of objects) {
			if (!obj.polygon || obj.polygon.length < 3) continue;

			const isSelected = selectedSet.has(obj.id);
			const isHovered = hoveredObject?.id === obj.id;

			// Path
			ctx.beginPath();
			const [firstX, firstY] = mmToCanvas(
				obj.polygon[0][0],
				obj.polygon[0][1],
				width,
				height,
				padding,
			);
			ctx.moveTo(firstX, firstY);

			for (let i = 1; i < obj.polygon.length; i++) {
				const [px, py] = mmToCanvas(
					obj.polygon[i][0],
					obj.polygon[i][1],
					width,
					height,
					padding,
				);
				ctx.lineTo(px, py);
			}
			ctx.closePath();

			// Style according to state
			if (isSelected) {
				// Skipped (Red/orange striped style)
				ctx.fillStyle = isHovered
					? "rgba(239, 68, 68, 0.45)"
					: "rgba(239, 68, 68, 0.3)";
				ctx.fill();

				ctx.strokeStyle = "#ef4444";
				ctx.lineWidth = isHovered ? 2.5 : 1.5;
				ctx.stroke();
			} else if (isHovered) {
				// Hovered active object
				ctx.fillStyle = "rgba(56, 189, 248, 0.4)";
				ctx.fill();

				ctx.strokeStyle = "#38bdf8";
				ctx.lineWidth = 2;
				ctx.stroke();
			} else {
				// Normal printable object
				ctx.fillStyle = "rgba(100, 116, 139, 0.35)";
				ctx.fill();

				ctx.strokeStyle = "rgba(148, 163, 184, 0.7)";
				ctx.lineWidth = 1.2;
				ctx.stroke();
			}

			// 4. Calculate object center / badge position
			let cx = 0;
			let cy = 0;
			if (obj.center && obj.center.length >= 2) {
				[cx, cy] = mmToCanvas(
					obj.center[0],
					obj.center[1],
					width,
					height,
					padding,
				);
			} else {
				// Calculate centroid
				let sumX = 0;
				let sumY = 0;
				for (const [px, py] of obj.polygon) {
					sumX += px;
					sumY += py;
				}
				const avgMmX = sumX / obj.polygon.length;
				const avgMmY = sumY / obj.polygon.length;
				[cx, cy] = mmToCanvas(
					avgMmX,
					avgMmY,
					width,
					height,
					padding,
				);
			}

			// Badge circle
			ctx.beginPath();
			ctx.arc(cx, cy, 9, 0, Math.PI * 2);
			ctx.fillStyle = isSelected
				? "#dc2626"
				: isHovered
					? "#0284c7"
					: "#334155";
			ctx.fill();
			ctx.strokeStyle = isSelected ? "#fca5a5" : "#94a3b8";
			ctx.lineWidth = 1;
			ctx.stroke();

			// Badge text (ID or cross for skipped)
			ctx.fillStyle = "#ffffff";
			ctx.font = "bold 9px system-ui, sans-serif";
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.fillText(isSelected ? "✕" : String(obj.id), cx, cy);
		}

		ctx.restore();
	}, [bounds, mmToCanvas, objects, selectedSet, hoveredObject]);

	// Mouse move handler (hit testing)
	const handleMouseMove = useCallback(
		(event: React.MouseEvent<HTMLCanvasElement>) => {
			const canvas = canvasRef.current;
			if (!canvas) return;

			const rect = canvas.getBoundingClientRect();
			const px = event.clientX - rect.left;
			const py = event.clientY - rect.top;

			const padding = 16;
			const [mmX, mmY] = canvasToMm(
				px,
				py,
				rect.width,
				rect.height,
				padding,
			);

			// Test hit with objects
			let hitObj: PrintableObject | null = null;
			for (const obj of objects) {
				if (obj.polygon && obj.polygon.length >= 3) {
					if (isPointInPolygon([mmX, mmY], obj.polygon)) {
						hitObj = obj;
						break;
					}
				}
			}

			setHoveredObject(hitObj);
		},
		[canvasToMm, objects],
	);

	const handleMouseLeave = useCallback(() => {
		setHoveredObject(null);
	}, []);

	const handleClick = useCallback(
		(event: React.MouseEvent<HTMLCanvasElement>) => {
			const canvas = canvasRef.current;
			if (!canvas) return;

			const rect = canvas.getBoundingClientRect();
			const px = event.clientX - rect.left;
			const py = event.clientY - rect.top;
			const padding = 16;
			const [mmX, mmY] = canvasToMm(
				px,
				py,
				rect.width,
				rect.height,
				padding,
			);

			for (const obj of objects) {
				if (obj.polygon && obj.polygon.length >= 3) {
					if (isPointInPolygon([mmX, mmY], obj.polygon)) {
						onToggleObject(obj.id);
						break;
					}
				}
			}
		},
		[canvasToMm, objects, onToggleObject],
	);

	return (
		<div
			className={`relative aspect-square overflow-hidden rounded-lg border border-gray-300 bg-gray-950 dark:border-gray-700 ${className}`}
		>
			<canvas
				ref={canvasRef}
				onMouseMove={handleMouseMove}
				onMouseLeave={handleMouseLeave}
				onClick={handleClick}
				className={`w-full h-full block ${
					hoveredObject ? "cursor-pointer" : "cursor-crosshair"
				}`}
				aria-label="Vector Bed Preview"
			/>

			{/* Expand Button */}
			{onEnlarge && (
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						onEnlarge();
					}}
					className="absolute right-2 top-2 rounded bg-black/65 p-1.5 text-white/80 hover:text-white transition-colors"
					title="Expand"
				>
					<Maximize2 className="h-3.5 w-3.5" />
				</button>
			)}

			{/* Tooltip on Hover */}
			{hoveredObject && (
				<div className="pointer-events-none absolute bottom-2 left-2 right-2 rounded bg-gray-900/90 border border-gray-700/80 px-2.5 py-1 text-center shadow-md backdrop-blur-sm">
					<span className="text-[11px] font-semibold text-white truncate block">
						#{hoveredObject.id} {hoveredObject.name}
					</span>
					<span className="text-[10px] text-gray-400">
						{selectedSet.has(hoveredObject.id)
							? "Click to unskip"
							: "Click to skip this object"}
					</span>
				</div>
			)}
		</div>
	);
}
