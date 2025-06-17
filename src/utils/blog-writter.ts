import OpenAI from 'openai'
import { ChatCompletionMessageParam } from 'openai/resources'
import { franc } from 'franc'

type Locale = 'es' | 'en' | 'fr' | 'ja' | 'zh'

const languageNames: Record<Locale, string> = {
  es: 'Spanish',
  en: 'English',
  fr: 'French',
  ja: 'Japanese',
  zh: 'Chinese',
}

const isoToLocale: Record<string, Locale> = {
  spa: 'es',
  eng: 'en',
  fra: 'fr',
  jpn: 'ja',
  zho: 'zh',
}

export class BlogWriter {
  private readonly client = new OpenAI({
    apiKey: process.env.BLOGWRITER_OPENAI_API_KEY,
    baseURL: process.env.BLOGWRITER_OPENAI_API_URL || 'https://openrouter.ai/api/v1',
  })

  private readonly model = process.env.BLOGWRITER_OPENAI_API_MODEL || 'gpt-4'

  async write(title: string, excerpt: string, content: string): Promise<Record<Locale, string>> {
    if (!title || !content) return { es: '', en: '', fr: '', ja: '', zh: '' }

    console.log(`[BlogWriter] Generating Markdown article for: ${title}`)
    const article = await this.generateMarkdownArticle(title, excerpt, content)
    console.log(`[BlogWriter] Article generated.`)

    const translations: Record<Locale, string> = {
      es: '',
      en: '',
      fr: '',
      ja: '',
      zh: '',
    }

    const langCode = franc(article)
    const mainLocale = isoToLocale[langCode]
    if (mainLocale) {
      translations[mainLocale] = article
    }

    console.log(`[BlogWriter] Detected language: ${mainLocale}`)

    const otherLocales = (Object.keys(languageNames) as Locale[]).filter((l) => l !== mainLocale)

    await Promise.all(
      otherLocales.map(async (locale) => {
        console.log(`[BlogWriter] Translating to ${languageNames[locale]}...`)
        translations[locale] = await this.translate(article, locale)
        console.log(`[BlogWriter] ${languageNames[locale]} translation done.`)
      }),
    )

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
        content: `You are a technical writer. Write a long-form article in Markdown format (but not about Markdown itself). 
        Use headings (#), subheadings (##), and deep technical content. Do not explain Markdown syntax. Do not include meta 
        comments—just the article content. Format all code blocks using triple backticks with the appropriate language 
        tag (e.g., \`\`\`js, \`\`\`python). 
        The article must be at least 3000 words long.`,
      },
      {
        role: 'user',
        content: `Title: ${title}\n\nReference content: ${content}\n\nSuggested focus: "${excerpt}"`,
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
