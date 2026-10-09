export type BBox = [number, number, number, number];

const DEFAULT_MIN_SIZE = 0.03;

export function normalizeManualCrop(
  bbox: BBox,
  pageWidth: number,
  pageHeight: number,
  minSize = DEFAULT_MIN_SIZE,
): BBox {
  if (
    !Number.isFinite(pageWidth) ||
    !Number.isFinite(pageHeight) ||
    pageWidth <= 0 ||
    pageHeight <= 0
  ) {
    throw new Error("Invalid page dimensions");
  }
  if (bbox.some((value) => !Number.isFinite(value))) {
    throw new Error("Crop coordinates must be finite");
  }
  if (bbox[0] >= bbox[2] || bbox[1] >= bbox[3]) {
    throw new Error("Crop coordinates must be ordered");
  }
  if (
    bbox[0] < 0 ||
    bbox[1] < 0 ||
    bbox[2] > pageWidth ||
    bbox[3] > pageHeight
  ) {
    throw new Error("Crop coordinates are outside page bounds");
  }
  return validateNormalizedCrop(
    [
      bbox[0] / pageWidth,
      bbox[1] / pageHeight,
      bbox[2] / pageWidth,
      bbox[3] / pageHeight,
    ],
    minSize,
  );
}

export function validateNormalizedCrop(
  bbox: BBox,
  minSize = DEFAULT_MIN_SIZE,
): BBox {
  if (bbox.some((value) => !Number.isFinite(value))) {
    throw new Error("Crop coordinates must be finite");
  }
  if (bbox[0] < 0 || bbox[1] < 0 || bbox[2] > 1 || bbox[3] > 1) {
    throw new Error("Crop coordinates are outside normalized bounds");
  }
  if (bbox[0] >= bbox[2] || bbox[1] >= bbox[3]) {
    throw new Error("Crop coordinates must be ordered");
  }
  if (bbox[2] - bbox[0] < minSize || bbox[3] - bbox[1] < minSize) {
    throw new Error("Crop is too small");
  }
  return bbox;
}

export function denormalizeCrop(
  bbox: BBox,
  pageWidth: number,
  pageHeight: number,
): BBox {
  validateNormalizedCrop(bbox);
  return [
    bbox[0] * pageWidth,
    bbox[1] * pageHeight,
    bbox[2] * pageWidth,
    bbox[3] * pageHeight,
  ];
}
