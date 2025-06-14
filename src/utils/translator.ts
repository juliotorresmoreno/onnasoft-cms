import OpenAI from 'openai'
import { ChatCompletionMessageParam } from 'openai/resources'

type Locale = 'es' | 'en' | 'fr' | 'ja' | 'zh'

const languageNames: Record<Locale, string> = {
  es: 'Spanish',
  en: 'English',
  fr: 'French',
  ja: 'Japanese',
  zh: 'Chinese',
}

export class Translator {
  private client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_API_URL || 'https://openrouter.ai/api/v1',
  })

  private model = process.env.OPENAI_API_MODEL || 'gpt-3.5-turbo'

  async translate(text: string, targetLang: Locale): Promise<string> {
    if (!text) return ''
    const messages: ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: `You are a translator. Translate everything to ${languageNames[targetLang]} with no explanations.`,
      },
      {
        role: 'user',
        content: text,
      },
    ]

    const res = await this.client.chat.completions.create({
      model: this.model,
      messages,
    })

    return res.choices?.[0]?.message?.content?.trim() || ''
  }
}
