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

export class BlogWriter {
  private readonly client = new OpenAI({
    apiKey: process.env.BLOGWRITER_OPENAI_API_KEY,
    baseURL: process.env.BLOGWRITER_OPENAI_API_URL || 'https://openrouter.ai/api/v1',
  })

  private readonly model = process.env.BLOGWRITER_OPENAI_API_MODEL || 'gpt-4'

  async write(title: string, excerpt: string, content: string): Promise<Record<Locale, string>> {
    if (!title || !content) return { es: '', en: '', fr: '', ja: '', zh: '' }

    const article = await this.generateMarkdownArticle(title, excerpt, content)
    const translations: Record<Locale, string> = { es: article, en: '', fr: '', ja: '', zh: '' }

    for (const locale of ['en', 'fr', 'ja', 'zh'] as Locale[]) {
      translations[locale] = await this.translate(article, locale)
    }

    return translations
  }

  private async generateMarkdownArticle(
    title: string,
    excerpt: string,
    content: string,
  ): Promise<string> {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content:
          'Eres un redactor experto en tecnología. Escribe artículos extensos en formato Markdown (no JSON ni richText). Usa títulos (#) y subtítulos (##), con párrafos largos, profundidad técnica y al menos 1200 palabras. No expliques ni agregues encabezados innecesarios. Solo escribe el artículo en Markdown.',
      },
      {
        role: 'user',
        content: `Título: ${title}\n\nContenido base: ${content}\n\nEnfoque sugerido: "${excerpt}"`,
      },
    ]

    const res = await this.client.chat.completions.create({
      model: this.model,
      messages,
    })

    return res.choices?.[0]?.message?.content?.trim() || ''
  }

  private async translate(markdown: string, targetLang: Locale): Promise<string> {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: `You are a translator. Translate the following Markdown content to ${languageNames[targetLang]}. Do not alter the formatting.`,
      },
      {
        role: 'user',
        content: markdown,
      },
    ]

    const res = await this.client.chat.completions.create({
      model: this.model,
      messages,
    })

    return res.choices?.[0]?.message?.content?.trim() || ''
  }
}
