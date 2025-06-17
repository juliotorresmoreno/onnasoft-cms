import { pipeline } from '@xenova/transformers'

export class EmbeddingGenerator {
  private readonly extractorPromise = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')

  async generate(text: string): Promise<Float32Array> {
    const extractor = await this.extractorPromise
    const output = await extractor(text, {
      pooling: 'mean',
      normalize: true,
    })

    return new Float32Array(output.data)
  }
}
