export class ImageGenerator {
  private readonly token = process.env.HF_TOKEN
  private readonly model = process.env.HF_IMAGE_MODEL || 'black-forest-labs/FLUX.1-schnell'
  private readonly endpoint = 'https://router.huggingface.co/together/v1/images/generations'

  async generate(prompt: string): Promise<Blob> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        model: this.model,
        response_format: 'base64',
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

    const buffer = Buffer.from(b64, 'base64')
    return new Blob([buffer], { type: 'image/jpeg' })
  }
}
