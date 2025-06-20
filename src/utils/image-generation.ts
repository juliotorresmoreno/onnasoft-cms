import sharp from 'sharp'

export class ImageGenerator {
  private readonly token = process.env.HF_TOKEN
  private readonly model = process.env.HF_IMAGE_MODEL || 'black-forest-labs/FLUX.1-schnell'
  private readonly endpoint = 'https://router.huggingface.co/together/v1/images/generations'

  async generate(
    prompt: string,
    width = 768,
    height = 576,
  ): Promise<{ image: Blob; thumbnail: Blob }> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: `${prompt}`,
        model: this.model,
        response_format: 'base64',
        width,
        height,
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to generate image: ${response.statusText}`)
    }

    const result = await response.json()
    const b64 = result?.data?.[0]?.b64_json

    if (!b64) {
      throw new Error('No image returned from API')
    }

    const jpegBuffer = Buffer.from(b64, 'base64')

    const webpBuffer = await sharp(jpegBuffer).toFormat('webp').toBuffer()
    const imageBlob = new Blob([webpBuffer], { type: 'image/webp' })

    const thumbnail = await this.createThumbnail(webpBuffer)

    return { image: imageBlob, thumbnail }
  }

  private async createThumbnail(imageBuffer: Buffer): Promise<Blob> {
    const thumbBuffer = await sharp(imageBuffer).resize({ width: 300 }).toFormat('webp').toBuffer()
    return new Blob([thumbBuffer], { type: 'image/webp' })
  }
}
