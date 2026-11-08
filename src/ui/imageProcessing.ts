import { imageDimensions } from "../domain";

export async function resizeImage(file: File): Promise<Blob> {
  const source = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = source;
    await image.decode();
    const size = imageDimensions(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Die Bildbearbeitung ist nicht verfügbar.");
    context.drawImage(image, 0, 0, size.width, size.height);
    const type = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) =>
          result
            ? resolve(result)
            : reject(new Error("Das Bild konnte nicht verarbeitet werden.")),
        type,
        0.88,
      );
    });
    return blob;
  } finally {
    URL.revokeObjectURL(source);
  }
}
