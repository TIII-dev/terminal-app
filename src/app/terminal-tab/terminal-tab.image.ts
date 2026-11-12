export const readTabImage = async (file: File): Promise<string> => {
  if (
    !['image/svg+xml', 'image/jpeg', 'image/png'].includes(file.type) ||
    file.size === 0
  ) {
    throw new Error(
      'Unsupported icon - choose a nonempty SVG, JPG, or PNG image',
    );
  }
  const source = await new Promise<string>((resolve, reject): void => {
    const reader = new FileReader();
    reader.onerror = (): void =>
      reject(new Error('Could not read icon - select the image again'));
    reader.onload = (): void => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Could not read icon - select the image again'));
        return;
      }
      resolve(reader.result);
    };
    reader.readAsDataURL(file);
  });
  const image = new Image();
  image.src = source;
  try {
    await image.decode();
  } catch (error: unknown) {
    throw new Error('Invalid icon image - choose a valid SVG, JPG, or PNG', {
      cause: error,
    });
  }
  return source;
};
