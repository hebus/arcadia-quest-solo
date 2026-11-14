/** Lit un scan en data URL ; le réduit (900 px max) pour ménager le stockage local quand le navigateur le permet. */
export function readScan(file: File, maxSize = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Image illisible'));
    reader.onload = () => {
      const original = String(reader.result);
      const img = new Image();
      // Environnements sans décodage d'image : on garde le scan tel quel.
      const timer = setTimeout(() => resolve(original), 2000);
      img.onerror = () => {
        clearTimeout(timer);
        resolve(original);
      };
      img.onload = () => {
        clearTimeout(timer);
        try {
          const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
          if (scale >= 1) return resolve(original);
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } catch {
          resolve(original);
        }
      };
      img.src = original;
    };
    reader.readAsDataURL(file);
  });
}
